import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))

from puffbuddies.domain.authorization import AuthorizationContext,PrincipalKind
from puffbuddies.domain.eligibility_authorization import BoundEligibilityAuthorization
from puffbuddies.domain.messenger_integration import MessengerAuthorizationConclusion
from puffbuddies.domain.messaging_eligibility import MessagingEligibilityPair
from puffbuddies.domain.notifications_integration import *
from puffbuddies.domain.types import EligibilityState,LifecycleState,ProfileId,RelationshipState
from puffbuddies.persistence.revocation import DerivedAuthorityToken,RevocationMarker

class Reader:
 def __init__(self,sub): self.sub=sub
 def selected_subscription(self,sid):
  return NotificationsSelection(self.sub,{"in_app":"private:recipient"}) if sid==self.sub.subscription_id else None

class PB7CrossAppIntegrationTests(unittest.TestCase):
 def bound(self,pid,peer,rel=RelationshipState.MATCHED):
  return BoundEligibilityAuthorization(
   AuthorizationContext(PrincipalKind.USER,pid,actor_id=peer,eligibility=EligibilityState.ELIGIBLE,
    lifecycle=LifecycleState.ACTIVE,relationship=rel),1,"v1",100)
 def pair(self,rel=RelationshipState.MATCHED):
  return MessagingEligibilityPair(self.bound("alice","bob",rel),self.bound("bob","alice",rel))
 def tokens(self,g=9):
  return dict(left_token=DerivedAuthorityToken("alice",g),left_marker=RevocationMarker("alice",g,"CURRENT"),
   right_token=DerivedAuthorityToken("bob",g),right_marker=RevocationMarker("bob",g,"CURRENT"))
 def reader(self):
  sub=NotificationsSubscriptionSnapshot("sub:pb",frozenset({"puffbuddies"}),
   frozenset({"messages","relationships"}),frozenset(),NotificationSeverity.INFO,
   ("in_app",),True,False,True,False)
  return Reader(sub)

 def test_pb6_authorized_message_can_create_non_authoritative_pb7_handoff(self):
  intent=PuffBuddiesNotificationIntent("evt:msg",ProfileId("bob"),NotificationKind.MESSAGE_AVAILABLE,
   NotificationTopic.MESSAGES,"puffbuddies://messages/current")
  pb6=MessengerAuthorizationConclusion(True)
  out=prepare_notification_handoffs(intent,self.pair(),subscription_id="sub:pb",reader=self.reader(),
   messenger_handoff_allowed=pb6.allowed,**self.tokens())
  self.assertEqual(len(out),1);self.assertFalse(out[0].authoritative)

 def test_unmatch_revokes_notification_despite_prior_pb6_authorization(self):
  intent=PuffBuddiesNotificationIntent("evt:msg",ProfileId("bob"),NotificationKind.MESSAGE_AVAILABLE,
   NotificationTopic.MESSAGES,"puffbuddies://messages/current")
  with self.assertRaises(NotificationsIntegrationDenied):
   prepare_notification_handoffs(intent,self.pair(RelationshipState.UNMATCHED),subscription_id="sub:pb",
    reader=self.reader(),messenger_handoff_allowed=True,**self.tokens())

 def test_notifications_preference_can_suppress_without_rewriting_match_or_messenger_authority(self):
  sub=NotificationsSubscriptionSnapshot("sub:pb",frozenset({"puffbuddies"}),
   frozenset({"messages"}),frozenset(),NotificationSeverity.INFO,("in_app",),True,True,True,False)
  intent=PuffBuddiesNotificationIntent("evt:msg",ProfileId("bob"),NotificationKind.MESSAGE_AVAILABLE,
   NotificationTopic.MESSAGES,"puffbuddies://messages/current")
  pair=self.pair()
  self.assertEqual(prepare_notification_handoffs(intent,pair,subscription_id="sub:pb",
    reader=Reader(sub),messenger_handoff_allowed=True,**self.tokens()),())
  self.assertEqual(pair.left.context.relationship,RelationshipState.MATCHED)

if __name__=="__main__":unittest.main()
