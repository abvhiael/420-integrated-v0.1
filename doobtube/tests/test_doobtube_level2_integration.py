import unittest

from doobtube.integration import (
    EcosystemMilestone, EcosystemInput, IdentitySnapshot, RightsSnapshot,
    SearchSnapshot, IntegrationDenied,
)
from doobtube.integrations.ecosystem import (
    CANONICAL_OWNERS, MediaCompatibility, NotificationSubscription,
    PublicProjection, RegistrySnapshot, SERVICE_IDS, StorageReadiness,
)


class DoobTubeLevel2IntegrationTests(unittest.TestCase):
    def setUp(self):
        self.now=1000
        self.wallet="0x1111111111111111111111111111111111111111"
        names=("420Registry","420Wallet","420SmartAccounts","420Media","420Identity",
               "420Rights","420Storage","420Search","420Notifications","420Pay","420Compute")
        self.registry={
            n: RegistrySnapshot(n,SERVICE_IDS[n],1,True,False,420,self.now-10,f"registry:{n}:v1")
            for n in names
        }
        self.media=MediaCompatibility(
            SERVICE_IDS["420Media"],"v1",1,420,"testnet",
            frozenset({"media.uploads","media.livestreaming"}),
        )
        self.identity=IdentitySnapshot(True,self.wallet,"identity:profile:1",self.wallet)
        self.rights=RightsSnapshot("asset-1","rights:prov:1",True,False)
        self.storage=StorageReadiness("obj","manifest",0,"root",1024,"commit",True,True,True)
        self.search=SearchSnapshot("asset-1",SERVICE_IDS["420Search"],False,100,95)
        self.projection=PublicProjection("asset-1","READY","PUBLIC",True,420,100,95,False)
        self.notification=NotificationSubscription(self.wallet,"creator-1",True,False,False,False,False)
        self.authority=dict(CANONICAL_OWNERS)
        self.svc=EcosystemMilestone()

    def value(self,**kw):
        values=dict(expected_chain_id=420,expected_network="testnet",now_epoch=self.now,
                    wallet_ref=self.wallet,registry=self.registry,media=self.media,identity=self.identity,
                    rights=self.rights,storage=self.storage,search=self.search,projection=self.projection,
                    notification=self.notification,authority_by_domain=self.authority)
        values.update(kw);return EcosystemInput(**values)

    def test_full_adopted_stack_qualifies_together(self):
        out=self.svc.qualify(self.value())
        self.assertTrue(out["qualified"])
        self.assertEqual(out["identity_mode"],"optional_profile")
        self.assertEqual(out["pay_compute_mode"],"TRANSITIVE_MEDIA")
        self.assertEqual(out["arbitration_mode"],"NOT_ADOPTED_V1")

    def test_optional_identity_can_degrade_to_wallet_only(self):
        out=self.svc.qualify(self.value(identity=IdentitySnapshot(False,self.wallet)))
        self.assertEqual(out["identity_mode"],"wallet_only_pseudonymous")

    def test_registry_stale_wrong_chain_inactive_and_service_substitution_fail_closed(self):
        mutations=[
            RegistrySnapshot("420Media",SERVICE_IDS["420Media"],1,True,False,420,self.now-301,"x"),
            RegistrySnapshot("420Media",SERVICE_IDS["420Media"],1,True,False,421,self.now-1,"x"),
            RegistrySnapshot("420Media",SERVICE_IDS["420Media"],1,False,False,420,self.now-1,"x"),
            RegistrySnapshot("420Media",SERVICE_IDS["420Rights"],1,True,False,420,self.now-1,"x"),
        ]
        for bad in mutations:
            reg=dict(self.registry);reg["420Media"]=bad
            with self.assertRaises(IntegrationDenied): self.svc.qualify(self.value(registry=reg))

    def test_wallet_identity_actor_substitution_fails_closed(self):
        with self.assertRaises(IntegrationDenied):
            self.svc.qualify(self.value(identity=IdentitySnapshot(True,"0x2222222222222222222222222222222222222222","p","c")))
        with self.assertRaises(IntegrationDenied):
            self.svc.qualify(self.value(wallet_ref=""))

    def test_media_compatibility_mismatch_fails_closed(self):
        bad=MediaCompatibility(SERVICE_IDS["420Media"],"v2",2,420,"testnet",self.media.capabilities)
        with self.assertRaises(IntegrationDenied): self.svc.qualify(self.value(media=bad))

    def test_rights_revocation_or_provenance_identity_mismatch_blocks_public_flow(self):
        for bad in [
            RightsSnapshot("asset-1","rights:prov:1",False,False),
            RightsSnapshot("asset-1","rights:prov:1",True,True),
            RightsSnapshot("asset-2","rights:prov:1",True,False),
            RightsSnapshot("asset-1","",True,False),
        ]:
            with self.assertRaises(IntegrationDenied): self.svc.qualify(self.value(rights=bad))

    def test_storage_unready_blocks_integrated_public_flow(self):
        for bad in [
            StorageReadiness("obj","manifest",0,"root",1024,"commit",False,True,True),
            StorageReadiness("obj","manifest",0,"root",1024,"commit",True,False,True),
            StorageReadiness("obj","manifest",0,"root",1024,"commit",True,True,False),
        ]:
            with self.assertRaises(IntegrationDenied): self.svc.qualify(self.value(storage=bad))

    def test_search_cannot_widen_visibility_claim_authority_or_substitute_service(self):
        cases=[
            self.value(projection=PublicProjection("asset-1","READY","UNLISTED",True,420,100,95,False)),
            self.value(search=SearchSnapshot("asset-1",SERVICE_IDS["420Search"],True,100,95)),
            self.value(search=SearchSnapshot("asset-1",SERVICE_IDS["420Media"],False,100,95)),
            self.value(search=SearchSnapshot("asset-2",SERVICE_IDS["420Search"],False,100,95)),
        ]
        for value in cases:
            with self.assertRaises(IntegrationDenied): self.svc.qualify(value)

    def test_notifications_cannot_become_entitlement_marketing_or_wallet_authority(self):
        bad=[
            NotificationSubscription(self.wallet,"creator",True,False,True,False,False),
            NotificationSubscription(self.wallet,"creator",True,True,False,False,False),
            NotificationSubscription(self.wallet,"creator",True,False,False,True,False),
            NotificationSubscription("0x2222222222222222222222222222222222222222","creator",True,False,False,False,False),
        ]
        for item in bad:
            with self.assertRaises(IntegrationDenied): self.svc.qualify(self.value(notification=item))

    def test_pay_compute_remain_media_transitive_and_unadopted_services_remain_non_authoritative(self):
        out=self.svc.qualify(self.value())
        self.assertEqual(out["pay_compute_mode"],"TRANSITIVE_MEDIA")
        self.assertEqual(out["arbitration_mode"],"NOT_ADOPTED_V1")
        self.assertEqual(tuple(out["visibility_only"]),("420Analytics","420Verify","420Explorer"))

    def test_shadow_authority_transfer_fails_closed(self):
        for domain in CANONICAL_OWNERS:
            bad=dict(self.authority);bad[domain]="DoobTube"
            with self.assertRaises(IntegrationDenied): self.svc.qualify(self.value(authority_by_domain=bad))


if __name__=="__main__": unittest.main()
