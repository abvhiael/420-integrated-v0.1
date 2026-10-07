"""DOOBTUBE-4 bounded protocol-adapter policy.

This module is executable repository qualification for DoobTube's external
420Integrated bindings. It is intentionally not a live network client.

Canonical authority stays with the owning services. DoobTube has no service ID,
no smart contract, no custody, and no direct Pay/Compute integration in V1.
"""
from dataclasses import dataclass
from enum import Enum
from typing import Mapping


class AdapterDenied(PermissionError):
    pass


class DependencyMode(str, Enum):
    DIRECT_REQUIRED = "DIRECT_REQUIRED"
    DIRECT_OPTIONAL = "DIRECT_OPTIONAL"
    TRANSITIVE_MEDIA = "TRANSITIVE_MEDIA"
    NOT_ADOPTED_V1 = "NOT_ADOPTED_V1"


@dataclass(frozen=True)
class AdapterBinding:
    name: str
    mode: DependencyMode
    service_id: str | None
    consumes: frozenset[str]
    never_authoritative_for: frozenset[str]


SERVICE_IDS = {
    "420Registry": "420/service/protocol-registry/v1",
    "420Wallet": "420/service/wallet/v1",
    "420SmartAccounts": "420/service/smart-accounts/v1",
    "420Media": "420/service/media/v1",
    "420Identity": "420/service/identity/v1",
    "420Rights": "420/service/rights/v1",
    "420Storage": "420/service/resource-protocol/v1",
    "420Search": "420/service/search/v1",
    "420Notifications": "420/service/notifications/v1",
    "420Pay": "420/service/pay/v1",
    "420Compute": "420/service/compute-market/v1",
}

CANONICAL_OWNERS = {
    "service_discovery": "420Registry",
    "wallet_signing": "420Wallet",
    "account_execution": "420SmartAccounts",
    "media_lifecycle": "420Media",
    "stream_controller": "420Media",
    "identity_profile": "420Identity",
    "rights_provenance": "420Rights",
    "storage_readiness": "420Storage",
    "public_discovery": "420Search",
    "notification_subscription": "420Notifications",
    "payment_settlement": "420Pay",
    "compute_processing": "420Compute",
}

PROTECTED_DOMAINS = frozenset(CANONICAL_OWNERS)

_COMMON_NEVER = frozenset({
    "wallet_signing", "account_execution", "media_lifecycle", "stream_controller",
    "identity_profile", "rights_provenance", "storage_readiness",
    "payment_settlement", "compute_processing",
})

BINDINGS = {
    "420Registry": AdapterBinding(
        "420Registry", DependencyMode.DIRECT_REQUIRED, SERVICE_IDS["420Registry"],
        frozenset({"service_identity", "service_version", "active_state", "deprecation_state", "implementation_ref"}),
        _COMMON_NEVER | frozenset({"public_discovery", "notification_subscription"}),
    ),
    "420Wallet": AdapterBinding(
        "420Wallet", DependencyMode.DIRECT_REQUIRED, SERVICE_IDS["420Wallet"],
        frozenset({"account_context", "explicit_signature", "network_context"}),
        _COMMON_NEVER - frozenset({"wallet_signing"}),
    ),
    "420SmartAccounts": AdapterBinding(
        "420SmartAccounts", DependencyMode.DIRECT_REQUIRED, SERVICE_IDS["420SmartAccounts"],
        frozenset({"scoped_execution", "session_capability", "revocation_state"}),
        _COMMON_NEVER - frozenset({"account_execution"}),
    ),
    "420Media": AdapterBinding(
        "420Media", DependencyMode.DIRECT_REQUIRED, SERVICE_IDS["420Media"],
        frozenset({
            "asset_lifecycle", "upload_prepare", "playback_locator", "livestream",
            "moderation", "media_projection", "media_dependency_state",
        }),
        _COMMON_NEVER - frozenset({"media_lifecycle", "stream_controller"}),
    ),
    "420Identity": AdapterBinding(
        "420Identity", DependencyMode.DIRECT_OPTIONAL, SERVICE_IDS["420Identity"],
        frozenset({"profile_state", "controller_binding"}),
        _COMMON_NEVER - frozenset({"identity_profile"}),
    ),
    "420Rights": AdapterBinding(
        "420Rights", DependencyMode.DIRECT_REQUIRED, SERVICE_IDS["420Rights"],
        frozenset({"rights_state", "provenance", "license_state"}),
        _COMMON_NEVER - frozenset({"rights_provenance"}),
    ),
    "420Storage": AdapterBinding(
        "420Storage", DependencyMode.DIRECT_REQUIRED, SERVICE_IDS["420Storage"],
        frozenset({"object_identity", "manifest_state", "retrievability"}),
        _COMMON_NEVER - frozenset({"storage_readiness"}),
    ),
    "420Search": AdapterBinding(
        "420Search", DependencyMode.DIRECT_REQUIRED, SERVICE_IDS["420Search"],
        frozenset({"public_media_projection", "ranking_presentation", "projection_provenance"}),
        _COMMON_NEVER - frozenset({"public_discovery"}),
    ),
    "420Notifications": AdapterBinding(
        "420Notifications", DependencyMode.DIRECT_REQUIRED, SERVICE_IDS["420Notifications"],
        frozenset({"subscription_state", "delivery_preference", "delivery_result"}),
        _COMMON_NEVER - frozenset({"notification_subscription"}),
    ),
    "420Pay": AdapterBinding(
        "420Pay", DependencyMode.TRANSITIVE_MEDIA, SERVICE_IDS["420Pay"],
        frozenset({"payment_settlement", "refund_state"}),
        PROTECTED_DOMAINS - frozenset({"payment_settlement"}),
    ),
    "420Compute": AdapterBinding(
        "420Compute", DependencyMode.TRANSITIVE_MEDIA, SERVICE_IDS["420Compute"],
        frozenset({"job_state", "provider_state", "entitlement", "verification", "settlement"}),
        PROTECTED_DOMAINS - frozenset({"compute_processing"}),
    ),
}


@dataclass(frozen=True)
class RegistrySnapshot:
    dependency: str
    service_id: str
    version: int
    active: bool
    deprecated: bool
    chain_id: int
    observed_at_epoch: int
    implementation_ref: str

    def __post_init__(self):
        if self.dependency not in BINDINGS:
            raise AdapterDenied("unknown dependency")
        if not self.service_id or len(self.service_id) > 160:
            raise AdapterDenied("bounded service id required")
        if self.version < 1 or self.chain_id <= 0 or self.observed_at_epoch < 0:
            raise AdapterDenied("invalid Registry snapshot")
        if not self.implementation_ref or len(self.implementation_ref) > 192:
            raise AdapterDenied("bounded implementation reference required")


@dataclass(frozen=True)
class MediaCompatibility:
    service_id: str
    api_version: str
    compatibility_major: int
    chain_id: int
    network: str
    capabilities: frozenset[str]

    def __post_init__(self):
        if not self.service_id or not self.api_version or self.compatibility_major < 1:
            raise AdapterDenied("invalid Media compatibility")
        if self.chain_id <= 0 or not self.network or len(self.network) > 64:
            raise AdapterDenied("bounded Media chain/network required")


@dataclass(frozen=True)
class StorageReadiness:
    object_id: str
    manifest_id: str
    shard_index: int
    shard_root: str
    size_bytes: int
    commitment_id: str
    sealed: bool
    retrievable: bool
    live: bool

    def __post_init__(self):
        if not all((self.object_id, self.manifest_id, self.shard_root, self.commitment_id)):
            raise AdapterDenied("complete Storage object identity required")
        if self.shard_index < 0 or self.size_bytes <= 0:
            raise AdapterDenied("invalid Storage object bounds")


@dataclass(frozen=True)
class PublicProjection:
    media_asset_id: str
    media_state: str
    visibility: str
    rights_authorized: bool
    chain_id: int
    indexed_height: int
    finalized_height: int
    canonical_authority_claimed: bool = False

    def __post_init__(self):
        if not self.media_asset_id or self.chain_id <= 0:
            raise AdapterDenied("invalid projection identity")
        if self.indexed_height < 0 or self.finalized_height < 0 or self.finalized_height > self.indexed_height:
            raise AdapterDenied("invalid projection finality")


@dataclass(frozen=True)
class NotificationSubscription:
    user_ref: str
    creator_ref: str
    confirmed: bool
    promotional: bool = False
    paid_entitlement: bool = False
    can_sign: bool = False
    can_spend: bool = False

    def __post_init__(self):
        if not self.user_ref or not self.creator_ref:
            raise AdapterDenied("subscription requires bounded user and creator references")


def binding_for(dependency: str) -> AdapterBinding:
    try:
        return BINDINGS[dependency]
    except KeyError as exc:
        raise AdapterDenied("unknown dependency") from exc


def admit_registry_snapshot(
    snapshot: RegistrySnapshot,
    *,
    expected_chain_id: int,
    now_epoch: int,
    max_age_seconds: int = 300,
) -> RegistrySnapshot:
    binding = binding_for(snapshot.dependency)
    if binding.service_id is None or snapshot.service_id != binding.service_id:
        raise AdapterDenied("Registry service identity mismatch")
    if not snapshot.active or snapshot.deprecated:
        raise AdapterDenied("inactive/deprecated service")
    if snapshot.chain_id != expected_chain_id:
        raise AdapterDenied("wrong-chain service snapshot")
    if now_epoch < snapshot.observed_at_epoch:
        raise AdapterDenied("future Registry observation")
    if now_epoch - snapshot.observed_at_epoch > max_age_seconds:
        raise AdapterDenied("stale Registry observation")
    return snapshot


def admit_media_compatibility(
    value: MediaCompatibility,
    *,
    expected_chain_id: int,
    expected_network: str,
) -> MediaCompatibility:
    if value.service_id != SERVICE_IDS["420Media"]:
        raise AdapterDenied("wrong Media service identity")
    if value.api_version != "v1" or value.compatibility_major != 1:
        raise AdapterDenied("unsupported Media API compatibility")
    if value.chain_id != expected_chain_id or value.network != expected_network:
        raise AdapterDenied("Media chain/network mismatch")
    required = {"media.uploads", "media.livestreaming"}
    if not required.issubset(value.capabilities):
        raise AdapterDenied("required Media capability unavailable")
    return value


def admit_storage_ready(value: StorageReadiness) -> StorageReadiness:
    if not value.sealed or not value.retrievable or not value.live:
        raise AdapterDenied("Storage object is not canonically READY")
    return value


def admit_public_projection(
    value: PublicProjection,
    *,
    expected_chain_id: int,
) -> PublicProjection:
    if value.canonical_authority_claimed:
        raise AdapterDenied("Search projection cannot claim canonical authority")
    if value.chain_id != expected_chain_id:
        raise AdapterDenied("wrong-chain public projection")
    if value.media_state != "READY" or value.visibility != "PUBLIC" or not value.rights_authorized:
        raise AdapterDenied("public projection is not eligible")
    return value


def admit_notification_subscription(value: NotificationSubscription) -> NotificationSubscription:
    if value.paid_entitlement:
        raise AdapterDenied("creator subscription cannot become paid entitlement")
    if value.can_sign or value.can_spend:
        raise AdapterDenied("Notifications cannot inherit Wallet authority")
    if value.promotional:
        raise AdapterDenied("promotional consent requires separate explicit flow")
    if not value.confirmed:
        raise AdapterDenied("unconfirmed local subscription is not durable state")
    return value


def assert_direct_call_allowed(dependency: str) -> None:
    binding = binding_for(dependency)
    if binding.mode == DependencyMode.TRANSITIVE_MEDIA:
        raise AdapterDenied("dependency is transitive through 420Media")
    if binding.mode == DependencyMode.NOT_ADOPTED_V1:
        raise AdapterDenied("dependency is not adopted for V1")


def assert_capability(dependency: str, capability: str) -> None:
    binding = binding_for(dependency)
    if capability not in binding.consumes:
        raise AdapterDenied("dependency capability not approved")


def assert_no_shadow_authority(authority_by_domain: Mapping[str, str]) -> None:
    for domain, canonical_owner in CANONICAL_OWNERS.items():
        observed = authority_by_domain.get(domain)
        if observed is not None and observed != canonical_owner:
            raise AdapterDenied(f"{domain} authority transferred to {observed}")


def dependency_service_ids() -> frozenset[str]:
    return frozenset(binding.service_id for binding in BINDINGS.values() if binding.service_id)


def doobtube_contracts_required() -> bool:
    return False


def doobtube_service_id() -> None:
    return None
