import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))

from puffbuddies.domain.authorization import AuthorizationContext,PrincipalKind
from puffbuddies.domain.eligibility_authorization import BoundEligibilityAuthorization
from puffbuddies.domain.messenger_integration import *
from puffbuddies.domain.messaging_eligibility import MessagingEligibilityPair
from puffbuddies.domain.types import EligibilityState,LifecycleState,ProfileId,RelationshipState
from puffbuddies.persistence.revocation import DerivedAuthorityToken,RevocationMarker

class FakeMessenger:
 def __init__(self):
  self.endpoints={"acct:a":True,"acct:b":True}
  self.blocks=set()
  self.conversations={}
  self.fail=False
 def _ok(self):
  if self.fail: raise OSError("rpc unavailable")
 def endpoint_active(self,a): self._ok(); return self.endpoints.get(a,False)
 def blocked(self,a,b): self._ok(); return (a,b) in self.blocks
 def conversation(self,c): self._ok(); return self.conversations.get(c)

class PB6MessengerIntegrationTests(unittest.TestCase):
 def bound(self,pid,peer,rel=RelationshipState.MATCHED,eligible=EligibilityState.ELIGIBLE,
           lifecycle=LifecycleState.ACTIVE,blocked=False):
  return BoundEligibilityAuthorization(
   AuthorizationContext(PrincipalKind.USER,pid,actor_id=peer,eligibility=eligible,
     lifecycle=lifecycle,relationship=rel,blocked=blocked),1,"v1",100)
 def pair(self,rel=RelationshipState.MATCHED):
  return MessagingEligibilityPair(self.bound("alice","bob",rel),self.bound("bob","alice",rel))
 def bindings(self):
  return MessengerAccountBinding(ProfileId("alice"),"acct:a"),MessengerAccountBinding(ProfileId("bob"),"acct:b")
 def tokens(self):
  return dict(left_token=DerivedAuthorityToken("alice",4),left_marker=RevocationMarker("alice",4,"CURRENT"),
    right_token=DerivedAuthorityToken("bob",4),right_marker=RevocationMarker("bob",4,"CURRENT"))
 def active(self):
  return MessengerConversationSnapshot("conv:1","acct:a","acct:b","acct:a",MessengerConversationState.ACTIVE)

 def test_request_requires_current_match_active_endpoints_and_no_messenger_block(self):
  r=FakeMessenger();a,b=self.bindings()
  intent=prepare_conversation_request(self.pair(),left_binding=a,right_binding=b,
    initiator_profile_id=ProfileId("alice"),context_ref="pb-private-context:1",reader=r,**self.tokens())
  self.assertEqual(intent.initiator_account_ref,"acct:a")
  r.endpoints["acct:b"]=False
  with self.assertRaises(MessengerIntegrationDenied):
   prepare_conversation_request(self.pair(),left_binding=a,right_binding=b,
    initiator_profile_id=ProfileId("alice"),context_ref="ctx",reader=r,**self.tokens())

 def test_messenger_native_block_is_additional_deny_not_puffbuddies_authority(self):
  r=FakeMessenger();a,b=self.bindings();r.blocks.add(("acct:b","acct:a"))
  with self.assertRaises(MessengerIntegrationDenied):
   prepare_conversation_request(self.pair(),left_binding=a,right_binding=b,
    initiator_profile_id=ProfileId("alice"),context_ref="ctx",reader=r,**self.tokens())
  self.assertEqual(self.pair().left.context.relationship,RelationshipState.MATCHED)

 def test_unmatched_pair_denies_even_if_messenger_conversation_is_active(self):
  r=FakeMessenger();r.conversations["conv:1"]=self.active();a,b=self.bindings()
  with self.assertRaises(MessengerIntegrationDenied):
   authorize_send(self.pair(RelationshipState.UNMATCHED),left_binding=a,right_binding=b,
    sender_profile_id=ProfileId("alice"),conversation_ref="conv:1",reader=r,**self.tokens())

 def test_stale_puffbuddies_generation_denies_active_messenger_conversation(self):
  r=FakeMessenger();r.conversations["conv:1"]=self.active();a,b=self.bindings()
  stale=self.tokens();stale["left_token"]=DerivedAuthorityToken("alice",3)
  with self.assertRaises(MessengerIntegrationDenied):
   authorize_send(self.pair(),left_binding=a,right_binding=b,
    sender_profile_id=ProfileId("alice"),conversation_ref="conv:1",reader=r,**stale)

 def test_accept_requires_pending_exact_participants_and_nonrequester(self):
  r=FakeMessenger();a,b=self.bindings()
  r.conversations["conv:1"]=MessengerConversationSnapshot("conv:1","acct:a","acct:b","acct:a",MessengerConversationState.REQUESTED)
  self.assertTrue(authorize_conversation_accept(self.pair(),left_binding=a,right_binding=b,
    accepter_profile_id=ProfileId("bob"),conversation_ref="conv:1",reader=r,**self.tokens()).allowed)
  with self.assertRaises(MessengerIntegrationDenied):
   authorize_conversation_accept(self.pair(),left_binding=a,right_binding=b,
    accepter_profile_id=ProfileId("alice"),conversation_ref="conv:1",reader=r,**self.tokens())

 def test_send_requires_active_exact_conversation_and_current_native_block_state(self):
  r=FakeMessenger();a,b=self.bindings();r.conversations["conv:1"]=self.active()
  self.assertTrue(authorize_send(self.pair(),left_binding=a,right_binding=b,
    sender_profile_id=ProfileId("alice"),conversation_ref="conv:1",reader=r,**self.tokens()).allowed)
  r.blocks.add(("acct:a","acct:b"))
  with self.assertRaises(MessengerIntegrationDenied):
   authorize_send(self.pair(),left_binding=a,right_binding=b,
    sender_profile_id=ProfileId("alice"),conversation_ref="conv:1",reader=r,**self.tokens())

 def test_conversation_participant_mismatch_denies(self):
  r=FakeMessenger();a,b=self.bindings()
  r.conversations["conv:1"]=MessengerConversationSnapshot("conv:1","acct:a","acct:x","acct:a",MessengerConversationState.ACTIVE)
  with self.assertRaises(MessengerIntegrationDenied):
   authorize_send(self.pair(),left_binding=a,right_binding=b,
    sender_profile_id=ProfileId("alice"),conversation_ref="conv:1",reader=r,**self.tokens())

 def test_messenger_authority_outage_fails_closed(self):
  r=FakeMessenger();r.fail=True;a,b=self.bindings()
  with self.assertRaises(MessengerDependencyUnavailable):
   prepare_conversation_request(self.pair(),left_binding=a,right_binding=b,
    initiator_profile_id=ProfileId("alice"),context_ref="ctx",reader=r,**self.tokens())

 def test_close_handoff_is_best_effort_and_does_not_restore_authority(self):
  r=FakeMessenger();r.conversations["conv:1"]=self.active();a,b=self.bindings()
  close=prepare_close_intent_after_puffbuddies_revocation(
    actor_binding=a,peer_binding=b,conversation_ref="conv:1",reader=r)
  self.assertEqual(close,MessengerCloseIntent("conv:1","acct:a"))
  r.conversations["conv:1"]=MessengerConversationSnapshot("conv:1","acct:a","acct:b","acct:a",MessengerConversationState.CLOSED)
  self.assertIsNone(prepare_close_intent_after_puffbuddies_revocation(
    actor_binding=a,peer_binding=b,conversation_ref="conv:1",reader=r))

 def test_profile_account_binding_is_transient_and_not_in_authorization_conclusion(self):
  self.assertEqual(set(MessengerAuthorizationConclusion.__dataclass_fields__),{"allowed"})
  with self.assertRaises(MessengerIntegrationDenied):
   assert_no_persistent_profile_account_mapping({"profile_id":"alice","account_ref":"acct:a"})
  assert_no_persistent_profile_account_mapping({"generation":4,"state":"CURRENT"})

 def test_request_handoff_contains_messenger_fields_not_puffbuddies_profile_ids(self):
  self.assertEqual(set(MessengerRequestIntent.__dataclass_fields__),
    {"initiator_account_ref","peer_account_ref","context_ref"})
  self.assertNotIn("profile_id",MessengerRequestIntent.__dataclass_fields__)

 def test_no_message_payload_envelope_or_receipt_state_is_owned_here(self):
  fields=set(MessengerAuthorizationConclusion.__dataclass_fields__)|set(MessengerRequestIntent.__dataclass_fields__)
  for forbidden in ("plaintext","ciphertext","attachment","envelope_hash","storage_ref_hash","receipt","read_at"):
   self.assertNotIn(forbidden,fields)

if __name__=="__main__":unittest.main()
