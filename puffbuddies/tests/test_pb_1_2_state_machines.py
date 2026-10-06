import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))
from puffbuddies.domain.types import LifecycleState as L, RelationshipState as R
from puffbuddies.domain.state_machines import *

class PB12StateMachineTests(unittest.TestCase):
 def test_lifecycle_vocabulary(self): self.assertEqual(len(L),14)
 def test_entry_and_activation(self):
  self.assertEqual(lifecycle_transition(L.UNREGISTERED,L.ELIGIBILITY_PENDING,Authority.ENTRY),L.ELIGIBILITY_PENDING)
  self.assertEqual(lifecycle_transition(L.PROFILE_INCOMPLETE,L.ACTIVE,Authority.PROFILE_POLICY),L.ACTIVE)
 def test_client_payment_dependency_cannot_activate(self):
  for a in (Authority.USER,Authority.ENTRY,Authority.SAFETY,Authority.DELETION_PROCESSOR,Authority.REVIEW):
   with self.assertRaises(TransitionDenied): lifecycle_transition(L.DEACTIVATED,L.ACTIVE,a)
 def test_deletion_is_one_way_for_ordinary_participation(self):
  self.assertFalse(ordinary_participation_allowed(L.DELETE_REQUESTED));self.assertFalse(ordinary_participation_allowed(L.DELETION_IN_PROGRESS));self.assertFalse(ordinary_participation_allowed(L.DELETION_COMPLETE))
  with self.assertRaises(TransitionDenied): lifecycle_transition(L.DELETION_COMPLETE,L.ACTIVE,Authority.PROFILE_POLICY)
 def test_appeal_does_not_restore_access(self):
  self.assertEqual(lifecycle_transition(L.BANNED,L.APPEAL_REVIEW,Authority.REVIEW),L.APPEAL_REVIEW);self.assertFalse(ordinary_participation_allowed(L.APPEAL_REVIEW))
 def test_safety_overrides_active(self): self.assertEqual(lifecycle_transition(L.ACTIVE,L.SUSPENDED,Authority.SAFETY),L.SUSPENDED)
 def test_unknown_transition_fails_closed(self):
  with self.assertRaises(TransitionDenied): lifecycle_transition(L.ACTIVE,L.ELIGIBILITY_PENDING,Authority.ENTRY)
 def test_match_requires_reciprocal_users(self):
  with self.assertRaises(TransitionDenied): relationship_transition(R.LIKED,R.MATCHED,Authority.USER)
  self.assertEqual(relationship_transition(R.LIKED,R.MATCHED,Authority.RECIPROCAL_USERS),R.MATCHED)
 def test_algorithm_admin_payment_have_no_authority_enum(self):
  self.assertNotIn("ALGORITHM",Authority.__members__);self.assertNotIn("ADMIN",Authority.__members__);self.assertNotIn("PAYMENT",Authority.__members__)
 def test_block_supremacy_no_unblock_shortcut(self):
  self.assertEqual(relationship_transition(R.MATCHED,R.BLOCKED,Authority.USER),R.BLOCKED)
  with self.assertRaises(TransitionDenied): relationship_transition(R.BLOCKED,R.MATCHED,Authority.RECIPROCAL_USERS)

if __name__=="__main__":unittest.main()
