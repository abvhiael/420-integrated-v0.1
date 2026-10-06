import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))
from puffbuddies.domain.authorization import *
from puffbuddies.domain.eligibility_authorization import *
from puffbuddies.domain.eligibility_state import EligibilityRecord
from puffbuddies.domain.types import *

class PB27AuthorizationIntegrationTests(unittest.TestCase):
 def record(self,**kw):
  d=dict(profile_id=ProfileId("p"),state=EligibilityState.ELIGIBLE,source_version="id-v1",
         policy_version="pb-age-v1",expires_at_epoch=200,sequence=7,checked_at_epoch=100)
  d.update(kw);return EligibilityRecord(**d)
 def ctx(self,**kw):
  d=dict(principal=PrincipalKind.USER,subject_id="p",actor_id="peer",
         eligibility=EligibilityState.UNKNOWN,lifecycle=LifecycleState.ACTIVE,
         relationship=RelationshipState.MATCHED)
  d.update(kw);return AuthorizationContext(**d)

 def bind(self,record=None,**kw):
  return bind_current_eligibility(
   self.ctx(**kw),record or self.record(),profile_id=ProfileId("p"),
   current_policy_version="pb-age-v1",now_epoch=150)

 def test_current_record_enables_existing_authorization_primitives(self):
  b=self.bind()
  self.assertEqual(b.context.eligibility,EligibilityState.ELIGIBLE)
  self.assertTrue(authorize_private_access(VisibilityAudience.DISCOVERABLE,b.context))
  self.assertTrue(authorize_private_access(VisibilityAudience.MATCHED,b.context))
  self.assertTrue(authorize_relationship_action(b.context))

 def test_expired_revoked_ineligible_unknown_all_fail_ordinary_authorization(self):
  cases=[
   self.record(expires_at_epoch=150),
   self.record(state=EligibilityState.REVOKED),
   self.record(state=EligibilityState.INELIGIBLE),
   self.record(state=EligibilityState.UNKNOWN,source_version="",expires_at_epoch=None),
  ]
  for r in cases:
   b=self.bind(record=r)
   self.assertNotEqual(b.context.eligibility,EligibilityState.ELIGIBLE)
   self.assertFalse(authorize_private_access(VisibilityAudience.DISCOVERABLE,b.context))
   self.assertFalse(authorize_private_access(VisibilityAudience.MATCHED,b.context))
   self.assertFalse(authorize_relationship_action(b.context))

 def test_policy_mismatch_becomes_unknown_and_fails_closed(self):
  b=bind_current_eligibility(
   self.ctx(),self.record(),profile_id=ProfileId("p"),
   current_policy_version="pb-age-v2",now_epoch=150)
  self.assertEqual(b.context.eligibility,EligibilityState.UNKNOWN)
  self.assertFalse(authorize_relationship_action(b.context))

 def test_subject_mismatch_fails_closed(self):
  with self.assertRaises(EligibilityAuthorizationDenied):
   bind_current_eligibility(self.ctx(),self.record(profile_id=ProfileId("other")),
                            profile_id=ProfileId("p"),current_policy_version="pb-age-v1",now_epoch=150)
  with self.assertRaises(EligibilityAuthorizationDenied):
   bind_current_eligibility(self.ctx(subject_id="other"),self.record(),
                            profile_id=ProfileId("p"),current_policy_version="pb-age-v1",now_epoch=150)

 def test_time_before_checked_state_is_rejected(self):
  with self.assertRaises(EligibilityAuthorizationDenied):
   effective_eligibility_state(self.record(),profile_id=ProfileId("p"),
                               current_policy_version="pb-age-v1",now_epoch=99)

 def test_lifecycle_block_and_relationship_authority_still_override(self):
  b=self.bind(lifecycle=LifecycleState.SUSPENDED)
  self.assertFalse(authorize_private_access(VisibilityAudience.MATCHED,b.context))
  b=self.bind(blocked=True)
  self.assertFalse(authorize_private_access(VisibilityAudience.MATCHED,b.context))
  b=self.bind(relationship=RelationshipState.NONE)
  self.assertFalse(authorize_private_access(VisibilityAudience.MATCHED,b.context))

 def test_binding_does_not_broaden_service_or_moderator_authority(self):
  service=self.bind(principal=PrincipalKind.SERVICE,service_approved=False).context
  self.assertFalse(authorize_eligibility_minimum(service))
  moderator=self.bind(principal=PrincipalKind.MODERATOR,moderator_case=False).context
  self.assertFalse(authorize_safety_access(moderator))

 def test_bound_metadata_is_minimum_and_auditable(self):
  b=self.bind()
  self.assertEqual(set(BoundEligibilityAuthorization.__dataclass_fields__),
                   {"context","record_sequence","policy_version","checked_at_epoch"})
  self.assertEqual(b.record_sequence,7)

if __name__=="__main__":unittest.main()
