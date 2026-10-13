"""R02.6 state-machine security and pre-DB denial regression."""
import unittest
from datetime import datetime, timezone, timedelta
from doobr.auth import Denied
from doobr.order_commands import EDGES,run_command,command_digest
N=datetime(2026,10,10,tzinfo=timezone.utc)
T="00000000-0000-4000-8000-000000001101"
O="00000000-0000-4000-8000-000000001106"
C="00000000-0000-4000-8000-000000001108"
class NoDB:
 def __call__(self):raise AssertionError("invalid input must not touch DB")
class Tests(unittest.TestCase):
 def defaults(self,**kw):
  data=dict(connect=NoDB(),identity_issuer=None,session_store=None,signed_token="signed",
   tenant_id=T,order_id=O,command_id=C,action="CANCEL",expected_revision=1,
   evidence_ref="approval:evidence",evidence_authority=None,at=N)
  data.update(kw);return data
 def test_invalid_inputs_rejected_before_database(self):
  for bad in (dict(action="PAY"),dict(expected_revision=0),dict(expected_revision=True),
    dict(evidence_ref=""),dict(command_id="evil"),dict(tenant_id="evil"),
    dict(at=N.replace(tzinfo=None))):
   with self.subTest(bad=bad),self.assertRaises(Denied):
    run_command(**self.defaults(**bad))
 def test_idempotency_digest_has_actor_and_command_payload(self):
  a=command_digest(T,O,"a","CANCEL",1,"proof")
  self.assertNotEqual(a,command_digest(T,O,"b","CANCEL",1,"proof"))
  self.assertNotEqual(a,command_digest(T,O,"a","CANCEL",2,"proof"))
  self.assertNotEqual(a,command_digest(T,O,"a","CANCEL",1,"other"))
 def test_state_transitions_are_explicit_acyclic(self):
  self.assertEqual(EDGES["DELIVER"][:2],("HANDOFF_PENDING","DELIVERED"))
  self.assertNotIn("DRAFT",{target for _,target,_ in EDGES.values()})
  self.assertNotIn("CANCELLED",{source for source,_,_ in EDGES.values()})
  self.assertNotIn("CLOSED",{source for source,_,_ in EDGES.values()})
if __name__=="__main__":unittest.main()
