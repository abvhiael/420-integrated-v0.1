import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))
from puffbuddies.persistence.recovery import *
from puffbuddies.persistence.revocation import RevocationMarker,RevocationDenied
from puffbuddies.storage.memory import InMemoryPrivateRepository
from puffbuddies.domain.repositories import StoredRecord,VersionConflict
class BrokenRepo:
 def get(self,*a,**k): raise ConnectionError("down")
class PB112PersistenceFailureRecoveryTests(unittest.TestCase):
 def row(self,v=1,state="ACTIVE"): return StoredRecord("lifecycle","p",v,{"profile_id":"p","state":state,"version":v})
 def test_authoritative_unavailable_fails_closed(self):
  with self.assertRaises(AuthorityUnavailable): authoritative_read(None,"lifecycle","p")
  with self.assertRaises(AuthorityUnavailable): authoritative_read(BrokenRepo(),"lifecycle","p")
 def test_stale_replica_rejected(self):
  with self.assertRaises(RecoveryFailed): require_current_replica(self.row(1),self.row(2,"DEACTIVATED"))
 def test_conflicting_same_version_replica_rejected(self):
  with self.assertRaises(RecoveryFailed): require_current_replica(self.row(2,"ACTIVE"),self.row(2,"DEACTIVATED"))
 def test_exact_replica_accepted(self):
  require_current_replica(self.row(2,"ACTIVE"),self.row(2,"ACTIVE"))
 def test_missing_replica_cannot_stand_in_for_authority(self):
  with self.assertRaises(RecoveryFailed): require_current_replica(None,self.row())
 def test_old_restore_snapshot_rejected_after_revocation(self):
  s=Snapshot(4,(self.row(),));m=RevocationMarker("p",5,"BLOCK")
  with self.assertRaises(RevocationDenied): validate_restore(s,m)
 def test_restore_rejected_after_deletion_complete(self):
  s=Snapshot(99,(self.row(),));m=RevocationMarker("p",5,"DELETE",True)
  with self.assertRaises(RevocationDenied): validate_restore(s,m)
 def test_conflicting_snapshot_records_rejected(self):
  s=Snapshot(5,(self.row(),self.row(2)));m=RevocationMarker("p",5,"RECOVERY")
  with self.assertRaises(RecoveryFailed): validate_restore(s,m)
 def test_current_nonconflicting_restore_validates(self):
  s=Snapshot(5,(self.row(),));m=RevocationMarker("p",5,"RECOVERY")
  self.assertEqual(validate_restore(s,m),s.records)
 def test_concurrent_stale_write_and_delete_fail(self):
  r=InMemoryPrivateRepository();a=r.put("lifecycle","p",self.row().values,expected_version=None)
  b=r.put("lifecycle","p",{"profile_id":"p","state":"DEACTIVATED","version":2},expected_version=a.version)
  with self.assertRaises(VersionConflict): r.put("lifecycle","p",{"profile_id":"p","state":"ACTIVE","version":3},expected_version=a.version)
  with self.assertRaises(VersionConflict): r.delete("lifecycle","p",expected_version=a.version)
  self.assertEqual(r.get("lifecycle","p").version,b.version)
 def test_partial_batch_failure_is_not_publishable_success(self):
  r=InMemoryPrivateRepository()
  def one(): return r.put("profile","p",{"profile_id":"p","display_name":"x","bio":"","intent_mode":"BUDDY","created_at":"t","updated_at":"t","version":1},expected_version=None)
  def two(): raise TimeoutError("storage failure")
  with self.assertRaises(RecoveryFailed): staged_batch(r,[one,two])
 def test_rollback_uses_known_good_before_image(self):
  before=(self.row(1),);after=(self.row(2,"DEACTIVATED"),)
  self.assertEqual(rollback_plan(before,after),before)
  with self.assertRaises(RecoveryFailed): rollback_plan((),after)
if __name__=="__main__":unittest.main()
