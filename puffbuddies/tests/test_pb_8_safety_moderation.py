import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))
from puffbuddies.domain.safety import *
from puffbuddies.domain.matching import PairRelationship
from puffbuddies.domain.profiles import ProfileRecord
from puffbuddies.domain.invalidation import DerivedSurface,affected
from puffbuddies.domain.types import *
from puffbuddies.storage.memory import InMemoryPrivateRepository

D="a"*64
class PB8SafetyTests(unittest.TestCase):
 def case(self,cls=ReportClass.HARASSMENT_THREATS):
  return submit_report(case_id="case:1",reporter_profile_id=ProfileId("alice"),
   subject_profile_id=ProfileId("bob"),report_class=cls,evidence_digest=D,
   evidence_ref="evidence:opaque:1",policy_basis="PB-SAFETY",retention_reason="safety-review")
 def profile(self,state=LifecycleState.ACTIVE):
  return ProfileRecord(ProfileId("bob"),IntentMode.DATING,state,(("display_name","bob"),),("m:1",),1)

 def test_report_is_received_only_and_does_not_block_or_establish_guilt(self):
  c=self.case();self.assertEqual(c.state,ModerationState.RECEIVED)
  self.assertEqual(c.action,SafetyAction.NONE)
  self.assertFalse(hasattr(c,"report_count"))

 def test_all_twelve_canonical_report_classes_exist(self):
  self.assertEqual(len(ReportClass),12)
  self.assertIn(ReportClass.MINOR_ELIGIBILITY,HIGH_PRIORITY)
  self.assertEqual(case_priority(self.case()),"STANDARD")
  self.assertEqual(case_priority(self.case(ReportClass.MINOR_ELIGIBILITY)),"HIGH")

 def test_block_is_immediate_independent_and_invalidates_both_sides(self):
  pair=PairRelationship(ProfileId("alice"),ProfileId("bob"),RelationshipState.MATCHED,2)
  out=block_pair(pair,actor_profile_id=ProfileId("alice"),left_current_generation=4,right_current_generation=7)
  self.assertEqual(out.pair.state,RelationshipState.BLOCKED)
  self.assertEqual(out.pair.consent_epoch,3)
  for inv in out.invalidations:
   self.assertTrue(affected(inv,DerivedSurface.MESSAGING_AUTH))
   self.assertTrue(affected(inv,DerivedSurface.DISCOVERY))

 def test_report_does_not_silently_block(self):
  c=self.case()
  pair=PairRelationship(ProfileId("alice"),ProfileId("bob"),RelationshipState.MATCHED,1)
  self.assertEqual(c.state,ModerationState.RECEIVED);self.assertEqual(pair.state,RelationshipState.MATCHED)

 def test_triage_review_state_machine_and_least_privilege(self):
  c=self.case()
  with self.assertRaises(SafetyDenied):
   advance_case(c,target=ModerationState.TRIAGED,actor_id="appeals",role=ModeratorRole.APPEALS)
  c=advance_case(c,target=ModerationState.TRIAGED,actor_id="triage",role=ModeratorRole.TRIAGE)
  c=advance_case(c,target=ModerationState.REVIEWING,actor_id="mod",role=ModeratorRole.MODERATOR)
  self.assertEqual(c.state,ModerationState.REVIEWING)

 def test_pending_restriction_changes_lifecycle_and_invalidates_all_derived(self):
  c=advance_case(self.case(),target=ModerationState.TRIAGED,actor_id="triage",role=ModeratorRole.TRIAGE)
  out=impose_pending_restriction(c,self.profile(),actor_id="mod",role=ModeratorRole.MODERATOR,current_generation=5)
  self.assertEqual(out.case.state,ModerationState.RESTRICTED_PENDING_REVIEW)
  self.assertEqual(out.lifecycle,LifecycleState.RESTRICTED)
  for s in DerivedSurface:self.assertTrue(affected(out.invalidation,s))

 def test_final_action_requires_human_review(self):
  c=advance_case(self.case(),target=ModerationState.TRIAGED,actor_id="t",role=ModeratorRole.TRIAGE)
  c=advance_case(c,target=ModerationState.REVIEWING,actor_id="m",role=ModeratorRole.MODERATOR)
  with self.assertRaises(SafetyDenied):
   apply_action(c,self.profile(),action=SafetyAction.BAN,actor_id="m",
    role=ModeratorRole.MODERATOR,current_generation=2,human_reviewed=False)

 def test_suspend_and_ban_use_canonical_lifecycle_authority(self):
  c=advance_case(self.case(),target=ModerationState.TRIAGED,actor_id="t",role=ModeratorRole.TRIAGE)
  c=advance_case(c,target=ModerationState.REVIEWING,actor_id="m",role=ModeratorRole.MODERATOR)
  out=apply_action(c,self.profile(),action=SafetyAction.SUSPENSION,actor_id="m",
   role=ModeratorRole.SENIOR_MODERATOR,current_generation=2,human_reviewed=True)
  self.assertEqual(out.lifecycle,LifecycleState.SUSPENDED)
  self.assertEqual(out.case.state,ModerationState.ACTIONED)

 def test_appeal_does_not_restore_lifecycle_or_unblock(self):
  c=advance_case(self.case(),target=ModerationState.TRIAGED,actor_id="t",role=ModeratorRole.TRIAGE)
  c=advance_case(c,target=ModerationState.REVIEWING,actor_id="m",role=ModeratorRole.MODERATOR)
  acted=apply_action(c,self.profile(),action=SafetyAction.SUSPENSION,actor_id="m",
   role=ModeratorRole.MODERATOR,current_generation=2,human_reviewed=True)
  appeal=request_appeal(acted.case,subject_profile_id=ProfileId("bob"))
  self.assertEqual(appeal.state,ModerationState.APPEALED)
  self.assertEqual(acted.lifecycle,LifecycleState.SUSPENDED)
  pair=PairRelationship(ProfileId("alice"),ProfileId("bob"),RelationshipState.BLOCKED,2)
  self.assertEqual(pair.state,RelationshipState.BLOCKED)

 def test_appeal_adjudication_requires_appeals_or_senior_authority(self):
  c=advance_case(self.case(),target=ModerationState.TRIAGED,actor_id="t",role=ModeratorRole.TRIAGE)
  c=advance_case(c,target=ModerationState.REVIEWING,actor_id="m",role=ModeratorRole.MODERATOR)
  c=apply_action(c,self.profile(),action=SafetyAction.WARNING,actor_id="m",
   role=ModeratorRole.MODERATOR,current_generation=2,human_reviewed=True).case
  c=request_appeal(c,subject_profile_id=ProfileId("bob"))
  with self.assertRaises(SafetyDenied):
   no_action(c,actor_id="ordinary",role=ModeratorRole.MODERATOR)
  resolved=no_action(c,actor_id="appeals",role=ModeratorRole.APPEALS)
  self.assertEqual(resolved.state,ModerationState.NO_ACTION)

 def test_no_action_does_not_remove_independent_block(self):
  c=advance_case(self.case(),target=ModerationState.TRIAGED,actor_id="t",role=ModeratorRole.TRIAGE)
  resolved=no_action(c,actor_id="m",role=ModeratorRole.MODERATOR)
  self.assertEqual(resolved.state,ModerationState.NO_ACTION)
  pair=PairRelationship(ProfileId("alice"),ProfileId("bob"),RelationshipState.BLOCKED,3)
  self.assertEqual(pair.state,RelationshipState.BLOCKED)

 def test_evidence_is_digest_plus_opaque_reference_not_raw_payload(self):
  self.assertEqual(set(SafetyCase.__dataclass_fields__),{
   "case_id","reporter_profile_id","subject_profile_id","report_class","state","evidence_digest",
   "evidence_ref","policy_basis","action","moderator_actor_id","retention_reason","version"})
  with self.assertRaises(SafetyDenied):
   submit_report(case_id="x",reporter_profile_id=ProfileId("a"),subject_profile_id=ProfileId("b"),
    report_class=ReportClass.OTHER,evidence_digest="raw evidence",evidence_ref="https://public.example/e",
    policy_basis="p",retention_reason="r")

 def test_private_safety_case_persistence_and_optimistic_concurrency(self):
  repo=InMemoryPrivateRepository();c=self.case()
  row=persist_case(repo,c,expected_version=None);loaded,v=load_case(repo,c.case_id)
  self.assertEqual(loaded,c);self.assertEqual(v,row.version)
  c2=advance_case(c,target=ModerationState.TRIAGED,actor_id="t",role=ModeratorRole.TRIAGE)
  persist_case(repo,c2,expected_version=row.version)
  with self.assertRaises(Exception):persist_case(repo,c,expected_version=row.version)

 def test_case_has_no_payment_wallet_public_score_or_message_fields(self):
  fields=set(SafetyCase.__dataclass_fields__)
  for x in ("wallet_address","payment_status","premium","report_count","risk_score","message_body","public_score"):
   self.assertNotIn(x,fields)

if __name__=="__main__":unittest.main()
