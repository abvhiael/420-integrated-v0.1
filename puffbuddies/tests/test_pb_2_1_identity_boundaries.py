import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))
from puffbuddies.domain.types import *
from puffbuddies.domain.identity import *
from puffbuddies.domain.boundaries import CANONICAL_OWNER,EXTERNAL_AUTHORITIES,DEFAULT_AUDIENCE,PUBLICLY_ENUMERABLE
from puffbuddies.domain.authorization import AuthorizationContext,PrincipalKind,authorize_private_access
from puffbuddies.persistence.schema import TABLES

class PB21IdentityBoundaryTests(unittest.TestCase):
 def assertion(self,**kw):
  d=dict(profile_id=ProfileId("p"),adult=True,source="420Identity",source_version="id-v7",issued_at_epoch=100,expires_at_epoch=200,revoked=False);d.update(kw);return AdultEligibilityAssertion(**d)
 def test_authority_is_split_without_transfer(self):
  self.assertEqual(EXTERNAL_AUTHORITIES["eligibility_evidence"],"420Identity")
  self.assertEqual(CANONICAL_OWNER["eligibility_decision"],"puffbuddies")
  self.assertEqual(IDENTITY_AUTHORITY,"420Identity");self.assertEqual(LOCAL_ELIGIBILITY_AUTHORITY,"puffbuddies")
 def test_current_adult_assertion_projects_minimum_decision(self):
  p=consume_adult_eligibility(self.assertion(),profile_id=ProfileId("p"),now_epoch=150)
  self.assertEqual(p,EligibilityProjection(EligibilityState.ELIGIBLE,"id-v7",200));self.assertTrue(require_current_adult(p,now_epoch=199))
 def test_nonadult_is_ineligible_and_cannot_participate(self):
  p=consume_adult_eligibility(self.assertion(adult=False),profile_id=ProfileId("p"),now_epoch=150)
  self.assertEqual(p.state,EligibilityState.INELIGIBLE)
  c=AuthorizationContext(PrincipalKind.USER,"p",actor_id="q",eligibility=p.state,lifecycle=LifecycleState.ACTIVE)
  self.assertFalse(authorize_private_access(VisibilityAudience.DISCOVERABLE,c))
  with self.assertRaises(EligibilityDenied):require_current_adult(p,now_epoch=150)
 def test_expired_and_revoked_fail_closed(self):
  expired=consume_adult_eligibility(self.assertion(),profile_id=ProfileId("p"),now_epoch=200)
  revoked=consume_adult_eligibility(self.assertion(revoked=True),profile_id=ProfileId("p"),now_epoch=150)
  self.assertEqual(expired.state,EligibilityState.EXPIRED);self.assertEqual(revoked.state,EligibilityState.REVOKED)
  for p in (expired,revoked):
   with self.assertRaises(EligibilityDenied):require_current_adult(p,now_epoch=150)
 def test_wrong_profile_untrusted_source_future_and_bad_window_fail(self):
  cases=[(self.assertion(),ProfileId("other"),150),(self.assertion(source="client"),ProfileId("p"),150),(self.assertion(issued_at_epoch=160),ProfileId("p"),150),(self.assertion(expires_at_epoch=100),ProfileId("p"),100),(self.assertion(source_version=""),ProfileId("p"),150)]
  for a,p,n in cases:
   with self.assertRaises(EligibilityDenied):consume_adult_eligibility(a,profile_id=p,now_epoch=n)
 def test_identity_material_is_not_persisted_or_public(self):
  spec=TABLES["eligibility_projection"]
  self.assertTrue(FORBIDDEN_IDENTITY_FIELDS.isdisjoint(spec.fields))
  self.assertIn("date_of_birth",spec.forbidden_fields);self.assertIn("raw_identity_document",spec.forbidden_fields)
  self.assertEqual(PUBLICLY_ENUMERABLE,frozenset())
  self.assertEqual(DEFAULT_AUDIENCE["eligibility_evidence"],VisibilityAudience.NEVER_PUBLIC)
  self.assertEqual(DEFAULT_AUDIENCE["wallet_profile_link"],VisibilityAudience.NEVER_PUBLIC)
 def test_assertion_shape_contains_no_wallet_dob_name_or_document(self):
  self.assertTrue(FORBIDDEN_IDENTITY_FIELDS.isdisjoint(set(AdultEligibilityAssertion.__dataclass_fields__)))
 def test_projection_requires_expiry(self):
  with self.assertRaises(EligibilityDenied):require_current_adult(EligibilityProjection(EligibilityState.ELIGIBLE,"v",None),now_epoch=1)
if __name__=="__main__":unittest.main()
