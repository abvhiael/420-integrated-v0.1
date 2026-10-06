import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))
from puffbuddies.domain.authorization import AuthorizationContext,PrincipalKind
from puffbuddies.domain.invalidation import DerivedSurface,affected,derived_usable
from puffbuddies.domain.profiles import *
from puffbuddies.domain.types import *
from puffbuddies.persistence.revocation import DerivedAuthorityToken
from puffbuddies.storage.memory import InMemoryPrivateRepository

class PB3ProfilesTests(unittest.TestCase):
 def draft(self):
  p=create_profile(ProfileId("alice"),mode=IntentMode.DATING,
      eligibility=EligibilityState.ELIGIBLE,lifecycle=LifecycleState.PROFILE_INCOMPLETE)
  return edit_profile(p,actor_profile_id=ProfileId("alice"),
      display_fields={"display_name":"Alice","bio":"hello","prompt_1":"coffee?"},
      media_refs=("media:1",),current_generation=1).profile

 def test_create_requires_current_eligibility_and_profile_incomplete_lifecycle(self):
  with self.assertRaises(ProfileDenied):
   create_profile(ProfileId("a"),mode=IntentMode.DATING,eligibility=EligibilityState.UNKNOWN,
      lifecycle=LifecycleState.PROFILE_INCOMPLETE)
  with self.assertRaises(ProfileDenied):
   create_profile(ProfileId("a"),mode=IntentMode.DATING,eligibility=EligibilityState.ELIGIBLE,
      lifecycle=LifecycleState.ACTIVE)

 def test_profile_fields_media_and_mode_are_bounded(self):
  p=self.draft();self.assertTrue(profile_complete(p))
  self.assertEqual(p.mode,IntentMode.DATING)
  with self.assertRaises(ProfileDenied):
   edit_profile(p,actor_profile_id=ProfileId("alice"),display_fields={"date_of_birth":"2000-01-01"},current_generation=2)
  with self.assertRaises(ProfileDenied):
   edit_profile(p,actor_profile_id=ProfileId("alice"),media_refs=("https://example/x.jpg",),current_generation=2)
  with self.assertRaises(ProfileDenied):
   edit_profile(p,actor_profile_id=ProfileId("alice"),media_refs=tuple(f"m:{i}" for i in range(7)),current_generation=2)

 def test_only_owner_can_edit_or_change_visibility(self):
  p=self.draft()
  with self.assertRaises(ProfileDenied):
   edit_profile(p,actor_profile_id=ProfileId("mallory"),display_fields={"display_name":"x"},current_generation=2)
  with self.assertRaises(ProfileDenied):
   change_profile_visibility(p,actor_profile_id=ProfileId("mallory"),field_key="bio",
      audience=VisibilityAudience.MATCHED,current_generation=2)

 def test_defaults_are_in_app_only_and_sensitive_presentation_is_narrower(self):
  p=edit_profile(self.draft(),actor_profile_id=ProfileId("alice"),
    display_fields={"display_name":"Alice","bio":"hello","pronouns":"they/them","relationship_intent":"long term"},
    current_generation=2).profile
  policies={x.field_key:x.audience for x in default_profile_visibility(p)}
  self.assertEqual(policies["display_name"],VisibilityAudience.DISCOVERABLE)
  self.assertEqual(policies["media_refs"],VisibilityAudience.DISCOVERABLE)
  self.assertEqual(policies["pronouns"],VisibilityAudience.PRIVATE_SELF)
  self.assertEqual(policies["relationship_intent"],VisibilityAudience.PRIVATE_SELF)
  for a in policies.values(): self.assertNotEqual(a,VisibilityAudience.PUBLIC_EXPLICIT)

 def test_discoverable_projection_obeys_server_authorization_and_current_lifecycle(self):
  p=self.draft();policies=default_profile_visibility(p)
  active=activate_or_reactivate_profile(p,eligibility=EligibilityState.ELIGIBLE,current_generation=2).profile
  policies=tuple(ProfileVisibility(x.profile_id,x.field_key,x.audience,active.visibility_version) for x in policies)
  c=AuthorizationContext(PrincipalKind.USER,"alice",actor_id="bob",
      eligibility=EligibilityState.ELIGIBLE,lifecycle=LifecycleState.ACTIVE)
  visible=visible_profile_fields(active,policies,c)
  self.assertEqual(visible["display_name"],"Alice")
  self.assertIn("media_refs",visible)
  with self.assertRaises(ProfileDenied):
   visible_profile_fields(active,policies,AuthorizationContext(PrincipalKind.USER,"alice",
       actor_id="bob",eligibility=EligibilityState.ELIGIBLE,lifecycle=LifecycleState.DEACTIVATED))

 def test_missing_or_stale_visibility_policy_fails_closed(self):
  p=activate_or_reactivate_profile(self.draft(),eligibility=EligibilityState.ELIGIBLE,current_generation=2).profile
  c=AuthorizationContext(PrincipalKind.USER,"alice",actor_id="bob",
      eligibility=EligibilityState.ELIGIBLE,lifecycle=LifecycleState.ACTIVE)
  self.assertEqual(visible_profile_fields(p,(),c),{})
  stale=(ProfileVisibility(ProfileId("alice"),"display_name",VisibilityAudience.DISCOVERABLE,p.visibility_version+1),)
  self.assertEqual(visible_profile_fields(p,stale,c),{})

 def test_profile_edit_invalidates_derived_discovery_matching_visibility_cache_index_analytics(self):
  out=edit_profile(self.draft(),actor_profile_id=ProfileId("alice"),mode=IntentMode.BOTH,current_generation=4)
  for s in (DerivedSurface.DISCOVERY,DerivedSurface.MATCHING,DerivedSurface.VISIBILITY,
            DerivedSurface.CACHE,DerivedSurface.INDEX,DerivedSurface.ANALYTICS):
   self.assertTrue(affected(out.invalidation,s))
  self.assertFalse(derived_usable(DerivedSurface.DISCOVERY,DerivedAuthorityToken("alice",4),out.marker))

 def test_visibility_change_invalidates_messaging_and_bumps_visibility_version(self):
  p=self.draft()
  updated,policy,marker,inv=change_profile_visibility(p,actor_profile_id=ProfileId("alice"),
      field_key="bio",audience=VisibilityAudience.MATCHED,current_generation=5)
  self.assertEqual(updated.visibility_version,p.visibility_version+1)
  self.assertEqual(policy.version,updated.visibility_version)
  self.assertTrue(affected(inv,DerivedSurface.MESSAGING_AUTH))

 def test_complete_profile_gates_activation_and_reactivation(self):
  p=create_profile(ProfileId("alice"),mode=IntentMode.DATING,eligibility=EligibilityState.ELIGIBLE,
      lifecycle=LifecycleState.PROFILE_INCOMPLETE)
  with self.assertRaises(ProfileDenied):
   activate_or_reactivate_profile(p,eligibility=EligibilityState.ELIGIBLE,current_generation=1)
  active=activate_or_reactivate_profile(self.draft(),eligibility=EligibilityState.ELIGIBLE,current_generation=2).profile
  self.assertEqual(active.lifecycle,LifecycleState.ACTIVE)
  paused=deactivate_profile(active,actor_profile_id=ProfileId("alice"),current_generation=3).profile
  self.assertEqual(paused.lifecycle,LifecycleState.DEACTIVATED)
  restored=activate_or_reactivate_profile(paused,eligibility=EligibilityState.ELIGIBLE,current_generation=4).profile
  self.assertEqual(restored.lifecycle,LifecycleState.ACTIVE)
  with self.assertRaises(ProfileDenied):
   activate_or_reactivate_profile(paused,eligibility=EligibilityState.EXPIRED,current_generation=4)

 def test_delete_request_revokes_all_derived_authority(self):
  active=activate_or_reactivate_profile(self.draft(),eligibility=EligibilityState.ELIGIBLE,current_generation=2).profile
  out=request_profile_deletion(active,actor_profile_id=ProfileId("alice"),current_generation=3)
  self.assertEqual(out.profile.lifecycle,LifecycleState.DELETE_REQUESTED)
  self.assertEqual(out.invalidation.surfaces,ALL_DERIVED)

 def test_persistence_round_trip_and_optimistic_concurrency(self):
  repo=InMemoryPrivateRepository();p=self.draft()
  row=persist_profile(repo,p,expected_version=None)
  loaded,version=load_profile(repo,ProfileId("alice"))
  self.assertEqual(loaded,p);self.assertEqual(version,row.version)
  with self.assertRaises(Exception):
   persist_profile(repo,p,expected_version=None)

 def test_visibility_records_use_existing_private_visibility_table(self):
  repo=InMemoryPrivateRepository();p=self.draft()
  policy=default_profile_visibility(p)[0]
  row=persist_visibility(repo,policy,expected_version=None)
  self.assertEqual(row.values["profile_id"],"alice")
  self.assertNotIn("wallet_address",row.values)

 def test_suspended_banned_or_deletion_profile_cannot_be_edited(self):
  for state in (LifecycleState.SUSPENDED,LifecycleState.BANNED,LifecycleState.DELETE_REQUESTED):
   p=ProfileRecord(ProfileId("alice"),IntentMode.DATING,state,
      (("display_name","Alice"),),("media:1",),1)
   with self.assertRaises(ProfileDenied):
    edit_profile(p,actor_profile_id=ProfileId("alice"),display_fields={"display_name":"B"},current_generation=2)

 def test_public_explicit_never_allowed_for_pb3_profile_fields(self):
  with self.assertRaises(ProfileDenied):
   ProfileVisibility(ProfileId("alice"),"display_name",VisibilityAudience.PUBLIC_EXPLICIT,1)

if __name__=="__main__":unittest.main()
