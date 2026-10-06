import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))

from puffbuddies.domain.authorization import AuthorizationContext,PrincipalKind
from puffbuddies.domain.eligibility_authorization import BoundEligibilityAuthorization
from puffbuddies.domain.matching import PairRelationship,bind_pair_relationship
from puffbuddies.domain.messenger_integration import *
from puffbuddies.domain.messaging_eligibility import MessagingEligibilityPair
from puffbuddies.domain.types import EligibilityState,LifecycleState,ProfileId,RelationshipState
from puffbuddies.persistence.revocation import DerivedAuthorityToken,RevocationMarker

class Reader:
 def __init__(self,state=MessengerConversationState.ACTIVE):
  self.state=state;self.block=False
 def endpoint_active(self,a): return True
 def blocked(self,a,b): return self.block
 def conversation(self,c):
  return MessengerConversationSnapshot(c,"acct:a","acct:b","acct:a",self.state)

class PB6MessengerMilestoneTests(unittest.TestCase):
 def bound(self,pid,peer,pair):
  raw=BoundEligibilityAuthorization(
   AuthorizationContext(PrincipalKind.USER,pid,actor_id=peer,eligibility=EligibilityState.ELIGIBLE,
    lifecycle=LifecycleState.ACTIVE),1,"v1",100)
  return bind_pair_relationship(raw,pair)
 def tokens(self):
  return dict(left_token=DerivedAuthorityToken("alice",7),left_marker=RevocationMarker("alice",7,"CURRENT"),
    right_token=DerivedAuthorityToken("bob",7),right_marker=RevocationMarker("bob",7,"CURRENT"))

 def test_current_pb5_match_hands_off_to_current_messenger_authority(self):
  pair=PairRelationship(ProfileId("alice"),ProfileId("bob"),RelationshipState.MATCHED,2)
  auth=MessagingEligibilityPair(self.bound("alice","bob",pair),self.bound("bob","alice",pair))
  a=MessengerAccountBinding(ProfileId("alice"),"acct:a");b=MessengerAccountBinding(ProfileId("bob"),"acct:b")
  reader=Reader()
  self.assertTrue(authorize_send(auth,left_binding=a,right_binding=b,sender_profile_id=ProfileId("alice"),
    conversation_ref="conv:pb",reader=reader,**self.tokens()).allowed)

 def test_pb5_unmatch_revokes_puffbuddies_send_even_if_messenger_still_active(self):
  pair=PairRelationship(ProfileId("alice"),ProfileId("bob"),RelationshipState.UNMATCHED,3)
  auth=MessagingEligibilityPair(self.bound("alice","bob",pair),self.bound("bob","alice",pair))
  a=MessengerAccountBinding(ProfileId("alice"),"acct:a");b=MessengerAccountBinding(ProfileId("bob"),"acct:b")
  with self.assertRaises(MessengerIntegrationDenied):
   authorize_send(auth,left_binding=a,right_binding=b,sender_profile_id=ProfileId("alice"),
    conversation_ref="conv:pb",reader=Reader(),**self.tokens())

 def test_messenger_native_block_revokes_handoff_without_mutating_pb_match(self):
  pair=PairRelationship(ProfileId("alice"),ProfileId("bob"),RelationshipState.MATCHED,2)
  auth=MessagingEligibilityPair(self.bound("alice","bob",pair),self.bound("bob","alice",pair))
  a=MessengerAccountBinding(ProfileId("alice"),"acct:a");b=MessengerAccountBinding(ProfileId("bob"),"acct:b")
  reader=Reader();reader.block=True
  with self.assertRaises(MessengerIntegrationDenied):
   authorize_send(auth,left_binding=a,right_binding=b,sender_profile_id=ProfileId("alice"),
    conversation_ref="conv:pb",reader=reader,**self.tokens())
  self.assertEqual(auth.left.context.relationship,RelationshipState.MATCHED)

if __name__=="__main__":unittest.main()
