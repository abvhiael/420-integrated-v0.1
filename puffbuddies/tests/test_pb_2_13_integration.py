import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))

from puffbuddies.domain.age_verification import *
from puffbuddies.domain.authorization import AuthorizationContext,PrincipalKind
from puffbuddies.domain.discovery_matching_eligibility import *
from puffbuddies.domain.eligibility_authorization import *
from puffbuddies.domain.eligibility_persistence import *
from puffbuddies.domain.eligibility_privacy import *
from puffbuddies.domain.eligibility_proofs import *
from puffbuddies.domain.eligibility_revocation import *
from puffbuddies.domain.eligibility_state import *
from puffbuddies.domain.messaging_eligibility import *
from puffbuddies.domain.types import *
from puffbuddies.persistence.recovery import Snapshot,validate_restore,RecoveryFailed
from puffbuddies.persistence.revocation import DerivedAuthorityToken,RevocationMarker,RevocationDenied
from puffbuddies.storage.memory import InMemoryPrivateRepository

class PB213IntegrationMilestoneTests(unittest.TestCase):
 def verified_record(self,profile,*,seq=1,checked=110,expiry=200,policy="v1"):
  req=AgeVerificationRequest(ProfileId(profile),policy,"0123456789abcdef",100)
  resp=AgeVerificationResponse(ProfileId(profile),policy,req.request_nonce,IDENTITY_AUTHORITY,
      "id-v1",VerificationDecision.ELIGIBLE,checked,expiry,False)
  projection=consume_verification_response(req,resp,now_epoch=120)
  initial=initial_eligibility(ProfileId(profile),policy_version=policy,now_epoch=100)
  return apply_authoritative_projection(initial,projection,policy_version=policy,
      current_policy_version=policy,sequence=seq,now_epoch=120)

 def ctx(self,subject,actor,*,rel=RelationshipState.NONE,elig=EligibilityState.UNKNOWN,blocked=False):
  return AuthorizationContext(PrincipalKind.USER,subject,actor_id=actor,eligibility=elig,
      lifecycle=LifecycleState.ACTIVE,relationship=rel,blocked=blocked)

 def bind(self,record,actor,*,rel=RelationshipState.NONE,policy="v1",now=120):
  return bind_current_eligibility(self.ctx(str(record.profile_id),actor,rel=rel),record,
      profile_id=record.profile_id,current_policy_version=policy,now_epoch=now)

 def test_authoritative_verification_persistence_and_authorization_compose(self):
  repo=InMemoryPrivateRepository()
  record=self.verified_record("alice")
  stored=persist_eligibility(repo,record,expected_version=None)
  loaded,version=load_eligibility(repo,ProfileId("alice"))
  self.assertEqual(loaded,record);self.assertEqual(version,stored.version)
  bound=self.bind(loaded,"bob")
  self.assertEqual(bound.context.eligibility,EligibilityState.ELIGIBLE)
  self.assertEqual(bound.record_sequence,record.sequence)

 def test_privacy_preserving_proof_path_reaches_same_minimum_eligibility_contract(self):
  challenge=EligibilityProofChallenge(ProfileId("alice"),"v1","0123456789abcdef",
      PROOF_AUDIENCE,PROOF_PREDICATE,100)
  proof=VerifiedEligibilityProof(ProfileId("alice"),"v1",challenge.nonce,PROOF_AUDIENCE,
      PROOF_PREDICATE,IDENTITY_AUTHORITY,"id-v1","qualified-scheme",
      VerificationDecision.ELIGIBLE,110,200,False)
  projection=consume_verified_eligibility_proof(challenge,proof,now_epoch=120)
  current=initial_eligibility(ProfileId("alice"),policy_version="v1",now_epoch=100)
  record=apply_authoritative_projection(current,projection,policy_version="v1",
      current_policy_version="v1",sequence=1,now_epoch=120)
  self.assertEqual(record.state,EligibilityState.ELIGIBLE)
  self.assertNotIn("proof_bytes",record.__dataclass_fields__)
  self.assertNotIn("date_of_birth",record.__dataclass_fields__)

 def test_current_eligibility_flows_into_discovery_match_and_matched_messaging(self):
  a=self.verified_record("alice");b=self.verified_record("bob")
  av=self.bind(a,"bob",rel=RelationshipState.NONE)
  bv=self.bind(b,"alice",rel=RelationshipState.NONE)
  pair=DiscoveryMatchingPair(av,bv)
  self.assertTrue(discovery_candidate_allowed(pair))
  self.assertTrue(match_intent_allowed(pair))
  avm=self.bind(a,"bob",rel=RelationshipState.MATCHED)
  bvm=self.bind(b,"alice",rel=RelationshipState.MATCHED)
  mp=MessagingEligibilityPair(avm,bvm)
  self.assertTrue(ordinary_messaging_allowed(mp))
  require_ordinary_messaging(mp,
      left_token=DerivedAuthorityToken("alice",4),left_marker=RevocationMarker("alice",4,"CURRENT"),
      right_token=DerivedAuthorityToken("bob",4),right_marker=RevocationMarker("bob",4,"CURRENT"))

 def test_revocation_persists_and_invalidates_stale_discovery_matching_messaging(self):
  repo=InMemoryPrivateRepository()
  record=self.verified_record("alice")
  stored=persist_eligibility(repo,record,expected_version=None)
  out=apply_authoritative_revocation(record,source_version="id-v1",sequence=2,
      revoked_at_epoch=130,current_generation=4)
  persist_invalidation_outcome(repo,out,expected_version=stored.version)
  loaded,_=load_eligibility(repo,ProfileId("alice"))
  self.assertEqual(loaded.state,EligibilityState.REVOKED)
  rebound=self.bind(loaded,"bob",rel=RelationshipState.MATCHED,now=130)
  self.assertEqual(rebound.context.eligibility,EligibilityState.REVOKED)
  peer=self.bind(self.verified_record("bob"),"alice",rel=RelationshipState.MATCHED,now=130)
  dp=DiscoveryMatchingPair(rebound,peer)
  mp=MessagingEligibilityPair(rebound,peer)
  stale=DerivedAuthorityToken("alice",4)
  peer_token=DerivedAuthorityToken("bob",4);peer_marker=RevocationMarker("bob",4,"CURRENT")
  with self.assertRaises(PermissionError):
   require_discovery_candidate(dp,viewer_token=stale,viewer_marker=out.marker,
       candidate_token=peer_token,candidate_marker=peer_marker)
  with self.assertRaises(PermissionError):
   require_match_intent(dp,viewer_token=stale,viewer_marker=out.marker,
       candidate_token=peer_token,candidate_marker=peer_marker)
  with self.assertRaises(PermissionError):
   require_ordinary_messaging(mp,left_token=stale,left_marker=out.marker,
       right_token=peer_token,right_marker=peer_marker)

 def test_policy_drift_and_expiry_fail_closed_after_reload(self):
  repo=InMemoryPrivateRepository()
  record=self.verified_record("alice")
  persist_eligibility(repo,record,expected_version=None)
  loaded,_=load_eligibility(repo,ProfileId("alice"))
  policy_stale=self.bind(loaded,"bob",policy="v2")
  self.assertEqual(policy_stale.context.eligibility,EligibilityState.UNKNOWN)
  expired=self.bind(loaded,"bob",now=200)
  self.assertEqual(expired.context.eligibility,EligibilityState.EXPIRED)

 def test_recovery_cannot_resurrect_pre_revocation_eligibility(self):
  record=self.verified_record("alice")
  snap=Snapshot(4,(StoredRecord("eligibility_projection","alice",1,{
      "profile_id":"alice","decision":record.state.value,"source_version":record.source_version,
      "expires_at":record.expires_at_epoch,"policy_version":record.policy_version,
      "sequence":record.sequence,"checked_at_epoch":record.checked_at_epoch}),))
  marker=RevocationMarker("alice",5,"ELIGIBILITY_REVOKED")
  with self.assertRaises(RevocationDenied): validate_restore(snap,marker)

 def test_privacy_boundary_survives_integrated_authorization_flow(self):
  c=private_authorization_conclusion(allowed=False)
  self.assertEqual(set(c.__dataclass_fields__),{"allowed"})
  self.assertEqual(uniform_denial_code(),"NOT_AUTHORIZED")
  for payload in (
      {"eligibility_state":"REVOKED"},{"policy_version":"v1"},{"source_version":"id-v1"},
      {"relationship_state":"MATCHED"},{"profile_id":"alice"}):
   with self.assertRaises(LeakageDenied): assert_pb2_external_payload_minimal(payload)
  with self.assertRaises(LeakageDenied): public_eligibility_lookup("alice")
  with self.assertRaises(LeakageDenied): public_authorization_probe("alice","bob")

 def test_conflicting_authorities_resolve_restrictively_end_to_end(self):
  eligible=self.verified_record("alice")
  peer=self.verified_record("bob")
  suspended=bind_current_eligibility(
      AuthorizationContext(PrincipalKind.USER,"alice",actor_id="bob",
          lifecycle=LifecycleState.SUSPENDED,relationship=RelationshipState.MATCHED),
      eligible,profile_id=ProfileId("alice"),current_policy_version="v1",now_epoch=120)
  current_peer=self.bind(peer,"alice",rel=RelationshipState.MATCHED)
  self.assertFalse(ordinary_messaging_allowed(MessagingEligibilityPair(suspended,current_peer)))
  blocked=bind_current_eligibility(
      AuthorizationContext(PrincipalKind.USER,"alice",actor_id="bob",
          lifecycle=LifecycleState.ACTIVE,relationship=RelationshipState.MATCHED,blocked=True),
      eligible,profile_id=ProfileId("alice"),current_policy_version="v1",now_epoch=120)
  self.assertFalse(ordinary_messaging_allowed(MessagingEligibilityPair(blocked,current_peer)))

if __name__=="__main__":unittest.main()
