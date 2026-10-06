import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))

from puffbuddies.integrations.ecosystem import *

class PB13CrossAppTests(unittest.TestCase):
 def snap(self,name="420Wallet",**kw):
  values=dict(dependency=name,service_id=SERVICE_IDS[name],version=1,active=True,deprecated=False,
   chain_id=420,observed_at_epoch=100,implementation_ref="registry:impl:v1")
  values.update(kw);return RegistryServiceSnapshot(**values)

 def test_dependency_inventory_is_exact_and_has_no_puffbuddies_service_id(self):
  self.assertEqual(set(CONTRACTS),{
   "420Wallet","420Identity","420Names","420Messenger","420Notifications","420Pay",
   "420Registry","420AppStore","420Analytics","420Indexer","420Explorer","420Search","420Verify"})
  self.assertFalse(any("puff" in x.lower() for x in dependency_service_ids()))

 def test_canonical_service_ids_match_expected_repository_v1_ids(self):
  self.assertEqual(SERVICE_IDS["420Wallet"],"420/service/wallet/v1")
  self.assertEqual(SERVICE_IDS["420Identity"],"420/service/identity/v1")
  self.assertEqual(SERVICE_IDS["420Names"],"420/service/names/v1")
  self.assertEqual(SERVICE_IDS["420Messenger"],"420/service/messenger/v1")
  self.assertEqual(SERVICE_IDS["420Notifications"],"420/service/notifications/v1")
  self.assertEqual(SERVICE_IDS["420Pay"],"420/service/pay/v1")
  self.assertEqual(SERVICE_IDS["420Registry"],"420/service/protocol-registry/v1")

 def test_registry_admission_rejects_stale_inactive_deprecated_wrong_chain_and_wrong_id(self):
  bad=[
   self.snap(active=False),self.snap(deprecated=True),self.snap(chain_id=421),
   self.snap(service_id="420/service/names/v1"),self.snap(observed_at_epoch=1),
  ]
  for value in bad:
   with self.assertRaises(IntegrationDenied):admit_registry_snapshot(value,expected_chain_id=420,now_epoch=500,max_age_seconds=300)
  self.assertEqual(admit_registry_snapshot(self.snap(observed_at_epoch=250),expected_chain_id=420,now_epoch=500,max_age_seconds=300).dependency,"420Wallet")

 def test_indexer_has_no_registry_service_identity_requirement(self):
  self.assertIsNone(CONTRACTS["420Indexer"].service_id)
  with self.assertRaises(IntegrationDenied):
   admit_registry_snapshot(RegistryServiceSnapshot("420Indexer","420/service/indexer/v1",1,True,False,420,100,"x"),
    expected_chain_id=420,now_epoch=100)

 def test_dependencies_cannot_inherit_puffbuddies_authority(self):
  for dep in CONTRACTS:
   with self.assertRaises(IntegrationDenied):assert_dependency_not_authority(dep,"match")
   with self.assertRaises(IntegrationDenied):assert_dependency_not_authority(dep,"block")

 def test_capabilities_are_allowlisted_per_dependency(self):
  assert_capability("420Wallet","account_control")
  assert_capability("420Identity","minimum_disclosure_eligibility_evidence")
  assert_capability("420Messenger","conversation_state")
  assert_capability("420Pay","payment_settlement")
  with self.assertRaises(IntegrationDenied):assert_capability("420Pay","match")
  with self.assertRaises(IntegrationDenied):assert_capability("420Notifications","eligibility_decision")

 def test_appstore_cannot_rewrite_registry_identity_version_or_active_state(self):
  reg=self.snap("420AppStore")
  good=AppStoreProjection(reg.service_id,1,True,7,False,"catalogue")
  self.assertEqual(validate_appstore_projection(reg,good),good)
  for bad in (
   AppStoreProjection("420/service/search/v1",1,True,7,False,"x"),
   AppStoreProjection(reg.service_id,2,True,7,False,"x"),
   AppStoreProjection(reg.service_id,1,False,7,False,"x"),
  ):
   with self.assertRaises(IntegrationDenied):validate_appstore_projection(reg,bad)

 def test_analytics_accepts_only_privacy_safe_aggregate(self):
  good=AnalyticsAggregate("eligible_active_count",12,100,200,"m1")
  self.assertEqual(admit_analytics_aggregate(good),good)
  with self.assertRaises(IntegrationDenied):admit_analytics_aggregate(AnalyticsAggregate("x",1,100,200,"m1",contains_user_identifier=True))
  with self.assertRaises(IntegrationDenied):admit_analytics_aggregate(AnalyticsAggregate("x",1,100,200,"m1",contains_private_payload=True))

 def test_derived_services_are_noncanonical_fresh_and_right_chain(self):
  good=DerivedProjection("420Indexer",420,100,95,200,False)
  self.assertEqual(admit_derived_projection(good,expected_chain_id=420,now_epoch=250),good)
  for bad in (
   DerivedProjection("420Indexer",420,100,95,200,True),
   DerivedProjection("420Search",421,100,95,200,False),
   DerivedProjection("420Explorer",420,100,95,1,False),
  ):
   with self.assertRaises(IntegrationDenied):admit_derived_projection(bad,expected_chain_id=420,now_epoch=400,max_age_seconds=120)

 def test_verify_evidence_is_bounded_to_deployment_source_correspondence(self):
  self.assertTrue(verification_evidence_may_support("deployment_authenticity"))
  self.assertTrue(verification_evidence_may_support("source_build_correspondence"))
  for value in ("adult_eligibility","personal_identity","reputation","match_consent","safety_status"):
   self.assertFalse(verification_evidence_may_support(value))

 def test_authority_map_conflict_fails_closed(self):
  assert_no_authority_inheritance({"match":"PuffBuddies","block":"PuffBuddies"})
  with self.assertRaises(IntegrationDenied):assert_no_authority_inheritance({"match":"420Messenger"})
  with self.assertRaises(IntegrationDenied):assert_no_authority_inheritance({"eligibility_decision":"420Identity"})

if __name__=="__main__":unittest.main()
