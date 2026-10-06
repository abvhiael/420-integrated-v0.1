import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))
from puffbuddies.domain.authorization import *
from puffbuddies.domain.types import *

def ctx(**kw):
 d=dict(principal=PrincipalKind.USER,subject_id="s",actor_id="a",eligibility=EligibilityState.ELIGIBLE,lifecycle=LifecycleState.ACTIVE)
 d.update(kw);return AuthorizationContext(**d)
class PB15AuthorizationTests(unittest.TestCase):
 def test_discovery_requires_current_eligible_active_user(self):
  self.assertTrue(authorize_private_access(VisibilityAudience.DISCOVERABLE,ctx()))
  for e in (EligibilityState.UNKNOWN,EligibilityState.EXPIRED,EligibilityState.REVOKED,EligibilityState.INELIGIBLE):
   self.assertFalse(authorize_private_access(VisibilityAudience.DISCOVERABLE,ctx(eligibility=e)))
  for l in (LifecycleState.DEACTIVATED,LifecycleState.SUSPENDED,LifecycleState.BANNED,LifecycleState.DELETE_REQUESTED,LifecycleState.DELETION_IN_PROGRESS,LifecycleState.DELETION_COMPLETE):
   self.assertFalse(authorize_private_access(VisibilityAudience.DISCOVERABLE,ctx(lifecycle=l)))
 def test_match_visibility_requires_current_match(self):
  self.assertTrue(authorize_private_access(VisibilityAudience.MATCHED,ctx(relationship=RelationshipState.MATCHED)))
  for r in (RelationshipState.NONE,RelationshipState.LIKED,RelationshipState.UNMATCHED,RelationshipState.BLOCKED):
   self.assertFalse(authorize_private_access(VisibilityAudience.MATCHED,ctx(relationship=r)))
 def test_block_overrides_discovery_and_match(self):
  self.assertFalse(authorize_private_access(VisibilityAudience.DISCOVERABLE,ctx(blocked=True)))
  self.assertFalse(authorize_private_access(VisibilityAudience.MATCHED,ctx(blocked=True,relationship=RelationshipState.MATCHED)))
 def test_private_self_only_self(self):
  self.assertTrue(authorize_private_access(VisibilityAudience.PRIVATE_SELF,ctx(principal=PrincipalKind.SELF)))
  self.assertFalse(authorize_private_access(VisibilityAudience.PRIVATE_SELF,ctx()))
 def test_moderator_requires_case_purpose(self):
  self.assertTrue(authorize_safety_access(ctx(principal=PrincipalKind.MODERATOR,moderator_case=True)))
  self.assertFalse(authorize_safety_access(ctx(principal=PrincipalKind.MODERATOR,moderator_case=False)))
  self.assertFalse(authorize_private_access(VisibilityAudience.MODERATOR_ONLY,ctx(principal=PrincipalKind.SERVICE,service_approved=True)))
 def test_service_minimum_requires_approved_service(self):
  self.assertTrue(authorize_eligibility_minimum(ctx(principal=PrincipalKind.SERVICE,service_approved=True)))
  self.assertFalse(authorize_eligibility_minimum(ctx(principal=PrincipalKind.SERVICE)))
 def test_never_public_denies_public(self):
  self.assertFalse(authorize_private_access(VisibilityAudience.NEVER_PUBLIC,ctx(principal=PrincipalKind.PUBLIC,public_explicit=True)))
 def test_public_explicit_requires_both_public_principal_and_explicit_flag(self):
  self.assertTrue(authorize_private_access(VisibilityAudience.PUBLIC_EXPLICIT,ctx(principal=PrincipalKind.PUBLIC,public_explicit=True)))
  self.assertFalse(authorize_private_access(VisibilityAudience.PUBLIC_EXPLICIT,ctx(principal=PrincipalKind.PUBLIC)))
 def test_aggregate_requires_approved_and_safe(self):
  self.assertTrue(authorize_private_access(VisibilityAudience.AGGREGATE_ONLY,ctx(principal=PrincipalKind.SERVICE,service_approved=True,aggregate_safe=True)))
  self.assertFalse(authorize_private_access(VisibilityAudience.AGGREGATE_ONLY,ctx(principal=PrincipalKind.SERVICE,service_approved=True)))
 def test_relationship_action_fail_closed_on_revocation(self):
  self.assertTrue(authorize_relationship_action(ctx()))
  self.assertFalse(authorize_relationship_action(ctx(lifecycle=LifecycleState.SUSPENDED)))
  self.assertFalse(authorize_relationship_action(ctx(blocked=True)))
 def test_repository_access_is_table_specific_and_unknown_denied(self):
  self.assertTrue(authorize_repository_read("profile",ctx(principal=PrincipalKind.SELF)))
  self.assertFalse(authorize_repository_read("profile",ctx()))
  self.assertTrue(authorize_repository_read("safety",ctx(principal=PrincipalKind.MODERATOR,moderator_case=True)))
  self.assertFalse(authorize_repository_read("unknown",ctx(principal=PrincipalKind.SELF)))
 def test_require_raises_instead_of_default_allow(self):
  with self.assertRaises(AccessDenied): require_private_access(VisibilityAudience.MATCHED,ctx())
 def test_payment_admin_algorithm_are_not_principals(self):
  self.assertFalse(any(x in PrincipalKind.__members__ for x in ("PAYMENT","ADMIN","ALGORITHM","AI")))
if __name__=="__main__":unittest.main()
