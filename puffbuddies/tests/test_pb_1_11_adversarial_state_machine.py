import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))
from puffbuddies.domain.state_machines import *
from puffbuddies.domain.types import *
from puffbuddies.domain.authorization import *
from puffbuddies.domain.repositories import VersionConflict
from puffbuddies.storage.memory import InMemoryPrivateRepository
from puffbuddies.persistence.revocation import *
from puffbuddies.persistence.migrations import Migration,MigrationDenied,apply_migration
from puffbuddies.domain.audit_evidence import AuditKind,record_transition
class PB111AdversarialStateMachineTests(unittest.TestCase):
 def test_invalid_lifecycle_transitions_fail_closed(self):
  cases=[(LifecycleState.UNREGISTERED,LifecycleState.ACTIVE,Authority.USER),
   (LifecycleState.DELETION_COMPLETE,LifecycleState.ACTIVE,Authority.PROFILE_POLICY),
   (LifecycleState.DELETE_REQUESTED,LifecycleState.ACTIVE,Authority.PROFILE_POLICY),
   (LifecycleState.BANNED,LifecycleState.ACTIVE,Authority.REVIEW)]
  for a,b,auth in cases:
   with self.assertRaises(TransitionDenied): lifecycle_transition(a,b,auth)
 def test_invalid_relationship_and_consent_fabrication_fail(self):
  for a,b,auth in [(RelationshipState.NONE,RelationshipState.MATCHED,Authority.USER),
   (RelationshipState.LIKED,RelationshipState.MATCHED,Authority.USER),
   (RelationshipState.UNMATCHED,RelationshipState.MATCHED,Authority.RECIPROCAL_USERS),
   (RelationshipState.BLOCKED,RelationshipState.MATCHED,Authority.RECIPROCAL_USERS)]:
   with self.assertRaises(TransitionDenied): relationship_transition(a,b,auth)
 def test_replay_same_transition_fails_after_state_advance(self):
  state=relationship_transition(RelationshipState.NONE,RelationshipState.LIKED,Authority.USER)
  with self.assertRaises(TransitionDenied): relationship_transition(state,RelationshipState.LIKED,Authority.USER)
 def test_block_is_terminal_for_relationship_machine(self):
  for target in RelationshipState:
   with self.assertRaises(TransitionDenied): relationship_transition(RelationshipState.BLOCKED,target,Authority.USER)
 def test_block_bypass_fails_authorization_even_if_matched(self):
  c=AuthorizationContext(PrincipalKind.USER,"p",actor_id="q",eligibility=EligibilityState.ELIGIBLE,lifecycle=LifecycleState.ACTIVE,relationship=RelationshipState.MATCHED,blocked=True)
  for audience in (VisibilityAudience.DISCOVERABLE,VisibilityAudience.MATCHED,VisibilityAudience.PARTICIPANT_ONLY):
   self.assertFalse(authorize_private_access(audience,c))
  self.assertFalse(authorize_relationship_action(c))
 def test_stale_match_cannot_authorize_after_unmatch(self):
  c=AuthorizationContext(PrincipalKind.USER,"p",actor_id="q",eligibility=EligibilityState.ELIGIBLE,lifecycle=LifecycleState.ACTIVE,relationship=RelationshipState.UNMATCHED)
  self.assertFalse(authorize_private_access(VisibilityAudience.MATCHED,c))
  self.assertFalse(authorize_private_access(VisibilityAudience.PARTICIPANT_ONLY,c))
 def test_revoked_lifecycle_conflicts_with_stale_match_and_denies(self):
  for life in (LifecycleState.SUSPENDED,LifecycleState.BANNED,LifecycleState.DELETE_REQUESTED,LifecycleState.DELETION_IN_PROGRESS,LifecycleState.DELETION_COMPLETE):
   c=AuthorizationContext(PrincipalKind.USER,"p",actor_id="q",eligibility=EligibilityState.ELIGIBLE,lifecycle=life,relationship=RelationshipState.MATCHED)
   self.assertFalse(authorize_private_access(VisibilityAudience.MATCHED,c),life)
 def test_unauthorized_repository_reads_fail_policy(self):
  for table in ("profile","preferences","relationship","lifecycle","location","cannabis","matching_input","safety","eligibility_projection"):
   c=AuthorizationContext(PrincipalKind.PUBLIC,"p")
   self.assertFalse(authorize_repository_read(table,c),table)
 def test_stale_write_and_delete_conflicts(self):
  r=InMemoryPrivateRepository(); row=r.put("lifecycle","p",{"profile_id":"p","state":"ACTIVE","version":1},expected_version=None)
  row2=r.put("lifecycle","p",{"profile_id":"p","state":"DEACTIVATED","version":2},expected_version=row.version)
  with self.assertRaises(VersionConflict): r.put("lifecycle","p",{"profile_id":"p","state":"ACTIVE","version":3},expected_version=row.version)
  with self.assertRaises(VersionConflict): r.delete("lifecycle","p",expected_version=row.version)
  self.assertEqual(r.get("lifecycle","p").version,row2.version)
 def test_deletion_resurrection_fails_restore_write_and_migration(self):
  marker=RevocationMarker("p",9,"DELETE",True)
  self.assertFalse(restore_allowed(999,marker))
  with self.assertRaises(VersionConflict): reject_stale_write_after_revocation(write_generation=999,marker=marker)
  m=Migration("lifecycle",1,2,lambda x:{**x,"state":"ACTIVE"})
  with self.assertRaises(MigrationDenied): apply_migration(m,{"profile_id":"p","state":"DELETION_COMPLETE","version":1})
 def test_denied_transition_cannot_be_recorded_as_successful_evidence(self):
  with self.assertRaises(TransitionDenied):
   record_transition(kind=AuditKind.CONSENT,profile_id="p",source=RelationshipState.NONE,target=RelationshipState.MATCHED,authority=Authority.USER,reason_code="REPLAY",sequence=1,pepper="secret")
 def test_conflicting_eligibility_lifecycle_relationship_fails_closed(self):
  c=AuthorizationContext(PrincipalKind.USER,"p",actor_id="q",eligibility=EligibilityState.REVOKED,lifecycle=LifecycleState.ACTIVE,relationship=RelationshipState.MATCHED)
  self.assertFalse(authorize_private_access(VisibilityAudience.DISCOVERABLE,c))
  self.assertFalse(authorize_private_access(VisibilityAudience.MATCHED,c))
  self.assertFalse(authorize_relationship_action(c))
 def test_payment_admin_algorithm_ai_are_not_transition_authorities(self):
  values={a.value for a in Authority}
  for forbidden in ("PAYMENT","ADMIN","ALGORITHM","AI"):self.assertNotIn(forbidden,values)
if __name__=="__main__":unittest.main()
