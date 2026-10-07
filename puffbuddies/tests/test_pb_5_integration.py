import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))

from puffbuddies.domain.authorization import AuthorizationContext,PrincipalKind
from puffbuddies.domain.discovery import *
from puffbuddies.domain.eligibility_authorization import BoundEligibilityAuthorization
from puffbuddies.domain.matching import *
from puffbuddies.domain.messaging_eligibility import MessagingEligibilityPair,ordinary_messaging_allowed
from puffbuddies.domain.profiles import ProfileRecord,ProfileVisibility
from puffbuddies.domain.types import *
from puffbuddies.persistence.revocation import DerivedAuthorityToken,RevocationMarker

class PB5DiscoveryMatchingIntegrationTests(unittest.TestCase):
 def profile(self,pid):
  return ProfileRecord(ProfileId(pid),IntentMode.DATING,LifecycleState.ACTIVE,
      (("display_name",pid),),("media:1",),1)

 def subject(self,pid,actor,*,blocked=False,generation=4):
  auth=BoundEligibilityAuthorization(
   AuthorizationContext(PrincipalKind.USER,pid,actor_id=actor,
    eligibility=EligibilityState.ELIGIBLE,lifecycle=LifecycleState.ACTIVE,
    relationship=RelationshipState.NONE,blocked=blocked),1,"v1",100)
  prefs=DiscoveryPreferencesRecord(ProfileId(pid),frozenset({IntentMode.DATING}),
      CoarseDistanceBand.REGIONAL,None,1)
  return DiscoverySubject(auth,self.profile(pid),prefs,CannabisUse.NONE,
      DerivedAuthorityToken(pid,generation),RevocationMarker(pid,generation,"CURRENT"))

 def candidate(self,s):
  return DiscoveryCandidate(s,(
   ProfileVisibility(s.profile.profile_id,"display_name",VisibilityAudience.DISCOVERABLE,1),
   ProfileVisibility(s.profile.profile_id,"mode",VisibilityAudience.DISCOVERABLE,1),
   ProfileVisibility(s.profile.profile_id,"media_refs",VisibilityAudience.DISCOVERABLE,1),
  ),CoarseDistanceBand.NEARBY,1)

 def ctx(self,*,blocked_right=False):
  left=self.subject("alice","bob")
  right=self.subject("bob","alice",blocked=blocked_right)
  return MatchingContext(left,right,self.candidate(right),self.candidate(left))

 def test_discovery_to_reciprocal_match_to_unmatch_lifecycle(self):
  ctx=self.ctx()
  self.assertEqual([r.profile_id for r in discover(ctx.left,[ctx.right_as_seen_by_left])],[ProfileId("bob")])
  self.assertEqual([r.profile_id for r in discover(ctx.right,[ctx.left_as_seen_by_right])],[ProfileId("alice")])
  pair=canonical_pair(ProfileId("alice"),ProfileId("bob"))

  left_like,_,_=record_like(ctx,actor_profile_id=ProfileId("alice"),pair=pair,actor_current_generation=4)
  self.assertEqual(pair.state,RelationshipState.NONE)
  self.assertFalse(ordinary_messaging_allowed(MessagingEligibilityPair(
      bind_pair_relationship(ctx.left.authorization,pair),
      bind_pair_relationship(ctx.right.authorization,pair))))

  right_like,_,_=record_like(ctx,actor_profile_id=ProfileId("bob"),pair=pair,actor_current_generation=4)
  matched=form_match(ctx,pair=pair,left_intent=left_like,right_intent=right_like,
      left_current_generation=4,right_current_generation=4).pair
  self.assertEqual(matched.state,RelationshipState.MATCHED)
  self.assertTrue(ordinary_messaging_allowed(MessagingEligibilityPair(
      bind_pair_relationship(ctx.left.authorization,matched),
      bind_pair_relationship(ctx.right.authorization,matched))))

  ended=unmatch(matched,actor_profile_id=ProfileId("alice"),
      left_current_generation=5,right_current_generation=5).pair
  self.assertEqual(ended.state,RelationshipState.UNMATCHED)
  self.assertFalse(ordinary_messaging_allowed(MessagingEligibilityPair(
      bind_pair_relationship(ctx.left.authorization,ended),
      bind_pair_relationship(ctx.right.authorization,ended))))
  with self.assertRaises(MatchingDenied):
   form_match(ctx,pair=ended,left_intent=left_like,right_intent=right_like,
      left_current_generation=6,right_current_generation=6)

 def test_fresh_epoch_requires_two_new_user_actions(self):
  ctx=self.ctx()
  pair=PairRelationship(ProfileId("alice"),ProfileId("bob"),RelationshipState.UNMATCHED,2)
  left_like,_,_=record_like(ctx,actor_profile_id=ProfileId("alice"),pair=pair,actor_current_generation=6)
  with self.assertRaises(MatchingDenied):
   form_match(ctx,pair=pair,left_intent=left_like,
      right_intent=DirectedIntent(ProfileId("bob"),ProfileId("alice"),RelationshipState.LIKED,1),
      left_current_generation=6,right_current_generation=6)
  right_like,_,_=record_like(ctx,actor_profile_id=ProfileId("bob"),pair=pair,actor_current_generation=6)
  self.assertEqual(form_match(ctx,pair=pair,left_intent=left_like,right_intent=right_like,
      left_current_generation=6,right_current_generation=6).pair.state,RelationshipState.MATCHED)

 def test_current_block_defeats_old_reciprocal_likes(self):
  pair=canonical_pair(ProfileId("alice"),ProfileId("bob"))
  left_like=DirectedIntent(ProfileId("alice"),ProfileId("bob"),RelationshipState.LIKED,1)
  right_like=DirectedIntent(ProfileId("bob"),ProfileId("alice"),RelationshipState.LIKED,1)
  with self.assertRaises((MatchingDenied,PermissionError)):
   form_match(self.ctx(blocked_right=True),pair=pair,left_intent=left_like,right_intent=right_like,
      left_current_generation=4,right_current_generation=4)

if __name__=="__main__":unittest.main()
