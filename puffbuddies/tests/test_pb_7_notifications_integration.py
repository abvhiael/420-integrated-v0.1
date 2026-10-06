import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))

from puffbuddies.domain.authorization import AuthorizationContext,PrincipalKind
from puffbuddies.domain.eligibility_authorization import BoundEligibilityAuthorization
from puffbuddies.domain.notifications_integration import *
from puffbuddies.domain.messaging_eligibility import MessagingEligibilityPair
from puffbuddies.domain.types import EligibilityState,LifecycleState,ProfileId,RelationshipState
from puffbuddies.persistence.revocation import DerivedAuthorityToken,RevocationMarker

class FakeNotifications:
 def __init__(self,selection): self.selection=selection;self.fail=False
 def selected_subscription(self,sid):
  if self.fail: raise OSError("service unavailable")
  return self.selection if self.selection and self.selection.subscription.subscription_id==sid else None

class PB7NotificationsIntegrationTests(unittest.TestCase):
 def bound(self,pid,peer,rel=RelationshipState.MATCHED,eligible=EligibilityState.ELIGIBLE,
           lifecycle=LifecycleState.ACTIVE,blocked=False):
  return BoundEligibilityAuthorization(
   AuthorizationContext(PrincipalKind.USER,pid,actor_id=peer,eligibility=eligible,
    lifecycle=lifecycle,relationship=rel,blocked=blocked),1,"v1",100)
 def pair(self,rel=RelationshipState.MATCHED):
  return MessagingEligibilityPair(self.bound("alice","bob",rel),self.bound("bob","alice",rel))
 def tokens(self):
  return dict(left_token=DerivedAuthorityToken("alice",8),left_marker=RevocationMarker("alice",8,"CURRENT"),
    right_token=DerivedAuthorityToken("bob",8),right_marker=RevocationMarker("bob",8,"CURRENT"))
 def sub(self,**kw):
  v=dict(subscription_id="sub:1",sources=frozenset({"puffbuddies"}),
   topics=frozenset({"relationships","messages"}),events=frozenset(),
   minimum_severity=NotificationSeverity.INFO,channels=("in_app",),active=True,muted=False,
   operational_consent=True,promotional_consent=False)
  v.update(kw);return NotificationsSubscriptionSnapshot(**v)
 def reader(self,sub=None):
  if sub is None: sub=self.sub()
  return FakeNotifications(NotificationsSelection(sub,{"in_app":"private:dest"}))
 def match_intent(self):
  return PuffBuddiesNotificationIntent("evt:match:1",ProfileId("alice"),
    NotificationKind.MATCHED,NotificationTopic.RELATIONSHIPS,"puffbuddies://matches/current")
 def message_intent(self):
  return PuffBuddiesNotificationIntent("evt:message:1",ProfileId("alice"),
    NotificationKind.MESSAGE_AVAILABLE,NotificationTopic.MESSAGES,"puffbuddies://messages/current")

 def test_current_match_and_selected_operational_subscription_handoff(self):
  out=prepare_notification_handoffs(self.match_intent(),self.pair(),subscription_id="sub:1",
    reader=self.reader(),**self.tokens())
  self.assertEqual(len(out),1);self.assertEqual(out[0].service_id,NOTIFICATIONS_SERVICE_ID)
  self.assertFalse(out[0].authoritative);self.assertEqual(out[0].classification,"operational")

 def test_unmatched_or_stale_pair_denies_notification_intent(self):
  with self.assertRaises(NotificationsIntegrationDenied):
   prepare_notification_handoffs(self.match_intent(),self.pair(RelationshipState.UNMATCHED),
    subscription_id="sub:1",reader=self.reader(),**self.tokens())
  stale=self.tokens();stale["left_token"]=DerivedAuthorityToken("alice",7)
  with self.assertRaises(NotificationsIntegrationDenied):
   prepare_notification_handoffs(self.match_intent(),self.pair(),subscription_id="sub:1",
    reader=self.reader(),**stale)

 def test_message_notification_requires_current_pb6_handoff(self):
  with self.assertRaises(NotificationsIntegrationDenied):
   prepare_notification_handoffs(self.message_intent(),self.pair(),subscription_id="sub:1",
    reader=self.reader(),messenger_handoff_allowed=False,**self.tokens())
  out=prepare_notification_handoffs(self.message_intent(),self.pair(),subscription_id="sub:1",
    reader=self.reader(),messenger_handoff_allowed=True,**self.tokens())
  self.assertEqual(len(out),1)

 def test_muted_inactive_or_no_operational_consent_suppresses_delivery(self):
  for sub in (self.sub(muted=True),self.sub(active=False),self.sub(operational_consent=False)):
   self.assertEqual(prepare_notification_handoffs(self.match_intent(),self.pair(),subscription_id="sub:1",
    reader=self.reader(sub),**self.tokens()),())

 def test_subscription_filters_and_severity_are_notifications_owned(self):
  wrong=self.sub(topics=frozenset({"messages"}))
  self.assertEqual(prepare_notification_handoffs(self.match_intent(),self.pair(),subscription_id="sub:1",
    reader=self.reader(wrong),**self.tokens()),())
  high=self.sub(minimum_severity=NotificationSeverity.CRITICAL)
  self.assertEqual(prepare_notification_handoffs(self.match_intent(),self.pair(),subscription_id="sub:1",
    reader=self.reader(high),**self.tokens()),())

 def test_promotional_consent_does_not_grant_operational_delivery(self):
  sub=self.sub(operational_consent=False,promotional_consent=True)
  self.assertEqual(prepare_notification_handoffs(self.match_intent(),self.pair(),subscription_id="sub:1",
    reader=self.reader(sub),**self.tokens()),())

 def test_notification_dependency_outage_fails_closed(self):
  r=self.reader();r.fail=True
  with self.assertRaises(NotificationsDependencyUnavailable):
   prepare_notification_handoffs(self.match_intent(),self.pair(),subscription_id="sub:1",
    reader=r,**self.tokens())

 def test_recipient_must_be_current_pair_member(self):
  bad=PuffBuddiesNotificationIntent("evt:x",ProfileId("mallory"),
    NotificationKind.MATCHED,NotificationTopic.RELATIONSHIPS,"puffbuddies://matches/current")
  with self.assertRaises(NotificationsIntegrationDenied):
   prepare_notification_handoffs(bad,self.pair(),subscription_id="sub:1",reader=self.reader(),**self.tokens())

 def test_handoff_payload_is_minimum_disclosure(self):
  out=prepare_notification_handoffs(self.match_intent(),self.pair(),subscription_id="sub:1",
    reader=self.reader(),**self.tokens())[0]
  self.assertEqual(set(out.payload),{"notificationId","appId","kind","topic","actionRef","authoritative"})
  text=str(out.payload).lower()
  for forbidden in ("alice","bob","wallet_address","account_ref","eligibility","lifecycle",
                    "relationship_state","conversation_id","message_id","subscription_id","destination"):
   self.assertNotIn(forbidden,text)

 def test_destination_and_subscription_are_handoff_only_not_puffbuddies_state(self):
  with self.assertRaises(NotificationsIntegrationDenied):
   assert_no_persistent_notification_binding({"profile_id":"alice","subscription_id":"sub:1"})
  assert_no_persistent_notification_binding({"event_generation":8,"kind":"MATCHED"})

 def test_multiple_channels_use_notifications_provider_mapping(self):
  sub=self.sub(channels=("in_app","web","push"))
  r=FakeNotifications(NotificationsSelection(sub,{
    "in_app":"d:1","web":"d:2","push":"d:3"}))
  out=prepare_notification_handoffs(self.match_intent(),self.pair(),subscription_id="sub:1",
    reader=r,**self.tokens())
  self.assertEqual([x.provider_id for x in out],["genesis-in-app","genesis-web","genesis-push"])

 def test_kind_topic_mismatch_rejected(self):
  with self.assertRaises(NotificationsIntegrationDenied):
   PuffBuddiesNotificationIntent("evt:x",ProfileId("alice"),
    NotificationKind.MATCHED,NotificationTopic.MESSAGES,"puffbuddies://matches/current")

if __name__=="__main__":unittest.main()
