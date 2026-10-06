import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))
from puffbuddies.domain.types import *
from puffbuddies.domain.state_machines import *
from puffbuddies.domain.authorization import *
from puffbuddies.domain.invalidation import *
from puffbuddies.domain.privacy import LeakageDenied,wallet_lookup_membership_result
from puffbuddies.domain.audit_evidence import AuditKind,record_transition
from puffbuddies.domain.repositories import VersionConflict
from puffbuddies.storage.memory import InMemoryPrivateRepository
from puffbuddies.persistence.revocation import *
from puffbuddies.persistence.migrations import Migration,MigrationDenied,apply_migration
from puffbuddies.persistence.recovery import Snapshot,validate_restore,RecoveryFailed,require_current_replica

class PB113IntegrationTests(unittest.TestCase):
 def ctx(self,rel=RelationshipState.NONE,life=LifecycleState.ACTIVE,elig=EligibilityState.ELIGIBLE,blocked=False):
  return AuthorizationContext(PrincipalKind.USER,"alice",actor_id="bob",eligibility=elig,lifecycle=life,relationship=rel,blocked=blocked)
 def test_reciprocal_match_authorizes_then_unmatch_revokes_and_invalidates(self):
  rel=relationship_transition(RelationshipState.LIKED,RelationshipState.MATCHED,Authority.RECIPROCAL_USERS)
  self.assertTrue(authorize_private_access(VisibilityAudience.MATCHED,self.ctx(rel)))
  rel=relationship_transition(rel,RelationshipState.UNMATCHED,Authority.USER)
  self.assertFalse(authorize_private_access(VisibilityAudience.MATCHED,self.ctx(rel)))
  marker=next_revocation("alice",3,"UNMATCH")
  inv=invalidation_for(marker,CanonicalChange.UNMATCH)
  self.assertTrue(affected(inv,DerivedSurface.MESSAGING_AUTH));self.assertTrue(affected(inv,DerivedSurface.MATCHING))
  self.assertFalse(derived_usable(DerivedSurface.MESSAGING_AUTH,DerivedAuthorityToken("alice",3),marker))
 def test_block_overrides_match_and_invalidates_all_derived(self):
  c=self.ctx(RelationshipState.MATCHED,blocked=True)
  self.assertFalse(authorize_private_access(VisibilityAudience.MATCHED,c));self.assertFalse(authorize_relationship_action(c))
  marker=next_revocation("alice",5,"BLOCK");self.assertEqual(invalidation_for(marker,CanonicalChange.BLOCK).surfaces,ALL_DERIVED)
 def test_deletion_lifecycle_revokes_authority_restore_and_derived_state(self):
  state=lifecycle_transition(LifecycleState.ACTIVE,LifecycleState.DELETE_REQUESTED,Authority.USER)
  self.assertEqual(state,LifecycleState.DELETE_REQUESTED)
  c=self.ctx(RelationshipState.MATCHED,life=state);self.assertFalse(authorize_private_access(VisibilityAudience.MATCHED,c))
  marker=next_revocation("alice",8,"DELETE",deletion_complete=True)
  self.assertFalse(token_current(DerivedAuthorityToken("alice",marker.generation),marker))
  with self.assertRaises(RevocationDenied): validate_restore(Snapshot(999,()),marker)
 def test_repository_concurrency_plus_revocation_prevents_stale_resurrection(self):
  r=InMemoryPrivateRepository();a=r.put("lifecycle","alice",{"profile_id":"alice","state":"ACTIVE","version":1},expected_version=None)
  b=r.put("lifecycle","alice",{"profile_id":"alice","state":"DELETE_REQUESTED","version":2},expected_version=a.version)
  with self.assertRaises(VersionConflict):r.put("lifecycle","alice",{"profile_id":"alice","state":"ACTIVE","version":3},expected_version=a.version)
  marker=next_revocation("alice",1,"DELETE")
  with self.assertRaises(VersionConflict):reject_stale_write_after_revocation(write_generation=1,marker=marker)
  self.assertEqual(r.get("lifecycle","alice").version,b.version)
 def test_migration_cannot_restore_revoked_lifecycle_or_manufacture_match(self):
  lm=Migration("lifecycle",1,2,lambda x:{**x,"state":"ACTIVE"})
  with self.assertRaises(MigrationDenied):apply_migration(lm,{"profile_id":"alice","state":"DELETE_REQUESTED","version":1})
  rm=Migration("relationship",1,2,lambda x:{**x,"state":"MATCHED"})
  with self.assertRaises(MigrationDenied):apply_migration(rm,{"relationship_id":"r","left_profile_id":"alice","right_profile_id":"bob","state":"UNMATCHED","version":1})
 def test_transition_evidence_tracks_valid_transition_but_cannot_create_consent(self):
  e=record_transition(kind=AuditKind.RELATIONSHIP,profile_id="alice",source=RelationshipState.LIKED,target=RelationshipState.MATCHED,authority=Authority.RECIPROCAL_USERS,reason_code="RECIPROCAL",sequence=1,pepper="p")
  self.assertNotEqual(e.subject_ref,"alice")
  with self.assertRaises(TransitionDenied):record_transition(kind=AuditKind.CONSENT,profile_id="alice",source=RelationshipState.NONE,target=RelationshipState.MATCHED,authority=Authority.USER,reason_code="FAKE",sequence=2,pepper="p")
 def test_stale_replica_cannot_override_current_private_state(self):
  a=StoredRecord("lifecycle","alice",1,{"profile_id":"alice","state":"ACTIVE","version":1})
  b=StoredRecord("lifecycle","alice",2,{"profile_id":"alice","state":"SUSPENDED","version":2})
  with self.assertRaises(RecoveryFailed):require_current_replica(a,b)
 def test_private_membership_remains_nondiscoverable_by_wallet(self):
  with self.assertRaises(LeakageDenied):wallet_lookup_membership_result("0xabc")
 def test_conflicting_authorities_choose_restrictive_result(self):
  for c in (self.ctx(RelationshipState.MATCHED,elig=EligibilityState.REVOKED),self.ctx(RelationshipState.MATCHED,life=LifecycleState.SUSPENDED),self.ctx(RelationshipState.MATCHED,blocked=True)):
   self.assertFalse(authorize_private_access(VisibilityAudience.MATCHED,c))
if __name__=="__main__":unittest.main()
