import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))
from puffbuddies.domain.eligibility_revocation import *
from puffbuddies.domain.eligibility_persistence import load_eligibility,persist_eligibility
from puffbuddies.domain.eligibility_state import EligibilityRecord
from puffbuddies.domain.invalidation import ALL_DERIVED,CanonicalChange
from puffbuddies.domain.types import EligibilityState,ProfileId
from puffbuddies.persistence.revocation import DerivedAuthorityToken,token_current
from puffbuddies.storage.memory import InMemoryPrivateRepository

class PB26RevocationExpiryHandlingTests(unittest.TestCase):
 def current(self,**kw):
  d=dict(profile_id=ProfileId("p"),state=EligibilityState.ELIGIBLE,source_version="id-v1",
         policy_version="pb-age-v1",expires_at_epoch=200,sequence=5,checked_at_epoch=100)
  d.update(kw);return EligibilityRecord(**d)

 def test_authoritative_revocation_advances_state_and_invalidates_all_derived(self):
  out=apply_authoritative_revocation(self.current(),source_version="id-v1",sequence=6,
                                     revoked_at_epoch=150,current_generation=9)
  self.assertEqual(out.record.state,EligibilityState.REVOKED)
  self.assertEqual(out.record.sequence,6)
  self.assertEqual(out.marker.generation,10)
  self.assertEqual(out.invalidation.change,CanonicalChange.ELIGIBILITY)
  self.assertEqual(out.invalidation.surfaces,ALL_DERIVED)
  self.assertFalse(token_current(DerivedAuthorityToken("p",9),out.marker))

 def test_revocation_rejects_old_source_replay_and_time_rollback(self):
  with self.assertRaises(EligibilityRevocationDenied):
   apply_authoritative_revocation(self.current(),source_version="old",sequence=6,revoked_at_epoch=150,current_generation=1)
  with self.assertRaises(EligibilityRevocationDenied):
   apply_authoritative_revocation(self.current(),source_version="id-v1",sequence=5,revoked_at_epoch=150,current_generation=1)
  with self.assertRaises(EligibilityRevocationDenied):
   apply_authoritative_revocation(self.current(),source_version="id-v1",sequence=6,revoked_at_epoch=99,current_generation=1)

 def test_expiry_only_fires_when_due_and_advances_sequence(self):
  self.assertIsNone(apply_expiry_if_due(self.current(),sequence=6,now_epoch=199,current_generation=3))
  out=apply_expiry_if_due(self.current(),sequence=6,now_epoch=200,current_generation=3)
  self.assertEqual(out.record.state,EligibilityState.EXPIRED)
  self.assertEqual(out.record.sequence,6)
  self.assertEqual(out.record.checked_at_epoch,200)
  self.assertEqual(out.invalidation.surfaces,ALL_DERIVED)

 def test_expiry_rejects_replay_and_invalid_eligible_expiry(self):
  with self.assertRaises(EligibilityRevocationDenied):
   apply_expiry_if_due(self.current(),sequence=5,now_epoch=200,current_generation=1)
  with self.assertRaises(EligibilityRevocationDenied):
   apply_expiry_if_due(self.current(expires_at_epoch=None),sequence=6,now_epoch=200,current_generation=1)

 def test_noneligible_state_is_not_reexpired(self):
  for state in (EligibilityState.EXPIRED,EligibilityState.REVOKED,EligibilityState.INELIGIBLE,EligibilityState.UNKNOWN):
   self.assertIsNone(apply_expiry_if_due(self.current(state=state,expires_at_epoch=None if state==EligibilityState.UNKNOWN else 200),
                                         sequence=6,now_epoch=300,current_generation=1))

 def test_revocation_of_unknown_is_rejected(self):
  with self.assertRaises(EligibilityRevocationDenied):
   apply_authoritative_revocation(self.current(state=EligibilityState.UNKNOWN,source_version="",expires_at_epoch=None),
                                  source_version="id-v1",sequence=6,revoked_at_epoch=150,current_generation=1)

 def test_outcomes_persist_and_survive_reload(self):
  repo=InMemoryPrivateRepository()
  first=persist_eligibility(repo,self.current(),expected_version=None)
  out=apply_authoritative_revocation(self.current(),source_version="id-v1",sequence=6,
                                     revoked_at_epoch=150,current_generation=4)
  second=persist_invalidation_outcome(repo,out,expected_version=first.version)
  loaded,version=load_eligibility(repo,ProfileId("p"))
  self.assertEqual(loaded.state,EligibilityState.REVOKED)
  self.assertEqual(loaded.sequence,6)
  self.assertEqual(version,second.version)

 def test_outcome_contains_no_raw_identity_or_proof_payload(self):
  self.assertEqual(set(EligibilityInvalidationOutcome.__dataclass_fields__),{"record","marker","invalidation"})

if __name__=="__main__":unittest.main()
