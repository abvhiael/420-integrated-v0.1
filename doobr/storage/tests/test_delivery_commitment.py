import unittest
from datetime import datetime,timezone
from dataclasses import asdict
from doobr.auth import Denied
from doobr.delivery_commitment import commit_delivery
NOW=datetime(2026,10,12,12,tzinfo=timezone.utc)
ARGS=dict(event_kind="HANDOFF",source_digest="a"*64,tenant_ref="t"*30,
 order_ref="o"*30,evidence_ref="e"*30,nonce="n"*30,occurred_at=NOW)
class CommitmentTests(unittest.TestCase):
 def test_determinism_and_domain(self):
  a=commit_delivery(**ARGS); b=commit_delivery(**ARGS)
  self.assertEqual(a,b);self.assertEqual(len(a.commitment),64)
  self.assertEqual(a.version,"doobr.delivery-commitment.v1")
 def test_binding(self):
  original=commit_delivery(**ARGS).commitment
  for field,value in (("event_kind","PICKUP"),("source_digest","b"*64),
   ("tenant_ref","x"*30),("order_ref","x"*30),
   ("evidence_ref","x"*30),("nonce","x"*30)):
   with self.subTest(field=field):
    self.assertNotEqual(original,commit_delivery(**{**ARGS,field:value}).commitment)
 def test_reject_unsafe_or_missing_values(self):
  for field,value in (("event_kind","DELIVERED"),("source_digest","signed content"),
    ("source_digest","A"*64),("order_ref","123"),("tenant_ref","john@example.com"),
    ("evidence_ref","name smith"),("nonce",""),("occurred_at",NOW.replace(tzinfo=None))):
   with self.subTest(field=field),self.assertRaises(Denied):
    commit_delivery(**{**ARGS,field:value})
 def test_output_contains_no_personal_fields(self):
  obj=asdict(commit_delivery(**ARGS))
  self.assertEqual(set(obj),{"version","commitment","source_digest","event_kind","occurred_at"})
if __name__=="__main__":unittest.main()
