"""DOOBTUBE-8 retained ecosystem integration milestone.

This module composes the already-qualified DOOBTUBE-2..7 boundaries into one
app-focused Level-2 admission decision. It does not perform network I/O and it
does not create new authority.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping

from doobtube.integrations.ecosystem import (
    AdapterDenied,
    MediaCompatibility,
    NotificationSubscription,
    PublicProjection,
    RegistrySnapshot,
    StorageReadiness,
    SERVICE_IDS,
    admit_media_compatibility,
    admit_notification_subscription,
    admit_public_projection,
    admit_registry_snapshot,
    admit_storage_ready,
    assert_direct_call_allowed,
    assert_no_shadow_authority,
    CANONICAL_OWNERS,
)


class IntegrationDenied(PermissionError):
    pass


DIRECT_REQUIRED = (
    "420Registry",
    "420Wallet",
    "420SmartAccounts",
    "420Media",
    "420Rights",
    "420Storage",
    "420Search",
    "420Notifications",
)

DIRECT_OPTIONAL = ("420Identity",)
TRANSITIVE_ONLY = ("420Pay", "420Compute")
NOT_ADOPTED_V1 = (
    "420Arbitration",
    "420Analytics",
    "420Verify",
    "420Explorer",
)


@dataclass(frozen=True)
class IdentitySnapshot:
    available: bool
    wallet_ref: str
    profile_ref: str = ""
    controller_ref: str = ""


@dataclass(frozen=True)
class RightsSnapshot:
    media_asset_id: str
    provenance_ref: str
    publication_authorized: bool
    revoked: bool = False


@dataclass(frozen=True)
class SearchSnapshot:
    media_asset_id: str
    source_service_id: str
    canonical_authority_claimed: bool
    indexed_height: int
    finalized_height: int


@dataclass(frozen=True)
class EcosystemInput:
    expected_chain_id: int
    expected_network: str
    now_epoch: int
    wallet_ref: str
    registry: Mapping[str, RegistrySnapshot]
    media: MediaCompatibility
    identity: IdentitySnapshot
    rights: RightsSnapshot
    storage: StorageReadiness
    search: SearchSnapshot
    projection: PublicProjection
    notification: NotificationSubscription
    authority_by_domain: Mapping[str, str]


class EcosystemMilestone:
    """One retained admission decision for the accumulated DoobTube V1 stack."""

    def qualify(self, value: EcosystemInput) -> dict[str, object]:
        try:
            self._registry(value)
            self._wallet_identity(value)
            self._media(value)
            self._rights_storage_search(value)
            self._notifications(value)
            self._transitive_and_unadopted()
            assert_no_shadow_authority(value.authority_by_domain)
        except AdapterDenied as exc:
            raise IntegrationDenied(str(exc)) from exc

        return {
            "qualified": True,
            "chain_id": value.expected_chain_id,
            "network": value.expected_network,
            "wallet_ref": value.wallet_ref,
            "identity_mode": "optional_profile" if value.identity.available else "wallet_only_pseudonymous",
            "public_media_asset_id": value.projection.media_asset_id,
            "provenance_ref": value.rights.provenance_ref,
            "notification_subscription": value.notification.confirmed,
            "pay_compute_mode": "TRANSITIVE_MEDIA",
            "arbitration_mode": "NOT_ADOPTED_V1",
            "visibility_only": ("420Analytics", "420Verify", "420Explorer"),
        }

    def _registry(self, value: EcosystemInput) -> None:
        required = DIRECT_REQUIRED + DIRECT_OPTIONAL + TRANSITIVE_ONLY
        for name in required:
            snap = value.registry.get(name)
            if snap is None:
                if name in DIRECT_OPTIONAL:
                    continue
                raise IntegrationDenied(f"missing Registry snapshot for {name}")
            admit_registry_snapshot(
                snap,
                expected_chain_id=value.expected_chain_id,
                now_epoch=value.now_epoch,
                max_age_seconds=300,
            )

    def _wallet_identity(self, value: EcosystemInput) -> None:
        wallet = value.wallet_ref.strip()
        if not wallet:
            raise IntegrationDenied("wallet authority required for integrated mutation flow")
        if value.identity.available:
            if value.identity.wallet_ref.lower() != wallet.lower():
                raise IntegrationDenied("Identity wallet/controller mismatch")
            if not value.identity.profile_ref.strip() or not value.identity.controller_ref.strip():
                raise IntegrationDenied("available Identity profile is incomplete")
        else:
            if value.identity.profile_ref or value.identity.controller_ref:
                raise IntegrationDenied("unavailable Identity cannot supply profile authority")

    def _media(self, value: EcosystemInput) -> None:
        admit_media_compatibility(
            value.media,
            expected_chain_id=value.expected_chain_id,
            expected_network=value.expected_network,
        )

    def _rights_storage_search(self, value: EcosystemInput) -> None:
        if value.rights.revoked or not value.rights.publication_authorized:
            raise IntegrationDenied("Rights publication is not authorized")
        if value.rights.media_asset_id != value.projection.media_asset_id:
            raise IntegrationDenied("Rights/Media asset identity mismatch")
        if not value.rights.provenance_ref.strip():
            raise IntegrationDenied("Rights provenance reference required")

        admit_storage_ready(value.storage)
        admit_public_projection(value.projection, expected_chain_id=value.expected_chain_id)

        if value.search.source_service_id != SERVICE_IDS["420Search"]:
            raise IntegrationDenied("Search service identity mismatch")
        if value.search.canonical_authority_claimed:
            raise IntegrationDenied("Search cannot claim canonical authority")
        if value.search.media_asset_id != value.projection.media_asset_id:
            raise IntegrationDenied("Search/Media asset identity mismatch")
        if value.search.finalized_height > value.search.indexed_height:
            raise IntegrationDenied("Search finality exceeds indexed height")

    def _notifications(self, value: EcosystemInput) -> None:
        admit_notification_subscription(value.notification)
        if value.notification.user_ref.lower() != value.wallet_ref.lower():
            raise IntegrationDenied("Notifications actor substitution")

    def _transitive_and_unadopted(self) -> None:
        for dependency in TRANSITIVE_ONLY:
            try:
                assert_direct_call_allowed(dependency)
            except AdapterDenied:
                pass
            else:
                raise IntegrationDenied(f"{dependency} unexpectedly became direct")

        # These are deliberately absent from the V1 authority graph. Their
        # visibility/diagnostic surfaces are not dependencies for correctness.
        for name in NOT_ADOPTED_V1:
            if name in CANONICAL_OWNERS.values():
                raise IntegrationDenied(f"{name} unexpectedly became canonical authority")
