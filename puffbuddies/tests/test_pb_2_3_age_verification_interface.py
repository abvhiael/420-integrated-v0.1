import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))
from puffbuddies.domain.types import *
from puffbuddies.domain.age_verification import *
from puffbuddies.domain.eligibility_state import *
from puffbuddies.persistence.schema import TABLES

class PB23AgeVerificationInterfaceTests(unittest.TestCase):
 def req(self,**kw):
  d=dict(profile_id=ProfileId("p"),policy_version="pb-age-v1",request_nonce="0123456789abcdef",requested_at_epoch=100);d.update(kw);return AgeVerificationRequest(**d)
 def resp(self,**kw):
  d=dict(profile_id=ProfileId("p"),policy_version="pb-age-v1",request_nonce="0123456789abcdef",source="420Identity",source_version="id-v9",decision=VerificationDecision.ELIGIBLE,checked_at_epoch=101,expires_at_epoch=200,revoked=False);d.update(kw);return AgeVerificationResponse(**d)
 def test_current_eligible_response_projects_minimum_state(self):
  p=consume_verification_response(self.req(),self.resp(),now_epoch=102)
  self.assertEqual(p,EligibilityProjection(EligibilityState.ELIGIBLE,"id-v9",200))
 def test_ineligible_and_unknown_map_fail_closed(self):
  p=consume_verification_response(self.req(),self.resp(decision=VerificationDecision.INELIGIBLE),now_epoch=102)
  self.assertEqual(p.state,EligibilityState.INELIGIBLE)
  u=consume_verification_response(self.req(),self.resp(decision=VerificationDecision.UNKNOWN,expires_at_epoch=None),now_epoch=102)
  self.assertEqual(u,EligibilityProjection(EligibilityState.UNKNOWN,"id-v9",None))
 def test_revocation_overrides_positive_decision(self):
  p=consume_verification_response(self.req(),self.resp(revoked=True),now_epoch=102)
  self.assertEqual(p.state,EligibilityState.REVOKED)
 def test_subject_policy_nonce_and_source_binding_fail_closed(self):
  cases=[
   self.resp(profile_id=ProfileId("other")),
   self.resp(policy_version="pb-age-v2"),
   self.resp(request_nonce="fedcba9876543210"),
   self.resp(source="client"),
   self.resp(source_version=""),
  ]
  for r in cases:
   with self.assertRaises(AgeVerificationDenied):consume_verification_response(self.req(),r,now_epoch=102)
 def test_freshness_and_time_boundaries_fail_closed(self):
  with self.assertRaises(AgeVerificationDenied):consume_verification_response(self.req(),self.resp(checked_at_epoch=99),now_epoch=102)
  with self.assertRaises(AgeVerificationDenied):consume_verification_response(self.req(),self.resp(checked_at_epoch=103),now_epoch=102)
  with self.assertRaises(AgeVerificationDenied):consume_verification_response(self.req(),self.resp(checked_at_epoch=101),now_epoch=500,max_response_age=300)
  with self.assertRaises(AgeVerificationDenied):consume_verification_response(self.req(),self.resp(expires_at_epoch=101),now_epoch=102)
 def test_request_requires_private_profile_policy_nonce_and_time(self):
  for q in (self.req(profile_id=ProfileId("")),self.req(policy_version=""),self.req(request_nonce="short"),self.req(requested_at_epoch=-1)):
   with self.assertRaises(AgeVerificationDenied):validate_request(q)
 def test_interface_contains_no_raw_identity_or_wallet_fields(self):
  fields=set(AgeVerificationRequest.__dataclass_fields__)|set(AgeVerificationResponse.__dataclass_fields__)
  self.assertTrue(FORBIDDEN_VERIFICATION_FIELDS.isdisjoint(fields))
  spec=TABLES["eligibility_projection"]
  self.assertTrue(FORBIDDEN_VERIFICATION_FIELDS.isdisjoint(spec.fields))
 def test_interface_does_not_grant_lifecycle_or_consent_authority(self):
  p=consume_verification_response(self.req(),self.resp(),now_epoch=102)
  r=apply_authoritative_projection(initial_eligibility(ProfileId("p"),policy_version="pb-age-v1",now_epoch=90),p,policy_version="pb-age-v1",current_policy_version="pb-age-v1",sequence=1,now_epoch=102)
  self.assertEqual(r.state,EligibilityState.ELIGIBLE)
  self.assertFalse(hasattr(AgeVerificationResponse,"lifecycle"))
  self.assertFalse(hasattr(AgeVerificationResponse,"relationship"))
 def test_unknown_does_not_require_fake_expiry(self):
  p=consume_verification_response(self.req(),self.resp(decision=VerificationDecision.UNKNOWN,expires_at_epoch=None),now_epoch=102)
  self.assertIsNone(p.expires_at_epoch)
if __name__=="__main__":unittest.main()
