import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))
from puffbuddies.domain.repositories import InvalidRecord,UnknownCanonicalTable,VersionConflict
from puffbuddies.storage.memory import InMemoryPrivateRepository

class PB14RepositoryTests(unittest.TestCase):
 def setUp(self): self.repo=InMemoryPrivateRepository()
 def test_create_read_update_with_optimistic_version(self):
  a=self.repo.put("lifecycle","p1",{"profile_id":"p1","state":"ACTIVE","version":1},expected_version=None)
  self.assertEqual(a.version,1);self.assertEqual(self.repo.get("lifecycle","p1").values["state"],"ACTIVE")
  b=self.repo.put("lifecycle","p1",{"profile_id":"p1","state":"DEACTIVATED","version":2},expected_version=1);self.assertEqual(b.version,2)
 def test_stale_write_fails_closed(self):
  self.repo.put("visibility","p1:name",{"profile_id":"p1","field_key":"name","audience":"DISCOVERABLE","version":1},expected_version=None)
  with self.assertRaises(VersionConflict): self.repo.put("visibility","p1:name",{"profile_id":"p1","field_key":"name","audience":"PRIVATE_SELF","version":2},expected_version=None)
 def test_stale_delete_fails_closed(self):
  self.repo.put("lifecycle","p1",{"profile_id":"p1","state":"ACTIVE","version":1},expected_version=None)
  with self.assertRaises(VersionConflict): self.repo.delete("lifecycle","p1",expected_version=0)
  self.assertIsNotNone(self.repo.get("lifecycle","p1"))
 def test_current_delete_removes_canonical_record(self):
  r=self.repo.put("relationship","r1",{"relationship_id":"r1","left_profile_id":"a","right_profile_id":"b","state":"MATCHED","version":1},expected_version=None)
  self.repo.delete("relationship","r1",expected_version=r.version);self.assertIsNone(self.repo.get("relationship","r1"))
 def test_derived_shadow_tables_rejected(self):
  for table in ("public_match_graph","search_profiles","analytics_profiles","recommendation_scores"):
   with self.assertRaises(UnknownCanonicalTable): self.repo.get(table,"x")
 def test_unknown_table_rejected(self):
  with self.assertRaises(UnknownCanonicalTable): self.repo.put("wallet_membership","x",{"wallet":"0x1"},expected_version=None)
 def test_forbidden_or_extra_fields_rejected(self):
  with self.assertRaises(InvalidRecord): self.repo.put("profile","p1",{"profile_id":"p1","wallet_address":"0x1"},expected_version=None)
  with self.assertRaises(InvalidRecord): self.repo.put("eligibility_projection","p1",{"profile_id":"p1","raw_identity_evidence":"x"},expected_version=None)
 def test_adapter_does_not_enumerate_membership(self):
  self.assertFalse(hasattr(self.repo,"list_profiles"));self.assertFalse(hasattr(self.repo,"list_members"))
 def test_missing_delete_fails_closed(self):
  with self.assertRaises(VersionConflict): self.repo.delete("profile","missing",expected_version=1)

if __name__=="__main__":unittest.main()
