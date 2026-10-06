import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))
from puffbuddies.domain.audit_evidence import *
from puffbuddies.domain.state_machines import Authority,TransitionDenied
from puffbuddies.domain.types import LifecycleState,RelationshipState
class PB16AuditEvidenceTests(unittest.TestCase):
 def test_lifecycle_transition_records_minimum_protected_evidence(self):
  e=record_transition(kind=AuditKind.LIFECYCLE,profile_id="private-profile",source=LifecycleState.ACTIVE,target=LifecycleState.DEACTIVATED,authority=Authority.USER,reason_code="USER_DEACTIVATE",sequence=1,pepper="protected-secret")
  p=evidence_payload(e);self.assertNotEqual(p["subject_ref"],"private-profile");self.assertEqual(len(p["subject_ref"]),64);self.assertTrue(set(p).isdisjoint(FORBIDDEN_EVIDENCE_FIELDS))
 def test_invalid_transition_cannot_be_audited_as_success(self):
  with self.assertRaises(TransitionDenied): record_transition(kind=AuditKind.LIFECYCLE,profile_id="p",source=LifecycleState.DELETION_COMPLETE,target=LifecycleState.ACTIVE,authority=Authority.USER,reason_code="RESTORE",sequence=1,pepper="x")
 def test_match_evidence_requires_canonical_reciprocal_authority(self):
  e=record_transition(kind=AuditKind.CONSENT,profile_id="p",source=RelationshipState.LIKED,target=RelationshipState.MATCHED,authority=Authority.RECIPROCAL_USERS,reason_code="RECIPROCAL_MATCH",sequence=2,pepper="x");self.assertEqual(e.authority,"RECIPROCAL_USERS")
  with self.assertRaises(TransitionDenied): record_transition(kind=AuditKind.CONSENT,profile_id="p",source=RelationshipState.LIKED,target=RelationshipState.MATCHED,authority=Authority.USER,reason_code="FAKE_MATCH",sequence=2,pepper="x")
 def test_unmatch_and_block_are_auditable_without_graph(self):
  for target in (RelationshipState.UNMATCHED,RelationshipState.BLOCKED):
   source=RelationshipState.MATCHED
   e=record_transition(kind=AuditKind.CONSENT,profile_id="p",source=source,target=target,authority=Authority.USER,reason_code="CONSENT_REVOKED",sequence=3,pepper="x");self.assertNotIn("other_profile_id",evidence_payload(e))
 def test_moderation_requires_safety_or_review_authority(self):
  e=record_transition(kind=AuditKind.MODERATION,profile_id="p",source=LifecycleState.ACTIVE,target=LifecycleState.SUSPENDED,authority=Authority.SAFETY,reason_code="SAFETY_SUSPEND",sequence=4,pepper="x");self.assertEqual(e.kind,AuditKind.MODERATION)
  with self.assertRaises(TransitionDenied): record_transition(kind=AuditKind.MODERATION,profile_id="p",source=LifecycleState.ACTIVE,target=LifecycleState.DEACTIVATED,authority=Authority.USER,reason_code="NOT_MOD",sequence=4,pepper="x")
 def test_deletion_evidence_is_bounded_to_deletion_transitions(self):
  e=record_transition(kind=AuditKind.DELETION,profile_id="p",source=LifecycleState.ACTIVE,target=LifecycleState.DELETE_REQUESTED,authority=Authority.USER,reason_code="DELETE_REQUEST",sequence=5,pepper="x");self.assertEqual(e.target,"DELETE_REQUESTED")
  with self.assertRaises(TransitionDenied): record_transition(kind=AuditKind.DELETION,profile_id="p",source=LifecycleState.ACTIVE,target=LifecycleState.DEACTIVATED,authority=Authority.USER,reason_code="NO",sequence=5,pepper="x")
 def test_reason_and_sequence_are_bounded(self):
  for reason,seq in (("",1),("x"*65,1),("ok",0)):
   with self.assertRaises(ValueError): record_transition(kind=AuditKind.LIFECYCLE,profile_id="p",source=LifecycleState.ACTIVE,target=LifecycleState.DEACTIVATED,authority=Authority.USER,reason_code=reason,sequence=seq,pepper="x")
 def test_subject_reference_requires_protected_pepper(self):
  with self.assertRaises(ValueError): protected_subject_ref("p","")
  self.assertNotEqual(protected_subject_ref("p","a"),protected_subject_ref("p","b"))
 def test_evidence_schema_has_no_sensitive_payload_fields(self):
  self.assertTrue(set(TransitionEvidence.__dataclass_fields__).isdisjoint(FORBIDDEN_EVIDENCE_FIELDS))
if __name__=="__main__":unittest.main()
