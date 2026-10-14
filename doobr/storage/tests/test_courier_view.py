import unittest
from unittest.mock import patch
from datetime import datetime,timezone,timedelta
from doobr.auth import Denied,Session
from doobr.courier_view import read_courier_status
NOW=datetime(2026,10,11,tzinfo=timezone.utc)
def session(actor="courier"):return Session("tenant",actor,"subject","issuer","token",NOW+timedelta(hours=1),False,None)
def run(actor="courier",valid=True):
 with patch("doobr.courier_view.authorize",return_value=session(actor)) as auth,patch("doobr.courier_view.verify_courier") as verify:
  if valid:verify.return_value=type("Evidence",(),{"checked_at":NOW})()
  else:verify.side_effect=Denied("issuer unavailable")
  result=read_courier_status(identity_issuer=object(),session_store=object(),signed_token="signed",
   tenant_id="tenant",courier_id="courier",jurisdiction="CA-BC-VANCOUVER",
   carrier_class="COMMON_CARRIER",vehicle_ref=None,credentials=[],credential_authority=object(),
   courier_policy=object(),at=NOW)
  return result,auth,verify
class CourierViewTests(unittest.TestCase):
 def test_verified_never_goes_online(self):
  result,auth,verify=run()
  self.assertEqual((result.enrollment,result.credentials,result.availability),("REQUIRES_OPERATOR_APPROVAL","VERIFIED","OFFLINE"))
  self.assertEqual(auth.call_args.kwargs["permission"].role,"COURIER")
  self.assertEqual(auth.call_args.kwargs["permission"].resource,"courier:courier")
  self.assertEqual(verify.call_args.kwargs["carrier_class"],"COMMON_CARRIER")
 def test_other_courier_denied(self):
  with self.assertRaises(Denied):run(actor="other")
 def test_missing_independent_issuer_denied(self):
  with self.assertRaises(Denied):run(valid=False)
 def test_revocation_fail_closed(self):
  with patch("doobr.courier_view.authorize",side_effect=Denied("revoked")):
   with self.assertRaises(Denied):read_courier_status(identity_issuer=None,session_store=None,signed_token="t",tenant_id="tenant",courier_id="courier",jurisdiction="x",carrier_class="COMMON_CARRIER",vehicle_ref=None,credentials=[],credential_authority=None,courier_policy=None,at=NOW)
