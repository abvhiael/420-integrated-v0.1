"""R02.7 transition argument and fail-closed dispatch tests."""
import unittest
from datetime import datetime,timedelta,timezone
from doobr.auth import Denied
from doobr.dispatch import offer,decide
N=datetime(2026,10,10,tzinfo=timezone.utc)
class Tests(unittest.TestCase):
 def args(self):
  return dict(connect=None,issuer=None,store=None,token="",tenant_id="invalid",
       order_id="invalid",courier_id="invalid",offer_id="invalid",expected_revision=1,
       requested_units=1,expires_at=N+timedelta(minutes=1),eligibility=None,at=N)
 def test_invalid_offer_before_effects(self):
  for change in [{"requested_units":0},{"requested_units":True},{"expected_revision":0},
                 {"expires_at":N},{"expires_at":N.replace(tzinfo=None)},
                 {"at":N.replace(tzinfo=None)}]:
   args=self.args();args.update(change)
   with self.subTest(change=change),self.assertRaises(Denied):
    offer(**args)
 def test_malformed_identity_denies(self):
  with self.assertRaises(Denied):offer(**self.args())
  with self.assertRaises(Denied):
   decide(connect=None,issuer=None,store=None,token="",tenant_id="not-uuid",
       order_id="not-uuid",offer_id="not-uuid",accept=True,eligibility=None,at=N)
 def test_no_implicit_accept(self):
  with self.assertRaises(Denied):
   decide(connect=None,issuer=None,store=None,token="",tenant_id="not-uuid",
       order_id="not-uuid",offer_id="not-uuid",accept=1,eligibility=None,at=N)
if __name__=="__main__":unittest.main()
