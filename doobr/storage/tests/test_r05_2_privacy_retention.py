import unittest
from datetime import datetime,timezone,timedelta
from dataclasses import replace
from unittest.mock import Mock
from doobr.auth import Denied
from doobr.privacy_retention import enforce_public_projection,RetentionDecision,authorize_erasure
from doobr.travel_card import presence_card
NOW=datetime(2026,10,12,tzinfo=timezone.utc)
PROJECTION=dict(region_id="VANCOUVER",state="UNKNOWN",label="public regional presence",
 disclaimer="Information only",checkout_enabled=False,booking_enabled=False,handoff_type="EXTERNAL_DEEP_LINK")
def fixture(**kw):
 fields=dict(tenant_id="tenant",subject_ref="subject",record_ref="record",purpose="DATA_SUBJECT_ERASURE",
 legal_hold=False,retention_until=NOW-timedelta(seconds=1),authorized_erase=True,
 decision_id="approved",issuer="canonical",revoked=False)
 fields.update(kw)
 a=Mock();a.verify_erasure.return_value=RetentionDecision(**fields);a.is_revoked.return_value=False
 return a
def erase(a):
 return authorize_erasure(tenant_id="tenant",subject_ref="subject",record_ref="record",
 signed_request="signed",authority=a,approved_issuers={"canonical"},at=NOW)
class PrivacyRetentionTests(unittest.TestCase):
 def test_allowed_public_projection(self):
  self.assertFalse(enforce_public_projection(projection=PROJECTION)["checkout_enabled"])
 def test_address_gps_exfiltration_denials(self):
  for field in ("address","gps","latitude","longitude","courier_id","identity_proof",
                "email","phone","tracking","device_id","postal_code"):
   with self.subTest(field=field),self.assertRaises(Denied):
    enforce_public_projection(projection={**PROJECTION,field:"private"})
 def test_public_commerce_and_schema_injection(self):
  for mutation in ({"booking_enabled":True},{"checkout_enabled":True},
    {"region_id":"VANCOUVER\nsecret"},{"state":42},{"state":"X"*300}):
   with self.subTest(mutation=mutation),self.assertRaises(Denied):
    enforce_public_projection(projection={**PROJECTION,**mutation})
 def test_legal_hold_expiry_conflicts(self):
  for k,v in (("tenant_id","other"),("subject_ref","other"),("record_ref","other"),
    ("issuer","rogue"),("legal_hold",True),("retention_until",NOW+timedelta(days=1)),
    ("authorized_erase",False),("revoked",True),("decision_id","")):
   with self.subTest(field=k),self.assertRaises(Denied):erase(fixture(**{k:v}))
 def test_current_revocation_and_failures(self):
  a=fixture();self.assertEqual(erase(a).decision_id,"approved")
  a=fixture();a.is_revoked.return_value=True
  with self.assertRaises(Denied):erase(a)
  a=fixture();a.verify_erasure.side_effect=TimeoutError()
  with self.assertRaises(Denied):erase(a)
  a=fixture();a.is_revoked.side_effect=TimeoutError()
  with self.assertRaises(Denied):erase(a)
if __name__=="__main__":unittest.main()
