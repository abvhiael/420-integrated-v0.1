import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))
from puffbuddies.domain.authorization import AuthorizationContext,PrincipalKind
from puffbuddies.domain.eligibility_authorization import BoundEligibilityAuthorization
from puffbuddies.domain.messaging_eligibility import MessagingEligibilityPair,ordinary_messaging_allowed
from puffbuddies.domain.matching import PairRelationship,bind_pair_relationship
from puffbuddies.domain.safety import *
from puffbuddies.domain.profiles import ProfileRecord
from puffbuddies.domain.types import *

D="b"*64
class PB8IntegrationTests(unittest.TestCase):
 def bound(self,pid,peer,pair,lifecycle=LifecycleState.ACTIVE):
  raw=BoundEligibilityAuthorization(AuthorizationContext(PrincipalKind.USER,pid,actor_id=peer,
   eligibility=EligibilityState.ELIGIBLE,lifecycle=lifecycle),1,"v1",100)
  return bind_pair_relationship(raw,pair)
 def case(self):
  c=submit_report(case_id="case:2",reporter_profile_id=ProfileId("alice"),subject_profile_id=ProfileId("bob"),
   report_class=ReportClass.HARASSMENT_THREATS,evidence_digest=D,evidence_ref="e:2",
   policy_basis="PB-SAFETY",retention_reason="safety")
  c=advance_case(c,target=ModerationState.TRIAGED,actor_id="t",role=ModeratorRole.TRIAGE)
  return advance_case(c,target=ModerationState.REVIEWING,actor_id="m",role=ModeratorRole.MODERATOR)
 def profile(self):
  return ProfileRecord(ProfileId("bob"),IntentMode.DATING,LifecycleState.ACTIVE,(("display_name","b"),),("m:1",),1)

 def test_block_immediately_defeats_matched_messaging(self):
  pair=PairRelationship(ProfileId("alice"),ProfileId("bob"),RelationshipState.MATCHED,2)
  self.assertTrue(ordinary_messaging_allowed(MessagingEligibilityPair(self.bound("alice","bob",pair),self.bound("bob","alice",pair))))
  blocked=block_pair(pair,actor_profile_id=ProfileId("alice"),left_current_generation=3,right_current_generation=3).pair
  left=self.bound("alice","bob",blocked);right=self.bound("bob","alice",blocked)
  self.assertTrue(left.context.blocked);self.assertTrue(right.context.blocked)
  self.assertFalse(ordinary_messaging_allowed(MessagingEligibilityPair(left,right)))

 def test_suspension_defeats_old_match_without_changing_other_users_block_choice(self):
  pair=PairRelationship(ProfileId("alice"),ProfileId("bob"),RelationshipState.MATCHED,2)
  out=apply_action(self.case(),self.profile(),action=SafetyAction.SUSPENSION,actor_id="m",
   role=ModeratorRole.MODERATOR,current_generation=4,human_reviewed=True)
  self.assertEqual(out.lifecycle,LifecycleState.SUSPENDED)
  self.assertFalse(ordinary_messaging_allowed(MessagingEligibilityPair(
   self.bound("alice","bob",pair),self.bound("bob","alice",pair,lifecycle=out.lifecycle))))

 def test_appeal_never_manufactures_match_or_contact(self):
  c=apply_action(self.case(),self.profile(),action=SafetyAction.WARNING,actor_id="m",
   role=ModeratorRole.MODERATOR,current_generation=4,human_reviewed=True).case
  appeal=request_appeal(c,subject_profile_id=ProfileId("bob"))
  self.assertEqual(appeal.state,ModerationState.APPEALED)
  pair=PairRelationship(ProfileId("alice"),ProfileId("bob"),RelationshipState.UNMATCHED,4)
  self.assertEqual(pair.state,RelationshipState.UNMATCHED)

if __name__=="__main__":unittest.main()
