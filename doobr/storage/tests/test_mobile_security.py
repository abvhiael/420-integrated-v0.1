import unittest
from datetime import datetime,timedelta,timezone
from doobr.auth import Denied
from doobr.mobile_security import DeviceState,validate_device,validate_push_payload
NOW=datetime(2026,10,11,tzinfo=timezone.utc)
def state(**changes):
 values=dict(platform="ios",hardware_key=True,key_attested=True,device_unlocked=True,
  push_permission=False,foreground_location=True,background_location=False,
  active_assignment=True,active_navigation=True,user_requested_tracking=True,
  tracking_grant_expires=NOW+timedelta(minutes=20))
 values.update(changes)
 return DeviceState(**values)
class MobileSecurityTests(unittest.TestCase):
 def test_eligible_foreground_and_explicit_background(self):
  self.assertTrue(validate_device(state(),at=NOW)["foreground_tracking"])
  self.assertFalse(validate_device(state(),at=NOW)["background_tracking"])
  self.assertTrue(validate_device(state(platform="android",background_location=True),at=NOW)["background_tracking"])
  self.assertFalse(validate_device(state(background_location=True),at=NOW)["regulated_operations_enabled"])
 def test_no_tracking_without_all_gates(self):
  for k,v in (("foreground_location",False),("active_assignment",False),
              ("active_navigation",False),("user_requested_tracking",False),
              ("tracking_grant_expires",NOW),("tracking_grant_expires",None)):
   s=validate_device(state(**{k:v}),at=NOW)
   self.assertFalse(s["foreground_tracking"])
   self.assertFalse(s["background_tracking"])
 def test_untrusted_devices_denied(self):
  for k,v in (("hardware_key",False),("key_attested",False),("device_unlocked",False),
              ("platform","other"),("active_assignment",1)):
   with self.assertRaises(Denied):validate_device(state(**{k:v}),at=NOW)
 def test_push_data_minimal(self):
  self.assertEqual(validate_push_payload({"event":"SESSION_REVOKED","opaque_ref":"opaque0001"})["event"],"SESSION_REVOKED")
  for payload in ({"event":"ASSIGNMENT_UPDATED","opaque_ref":"opaque0001","latitude":50},
     {"event":"SESSION_REVOKED","opaque_ref":"a"},
     {"event":"LOCATION","opaque_ref":"opaque0001"},
     {"event":"SESSION_REVOKED","opaque_ref":"private address"}):
   with self.assertRaises(Denied):validate_push_payload(payload)
if __name__=="__main__":unittest.main()
