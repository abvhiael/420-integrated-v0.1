import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from doobtube.integrations.ecosystem import (
    AdapterDenied,
    BINDINGS,
    CANONICAL_OWNERS,
    DependencyMode,
    MediaCompatibility,
    NotificationSubscription,
    PublicProjection,
    RegistrySnapshot,
    SERVICE_IDS,
    StorageReadiness,
    admit_media_compatibility,
    admit_notification_subscription,
    admit_public_projection,
    admit_registry_snapshot,
    admit_storage_ready,
    assert_capability,
    assert_direct_call_allowed,
    assert_no_shadow_authority,
    dependency_service_ids,
    doobtube_contracts_required,
    doobtube_service_id,
)


class DoobTubeAdapterTests(unittest.TestCase):
    def snap(self, dependency="420Media", **kw):
        values = dict(
            dependency=dependency,
            service_id=SERVICE_IDS[dependency],
            version=1,
            active=True,
            deprecated=False,
            chain_id=420,
            observed_at_epoch=100,
            implementation_ref="registry:qualified:v1",
        )
        values.update(kw)
        return RegistrySnapshot(**values)

    def test_no_doobtube_contract_or_service_identity(self):
        self.assertFalse(doobtube_contracts_required())
        self.assertIsNone(doobtube_service_id())
        self.assertFalse(any("doobtube" in x.lower() or "420video" in x.lower() for x in dependency_service_ids()))

    def test_dependency_modes_are_exact(self):
        self.assertEqual(BINDINGS["420Media"].mode, DependencyMode.DIRECT_REQUIRED)
        self.assertEqual(BINDINGS["420Identity"].mode, DependencyMode.DIRECT_OPTIONAL)
        self.assertEqual(BINDINGS["420Pay"].mode, DependencyMode.TRANSITIVE_MEDIA)
        self.assertEqual(BINDINGS["420Compute"].mode, DependencyMode.TRANSITIVE_MEDIA)

    def test_registry_snapshot_rejects_wrong_id_chain_stale_inactive_and_deprecated(self):
        bad = [
            self.snap(service_id=SERVICE_IDS["420Rights"]),
            self.snap(chain_id=421),
            self.snap(observed_at_epoch=1),
            self.snap(active=False),
            self.snap(deprecated=True),
        ]
        for value in bad:
            with self.assertRaises(AdapterDenied):
                admit_registry_snapshot(value, expected_chain_id=420, now_epoch=500, max_age_seconds=300)
        good = self.snap(observed_at_epoch=250)
        self.assertEqual(
            admit_registry_snapshot(good, expected_chain_id=420, now_epoch=500, max_age_seconds=300),
            good,
        )

    def test_media_compatibility_is_fail_closed(self):
        good = MediaCompatibility(
            SERVICE_IDS["420Media"], "v1", 1, 420, "testnet",
            frozenset({"media.uploads", "media.livestreaming"}),
        )
        self.assertEqual(
            admit_media_compatibility(good, expected_chain_id=420, expected_network="testnet"), good
        )
        bad = [
            MediaCompatibility(SERVICE_IDS["420Rights"], "v1", 1, 420, "testnet", good.capabilities),
            MediaCompatibility(SERVICE_IDS["420Media"], "v2", 2, 420, "testnet", good.capabilities),
            MediaCompatibility(SERVICE_IDS["420Media"], "v1", 1, 421, "testnet", good.capabilities),
            MediaCompatibility(SERVICE_IDS["420Media"], "v1", 1, 420, "testnet", frozenset({"media.uploads"})),
        ]
        for value in bad:
            with self.assertRaises(AdapterDenied):
                admit_media_compatibility(value, expected_chain_id=420, expected_network="testnet")

    def test_storage_ready_requires_complete_live_canonical_state(self):
        good = StorageReadiness("o","m",0,"root",100,"c",True,True,True)
        self.assertEqual(admit_storage_ready(good), good)
        for value in [
            StorageReadiness("o","m",0,"root",100,"c",False,True,True),
            StorageReadiness("o","m",0,"root",100,"c",True,False,True),
            StorageReadiness("o","m",0,"root",100,"c",True,True,False),
        ]:
            with self.assertRaises(AdapterDenied):
                admit_storage_ready(value)
        with self.assertRaises(AdapterDenied):
            StorageReadiness("","m",0,"root",100,"c",True,True,True)

    def test_search_projection_cannot_widen_visibility_or_authority(self):
        good = PublicProjection("asset-1","READY","PUBLIC",True,420,100,95,False)
        self.assertEqual(admit_public_projection(good, expected_chain_id=420), good)
        bad = [
            PublicProjection("asset-1","UPLOADED","PUBLIC",True,420,100,95,False),
            PublicProjection("asset-1","READY","UNLISTED",True,420,100,95,False),
            PublicProjection("asset-1","READY","PUBLIC",False,420,100,95,False),
            PublicProjection("asset-1","READY","PUBLIC",True,421,100,95,False),
            PublicProjection("asset-1","READY","PUBLIC",True,420,100,95,True),
        ]
        for value in bad:
            with self.assertRaises(AdapterDenied):
                admit_public_projection(value, expected_chain_id=420)

    def test_notifications_cannot_become_entitlement_or_wallet_authority(self):
        good = NotificationSubscription("user","creator",True)
        self.assertEqual(admit_notification_subscription(good), good)
        for value in [
            NotificationSubscription("user","creator",True,paid_entitlement=True),
            NotificationSubscription("user","creator",True,can_sign=True),
            NotificationSubscription("user","creator",True,can_spend=True),
            NotificationSubscription("user","creator",True,promotional=True),
            NotificationSubscription("user","creator",False),
        ]:
            with self.assertRaises(AdapterDenied):
                admit_notification_subscription(value)

    def test_pay_and_compute_are_transitive_only(self):
        for dependency in ("420Pay", "420Compute"):
            with self.assertRaises(AdapterDenied):
                assert_direct_call_allowed(dependency)
        assert_direct_call_allowed("420Media")
        assert_direct_call_allowed("420Rights")

    def test_capabilities_are_allowlisted(self):
        assert_capability("420Media", "upload_prepare")
        assert_capability("420Rights", "provenance")
        assert_capability("420Search", "public_media_projection")
        with self.assertRaises(AdapterDenied):
            assert_capability("420Search", "media_lifecycle")
        with self.assertRaises(AdapterDenied):
            assert_capability("420Notifications", "wallet_signing")

    def test_shadow_authority_fails_closed(self):
        assert_no_shadow_authority(dict(CANONICAL_OWNERS))
        for domain, owner in CANONICAL_OWNERS.items():
            bad = dict(CANONICAL_OWNERS)
            bad[domain] = "DoobTube"
            with self.assertRaises(AdapterDenied):
                assert_no_shadow_authority(bad)

    def test_service_ids_are_repository_v1_preimages(self):
        self.assertEqual(SERVICE_IDS["420Registry"], "420/service/protocol-registry/v1")
        self.assertEqual(SERVICE_IDS["420Wallet"], "420/service/wallet/v1")
        self.assertEqual(SERVICE_IDS["420SmartAccounts"], "420/service/smart-accounts/v1")
        self.assertEqual(SERVICE_IDS["420Media"], "420/service/media/v1")
        self.assertEqual(SERVICE_IDS["420Identity"], "420/service/identity/v1")
        self.assertEqual(SERVICE_IDS["420Rights"], "420/service/rights/v1")
        self.assertEqual(SERVICE_IDS["420Storage"], "420/service/resource-protocol/v1")
        self.assertEqual(SERVICE_IDS["420Search"], "420/service/search/v1")
        self.assertEqual(SERVICE_IDS["420Notifications"], "420/service/notifications/v1")
        self.assertEqual(SERVICE_IDS["420Pay"], "420/service/pay/v1")
        self.assertEqual(SERVICE_IDS["420Compute"], "420/service/compute-market/v1")


if __name__ == "__main__":
    unittest.main()
