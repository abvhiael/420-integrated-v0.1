from dataclasses import replace
import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))

from puffbuddies.domain.authorization import AuthorizationContext,PrincipalKind
from puffbuddies.domain.discovery import *
from puffbuddies.domain.eligibility_authorization import BoundEligibilityAuthorization
from puffbuddies.domain.matching import *
from puffbuddies.domain.messaging_eligibility import MessagingEligibilityPair,ordinary_messaging_allowed
from puffbuddies.domain.profiles import ProfileRecord,ProfileVisibility
from puffbuddies.domain.invalidation import DerivedSurface,affected
from puffbuddies.domain.types import *
from puffbuddies.persistence.revocation import DerivedAuthorityToken,RevocationMarker
from puffbuddies.storage.memory import InMemoryPrivateRepository

class PB5LikesMatchingTests(unittest.TestCase):
 def profile(self,pid):
  return ProfileRecord(ProfileId(pid),IntentMode.DATING,LifecycleState.ACTIVE,
      (("display_name",pid),),("media:1",),1)

 def subject(self,pid,actor,*,rel=RelationshipState.NONE,blocked=False,generation=4):
  auth=BoundEligibilityAuthorization(
   AuthorizationContext(PrincipalKind.USER,pid,actor_id=actor,
    eligibility=EligibilityState.ELIGIBLE,lifecycle=LifecycleState.ACTIVE,
    relationship=rel,blocked=blocked),1,"v1",100)
  prefs=DiscoveryPreferencesRecord(ProfileId(pid),frozenset({IntentMode.DATING}),
      CoarseDistanceBand.REGIONAL,None,1)
  return DiscoverySubject(auth,self.profile(pid),prefs,CannabisUse.NONE,
      DerivedAuthorityToken(pid,generation),RevocationMarker(pid,generation,"CURRENT"))

 def candidate(self,subject):
  vis=(
   ProfileVisibility(subject.profile.profile_id,"display_name",VisibilityAudience.DISCOVERABLE,1),
   ProfileVisibility(subject.profile.profile_id,"mode",VisibilityAudience.DISCOVERABLE,1),
   ProfileVisibility(subject.profile.profile_id,"media_refs",VisibilityAudience.DISCOVERABLE,1),
  )
  return DiscoveryCandidate(subject,vis,CoarseDistanceBand.NEARBY,1)

 def ctx(self,*,left_blocked=False,right_blocked=False,left_gen=4,right_gen=4):
  left=self.subject("alice","bob",blocked=left_blocked,generation=left_gen)
  right=self.subject("bob","alice",blocked=right_blocked,generation=right_gen)
  return MatchingContext(left,right,self.candidate(right),self.candidate(left))

 def test_one_sided_like_is_private_intent_not_match_or_message_consent(self):
  ctx=self.ctx();pair=canonical_pair(ProfileId("alice"),ProfileId("bob"))
  like,_,_=record_like(ctx,actor_profile_id=ProfileId("alice"),pair=pair,actor_current_generation=4)
  self.assertEqual(like.state,RelationshipState.LIKED)
  self.assertEqual(pair.state,RelationshipState.NONE)
  left=bind_pair_relationship(ctx.left.authorization,pair)
  right=bind_pair_relationship(ctx.right.authorization,pair)
  self.assertFalse(ordinary_messaging_allowed(MessagingEligibilityPair(left,right)))

 def test_reciprocal_current_likes_form_match(self):
  ctx=self.ctx();pair=canonical_pair(ProfileId("alice"),ProfileId("bob"))
  a,_,_=record_like(ctx,actor_profile_id=ProfileId("alice"),pair=pair,actor_current_generation=4)
  b,_,_=record_like(ctx,actor_profile_id=ProfileId("bob"),pair=pair,actor_current_generation=4)
  out=form_match(ctx,pair=pair,left_intent=a,right_intent=b,left_current_generation=4,right_current_generation=4)
  self.assertEqual(out.pair.state,RelationshipState.MATCHED)
  self.assertEqual(len(out.invalidations),2)

 def test_pass_prevents_match_until_actor_explicitly_changes_intent(self):
  ctx=self.ctx();pair=canonical_pair(ProfileId("alice"),ProfileId("bob"))
  a,_,_=record_like(ctx,actor_profile_id=ProfileId("alice"),pair=pair,actor_current_generation=4)
  p,_,_=record_pass(ctx,actor_profile_id=ProfileId("bob"),pair=pair,actor_current_generation=4)
  with self.assertRaises(MatchingDenied):
   form_match(ctx,pair=pair,left_intent=a,right_intent=p,left_current_generation=4,right_current_generation=4)

 def test_match_rechecks_current_pair_authority(self):
  ctx=self.ctx();pair=canonical_pair(ProfileId("alice"),ProfileId("bob"))
  a=DirectedIntent(ProfileId("alice"),ProfileId("bob"),RelationshipState.LIKED,1)
  b=DirectedIntent(ProfileId("bob"),ProfileId("alice"),RelationshipState.LIKED,1)
  blocked=self.ctx(right_blocked=True)
  with self.assertRaises((MatchingDenied,PermissionError)):
   form_match(blocked,pair=pair,left_intent=a,right_intent=b,left_current_generation=4,right_current_generation=4)

 def test_stale_generation_cannot_like_or_match(self):
  ctx=self.ctx();pair=canonical_pair(ProfileId("alice"),ProfileId("bob"))
  stale=self.ctx(left_gen=3)
  # token and marker are internally same generation in this helper, so make candidate gate stale explicitly
  left=stale.left
  stale_left=DiscoverySubject(left.authorization,left.profile,left.preferences,left.cannabis_use,
      DerivedAuthorityToken("alice",3),RevocationMarker("alice",4,"PROFILE_CHANGED"))
  broken=MatchingContext(stale_left,stale.right,stale.right_as_seen_by_left,
      DiscoveryCandidate(stale_left,stale.left_as_seen_by_right.visibility,CoarseDistanceBand.NEARBY,1))
  with self.assertRaises((MatchingDenied,PermissionError)):
   record_like(broken,actor_profile_id=ProfileId("alice"),pair=pair,actor_current_generation=4)

 def test_unmatch_is_unilateral_immediate_and_advances_epoch(self):
  pair=PairRelationship(ProfileId("alice"),ProfileId("bob"),RelationshipState.MATCHED,1)
  out=unmatch(pair,actor_profile_id=ProfileId("alice"),left_current_generation=5,right_current_generation=5)
  self.assertEqual(out.pair.state,RelationshipState.UNMATCHED)
  self.assertEqual(out.pair.consent_epoch,2)
  for inv in out.invalidations:
   self.assertTrue(affected(inv,DerivedSurface.MESSAGING_AUTH))

 def test_stale_pre_unmatch_likes_cannot_rematch(self):
  ctx=self.ctx()
  old_pair=PairRelationship(ProfileId("alice"),ProfileId("bob"),RelationshipState.MATCHED,1)
  new_pair=unmatch(old_pair,actor_profile_id=ProfileId("bob"),left_current_generation=5,right_current_generation=5).pair
  old_a=DirectedIntent(ProfileId("alice"),ProfileId("bob"),RelationshipState.LIKED,1)
  old_b=DirectedIntent(ProfileId("bob"),ProfileId("alice"),RelationshipState.LIKED,1)
  with self.assertRaises(MatchingDenied):
   form_match(ctx,pair=new_pair,left_intent=old_a,right_intent=old_b,left_current_generation=6,right_current_generation=6)

 def test_fresh_reciprocal_intent_can_form_new_match_in_new_epoch(self):
  ctx=self.ctx()
  pair=PairRelationship(ProfileId("alice"),ProfileId("bob"),RelationshipState.UNMATCHED,2)
  a,_,_=record_like(ctx,actor_profile_id=ProfileId("alice"),pair=pair,actor_current_generation=6)
  b,_,_=record_like(ctx,actor_profile_id=ProfileId("bob"),pair=pair,actor_current_generation=6)
  out=form_match(ctx,pair=pair,left_intent=a,right_intent=b,left_current_generation=6,right_current_generation=6)
  self.assertEqual(out.pair.state,RelationshipState.MATCHED)
  self.assertEqual(out.pair.consent_epoch,2)

 def test_admin_service_or_algorithm_principal_cannot_like(self):
  ctx=self.ctx();pair=canonical_pair(ProfileId("alice"),ProfileId("bob"))
  bad_auth=replace(ctx.left.authorization,context=replace(ctx.left.authorization.context,principal=PrincipalKind.SERVICE))
  bad_left=replace(ctx.left,authorization=bad_auth)
  bad=MatchingContext(bad_left,ctx.right,ctx.right_as_seen_by_left,
      DiscoveryCandidate(bad_left,ctx.left_as_seen_by_right.visibility,CoarseDistanceBand.NEARBY,1))
  with self.assertRaises((MatchingDenied,PermissionError)):
   record_like(bad,actor_profile_id=ProfileId("alice"),pair=pair,actor_current_generation=4)

 def test_pair_binding_enables_messaging_only_after_match(self):
  ctx=self.ctx();pair=canonical_pair(ProfileId("alice"),ProfileId("bob"))
  a=DirectedIntent(ProfileId("alice"),ProfileId("bob"),RelationshipState.LIKED,1)
  b=DirectedIntent(ProfileId("bob"),ProfileId("alice"),RelationshipState.LIKED,1)
  matched=form_match(ctx,pair=pair,left_intent=a,right_intent=b,left_current_generation=4,right_current_generation=4).pair
  left=bind_pair_relationship(ctx.left.authorization,matched)
  right=bind_pair_relationship(ctx.right.authorization,matched)
  self.assertTrue(ordinary_messaging_allowed(MessagingEligibilityPair(left,right)))

 def test_directional_intents_and_pair_persist_privately(self):
  repo=InMemoryPrivateRepository();pair=canonical_pair(ProfileId("alice"),ProfileId("bob"))
  i=DirectedIntent(ProfileId("alice"),ProfileId("bob"),RelationshipState.LIKED,1)
  ir=persist_intent(repo,i,expected_version=None)
  pr=persist_pair(repo,pair,expected_version=None)
  loaded_i,iv=load_intent(repo,ProfileId("alice"),ProfileId("bob"))
  loaded_p,pv=load_pair(repo,ProfileId("bob"),ProfileId("alice"))
  self.assertEqual(loaded_i,i);self.assertEqual(loaded_p,pair)
  self.assertEqual(iv,ir.version);self.assertEqual(pv,pr.version)
  self.assertNotIn("wallet_address",ir.values)

 def test_optimistic_concurrency_prevents_stale_relationship_write(self):
  repo=InMemoryPrivateRepository();pair=canonical_pair(ProfileId("alice"),ProfileId("bob"))
  row=persist_pair(repo,pair,expected_version=None)
  updated=PairRelationship(pair.left_profile_id,pair.right_profile_id,RelationshipState.UNMATCHED,2)
  persist_pair(repo,updated,expected_version=row.version)
  with self.assertRaises(Exception): persist_pair(repo,pair,expected_version=row.version)

 def test_pair_and_intent_records_expose_no_payment_admin_or_public_graph_fields(self):
  self.assertEqual(set(DirectedIntent.__dataclass_fields__),
      {"actor_profile_id","target_profile_id","state","consent_epoch"})
  self.assertEqual(set(PairRelationship.__dataclass_fields__),
      {"left_profile_id","right_profile_id","state","consent_epoch"})

if __name__=="__main__":unittest.main()
