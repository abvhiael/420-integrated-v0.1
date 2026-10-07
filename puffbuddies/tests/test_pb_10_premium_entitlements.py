from dataclasses import replace
import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))
from puffbuddies.domain.premium_entitlements import *
from puffbuddies.domain.authorization import AuthorizationContext,PrincipalKind,authorize_private_access
from puffbuddies.domain.types import *
from puffbuddies.storage.memory import InMemoryPrivateRepository

class Reader:
 def __init__(self,p):self.p=p;self.fail=False
 def payment(self,ref):
  if self.fail:raise OSError("rpc unavailable")
  return self.p if self.p and self.p.payment_ref==ref else None

class PB10PremiumTests(unittest.TestCase):
 def offer(self):
  return PremiumOffer("premium:monthly","invoice:pb10","merchant:puffbuddies","asset:420",4200,
   frozenset({PremiumFeature.ADVANCED_FILTERS,PremiumFeature.LIKED_YOU,PremiumFeature.INCOGNITO,
              PremiumFeature.PROFILE_CUSTOMIZATION,PremiumFeature.UNDO_REWIND,PremiumFeature.COSMETIC}),
   30*24*3600,"premium-v1")
 def payment(self,status=PayStatus.SETTLED,refunded=0):
  return PaymentSettlementSnapshot("pay:1","invoice:pb10","payer:alice","merchant:puffbuddies",
   "asset:420",4200,refunded,status,"pay-v1",100)
 def binding(self):return PaymentAccountBinding(ProfileId("alice"),"payer:alice")
 def grant(self):
  return grant_entitlements(profile_id=ProfileId("alice"),account_binding=self.binding(),offer=self.offer(),
   payment_ref="pay:1",reader=Reader(self.payment()),now_epoch=120,current_policy_version="premium-v1")

 def test_only_exact_settled_offer_grants_bounded_features(self):
  es=self.grant();self.assertEqual({e.feature for e in es},set(self.offer().features))
  self.assertTrue(all(e.state==EntitlementState.ACTIVE for e in es))

 def test_submitted_finalized_failed_refunded_or_partial_do_not_grant(self):
  for status,refund in ((PayStatus.SUBMITTED,0),(PayStatus.FINALIZED,0),(PayStatus.FAILED,0),
                        (PayStatus.REFUNDED,4200),(PayStatus.PARTIALLY_REFUNDED,1)):
   with self.assertRaises(PremiumDenied):
    grant_entitlements(profile_id=ProfileId("alice"),account_binding=self.binding(),offer=self.offer(),
     payment_ref="pay:1",reader=Reader(self.payment(status,refund)),now_epoch=120,current_policy_version="premium-v1")

 def test_exact_invoice_merchant_asset_amount_and_payer_binding_required(self):
  base=self.payment()
  variants=[
   replace(base,invoice_ref="invoice:other"),replace(base,merchant_ref="merchant:other"),
   replace(base,settlement_asset_ref="asset:other"),replace(base,settlement_amount=4199),
   replace(base,payer_ref="payer:mallory"),
  ]
  for p in variants:
   with self.assertRaises(PremiumDenied):
    grant_entitlements(profile_id=ProfileId("alice"),account_binding=self.binding(),offer=self.offer(),
     payment_ref="pay:1",reader=Reader(p),now_epoch=120,current_policy_version="premium-v1")

 def test_pay_outage_fails_closed(self):
  r=Reader(self.payment());r.fail=True
  with self.assertRaises(PayDependencyUnavailable):
   grant_entitlements(profile_id=ProfileId("alice"),account_binding=self.binding(),offer=self.offer(),
    payment_ref="pay:1",reader=r,now_epoch=120,current_policy_version="premium-v1")

 def test_refund_and_expiry_revoke_existing_entitlement(self):
  e=self.grant()[0]
  r=reconcile_entitlement(e,offer=self.offer(),payment_ref="pay:1",account_binding=self.binding(),
   reader=Reader(self.payment(PayStatus.REFUNDED,4200)),now_epoch=130,current_policy_version="premium-v1")
  self.assertEqual(r.state,EntitlementState.REVOKED)
  x=reconcile_entitlement(e,offer=self.offer(),payment_ref="pay:1",account_binding=self.binding(),
   reader=Reader(self.payment()),now_epoch=e.expires_at_epoch,current_policy_version="premium-v1")
  self.assertEqual(x.state,EntitlementState.EXPIRED)

 def test_policy_change_revokes_without_treating_pay_as_policy_owner(self):
  e=self.grant()[0]
  x=reconcile_entitlement(e,offer=self.offer(),payment_ref="pay:1",account_binding=self.binding(),
   reader=Reader(self.payment()),now_epoch=130,current_policy_version="premium-v2")
  self.assertEqual(x.state,EntitlementState.REVOKED)

 def test_lifecycle_overrides_active_premium(self):
  e=self.grant()[0]
  self.assertTrue(feature_allowed(e,profile_id=ProfileId("alice"),feature=e.feature,
   lifecycle=LifecycleState.ACTIVE,now_epoch=130,current_policy_version="premium-v1"))
  for state in (LifecycleState.RESTRICTED,LifecycleState.SUSPENDED,LifecycleState.BANNED,
                LifecycleState.DEACTIVATED,LifecycleState.DELETE_REQUESTED, LifecycleState.DELETION_COMPLETE):
   self.assertFalse(feature_allowed(e,profile_id=ProfileId("alice"),feature=e.feature,
    lifecycle=state,now_epoch=130,current_policy_version="premium-v1"))

 def test_premium_does_not_create_match_message_or_private_access(self):
  self.grant()
  ctx=AuthorizationContext(PrincipalKind.USER,"bob",actor_id="alice",
   eligibility=EligibilityState.ELIGIBLE,lifecycle=LifecycleState.ACTIVE,
   relationship=RelationshipState.NONE,blocked=False)
  self.assertFalse(authorize_private_access(VisibilityAudience.MATCHED,ctx))
  self.assertFalse(authorize_private_access(VisibilityAudience.PARTICIPANT_ONLY,ctx))

 def test_block_stays_authoritative_despite_entitlement(self):
  self.grant()
  ctx=AuthorizationContext(PrincipalKind.USER,"bob",actor_id="alice",
   eligibility=EligibilityState.ELIGIBLE,lifecycle=LifecycleState.ACTIVE,
   relationship=RelationshipState.MATCHED,blocked=True)
  self.assertFalse(authorize_private_access(VisibilityAudience.MATCHED,ctx))

 def test_persistence_excludes_payment_and_wallet_linkage(self):
  repo=InMemoryPrivateRepository();e=self.grant()[0]
  row=persist_entitlement(repo,e,expected_version=None)
  self.assertNotIn("payment_ref",row.values);self.assertNotIn("payer_ref",row.values)
  self.assertNotIn("wallet_address",row.values);self.assertNotIn("receipt_hash",row.values)
  loaded,v=load_entitlement(repo,ProfileId("alice"),e.feature)
  self.assertEqual(loaded,e);self.assertEqual(v,row.version)

 def test_optimistic_concurrency_rejects_stale_entitlement_write(self):
  repo=InMemoryPrivateRepository();e=self.grant()[0]
  row=persist_entitlement(repo,e,expected_version=None)
  r=replace(e,state=EntitlementState.REVOKED,version=2)
  persist_entitlement(repo,r,expected_version=row.version)
  with self.assertRaises(Exception):persist_entitlement(repo,e,expected_version=row.version)

 def test_entitlement_record_has_no_interpersonal_authority_fields(self):
  self.assertEqual(set(PremiumEntitlement.__dataclass_fields__),{
   "profile_id","feature","offer_id","state","policy_version","source_version",
   "issued_at_epoch","expires_at_epoch","version"})
  with self.assertRaises(PremiumDenied):
   assert_entitlement_not_interpersonal_authority({"block_override":True})

if __name__=="__main__":unittest.main()
