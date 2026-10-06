import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))
from puffbuddies.domain.eligibility_persistence import *
from puffbuddies.domain.eligibility_state import *
from puffbuddies.domain.types import EligibilityState,ProfileId
from puffbuddies.storage.memory import InMemoryPrivateRepository
from puffbuddies.domain.repositories import VersionConflict,InvalidRecord

class PB25EligibilityPersistenceLifecycleTests(unittest.TestCase):
 def record(self,**kw):
  d=dict(profile_id=ProfileId("p"),state=EligibilityState.ELIGIBLE,source_version="id-v1",
         policy_version="pb-age-v1",expires_at_epoch=200,sequence=1,checked_at_epoch=100)
  d.update(kw);return EligibilityRecord(**d)

 def test_round_trip_preserves_replay_and_time_authority(self):
  repo=InMemoryPrivateRepository()
  stored=persist_eligibility(repo,self.record(),expected_version=None)
  loaded,version=load_eligibility(repo,ProfileId("p"))
  self.assertEqual(loaded,self.record())
  self.assertEqual(version,stored.version)

 def test_monotonic_sequence_survives_repository_reload(self):
  repo=InMemoryPrivateRepository()
  first=persist_eligibility(repo,self.record(),expected_version=None)
  with self.assertRaises(EligibilityPersistenceDenied):
   persist_eligibility(repo,self.record(sequence=1,checked_at_epoch=101),expected_version=first.version)
  with self.assertRaises(EligibilityPersistenceDenied):
   persist_eligibility(repo,self.record(sequence=2,checked_at_epoch=99),expected_version=first.version)
  second=persist_eligibility(repo,self.record(sequence=2,checked_at_epoch=101),expected_version=first.version)
  self.assertEqual(second.version,2)

 def test_optimistic_concurrency_remains_authoritative(self):
  repo=InMemoryPrivateRepository()
  first=persist_eligibility(repo,self.record(),expected_version=None)
  with self.assertRaises(VersionConflict):
   persist_eligibility(repo,self.record(sequence=2,checked_at_epoch=101),expected_version=99)
  self.assertEqual(load_eligibility(repo,ProfileId("p"))[1],first.version)

 def test_unknown_is_fail_closed_and_has_no_expiry(self):
  repo=InMemoryPrivateRepository()
  r=self.record(state=EligibilityState.UNKNOWN,source_version="",expires_at_epoch=None,sequence=0)
  persist_eligibility(repo,r,expected_version=None)
  loaded,_=load_eligibility(repo,ProfileId("p"))
  self.assertEqual(loaded.state,EligibilityState.UNKNOWN)
  with self.assertRaises(EligibilityPersistenceDenied):
   persist_eligibility(InMemoryPrivateRepository(),r.__class__(**{**r.__dict__,"expires_at_epoch":200}),expected_version=None)

 def test_current_policy_must_match(self):
  require_persisted_policy_current(self.record(),current_policy_version="pb-age-v1")
  with self.assertRaises(EligibilityTransitionDenied):
   require_persisted_policy_current(self.record(),current_policy_version="pb-age-v2")

 def test_subject_mismatch_and_malformed_rows_fail_closed(self):
  repo=InMemoryPrivateRepository()
  stored=persist_eligibility(repo,self.record(),expected_version=None)
  with self.assertRaises(EligibilityPersistenceDenied):
   decode_eligibility_record(stored,profile_id=ProfileId("other"))
  bad=StoredRecord("eligibility_projection","p",1,{"profile_id":"p"})
  with self.assertRaises(EligibilityPersistenceDenied):
   decode_eligibility_record(bad,profile_id=ProfileId("p"))

 def test_schema_persists_only_minimum_disclosure_lifecycle_metadata(self):
  fields=set(TABLES["eligibility_projection"].fields)
  self.assertEqual(fields,{"profile_id","decision","source_version","expires_at","policy_version","sequence","checked_at_epoch"})
  forbidden={"date_of_birth","legal_name","government_id","wallet_address","raw_identity_evidence","raw_proof","proof_bytes","credential_payload"}
  self.assertTrue(forbidden.isdisjoint(fields))
  self.assertTrue({"raw_identity_evidence","raw_proof","proof_bytes","credential_payload"} <= set(TABLES["eligibility_projection"].forbidden_fields))

if __name__=="__main__":unittest.main()
