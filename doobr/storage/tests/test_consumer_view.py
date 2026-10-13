import unittest
from datetime import datetime,timedelta,timezone
from types import SimpleNamespace
from doobr.consumer_view import read_own_order
from doobr.auth import Denied,Session,Grant,VerifiedPrincipal
T='00000000-0000-4000-8000-000000000101'
O='00000000-0000-4000-8000-000000000102'
A='00000000-0000-4000-8000-000000000103'
NOW=datetime(2026,10,11,tzinfo=timezone.utc)
class Issuer:
 def verify(self,token,now):return VerifiedPrincipal("issuer","subject","doobr-api","jti",NOW+timedelta(hours=1))
 def is_revoked(self,*args):return False
class Store:
 def __init__(self,owner=A,revoked=False,wallet=False):self.owner,self.revoked,self.wallet=owner,revoked,wallet
 def resolve(self,subject,token,tenant):
  return Session(tenant,self.owner,subject,"issuer",token,NOW+timedelta(hours=1),self.revoked,
                 NOW+timedelta(minutes=10) if self.wallet else None)
 def grants(self,tenant,actor):return [Grant("CONSUMER","order:"+O,NOW+timedelta(hours=1),False)]
class Cursor:
 def __init__(self,row):self.row=row;self.commands=[]
 def __enter__(self):return self
 def __exit__(self,*args):pass
 def execute(self,sql,params=None):self.commands.append((sql,params))
 def fetchone(self):return self.row
class DB:
 def __init__(self,row):self.cursor_obj=Cursor(row)
 def __enter__(self):return self
 def __exit__(self,*args):pass
 def transaction(self):return self
 def cursor(self):return self.cursor_obj
class Tests(unittest.TestCase):
 def check(self,row,store=None,order=O,tenant=T):
  db=DB(row)
  v=read_own_order(connect=lambda:db,identity_issuer=Issuer(),session_store=store or Store(),
    signed_token="signed-fixture",tenant_id=tenant,order_id=order,at=NOW)
  return v,db
 def test_owned_read_and_no_fabricated_receipt(self):
  v,db=self.check((A,"IN_TRANSIT",3),Store(wallet=True))
  self.assertEqual((v.order_id,v.state,v.revision,v.receipt_status,v.wallet_consent_active),(O,"IN_TRANSIT",3,"NOT_VERIFIED",True))
  self.assertTrue(any("SET TRANSACTION READ ONLY" in x[0] for x in db.cursor_obj.commands))
  self.assertTrue(all("INSERT " not in x[0] and "UPDATE " not in x[0] for x in db.cursor_obj.commands))
 def test_no_wallet_consent_is_not_age_authority(self):
  v,_=self.check((A,"DRAFT",1))
  self.assertFalse(v.wallet_consent_active)
  self.assertEqual(v.receipt_status,"NOT_VERIFIED")
 def test_cross_owner_not_found_and_revoked(self):
  for row,store in [((T,"DRAFT",1),Store()),(None,Store()),((A,"DRAFT",1),Store(revoked=True))]:
   with self.assertRaises(Denied):self.check(row,store)
 def test_invalid_identifiers_denied(self):
  for order,tenant in [("../other",T),(O,"bad"),("",T)]:
   with self.assertRaises(Denied):self.check((A,"DRAFT",1),order=order,tenant=tenant)
if __name__=="__main__":unittest.main()
