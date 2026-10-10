import unittest
from datetime import datetime,timedelta,timezone
from doobr.returns import transition_return
from doobr.auth import Denied
N=datetime(2026,10,10,tzinfo=timezone.utc)
class Tests(unittest.TestCase):
 def base(self,**changes):
  a=dict(connect=None,issuer=None,store=None,token="",tenant_id="bad",order_id="bad",
    command_id="bad",event_id="bad",action="FAIL_DELIVERY",expected_revision=1,
    reason="NO_SHOW",policy_ref="policy",deadline_at=N+timedelta(hours=1),
    proof_ref="verified-proof",authority=None,encrypt=None,at=N)
  return a|changes
 def test_reject_untrusted_inputs(self):
  for x in (dict(reason="MAGIC"),dict(action="DELIVER"),dict(policy_ref=""),
    dict(proof_ref=""),dict(expected_revision=0),dict(expected_revision=True),
    dict(deadline_at=N),dict(deadline_at=N.replace(tzinfo=None)),
    dict(retention_seconds=1)):
   with self.subTest(x=x),self.assertRaises(Denied):transition_return(**self.base(**x))
if __name__=="__main__":unittest.main()
