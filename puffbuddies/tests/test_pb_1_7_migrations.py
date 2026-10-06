import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))
from puffbuddies.persistence.migrations import *
from puffbuddies.domain.repositories import InvalidRecord
class PB17MigrationTests(unittest.TestCase):
 def test_monotonic_single_step_only(self):
  with self.assertRaises(MigrationDenied): Migration("profile",1,3,lambda r:r)
  with self.assertRaises(MigrationDenied): Migration("search_profiles",1,2,lambda r:r)
 def test_safe_schema_evolution_preserves_private_record(self):
  m=Migration("profile",1,2,lambda r:{**r,"display_fields":{"name":"x"}})
  r={"profile_id":"p","mode":"DATING","lifecycle":"ACTIVE","display_fields":{},"media_refs":[],"visibility_version":1}
  self.assertEqual(apply_migration(m,r)["profile_id"],"p")
 def test_forbidden_field_backfill_fails(self):
  m=Migration("eligibility_projection",1,2,lambda r:{**r,"raw_identity_evidence":"secret"})
  r={"profile_id":"p","decision":"ELIGIBLE","source_version":1,"expires_at":"x","policy_version":1}
  with self.assertRaises(InvalidRecord): apply_migration(m,r)
 def test_migration_cannot_manufacture_match(self):
  m=Migration("relationship",1,2,lambda r:{**r,"state":"MATCHED"})
  r={"relationship_id":"r","left_profile_id":"a","right_profile_id":"b","state":"LIKED","version":1}
  with self.assertRaises(MigrationDenied): apply_migration(m,r)
 def test_migration_cannot_resurrect_revoked_lifecycle(self):
  m=Migration("lifecycle",1,2,lambda r:{**r,"state":"ACTIVE"})
  for state in ("DEACTIVATED","SUSPENDED","BANNED","DELETE_REQUESTED","DELETION_IN_PROGRESS","DELETION_COMPLETE"):
   with self.assertRaises(MigrationDenied): apply_migration(m,{"profile_id":"p","state":state,"version":1})
 def test_visibility_cannot_widen(self):
  m=Migration("visibility",1,2,lambda r:{**r,"audience":"PUBLIC_EXPLICIT"})
  with self.assertRaises(MigrationDenied): apply_migration(m,{"profile_id":"p","field_key":"bio","audience":"PRIVATE_SELF","version":1})
 def test_visibility_can_preserve_or_restrict(self):
  r={"profile_id":"p","field_key":"bio","audience":"DISCOVERABLE","version":1}
  m=Migration("visibility",1,2,lambda x:{**x,"audience":"PRIVATE_SELF"})
  self.assertEqual(apply_migration(m,r)["audience"],"PRIVATE_SELF")
 def test_canonical_identity_cannot_be_rewritten(self):
  m=Migration("profile",1,2,lambda r:{**r,"profile_id":"other"})
  r={"profile_id":"p","mode":"DATING","lifecycle":"ACTIVE","display_fields":{},"media_refs":[],"visibility_version":1}
  with self.assertRaises(MigrationDenied): apply_migration(m,r)
 def test_backfill_is_all_or_nothing_staging(self):
  m=Migration("relationship",1,2,lambda r:{**r,"state":"MATCHED"} if r["relationship_id"]=="bad" else r)
  rows=[{"relationship_id":"ok","left_profile_id":"a","right_profile_id":"b","state":"LIKED","version":1},{"relationship_id":"bad","left_profile_id":"c","right_profile_id":"d","state":"LIKED","version":1}]
  with self.assertRaises(MigrationDenied): backfill(m,rows)
 def test_unknown_fields_fail_before_and_after(self):
  m=Migration("lifecycle",1,2,lambda r:r)
  with self.assertRaises(InvalidRecord): apply_migration(m,{"profile_id":"p","state":"ACTIVE","version":1,"wallet_address":"0x1"})
if __name__=="__main__":unittest.main()
