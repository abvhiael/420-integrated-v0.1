import unittest
from datetime import datetime,timedelta,timezone
from doobr.auth import Denied
from doobr.mobile_offline import OfflineQueue,MAX_ITEMS
T="00000000-0000-4000-8000-000000000101"
D="00000000-0000-4000-8000-000000000102"
NOW=datetime(2026,10,12,tzinfo=timezone.utc)
class Authority:
 def __init__(self,allow=True):self.allow=allow
 def verify_device(self,**kwargs):return self.allow
class OfflineTests(unittest.TestCase):
 def queue(self):return OfflineQueue(tenant_id=T,device_id=D)
 def add(self,q,n=1,at=NOW):
  return q.enqueue(command_id=f"00000000-0000-4000-8000-{n:012d}",kind="REFRESH_STATUS",opaque_ref="opaque0001",at=at)
 def test_reconnect_ignores_stale(self):
  q=self.queue();self.add(q,1);self.add(q,2,at=NOW-timedelta(minutes=6))
  ready=q.reconnect(issuer=Authority(),at=NOW)
  self.assertEqual(len(ready),1);self.assertEqual(q.items,[])
 def test_replay_and_sensitive_commands_denied(self):
  q=self.queue();self.add(q)
  with self.assertRaises(Denied):self.add(q)
  for kind in ("SEND_GPS","DELIVER","PAY","SIGN_CUSTODY","REDEEM","",None):
   with self.assertRaises(Denied):q.enqueue(command_id=D,kind=kind,opaque_ref="opaque0001",at=NOW)
  with self.assertRaises(Denied):q.enqueue(command_id=D,kind="REFRESH_STATUS",opaque_ref="private address",at=NOW)
 def test_revocation_and_location_denial_erase(self):
  for operation in ("revoke","location_permission_failed"):
   q=self.queue();self.add(q);getattr(q,operation)()
   self.assertEqual(q.items,[])
   with self.assertRaises(Denied):self.add(q,2)
   with self.assertRaises(Denied):q.reconnect(issuer=Authority(),at=NOW)
 def test_offline_authentication_failure_discards(self):
  for issuer in (Authority(False),None):
   q=self.queue();self.add(q)
   with self.assertRaises(Denied):q.reconnect(issuer=issuer,at=NOW)
   self.assertEqual(q.items,[])
 def test_bound_and_future_timestamp(self):
  q=self.queue()
  for i in range(1,MAX_ITEMS+1):self.add(q,i)
  with self.assertRaises(Denied):self.add(q,MAX_ITEMS+1)
  self.assertEqual(len(q.reconnect(issuer=Authority(),at=NOW)),MAX_ITEMS)
  self.add(q,50,at=NOW+timedelta(seconds=10))
  self.assertEqual(q.reconnect(issuer=Authority(),at=NOW),[])
if __name__=="__main__":unittest.main()
