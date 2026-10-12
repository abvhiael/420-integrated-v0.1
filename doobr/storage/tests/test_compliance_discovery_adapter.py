import unittest
from datetime import datetime,timezone,timedelta
from unittest.mock import Mock
from doobr.auth import Denied
from doobr.compliance_discovery_adapter import PolicyDecision,require_compliance,read_only_region
NOW=datetime(2026,10,12,tzinfo=timezone.utc)
def policy(**overrides):
 fields=dict(tenant_id="tenant",provider_ref="provider",municipality="Vancouver",
  policy_version="bc-v1",decision_id="decision",evidence_ref="evidence",issuer="420Compliance",
  outcome="ALLOW",valid_from=NOW-timedelta(minutes=1),
  expires_at=NOW+timedelta(minutes=4),revoked=False)
 fields.update(overrides)
 s=Mock();s.verify_decision.return_value=PolicyDecision(**fields)
 s.is_revoked.return_value=False;s.verify_evidence.return_value=True
 return s
def check(s):
 return require_compliance(tenant_id="tenant",provider_ref="provider",municipality="Vancouver",
  signed_decision="signed",compliance=s,approved_issuers={"420Compliance"},now=NOW)
class ComplianceTests(unittest.TestCase):
 def test_canonical_positive(self):
  s=policy();self.assertEqual(check(s).outcome,"ALLOW")
  s.verify_evidence.assert_called_once()
 def test_denial_cases(self):
  cases=[("tenant_id","other"),("provider_ref","other"),("municipality","Calgary"),
   ("policy_version",""),("decision_id",""),("evidence_ref",""),("issuer","forged"),
   ("outcome","DENY"),("revoked",True),("valid_from",NOW+timedelta(seconds=1)),
   ("expires_at",NOW)]
  for key,value in cases:
   with self.subTest(key=key),self.assertRaises(Denied):check(policy(**{key:value}))
 def test_revocation_and_outages(self):
  s=policy();s.is_revoked.return_value=True
  with self.assertRaises(Denied):check(s)
  s=policy();s.verify_evidence.return_value=False
  with self.assertRaises(Denied):check(s)
  s=policy();s.verify_decision.side_effect=TimeoutError()
  with self.assertRaises(Denied):check(s)
 def test_private_projection_denied(self):
  loc=Mock();search=Mock();verifier=Mock()
  loc.verify_public_region.return_value=True
  search.allow_public_region.return_value=True
  verifier.verify_projection.return_value=True
  record=dict(region_id="VANCOUVER",state="UNKNOWN",issued_at=NOW,
   expires_at=NOW+timedelta(minutes=1),privacy_threshold_met=True,signature="signed")
  loc.coarse_presence.return_value=record
  out=read_only_region(region_id="VANCOUVER",location=loc,search=search,
                         projection_verifier=verifier,at=NOW)
  self.assertIs(out["checkout_enabled"],False)
  self.assertIs(out["booking_enabled"],False)
  for extra in ("address","courier_gps","person_id"):
   loc.coarse_presence.return_value={**record,extra:"sensitive"}
   with self.subTest(extra=extra),self.assertRaises(Denied):
    read_only_region(region_id="VANCOUVER",location=loc,search=search,projection_verifier=verifier,at=NOW)
  loc.coarse_presence.return_value={**record,"region_id":"WRONG"}
  with self.assertRaises(Denied):
   read_only_region(region_id="VANCOUVER",location=loc,search=search,projection_verifier=verifier,at=NOW)
 def test_location_search_fail_closed(self):
  loc=Mock();search=Mock();verifier=Mock()
  loc.verify_public_region.return_value=False
  with self.assertRaises(Denied):
   read_only_region(region_id="VANCOUVER",location=loc,search=search,projection_verifier=verifier,at=NOW)
  loc.verify_public_region.return_value=True;search.allow_public_region.side_effect=TimeoutError()
  with self.assertRaises(Denied):
   read_only_region(region_id="VANCOUVER",location=loc,search=search,projection_verifier=verifier,at=NOW)
if __name__=="__main__":unittest.main()
