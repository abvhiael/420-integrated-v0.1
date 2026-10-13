import unittest
from datetime import datetime,timedelta,timezone
from unittest.mock import patch
from types import SimpleNamespace
from doobr.auth import Denied
from doobr.mobile_push import verify_registration,verify_delivery
NOW=datetime(2026,10,11,tzinfo=timezone.utc)
T="00000000-0000-4000-8000-000000000101"
D="00000000-0000-4000-8000-000000000102"
class Allow:
 def verify(self,**kwargs):return True
 def authorize_registration(self,**kwargs):return True
 def verify_push(self,**kwargs):return True
class Reject(Allow):
 def verify(self,**kwargs):return False
class MobilePushTests(unittest.TestCase):
 def test_authorized_device(self):
  with patch("doobr.mobile_push.authorize",return_value=SimpleNamespace(actor_id=D)) as auth:
   self.assertEqual(verify_registration(issuer=None,store=None,signed_token="proof",tenant_id=T,device_id=D,
    attestation=Allow(),notification_authority=Allow(),at=NOW)["status"],"ELIGIBLE_FOR_PROVIDER_REGISTRATION")
   self.assertEqual(auth.call_args.kwargs["permission"].resource,"device:"+D)
 def test_no_attestation_or_revoked_identity(self):
  with patch("doobr.mobile_push.authorize",return_value=SimpleNamespace(actor_id=D)):
   with self.assertRaises(Denied):verify_registration(issuer=None,store=None,signed_token="proof",tenant_id=T,
    device_id=D,attestation=Reject(),notification_authority=Allow(),at=NOW)
  with patch("doobr.mobile_push.authorize",side_effect=Denied("revoked")):
   with self.assertRaises(Denied):verify_registration(issuer=None,store=None,signed_token="proof",tenant_id=T,
    device_id=D,attestation=Allow(),notification_authority=Allow(),at=NOW)
 def test_push_expiry_and_privacy(self):
  p={"event":"SESSION_REVOKED","opaque_ref":"opaque0001"}
  self.assertEqual(verify_delivery(payload=p,issued_at=NOW-timedelta(minutes=1),expires_at=NOW+timedelta(minutes=5),authority=Allow(),at=NOW),p)
  for payload,expiry in [(dict(p,address="private"),NOW+timedelta(minutes=5)),(p,NOW-timedelta(seconds=1)),(p,NOW+timedelta(hours=5))]:
   with self.assertRaises(Denied):verify_delivery(payload=payload,issued_at=NOW-timedelta(minutes=1),expires_at=expiry,authority=Allow(),at=NOW)
if __name__=="__main__":unittest.main()
