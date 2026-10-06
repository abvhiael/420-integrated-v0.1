import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))
from puffbuddies.persistence.revocation import *
from puffbuddies.storage.memory import InMemoryPrivateRepository
from puffbuddies.domain.repositories import VersionConflict
class PB18DeletionRevocationTests(unittest.TestCase):
 def test_generation_is_monotonic(self):
  m=next_revocation("p",3,"UNMATCH");self.assertEqual(m.generation,4)
 def test_stale_cache_projection_token_is_invalid(self):
  m=next_revocation("p",2,"BLOCK")
  self.assertFalse(token_current(DerivedAuthorityToken("p",2),m))
  with self.assertRaises(RevocationDenied): require_current_token(DerivedAuthorityToken("p",2),m)
 def test_current_token_invalid_after_deletion_complete(self):
  m=next_revocation("p",2,"DELETE",deletion_complete=True)
  self.assertFalse(token_current(DerivedAuthorityToken("p",3),m))
 def test_old_backup_restore_cannot_resurrect(self):
  m=next_revocation("p",5,"DELETE")
  self.assertFalse(restore_allowed(5,m))
  with self.assertRaises(RevocationDenied): require_restore_allowed(5,m)
  self.assertTrue(restore_allowed(6,m))
 def test_no_restore_after_deletion_complete_even_same_generation(self):
  m=next_revocation("p",5,"DELETE",deletion_complete=True)
  self.assertFalse(restore_allowed(6,m))
 def test_deletion_plan_excludes_safety_retention(self):
  plan=deletion_plan();self.assertNotIn("safety",plan);self.assertIn("profile",plan);self.assertIn("relationship",plan)
  with self.assertRaises(RevocationDenied): deletion_plan(include_safety=True)
 def test_safety_retention_requires_reason_and_canonical_fields(self):
  good={"case_id":"c","subject_profile_id":"p","actor_profile_id":"a","action":"BLOCK","status":"OPEN","retention_reason":"ACTIVE_CASE","version":1}
  self.assertEqual(retained_safety_fields(good)["retention_reason"],"ACTIVE_CASE")
  with self.assertRaises(RevocationDenied): retained_safety_fields({**good,"retention_reason":""})
  with self.assertRaises(RevocationDenied): retained_safety_fields({**good,"profile_bio":"x"})
 def test_purge_deletes_ordinary_records(self):
  r=InMemoryPrivateRepository()
  row=r.put("lifecycle","p",{"profile_id":"p","state":"DELETE_REQUESTED","version":1},expected_version=None)
  purge_subject(r,[row]);self.assertIsNone(r.get("lifecycle","p"))
 def test_purge_refuses_safety_record(self):
  r=InMemoryPrivateRepository()
  row=r.put("safety","c",{"case_id":"c","subject_profile_id":"p","actor_profile_id":"a","action":"BLOCK","status":"OPEN","retention_reason":"ACTIVE_CASE","version":1},expected_version=None)
  with self.assertRaises(RevocationDenied): purge_subject(r,[row])
 def test_stale_write_rejected_after_revocation(self):
  m=next_revocation("p",7,"UNMATCH")
  with self.assertRaises(VersionConflict): reject_stale_write_after_revocation(write_generation=7,marker=m)
 def test_all_writes_rejected_after_deletion_complete(self):
  m=next_revocation("p",7,"DELETE",deletion_complete=True)
  with self.assertRaises(VersionConflict): reject_stale_write_after_revocation(write_generation=99,marker=m)
 def test_marker_validation_fail_closed(self):
  for subject,generation,reason in (("",1,"x"),("p",0,"x"),("p",1,""),("p",1,"x"*65)):
   with self.assertRaises(RevocationDenied): RevocationMarker(subject,generation,reason)
if __name__=="__main__":unittest.main()
