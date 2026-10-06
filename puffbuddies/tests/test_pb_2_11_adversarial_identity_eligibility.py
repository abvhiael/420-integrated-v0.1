import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))

from puffbuddies.domain.age_verification import *
from puffbuddies.domain.authorization import AuthorizationContext,PrincipalKind
from puffbuddies.domain.discovery_matching_eligibility import *
from puffbuddies.domain.eligibility_authorization import *
from puffbuddies.domain.eligibility_privacy import *
from puffbuddies.domain.eligibility_proofs import *
from puffbuddies.domain.eligibility_revocation import *
from puffbuddies.domain.eligibility_state import *
from puffbuddies.domain.identity import *
from puffbuddies.domain.messaging_eligibility import *
from puffbuddies.domain.types import *
from puffbuddies.persistence.revocation import DerivedAuthorityToken,RevocationMarker

class PB211AdversarialIdentityEligibilityQualificationTests(unittest.TestCase):
 def request(self,profile="p",policy="v1",nonce="0123456789abcdef",at=100):
  return AgeVerificationRequest(ProfileId(profile),policy,nonce,at)

 def response(self,**kw):
  d=dict(profile_id=ProfileId("p"),policy_version="v1",request_nonce="0123456789abcdef",
         source=IDENTITY_AUTHORITY,source_version="id-v1",decision=VerificationDecision.ELIGIBLE,
         checked_at_epoch=110,expires_at_epoch=200,revoked=False)
  d.update(kw);return AgeVerificationResponse(**d)

 def record(self,**kw):
  d=dict(profile_id=ProfileId("p"),state=EligibilityState.ELIGIBLE,source_version="id-v1",
         policy_version="v1",expires_at_epoch=200,sequence=8,checked_at_epoch=110)
  d.update(kw);return EligibilityRecord(**d)

 def bound(self,subject,actor,**kw):
  d=dict(principal=PrincipalKind.USER,subject_id=subject,actor_id=actor,
         eligibility=EligibilityState.ELIGIBLE,lifecycle=LifecycleState.ACTIVE,
         relationship=RelationshipState.MATCHED,blocked=False)
  d.update(kw)
  return BoundEligibilityAuthorization(AuthorizationContext(**d),8,"v1",110)

 def test_self_assertion_or_untrusted_authority_cannot_create_eligibility(self):
  a=AdultEligibilityAssertion(ProfileId("p"),True,"self","self-v1",100,200)
  with self.assertRaises(EligibilityDenied):
   consume_adult_eligibility(a,profile_id=ProfileId("p"),now_epoch=120)

 def test_cross_subject_verification_replay_fails(self):
  req=self.request(profile="p")
  with self.assertRaises(AgeVerificationDenied):
   consume_verification_response(req,self.response(profile_id=ProfileId("victim")),now_epoch=120)

 def test_nonce_replay_and_stale_response_fail(self):
  req=self.request()
  with self.assertRaises(AgeVerificationDenied):
   consume_verification_response(req,self.response(request_nonce="fedcba9876543210"),now_epoch=120)
  with self.assertRaises(AgeVerificationDenied):
   consume_verification_response(req,self.response(checked_at_epoch=101),now_epoch=500,max_response_age=300)

 def test_untrusted_verifier_and_policy_mismatch_fail(self):
  req=self.request()
  with self.assertRaises(AgeVerificationDenied):
   consume_verification_response(req,self.response(source="attacker"),now_epoch=120)
  with self.assertRaises(AgeVerificationDenied):
   consume_verification_response(req,self.response(policy_version="v0"),now_epoch=120)

 def test_proof_audience_predicate_and_subject_replay_fail(self):
  ch=EligibilityProofChallenge(ProfileId("p"),"v1","0123456789abcdef",PROOF_AUDIENCE,PROOF_PREDICATE,100)
  base=dict(profile_id=ProfileId("p"),policy_version="v1",nonce="0123456789abcdef",
            audience=PROOF_AUDIENCE,predicate=PROOF_PREDICATE,verifier_source=IDENTITY_AUTHORITY,
            verifier_version="id-v1",proof_scheme="scheme",decision=VerificationDecision.ELIGIBLE,
            verified_at_epoch=110,expires_at_epoch=200,revoked=False)
  for change in (
   dict(profile_id=ProfileId("other")),
   dict(audience="other-app"),
   dict(predicate="other-predicate"),
   dict(nonce="fedcba9876543210"),
  ):
   d=dict(base);d.update(change)
   with self.assertRaises(EligibilityProofDenied):
    consume_verified_eligibility_proof(ch,VerifiedEligibilityProof(**d),now_epoch=120)

 def test_stale_sequence_policy_drift_and_authority_outage_fail_closed(self):
  cur=self.record()
  projection=EligibilityProjection(EligibilityState.ELIGIBLE,"id-v1",200)
  with self.assertRaises(EligibilityTransitionDenied):
   apply_authoritative_projection(cur,projection,policy_version="v1",current_policy_version="v1",sequence=8,now_epoch=120)
  changed=require_policy_current(cur,current_policy_version="v2",sequence=9,now_epoch=120)
  self.assertEqual(changed.state,EligibilityState.UNKNOWN)
  unavailable=authority_unavailable(cur,sequence=9,now_epoch=120)
  self.assertEqual(unavailable.state,EligibilityState.UNKNOWN)

 def test_revocation_after_match_invalidates_stale_discovery_matching_and_messaging(self):
  cur=self.record()
  out=apply_authoritative_revocation(cur,source_version="id-v1",sequence=9,revoked_at_epoch=120,current_generation=4)
  stale=DerivedAuthorityToken("p",4)
  marker=out.marker
  for surface_call in ("discovery","matching","messaging"):
   self.assertFalse(stale.generation==marker.generation, surface_call)

 def test_expired_or_policy_stale_record_cannot_be_bound_as_eligible(self):
  ctx=AuthorizationContext(PrincipalKind.USER,"p",actor_id="q",lifecycle=LifecycleState.ACTIVE,
                           relationship=RelationshipState.MATCHED)
  expired=bind_current_eligibility(ctx,self.record(expires_at_epoch=120),profile_id=ProfileId("p"),
                                  current_policy_version="v1",now_epoch=120)
  self.assertEqual(expired.context.eligibility,EligibilityState.EXPIRED)
  stale=bind_current_eligibility(ctx,self.record(),profile_id=ProfileId("p"),
                                current_policy_version="v2",now_epoch=120)
  self.assertEqual(stale.context.eligibility,EligibilityState.UNKNOWN)

 def test_payment_admin_or_messenger_state_cannot_manufacture_access(self):
  left=self.bound("left","right",eligibility=EligibilityState.INELIGIBLE)
  right=self.bound("right","left")
  pair=MessagingEligibilityPair(left,right)
  self.assertFalse(ordinary_messaging_allowed(pair,messenger_native_denied=False))
  self.assertFalse(ordinary_messaging_allowed(MessagingEligibilityPair(self.bound("left","right"),right),
                                               messenger_native_denied=True))

 def test_block_and_unmatch_override_current_eligibility(self):
  unmatched=self.bound("left","right",relationship=RelationshipState.UNMATCHED)
  peer=self.bound("right","left")
  self.assertFalse(ordinary_messaging_allowed(MessagingEligibilityPair(unmatched,peer)))
  blocked=self.bound("left","right",blocked=True)
  self.assertFalse(ordinary_messaging_allowed(MessagingEligibilityPair(blocked,peer)))

 def test_uniform_denial_and_no_public_probe_prevent_state_oracle(self):
  self.assertEqual(uniform_denial_code(),"NOT_AUTHORIZED")
  for f,args in ((public_eligibility_lookup,("p",)),(public_authorization_probe,("p","q"))):
   with self.assertRaises(LeakageDenied): f(*args)

 def test_external_payload_rejects_identity_policy_and_relationship_metadata(self):
  for payload in (
   {"source_version":"id-v1"},{"policy_version":"v1"},{"sequence":9},
   {"relationship_state":"MATCHED"},{"blocked":True},{"date_of_birth":"2000-01-01"},
  ):
   with self.assertRaises(LeakageDenied): assert_pb2_external_payload_minimal(payload)

if __name__=="__main__":unittest.main()
