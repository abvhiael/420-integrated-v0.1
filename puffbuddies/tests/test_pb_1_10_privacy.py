import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))
from puffbuddies.domain.privacy import *
from puffbuddies.domain.types import VisibilityAudience
from puffbuddies.persistence.schema import TABLES,DERIVED_ONLY,PUBLIC_TABLES
class PB110PrivacyTests(unittest.TestCase):
 def test_no_canonical_table_is_public(self):
  self.assertEqual(PUBLIC_TABLES,frozenset())
  for table in TABLES:
   with self.assertRaises(LeakageDenied): assert_no_public_table(table)
 def test_no_derived_table_becomes_public_authority(self):
  for table in DERIVED_ONLY:
   with self.assertRaises(LeakageDenied): assert_no_public_table(table)
 def test_membership_cannot_be_disclosed_by_wallet_lookup(self):
  with self.assertRaises(LeakageDenied): wallet_lookup_membership_result("0xabc")
 def test_non_explicit_visibility_never_public(self):
  for a in VisibilityAudience:
   if a!=VisibilityAudience.PUBLIC_EXPLICIT:
    self.assertFalse(public_field_allowed(audience=a,field_key="display_name"))
 def test_public_explicit_still_cannot_expose_protected_categories(self):
  for key in ("membership","profile_id","relationship_state","match_status","block_state","moderation_status","eligibility","lifecycle","precise_location","gps","cannabis_use","wallet_address","identity_ref"):
   self.assertFalse(public_field_allowed(audience=VisibilityAudience.PUBLIC_EXPLICIT,field_key=key),key)
 def test_public_explicit_allows_only_nonprotected_field_key(self):
  self.assertTrue(public_field_allowed(audience=VisibilityAudience.PUBLIC_EXPLICIT,field_key="display_name"))
 def test_aggregate_rejects_identifying_dimensions(self):
  for bad in ({"metric":"users","count":3,"profile_id":"p"},{"metric":"users","count":3,"cannabis":"regular"},{"metric":"users","count":3,"location":"x"}):
   with self.assertRaises(LeakageDenied): safe_aggregate(bad)
 def test_aggregate_rejects_singleton_and_boolean_count(self):
  for n in (0,1,True):
   with self.assertRaises(LeakageDenied): safe_aggregate({"metric":"users","bucket":"all","count":n})
 def test_safe_aggregate_accepts_minimal_nonidentifying_cohort(self):
  self.assertEqual(safe_aggregate({"metric":"users","bucket":"all","count":2}).fields["count"],2)
 def test_derived_payload_rejects_sensitive_dimensions(self):
  for key in ("profile_id","wallet","relationship","match","block","moderation","eligibility","lifecycle","latitude","gps","cannabis"):
   with self.assertRaises(LeakageDenied): assert_derived_payload_minimal({"generation":4,key:"x"})
 def test_derived_payload_can_carry_nonidentifying_invalidation_metadata(self):
  assert_derived_payload_minimal({"generation":4,"change":"DELETE","surface":"CACHE"})
if __name__=="__main__":unittest.main()
