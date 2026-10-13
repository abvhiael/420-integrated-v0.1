import unittest
from datetime import datetime,timezone
from doobr.custody import apply_custody
from doobr.auth import Denied
N=datetime(2026,10,10,tzinfo=timezone.utc)
class Tests(unittest.TestCase):
 def base(self,**kw):
  x=dict(connect=None,issuer=None,store=None,token="",tenant_id="bad",
   order_id="bad",command_id="bad",evidence_id="bad",action="DELIVER",
   expected_revision=2,package_seal_ref="seal",issuer_evidence_ref="issuer",
   recipient_id_ref="verified-ID",recipient_name_ref="verified-name",
   signature_ref="signed",authority=None,encrypt=None,at=N)
  x.update(kw);return x
 def test_handoff_requires_complete_recipient_proofs(self):
  for missing in ("recipient_id_ref","recipient_name_ref","signature_ref"):
   with self.subTest(missing=missing),self.assertRaises(Denied):
    apply_custody(**self.base(**{missing:None}))
 def test_denies_unbounded_or_invalid_evidence(self):
  for args in (dict(action="IGNORE"),dict(expected_revision=0),
   dict(package_seal_ref=""),dict(issuer_evidence_ref=""),
   dict(retention_seconds=10),dict(expected_revision=True)):
   with self.subTest(args=args),self.assertRaises(Denied):
    apply_custody(**self.base(**args))
if __name__=="__main__":unittest.main()
