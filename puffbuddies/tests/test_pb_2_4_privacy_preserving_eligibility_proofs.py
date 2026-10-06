import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))
from puffbuddies.domain.age_verification import VerificationDecision
from puffbuddies.domain.eligibility_proofs import *
from puffbuddies.domain.types import EligibilityProjection,EligibilityState,ProfileId
from puffbuddies.domain.eligibility_state import apply_authoritative_projection,initial_eligibility

class PB24PrivacyPreservingEligibilityProofTests(unittest.TestCase):
 def challenge(self,**kw):
  d=dict(profile_id=ProfileId("p"),policy_version="pb-age-v1",nonce="0123456789abcdef",
         audience=PROOF_AUDIENCE,predicate=PROOF_PREDICATE,requested_at_epoch=100);d.update(kw)
  return EligibilityProofChallenge(**d)
 def proof(self,**kw):
  d=dict(profile_id=ProfileId("p"),policy_version="pb-age-v1",nonce="0123456789abcdef",
         audience=PROOF_AUDIENCE,predicate=PROOF_PREDICATE,verifier_source="420Identity",
         verifier_version="id-proof-v1",proof_scheme="approved-minimum-disclosure-v1",
         decision=VerificationDecision.ELIGIBLE,verified_at_epoch=101,expires_at_epoch=200,revoked=False)
  d.update(kw);return VerifiedEligibilityProof(**d)

 def test_valid_minimum_disclosure_proof_projects_eligibility(self):
  self.assertEqual(consume_verified_eligibility_proof(self.challenge(),self.proof(),now_epoch=102),
                   EligibilityProjection(EligibilityState.ELIGIBLE,"id-proof-v1",200))

 def test_ineligible_unknown_revoked_and_expired_fail_closed(self):
  self.assertEqual(consume_verified_eligibility_proof(self.challenge(),self.proof(decision=VerificationDecision.INELIGIBLE),now_epoch=102).state,EligibilityState.INELIGIBLE)
  self.assertEqual(consume_verified_eligibility_proof(self.challenge(),self.proof(decision=VerificationDecision.UNKNOWN,expires_at_epoch=None),now_epoch=102).state,EligibilityState.UNKNOWN)
  self.assertEqual(consume_verified_eligibility_proof(self.challenge(),self.proof(revoked=True),now_epoch=102).state,EligibilityState.REVOKED)
  self.assertEqual(consume_verified_eligibility_proof(self.challenge(),self.proof(expires_at_epoch=102),now_epoch=102).state,EligibilityState.EXPIRED)

 def test_subject_policy_nonce_audience_predicate_and_verifier_binding(self):
  bad=[
   self.proof(profile_id=ProfileId("other")),self.proof(policy_version="v2"),
   self.proof(nonce="fedcba9876543210"),self.proof(audience="other"),
   self.proof(predicate="other"),self.proof(verifier_source="client"),
   self.proof(verifier_version=""),self.proof(proof_scheme=""),
  ]
  for p in bad:
   with self.assertRaises(EligibilityProofDenied):
    consume_verified_eligibility_proof(self.challenge(),p,now_epoch=102)

 def test_challenge_is_domain_separated_and_replay_resistant(self):
  for q in [
   self.challenge(nonce="short"),self.challenge(audience="other"),
   self.challenge(predicate="other"),self.challenge(policy_version=""),
   self.challenge(profile_id=ProfileId("")),self.challenge(requested_at_epoch=-1),
  ]:
   with self.assertRaises(EligibilityProofDenied): validate_proof_challenge(q)

 def test_time_freshness_and_expiry_boundaries(self):
  for p,now in [
   (self.proof(verified_at_epoch=99),102),
   (self.proof(verified_at_epoch=103),102),
   (self.proof(verified_at_epoch=101),500),
   (self.proof(expires_at_epoch=101),102),
  ]:
   with self.assertRaises(EligibilityProofDenied):
    consume_verified_eligibility_proof(self.challenge(),p,now_epoch=now,max_proof_age=300)

 def test_raw_identity_and_raw_proof_material_are_not_in_interface(self):
  fields=set(EligibilityProofChallenge.__dataclass_fields__)|set(VerifiedEligibilityProof.__dataclass_fields__)
  self.assertTrue(FORBIDDEN_PROOF_FIELDS.isdisjoint(fields))

 def test_proof_result_feeds_existing_pb2_authority(self):
  projection=consume_verified_eligibility_proof(self.challenge(),self.proof(),now_epoch=102)
  record=apply_authoritative_projection(
   initial_eligibility(ProfileId("p"),policy_version="pb-age-v1",now_epoch=90),
   projection,policy_version="pb-age-v1",current_policy_version="pb-age-v1",sequence=1,now_epoch=102)
  self.assertEqual(record.state,EligibilityState.ELIGIBLE)
  self.assertFalse(hasattr(VerifiedEligibilityProof,"lifecycle"))
  self.assertFalse(hasattr(VerifiedEligibilityProof,"relationship"))

if __name__=="__main__":unittest.main()
