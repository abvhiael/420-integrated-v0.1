import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))
from puffbuddies.domain.eligibility_privacy import *
from puffbuddies.domain.privacy import LeakageDenied

class PB210EligibilityPrivacyTests(unittest.TestCase):
 def test_private_conclusion_is_minimum_boolean_only(self):
  c=private_authorization_conclusion(allowed=True)
  self.assertEqual(set(PrivateAuthorizationConclusion.__dataclass_fields__),{"allowed"})
  self.assertTrue(c.allowed)

 def test_denial_reason_is_uniform(self):
  reasons=["expired","revoked","ineligible","policy-stale","blocked","unmatched","suspended","unknown"]
  self.assertEqual({uniform_denial_code() for _ in reasons},{UNIFORM_DENIAL_CODE})

 def test_pb2_internal_metadata_cannot_enter_external_payload(self):
  for key in PB2_PRIVATE_KEYS:
   with self.assertRaises(LeakageDenied):
    assert_pb2_external_payload_minimal({key:"x"})

 def test_source_policy_sequence_and_expiry_are_private(self):
  for key in ("source_version","policy_version","record_sequence","sequence","checked_at_epoch","expires_at_epoch"):
   with self.assertRaises(LeakageDenied):
    assert_pb2_external_payload_minimal({key:1})

 def test_relationship_and_messaging_state_are_private(self):
  for key in ("relationship_state","blocked","match_id","conversation_id","messenger_native_denied"):
   with self.assertRaises(LeakageDenied):
    assert_pb2_external_payload_minimal({key:"x"})

 def test_existing_pb1_sensitive_tokens_remain_rejected(self):
  for key in ("membership_status","precise_location","cannabis","moderation_state"):
   with self.assertRaises(LeakageDenied):
    assert_pb2_external_payload_minimal({key:"x"})

 def test_nonidentifying_operational_metadata_can_remain_internal_derived(self):
  assert_pb2_external_payload_minimal({"generation":4,"change":"DELETE","surface":"CACHE"})

 def test_public_eligibility_and_authorization_enumeration_are_prohibited(self):
  with self.assertRaises(LeakageDenied): public_eligibility_lookup("profile")
  with self.assertRaises(LeakageDenied): public_authorization_probe("profile","peer")

 def test_conclusion_does_not_encode_reason_or_identity(self):
  c=private_authorization_conclusion(allowed=False)
  self.assertFalse(hasattr(c,"reason"))
  self.assertFalse(hasattr(c,"profile_id"))
  self.assertFalse(hasattr(c,"eligibility"))
  self.assertFalse(hasattr(c,"relationship"))

if __name__=="__main__":unittest.main()
