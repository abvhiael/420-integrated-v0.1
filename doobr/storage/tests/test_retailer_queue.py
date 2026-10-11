import unittest
from datetime import datetime,timezone
from unittest.mock import patch
from doobr.auth import Denied
from doobr.retailer_queue import read_retailer_order
T="00000000-0000-4000-8000-000000000101"
R="00000000-0000-4000-8000-000000000102"
O="00000000-0000-4000-8000-000000000103"
OTHER="00000000-0000-4000-8000-000000000104"
NOW=datetime(2026,10,11,tzinfo=timezone.utc)
class Cursor:
 def __init__(self,row):self.row=row;self.queries=[]
 def __enter__(self):return self
 def __exit__(self,*args):pass
 def execute(self,sql,params=None):self.queries.append((sql,params))
 def fetchone(self):return self.row
class DB:
 def __init__(self,row):self.cur=Cursor(row)
 def __enter__(self):return self
 def __exit__(self,*args):pass
 def transaction(self):return self
 def cursor(self):return self.cur
class TestRetailerQueue(unittest.TestCase):
 def read(self,row=(R,"RETAILER_READY",4),actor=R):
  db=DB(row)
  with patch("doobr.retailer_queue.authorize",return_value=type("Session",(),{"actor_id":actor})()) as authorize:
   result=read_retailer_order(connect=lambda:db,issuer=None,store=None,token="signed",tenant_id=T,
     retailer_id=R,order_id=O,at=NOW)
   self.assertEqual(authorize.call_args.kwargs["permission"].role,"RETAILER")
   self.assertEqual(authorize.call_args.kwargs["permission"].resource,"order:"+O)
  return result,db
 def test_authorized_read_only(self):
  view,db=self.read()
  self.assertEqual((view.state,view.dispatch,view.exception),("RETAILER_READY","OPERATOR_CONTROLLED","NONE"))
  self.assertEqual(db.cur.queries[-1][1],(T,O,R))
  self.assertTrue(any("TRANSACTION READ ONLY" in q[0] for q in db.cur.queries))
  self.assertFalse(any("INSERT INTO" in q[0] or "UPDATE doobr" in q[0] for q in db.cur.queries))
 def test_exception_no_self_approval(self):
  for state in ("DELIVERY_FAILED","RETURN_REQUIRED","DISPUTED"):
   v,_=self.read((R,state,7))
   self.assertEqual(v.exception,"ESCALATION_REQUIRED")
   self.assertEqual(v.intake,"VERIFIED_ADMISSION_REQUIRED")
 def test_cross_retailer_denied(self):
  for row,actor in [((OTHER,"RETAILER_READY",2),R),(None,R),((R,"RETAILER_READY",2),OTHER)]:
   with self.assertRaises(Denied):self.read(row,actor)
 def test_stale_or_invalid_record_denied(self):
  for row in ((R,"UNKNOWN",1),(R,"RETAILER_READY",0),(R,"RETAILER_READY",True)):
   with self.assertRaises(Denied):self.read(row)
 def test_revocation_denied(self):
  with patch("doobr.retailer_queue.authorize",side_effect=Denied("revoked")):
   with self.assertRaises(Denied):read_retailer_order(connect=None,issuer=None,store=None,token="signed",
    tenant_id=T,retailer_id=R,order_id=O,at=NOW)
 def test_invalid_identifier_denied(self):
  with self.assertRaises(Denied):read_retailer_order(connect=None,issuer=None,store=None,token="signed",
    tenant_id="invalid",retailer_id=R,order_id=O,at=NOW)
if __name__=="__main__":unittest.main()
