import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))
from dataclasses import replace
from puffbuddies.domain.premium_entitlements import *
from puffbuddies.domain.authorization import AuthorizationContext,PrincipalKind
from puffbuddies.domain.discovery_matching_eligibility import DiscoveryMatchingPair,match_intent_allowed
from puffbuddies.domain.eligibility_authorization import BoundEligibilityAuthorization
from puffbuddies.domain.messaging_eligibility import MessagingEligibilityPair,ordinary_messaging_allowed
from puffbuddies.domain.types import *

class R:
 def __init__(self,status=PayStatus.SETTLED,refund=0):self.status=status;self.refund=refund
 def payment(self,ref):
  return PaymentSettlementSnapshot(ref,"inv","payer:a","merchant:pb","asset:420",42,self.refund,
   self.status,"pay-v1",100)

class PB10IntegrationTests(unittest.TestCase):
 def entitlement(self):
  offer=PremiumOffer("offer","inv","merchant:pb","asset:420",42,
   frozenset({PremiumFeature.LIKED_YOU}),1000,"p1")
  return grant_entitlements(profile_id=ProfileId("a"),account_binding=PaymentAccountBinding(ProfileId("a"),"payer:a"),
   offer=offer,payment_ref="p",reader=R(),now_epoch=110,current_policy_version="p1")[0]
 def bound(self,pid,peer,rel=RelationshipState.NONE,blocked=False,lifecycle=LifecycleState.ACTIVE):
  return BoundEligibilityAuthorization(AuthorizationContext(PrincipalKind.USER,pid,actor_id=peer,
   eligibility=EligibilityState.ELIGIBLE,lifecycle=lifecycle,relationship=rel,blocked=blocked),1,"v1",100)

 def test_active_premium_cannot_manufacture_match_intent_authority_for_blocked_pair(self):
  self.assertEqual(self.entitlement().state,EntitlementState.ACTIVE)
  pair=DiscoveryMatchingPair(self.bound("a","b",blocked=True),self.bound("b","a",blocked=True))
  self.assertFalse(match_intent_allowed(pair))

 def test_active_premium_cannot_manufacture_messaging_without_match(self):
  self.assertEqual(self.entitlement().state,EntitlementState.ACTIVE)
  pair=MessagingEligibilityPair(self.bound("a","b"),self.bound("b","a"))
  self.assertFalse(ordinary_messaging_allowed(pair))

 def test_active_premium_cannot_override_suspension(self):
  e=self.entitlement()
  self.assertFalse(feature_allowed(e,profile_id=ProfileId("a"),feature=e.feature,
   lifecycle=LifecycleState.SUSPENDED,now_epoch=120,current_policy_version="p1"))

if __name__=="__main__":unittest.main()
