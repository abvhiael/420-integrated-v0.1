import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))

from puffbuddies.domain.verification_reputation import *
from puffbuddies.domain.types import ProfileId,VisibilityAudience
from puffbuddies.domain.invalidation import DerivedSurface,affected
from puffbuddies.storage.memory import InMemoryPrivateRepository

class PB9VerificationReputationTests(unittest.TestCase):
 def issue(self,kind=VerificationKind.IDENTITY_CREDENTIAL,source=VerificationSource.IDENTITY,visible=False,expires=200):
  return issue_indicator(profile_id=ProfileId("alice"),kind=kind,source=source,
   source_version="v1",issued_at_epoch=100,expires_at_epoch=expires,
   current_generation=4,user_visible=visible)

 def test_source_authority_is_bound_to_indicator_kind(self):
  with self.assertRaises(VerificationDenied):
   self.issue(VerificationKind.IDENTITY_CREDENTIAL,VerificationSource.WALLET)
  with self.assertRaises(VerificationDenied):
   self.issue(VerificationKind.ACCOUNT_CONTROL,VerificationSource.IDENTITY)

 def test_420verify_is_not_interpersonal_identity_source(self):
  self.assertNotIn("420Verify",{x.value for x in VerificationSource})

 def test_current_verified_indicator_is_private_by_default(self):
  x=self.issue().indicator
  self.assertEqual(verification_presentation([x],profile_id=ProfileId("alice"),
   audience=VisibilityAudience.DISCOVERABLE,now_epoch=120).indicators,())
  self.assertEqual(verification_presentation([x],profile_id=ProfileId("alice"),
   audience=VisibilityAudience.PRIVATE_SELF,now_epoch=120).indicators,("identity_verified",))

 def test_owner_can_opt_in_to_bounded_positive_badge(self):
  x=self.issue().indicator
  y=set_indicator_visibility(x,actor_profile_id=ProfileId("alice"),user_visible=True,current_generation=5)
  p=verification_presentation([y.indicator],profile_id=ProfileId("alice"),
   audience=VisibilityAudience.DISCOVERABLE,now_epoch=120)
  self.assertEqual(p.indicators,("identity_verified",))
  self.assertTrue(affected(y.invalidation,DerivedSurface.DISCOVERY))

 def test_non_owner_cannot_expose_indicator(self):
  with self.assertRaises(VerificationDenied):
   set_indicator_visibility(self.issue().indicator,actor_profile_id=ProfileId("bob"),
    user_visible=True,current_generation=5)

 def test_expiry_and_revocation_remove_badge_and_matching_input(self):
  x=self.issue(visible=True,expires=150).indicator
  self.assertEqual(effective_state(x,now_epoch=150),VerificationState.EXPIRED)
  self.assertEqual(narrow_matching_indicators([x],profile_id=ProfileId("alice"),now_epoch=150),frozenset())
  y=revoke_indicator(self.issue(visible=True).indicator,source=VerificationSource.IDENTITY,current_generation=5)
  self.assertEqual(verification_presentation([y.indicator],profile_id=ProfileId("alice"),
   audience=VisibilityAudience.DISCOVERABLE,now_epoch=120).indicators,())

 def test_wrong_source_cannot_revoke(self):
  with self.assertRaises(VerificationDenied):
   revoke_indicator(self.issue().indicator,source=VerificationSource.WALLET,current_generation=5)

 def test_public_explicit_presentation_is_rejected(self):
  with self.assertRaises(VerificationDenied):
   verification_presentation([self.issue(visible=True).indicator,],profile_id=ProfileId("alice"),
    audience=VisibilityAudience.PUBLIC_EXPLICIT,now_epoch=120)

 def test_presentation_is_non_scored_and_positive_only(self):
  x=self.issue(visible=True).indicator
  p=verification_presentation([x],profile_id=ProfileId("alice"),
   audience=VisibilityAudience.DISCOVERABLE,now_epoch=120)
  self.assertEqual(set(VerificationPresentation.__dataclass_fields__),{"indicators"})
  self.assertNotIn("score",VerificationPresentation.__dataclass_fields__)
  self.assertEqual(p.indicators,("identity_verified",))

 def test_matching_input_is_bounded_set_not_score(self):
  xs=[
   self.issue(VerificationKind.ACCOUNT_CONTROL,VerificationSource.WALLET,True).indicator,
   self.issue(VerificationKind.NAME_CONTROL,VerificationSource.NAMES,True).indicator,
  ]
  out=narrow_matching_indicators(xs,profile_id=ProfileId("alice"),now_epoch=120)
  self.assertEqual(out,frozenset({VerificationKind.ACCOUNT_CONTROL,VerificationKind.NAME_CONTROL}))

 def test_private_persistence_and_optimistic_concurrency(self):
  repo=InMemoryPrivateRepository();x=self.issue(visible=True).indicator
  row=persist_indicator(repo,x,expected_version=None)
  loaded,v=load_indicator(repo,ProfileId("alice"),VerificationKind.IDENTITY_CREDENTIAL)
  self.assertEqual(loaded,x);self.assertEqual(v,row.version)
  y=set_indicator_visibility(x,actor_profile_id=ProfileId("alice"),user_visible=False,current_generation=5).indicator
  persist_indicator(repo,y,expected_version=row.version)
  with self.assertRaises(Exception): persist_indicator(repo,x,expected_version=row.version)

 def test_record_has_no_raw_evidence_or_reputation_score_fields(self):
  fields=set(VerificationIndicator.__dataclass_fields__)
  for x in ("proof_bytes","credential_payload","government_id_image","biometric_template",
            "wallet_address","reputation_score","trust_score","report_count","moderation_history"):
   self.assertNotIn(x,fields)
  with self.assertRaises(VerificationDenied): assert_no_reputation_score({"trust_score":99})

 def test_future_issued_indicator_fails_closed(self):
  x=self.issue().indicator
  with self.assertRaises(VerificationDenied):effective_state(x,now_epoch=99)

 def test_cross_profile_indicator_set_is_rejected(self):
  a=self.issue(visible=True).indicator
  b=replace(a,profile_id=ProfileId("bob"))
  with self.assertRaises(VerificationDenied):
   verification_presentation([a,b],profile_id=ProfileId("alice"),
    audience=VisibilityAudience.DISCOVERABLE,now_epoch=120)

if __name__=="__main__":unittest.main()
