import unittest
from datetime import datetime,timezone,timedelta
from unittest.mock import patch
from doobr.auth import Denied
from doobr.courier_journey import read_journey
T='00000000-0000-4000-8000-000000000101'
O='00000000-0000-4000-8000-000000000102'
C='00000000-0000-4000-8000-000000000103'
OTHER='00000000-0000-4000-8000-000000000104'
NOW=datetime(2026,10,11,tzinfo=timezone.utc)
class Cursor:
 def __init__(self,order,offer,assigned):self.results=[order,offer,(1,) if assigned else None];self.queries=[]
 def __enter__(self):return self
 def __exit__(self,*a):pass
 def execute(self,sql,params=None):self.queries.append((sql,params))
 def fetchone(self):return self.results.pop(0)
class DB:
 def __init__(self,order,offer,assigned):self.cur=Cursor(order,offer,assigned)
 def __enter__(self):return self
 def __exit__(self,*a):pass
 def transaction(self):return self
 def cursor(self):return self.cur
class TestJourney(unittest.TestCase):
 def read(self,order=('ASSIGNED',),offer=('ACCEPTED',NOW+timedelta(minutes=10)),assigned=True,actor=C):
  db=DB(order,offer,assigned)
  with patch('doobr.courier_journey.authorize',return_value=type('Session',(),{'actor_id':actor})()) as auth:
   result=read_journey(connect=lambda:db,issuer=None,store=None,token='signed',tenant_id=T,order_id=O,at=NOW)
   self.assertEqual(auth.call_args.kwargs['permission'].resource,'order:'+O)
  return result,db
 def test_assigned_no_private_information(self):
  result,db=self.read()
  self.assertEqual(result.offer_state,'ACCEPTED')
  self.assertEqual(result.proof_of_delivery,'NOT_DISCLOSED')
  self.assertNotIn('lat',repr(result).lower())
  self.assertTrue(any('TRANSACTION READ ONLY' in q[0] for q in db.cur.queries))
  self.assertTrue(all('UPDATE ' not in q[0] and 'INSERT ' not in q[0] for q in db.cur.queries))
  self.assertEqual(db.cur.queries[3][1],(T,O,C))
 def test_unowned_order_denied(self):
  with self.assertRaises(Denied):self.read(offer=None,assigned=False)
 def test_expired_offer_denied(self):
  with self.assertRaises(Denied):self.read(offer=('OFFERED',NOW-timedelta(seconds=1)),assigned=False)
 def test_active_offer_read(self):
  result,_=self.read(order=('OFFERED',),offer=('OFFERED',NOW+timedelta(minutes=1)),assigned=False)
  self.assertEqual(result.offer_state,'OFFERED')
 def test_invalid_order(self):
  with self.assertRaises(Denied):
   read_journey(connect=None,issuer=None,store=None,token='x',tenant_id=T,order_id='other',at=NOW)
 def test_revoked_identity(self):
  with patch('doobr.courier_journey.authorize',side_effect=Denied('revoked')):
   with self.assertRaises(Denied):read_journey(connect=None,issuer=None,store=None,token='x',tenant_id=T,order_id=O,at=NOW)
if __name__=='__main__':unittest.main()
