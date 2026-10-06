import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))
from puffbuddies.domain.types import *
from puffbuddies.domain.eligibility_state import *
from puffbuddies.domain.authorization import AuthorizationContext,PrincipalKind,authorize_private_access
from puffbuddies.domain.invalidation import CanonicalChange,invalidation_for,ALL_DERIVED
from puffbuddies.persistence.revocation import RevocationMarker

class PB22AdultEligibilityStateTests(unittest.TestCase):
 def base(self):
  return initial_eligibility(ProfileId("p"),policy_version="pb-age-v1",now_epoch=10)
 def projection(self,state=EligibilityState.ELIGIBLE,expiry=100,source="id-v1"):
  return EligibilityProjection(state,source,expiry)
 def test_unknown_is_initial_and_fails_closed(self):
  r=self.base();self.assertEqual(r.state,EligibilityState.UNKNOWN)
  self.assertFalse(ordinary_eligibility_allowed(r,current_policy_version="pb-age-v1",now_epoch=11))
 def test_authoritative_eligible_is_current_only_until_expiry(self):
  r=apply_authoritative_projection(self.base(),self.projection(),policy_version="pb-age-v1",current_policy_version="pb-age-v1",sequence=1,now_epoch=20)
  self.assertTrue(ordinary_eligibility_allowed(r,current_policy_version="pb-age-v1",now_epoch=99))
  r=expire_if_due(r,now_epoch=100);self.assertEqual(r.state,EligibilityState.EXPIRED)
  self.assertFalse(ordinary_eligibility_allowed(r,current_policy_version="pb-age-v1",now_epoch=100))
 def test_ineligible_revoked_and_expired_never_participate(self):
  for state in (EligibilityState.INELIGIBLE,EligibilityState.REVOKED,EligibilityState.EXPIRED):
   r=apply_authoritative_projection(self.base(),self.projection(state),policy_version="pb-age-v1",current_policy_version="pb-age-v1",sequence=1,now_epoch=20)
   self.assertFalse(ordinary_eligibility_allowed(r,current_policy_version="pb-age-v1",now_epoch=21),state)
 def test_policy_change_forces_unknown_until_fresh_reevaluation(self):
  r=apply_authoritative_projection(self.base(),self.projection(),policy_version="pb-age-v1",current_policy_version="pb-age-v1",sequence=1,now_epoch=20)
  r=require_policy_current(r,current_policy_version="pb-age-v2",sequence=2,now_epoch=30)
  self.assertEqual(r.state,EligibilityState.UNKNOWN);self.assertFalse(ordinary_eligibility_allowed(r,current_policy_version="pb-age-v2",now_epoch=30))
  r=apply_authoritative_projection(r,self.projection(source="id-v2"),policy_version="pb-age-v2",current_policy_version="pb-age-v2",sequence=3,now_epoch=31)
  self.assertEqual(r.state,EligibilityState.ELIGIBLE)
 def test_old_policy_assertion_cannot_preserve_eligible(self):
  r=apply_authoritative_projection(self.base(),self.projection(),policy_version="pb-age-v0",current_policy_version="pb-age-v1",sequence=1,now_epoch=20)
  self.assertEqual(r.state,EligibilityState.UNKNOWN)
 def test_authority_failure_is_unknown_not_eligible(self):
  r=apply_authoritative_projection(self.base(),self.projection(),policy_version="pb-age-v1",current_policy_version="pb-age-v1",sequence=1,now_epoch=20)
  r=authority_unavailable(r,sequence=2,now_epoch=21)
  self.assertEqual(r.state,EligibilityState.UNKNOWN);self.assertFalse(ordinary_eligibility_allowed(r,current_policy_version="pb-age-v1",now_epoch=21))
 def test_stale_replay_and_time_rollback_fail(self):
  r=apply_authoritative_projection(self.base(),self.projection(),policy_version="pb-age-v1",current_policy_version="pb-age-v1",sequence=2,now_epoch=20)
  with self.assertRaises(EligibilityTransitionDenied):apply_authoritative_projection(r,self.projection(),policy_version="pb-age-v1",current_policy_version="pb-age-v1",sequence=2,now_epoch=21)
  with self.assertRaises(EligibilityTransitionDenied):authority_unavailable(r,sequence=3,now_epoch=19)
 def test_reverification_after_revocation_requires_new_sequence(self):
  r=apply_authoritative_projection(self.base(),self.projection(EligibilityState.REVOKED),policy_version="pb-age-v1",current_policy_version="pb-age-v1",sequence=1,now_epoch=20)
  with self.assertRaises(EligibilityTransitionDenied):apply_authoritative_projection(r,self.projection(),policy_version="pb-age-v1",current_policy_version="pb-age-v1",sequence=1,now_epoch=21)
  r=apply_authoritative_projection(r,self.projection(source="id-v2"),policy_version="pb-age-v1",current_policy_version="pb-age-v1",sequence=2,now_epoch=21)
  self.assertTrue(ordinary_eligibility_allowed(r,current_policy_version="pb-age-v1",now_epoch=22))
 def test_eligibility_change_invalidates_all_derived_authority(self):
  inv=invalidation_for(RevocationMarker("p",2,"ELIGIBILITY",False),CanonicalChange.ELIGIBILITY)
  self.assertEqual(inv.surfaces,ALL_DERIVED)
 def test_eligible_does_not_override_lifecycle(self):
  r=apply_authoritative_projection(self.base(),self.projection(),policy_version="pb-age-v1",current_policy_version="pb-age-v1",sequence=1,now_epoch=20)
  self.assertTrue(ordinary_eligibility_allowed(r,current_policy_version="pb-age-v1",now_epoch=21))
  c=AuthorizationContext(PrincipalKind.USER,"p",actor_id="q",eligibility=r.state,lifecycle=LifecycleState.SUSPENDED)
  self.assertFalse(authorize_private_access(VisibilityAudience.DISCOVERABLE,c))
if __name__=="__main__":unittest.main()
