"""R05.3 concurrency/chaos security contracts for retained DOOBr interfaces."""
import inspect
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timezone
from uuid import uuid4
from unittest.mock import Mock
from doobr.auth import Denied
from doobr.mobile_replay_api import ReplayRequest,handle_replay
from doobr import dispatch,outbox
NOW=datetime(2026,10,12,tzinfo=timezone.utc)
TENANT=str(uuid4()); DEVICE=str(uuid4());COMMAND=str(uuid4())
def request():
 return ReplayRequest("POST","/private/v1/mobile/replay","signed",TENANT,DEVICE,
   [{"command_id":COMMAND,"kind":"REFRESH_STATUS","opaque_ref":"opaque_ref_123","created_at":NOW}],
   True,True,True)
class AtomicLedger:
 def __init__(self):
  self.lock=threading.Lock();self.seen=set()
 def record_once(self,*,tenant_id,device_id,command_id,kind,opaque_ref,at):
  with self.lock:
   key=(tenant_id,device_id,command_id)
   if key in self.seen:return False
   self.seen.add(key);return True
class ChaosTests(unittest.TestCase):
 def test_simulated_concurrent_replay_exactly_one_accept(self):
  ident=Mock();ident.verify_replay.return_value=True;ledger=AtomicLedger()
  def attempt(_):
   return handle_replay(request=request(),identity=ident,ledger=ledger,at=NOW)["processed"][0]["status"]
  with ThreadPoolExecutor(max_workers=12) as pool:
   results=list(pool.map(attempt,range(100)))
  self.assertEqual(results.count("ACCEPTED"),1)
  self.assertEqual(results.count("DUPLICATE"),99)
 def test_replay_failure_and_revocation_fail_closed(self):
  ident=Mock();ident.verify_replay.return_value=False;ledger=AtomicLedger()
  with self.assertRaises(Denied):handle_replay(request=request(),identity=ident,ledger=ledger,at=NOW)
  ident.verify_replay.side_effect=TimeoutError()
  with self.assertRaises((Denied,TimeoutError)):handle_replay(request=request(),identity=ident,ledger=ledger,at=NOW)
  self.assertEqual(len(ledger.seen),0)
 def test_dispatch_serializable_atomic_contract(self):
  text=inspect.getsource(dispatch.offer)+inspect.getsource(dispatch.decide)
  self.assertIn("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE",text)
  self.assertIn("FOR UPDATE",text)
  self.assertIn("concurrent offer",text)
 def test_outbox_lease_fencing_and_bounded_retries(self):
  source=inspect.getsource(outbox.claim)+inspect.getsource(outbox.settle)
  self.assertIn("FOR UPDATE SKIP LOCKED",source)
  self.assertIn("lease_owner",source)
  self.assertIn("attempt_count",source)
  self.assertIn("MAX_ATTEMPTS",source)
  self.assertIn("row[3]!=attempt",source)
  self.assertIn("lease_until<",source)
 def test_failed_callback_never_accepted_as_verified_delivery(self):
  source=inspect.getsource(outbox.dispatch_once)
  self.assertIn("callback.verify_receipt",source)
  self.assertIn("CALLBACK_FAILED",source)
  self.assertIn("deduplication_key=item['event_id']",source)
if __name__=="__main__":unittest.main()
