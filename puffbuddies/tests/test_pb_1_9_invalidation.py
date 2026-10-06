import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))
from puffbuddies.domain.invalidation import *
from puffbuddies.persistence.revocation import RevocationMarker,DerivedAuthorityToken
class PB19InvalidationTests(unittest.TestCase):
 def marker(self,g=4,deleted=False): return RevocationMarker("p",g,"CHANGE",deleted)
 def test_delete_invalidates_every_derived_surface(self):
  inv=invalidation_for(self.marker(),CanonicalChange.DELETE);self.assertEqual(inv.surfaces,ALL_DERIVED)
 def test_block_invalidates_every_derived_surface(self):
  self.assertEqual(invalidation_for(self.marker(),CanonicalChange.BLOCK).surfaces,ALL_DERIVED)
 def test_lifecycle_safety_eligibility_are_global_derived_invalidators(self):
  for c in (CanonicalChange.LIFECYCLE,CanonicalChange.SAFETY,CanonicalChange.ELIGIBILITY):
   self.assertEqual(invalidation_for(self.marker(),c).surfaces,ALL_DERIVED)
 def test_unmatch_kills_messaging_and_matching_authority(self):
  inv=invalidation_for(self.marker(),CanonicalChange.UNMATCH)
  self.assertTrue(affected(inv,DerivedSurface.MESSAGING_AUTH));self.assertTrue(affected(inv,DerivedSurface.MATCHING))
 def test_visibility_change_invalidates_discovery_index_and_cached_visibility(self):
  inv=invalidation_for(self.marker(),CanonicalChange.VISIBILITY)
  for s in (DerivedSurface.DISCOVERY,DerivedSurface.VISIBILITY,DerivedSurface.CACHE,DerivedSurface.INDEX):
   self.assertTrue(affected(inv,s))
 def test_profile_preference_location_cannabis_invalidate_discovery_matching(self):
  for c in (CanonicalChange.PROFILE,CanonicalChange.PREFERENCES,CanonicalChange.LOCATION,CanonicalChange.CANNABIS):
   inv=invalidation_for(self.marker(),c)
   self.assertTrue(affected(inv,DerivedSurface.DISCOVERY));self.assertTrue(affected(inv,DerivedSurface.MATCHING))
 def test_stale_generation_is_unusable_on_every_surface(self):
  m=self.marker(8); stale=DerivedAuthorityToken("p",7)
  for s in ALL_DERIVED:
   self.assertFalse(derived_usable(s,stale,m))
   with self.assertRaises(PermissionError): require_derived_usable(s,stale,m)
 def test_wrong_subject_is_unusable(self):
  self.assertFalse(derived_usable(DerivedSurface.CACHE,DerivedAuthorityToken("other",4),self.marker()))
 def test_current_generation_is_usable_until_revoked(self):
  m=self.marker(4);t=DerivedAuthorityToken("p",4)
  for s in ALL_DERIVED:self.assertTrue(derived_usable(s,t,m))
 def test_deletion_complete_kills_even_current_generation(self):
  m=self.marker(4,True);t=DerivedAuthorityToken("p",4)
  for s in ALL_DERIVED:self.assertFalse(derived_usable(s,t,m))
 def test_invalidation_has_no_payload_or_public_linkage(self):
  inv=invalidation_for(self.marker(),CanonicalChange.PROFILE)
  self.assertEqual(set(inv.__dataclass_fields__),{"subject_id","generation","change","surfaces"})
  for forbidden in ("wallet","profile_data","message","location","cannabis_data","relationship_graph"):
   self.assertNotIn(forbidden,inv.__dataclass_fields__)
if __name__=="__main__":unittest.main()
