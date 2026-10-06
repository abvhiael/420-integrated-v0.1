import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))

from puffbuddies.domain.eligibility_authorization import *
from puffbuddies.domain.authorization import AuthorizationContext,PrincipalKind
from puffbuddies.domain.eligibility_persistence import *
from puffbuddies.domain.eligibility_privacy import *
from puffbuddies.domain.eligibility_revocation import *
from puffbuddies.domain.eligibility_state import *
from puffbuddies.domain.repositories import StoredRecord,VersionConflict
from puffbuddies.domain.types import *
from puffbuddies.persistence.recovery import *
from puffbuddies.persistence.revocation import DerivedAuthorityToken,RevocationMarker,RevocationDenied
from puffbuddies.storage.memory import InMemoryPrivateRepository

class BrokenRepo:
 def get(self,*a,**k): raise ConnectionError("down")
 def put(self,*a,**k): raise TimeoutError("down")

class PB212FailureRecoveryQualificationTests(unittest.TestCase):
 def record(self,**kw):
  d=dict(profile_id=ProfileId("p"),state=EligibilityState.ELIGIBLE,source_version="id-v1",
         policy_version="v1",expires_at_epoch=200,sequence=7,checked_at_epoch=100)
  d.update(kw);return EligibilityRecord(**d)

 def stored(self,record=None,version=1):
  r=record or self.record()
  return StoredRecord("eligibility_projection",str(r.profile_id),version,{
   "profile_id":str(r.profile_id),"decision":r.state.value,"source_version":r.source_version,
   "expires_at":r.expires_at_epoch,"policy_version":r.policy_version,
   "sequence":r.sequence,"checked_at_epoch":r.checked_at_epoch,
  })

 def test_authoritative_store_outage_fails_closed(self):
  with self.assertRaises(AuthorityUnavailable):
   authoritative_read(None,"eligibility_projection","p")
  with self.assertRaises(AuthorityUnavailable):
   authoritative_read(BrokenRepo(),"eligibility_projection","p")

 def test_stale_replica_cannot_restore_old_eligible_after_newer_decision(self):
  stale=self.stored(self.record(sequence=7),version=1)
  current=self.stored(self.record(state=EligibilityState.REVOKED,sequence=8,checked_at_epoch=120),version=2)
  with self.assertRaises(RecoveryFailed):
   require_current_replica(stale,current)

 def test_same_version_conflicting_replica_rejected(self):
  a=self.stored(self.record(state=EligibilityState.ELIGIBLE),version=2)
  b=self.stored(self.record(state=EligibilityState.REVOKED),version=2)
  with self.assertRaises(RecoveryFailed): require_current_replica(a,b)

 def test_restore_before_eligibility_revocation_generation_is_rejected(self):
  snap=Snapshot(4,(self.stored(),))
  marker=RevocationMarker("p",5,"ELIGIBILITY_REVOKED")
  with self.assertRaises(RevocationDenied): validate_restore(snap,marker)

 def test_current_generation_restore_still_requires_nonconflicting_snapshot(self):
  marker=RevocationMarker("p",5,"RECOVERY")
  good=Snapshot(5,(self.stored(),))
  self.assertEqual(validate_restore(good,marker),good.records)
  bad=Snapshot(5,(self.stored(version=1),self.stored(version=2)))
  with self.assertRaises(RecoveryFailed): validate_restore(bad,marker)

 def test_optimistic_concurrency_prevents_stale_eligibility_rewrite(self):
  repo=InMemoryPrivateRepository()
  first=persist_eligibility(repo,self.record(),expected_version=None)
  newer=persist_eligibility(repo,self.record(sequence=8,checked_at_epoch=110),expected_version=first.version)
  with self.assertRaises((VersionConflict,EligibilityPersistenceDenied)):
   persist_eligibility(repo,self.record(sequence=9,checked_at_epoch=111),expected_version=first.version)
  loaded,version=load_eligibility(repo,ProfileId("p"))
  self.assertEqual(version,newer.version)
  self.assertEqual(loaded.sequence,8)

 def test_partial_storage_failure_is_not_publishable_authority(self):
  repo=InMemoryPrivateRepository()
  def eligibility_write():
   return persist_eligibility(repo,self.record(),expected_version=None)
  def downstream_failure():
   raise TimeoutError("derived publication failed")
  with self.assertRaises(RecoveryFailed):
   staged_batch(repo,[eligibility_write,downstream_failure])
  # PB-1.12 explicitly does not claim transactional rollback for this adapter;
  # failure means callers must not publish derived authorization as success.
  stored=repo.get("eligibility_projection","p")
  self.assertIsNotNone(stored)

 def test_known_good_rollback_plan_never_uses_partial_after_image(self):
  before=(self.stored(self.record(sequence=7),version=1),)
  after=(self.stored(self.record(sequence=8,checked_at_epoch=110),version=2),)
  self.assertEqual(rollback_plan(before,after),before)
  with self.assertRaises(RecoveryFailed): rollback_plan((),after)

 def test_recovered_record_must_still_pass_policy_and_expiry_authorization(self):
  ctx=AuthorizationContext(PrincipalKind.USER,"p",actor_id="q",
      lifecycle=LifecycleState.ACTIVE,relationship=RelationshipState.MATCHED)
  expired=self.record(expires_at_epoch=120)
  b=bind_current_eligibility(ctx,expired,profile_id=ProfileId("p"),current_policy_version="v1",now_epoch=120)
  self.assertEqual(b.context.eligibility,EligibilityState.EXPIRED)
  stale=bind_current_eligibility(ctx,self.record(),profile_id=ProfileId("p"),current_policy_version="v2",now_epoch=120)
  self.assertEqual(stale.context.eligibility,EligibilityState.UNKNOWN)

 def test_recovery_payload_cannot_add_raw_identity_or_proof_fields(self):
  for key in ("date_of_birth","raw_identity_evidence","raw_proof","proof_bytes","credential_payload","wallet_address"):
   values=dict(self.stored().values);values[key]="secret"
   bad=StoredRecord("eligibility_projection","p",1,values)
   with self.assertRaises(EligibilityPersistenceDenied):
    decode_eligibility_record(bad,profile_id=ProfileId("p"))

 def test_recovery_does_not_turn_private_metadata_into_external_payload(self):
  for payload in ({"policy_version":"v1"},{"sequence":8},{"source_version":"id-v1"},{"eligibility_state":"ELIGIBLE"}):
   with self.assertRaises(LeakageDenied): assert_pb2_external_payload_minimal(payload)

if __name__=="__main__":unittest.main()
