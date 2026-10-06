"""PB-13 bounded 420Integrated cross-app integration policy.

The module deliberately models dependency admission and authority boundaries rather
than live network clients. Registry/service identity remains canonical to 420Registry;
derived infrastructure remains non-canonical; PuffBuddies remains final authority for
its protected application decisions.
"""
from dataclasses import dataclass
from enum import Enum
from typing import Mapping


class IntegrationDenied(PermissionError):
    pass


class DependencyClass(str, Enum):
    CANONICAL_CAPABILITY = "CANONICAL_CAPABILITY"
    REGISTRY_DISCOVERY = "REGISTRY_DISCOVERY"
    PRESENTATION = "PRESENTATION"
    DERIVED = "DERIVED"
    EVIDENCE = "EVIDENCE"


@dataclass(frozen=True)
class IntegrationContract:
    name: str
    dependency_class: DependencyClass
    service_id: str | None
    consumes: frozenset[str]
    never_authoritative_for: frozenset[str]


PROTECTED_PUFFBUDDIES_DECISIONS = frozenset({
    "membership", "eligibility_decision", "profile", "preferences", "precise_location",
    "like", "match", "unmatch", "block", "messaging_authorization", "safety",
    "moderation", "lifecycle", "deletion", "visibility", "premium_private_access",
})

SERVICE_IDS = {
    "420Wallet": "420/service/wallet/v1",
    "420Identity": "420/service/identity/v1",
    "420Names": "420/service/names/v1",
    "420Messenger": "420/service/messenger/v1",
    "420Notifications": "420/service/notifications/v1",
    "420Pay": "420/service/pay/v1",
    "420Registry": "420/service/protocol-registry/v1",
    "420AppStore": "420/service/appstore/v1",
    "420Analytics": "420/service/analytics/v1",
    "420Explorer": "420/service/explorer/v1",
    "420Search": "420/service/search/v1",
    "420Verify": "420/service/verify/v1",
}

_ALL_PROTECTED = PROTECTED_PUFFBUDDIES_DECISIONS

CONTRACTS = {
    "420Wallet": IntegrationContract(
        "420Wallet", DependencyClass.CANONICAL_CAPABILITY, SERVICE_IDS["420Wallet"],
        frozenset({"account_control", "explicit_signature", "bounded_session_capability"}),
        _ALL_PROTECTED,
    ),
    "420Identity": IntegrationContract(
        "420Identity", DependencyClass.CANONICAL_CAPABILITY, SERVICE_IDS["420Identity"],
        frozenset({"credential_lifecycle", "minimum_disclosure_eligibility_evidence"}),
        _ALL_PROTECTED - frozenset({"eligibility_decision"}),
    ),
    "420Names": IntegrationContract(
        "420Names", DependencyClass.CANONICAL_CAPABILITY, SERVICE_IDS["420Names"],
        frozenset({"current_name_resolution", "name_expiry", "name_binding"}),
        _ALL_PROTECTED,
    ),
    "420Messenger": IntegrationContract(
        "420Messenger", DependencyClass.CANONICAL_CAPABILITY, SERVICE_IDS["420Messenger"],
        frozenset({"conversation_state", "messenger_native_block", "endpoint_state", "delivery_receipt"}),
        _ALL_PROTECTED - frozenset({"messaging_authorization"}),
    ),
    "420Notifications": IntegrationContract(
        "420Notifications", DependencyClass.CANONICAL_CAPABILITY, SERVICE_IDS["420Notifications"],
        frozenset({"subscription_state", "delivery_preference", "delivery_result"}),
        _ALL_PROTECTED,
    ),
    "420Pay": IntegrationContract(
        "420Pay", DependencyClass.CANONICAL_CAPABILITY, SERVICE_IDS["420Pay"],
        frozenset({"payment_settlement", "refund_state"}),
        _ALL_PROTECTED,
    ),
    "420Registry": IntegrationContract(
        "420Registry", DependencyClass.REGISTRY_DISCOVERY, SERVICE_IDS["420Registry"],
        frozenset({"service_identity", "service_version", "active_state", "deprecation_state", "implementation_reference"}),
        _ALL_PROTECTED,
    ),
    "420AppStore": IntegrationContract(
        "420AppStore", DependencyClass.PRESENTATION, SERVICE_IDS["420AppStore"],
        frozenset({"catalogue_metadata", "listing_state", "presentation_rank"}),
        _ALL_PROTECTED | frozenset({"service_identity"}),
    ),
    "420Analytics": IntegrationContract(
        "420Analytics", DependencyClass.DERIVED, SERVICE_IDS["420Analytics"],
        frozenset({"aggregate_metric"}),
        _ALL_PROTECTED | frozenset({"canonical_protocol_state"}),
    ),
    "420Indexer": IntegrationContract(
        "420Indexer", DependencyClass.DERIVED, None,
        frozenset({"public_protocol_projection", "finality_context", "source_provenance"}),
        _ALL_PROTECTED | frozenset({"canonical_protocol_state"}),
    ),
    "420Explorer": IntegrationContract(
        "420Explorer", DependencyClass.PRESENTATION, SERVICE_IDS["420Explorer"],
        frozenset({"public_protocol_presentation"}),
        _ALL_PROTECTED | frozenset({"canonical_protocol_state"}),
    ),
    "420Search": IntegrationContract(
        "420Search", DependencyClass.PRESENTATION, SERVICE_IDS["420Search"],
        frozenset({"public_protocol_search"}),
        _ALL_PROTECTED | frozenset({"canonical_protocol_state"}),
    ),
    "420Verify": IntegrationContract(
        "420Verify", DependencyClass.EVIDENCE, SERVICE_IDS["420Verify"],
        frozenset({"deployment_authenticity_evidence", "source_build_correspondence"}),
        _ALL_PROTECTED | frozenset({"audit", "safety_endorsement", "official_status"}),
    ),
}


@dataclass(frozen=True)
class RegistryServiceSnapshot:
    dependency: str
    service_id: str
    version: int
    active: bool
    deprecated: bool
    chain_id: int
    observed_at_epoch: int
    implementation_ref: str

    def __post_init__(self):
        if self.dependency not in CONTRACTS:
            raise IntegrationDenied("unknown dependency")
        if not self.service_id or len(self.service_id) > 160:
            raise IntegrationDenied("bounded service id required")
        if self.version < 1 or self.chain_id <= 0 or self.observed_at_epoch < 0:
            raise IntegrationDenied("invalid registry service snapshot")
        if not self.implementation_ref or len(self.implementation_ref) > 192:
            raise IntegrationDenied("bounded implementation reference required")


@dataclass(frozen=True)
class AppStoreProjection:
    service_id: str
    service_version: int
    registry_active: bool
    catalogue_rank: int | None
    sponsored: bool
    description: str

    def __post_init__(self):
        if not self.service_id or self.service_version < 1:
            raise IntegrationDenied("bounded AppStore projection required")
        if len(self.description) > 500:
            raise IntegrationDenied("bounded catalogue description required")
        if self.catalogue_rank is not None and self.catalogue_rank < 1:
            raise IntegrationDenied("positive catalogue rank required")


@dataclass(frozen=True)
class AnalyticsAggregate:
    metric: str
    value: int
    window_start_epoch: int
    window_end_epoch: int
    methodology_version: str
    contains_user_identifier: bool = False
    contains_private_payload: bool = False

    def __post_init__(self):
        if not self.metric or len(self.metric) > 96:
            raise IntegrationDenied("bounded aggregate metric required")
        if self.value < 0 or self.window_start_epoch < 0 or self.window_end_epoch <= self.window_start_epoch:
            raise IntegrationDenied("valid aggregate observation window required")
        if not self.methodology_version or len(self.methodology_version) > 96:
            raise IntegrationDenied("methodology version required")


@dataclass(frozen=True)
class DerivedProjection:
    source: str
    chain_id: int
    indexed_height: int
    finalized_height: int
    observed_at_epoch: int
    canonical_authority_claimed: bool = False

    def __post_init__(self):
        if self.source not in {"420Indexer", "420Explorer", "420Search"}:
            raise IntegrationDenied("unsupported derived source")
        if self.chain_id <= 0 or self.indexed_height < 0 or self.finalized_height < 0:
            raise IntegrationDenied("invalid derived projection")
        if self.finalized_height > self.indexed_height:
            raise IntegrationDenied("finalized height cannot exceed indexed height")
        if self.observed_at_epoch < 0:
            raise IntegrationDenied("invalid derived observation time")


def contract_for(dependency: str) -> IntegrationContract:
    try:
        return CONTRACTS[dependency]
    except KeyError as exc:
        raise IntegrationDenied("unknown dependency") from exc


def assert_capability(dependency: str, capability: str) -> None:
    contract = contract_for(dependency)
    if capability not in contract.consumes:
        raise IntegrationDenied("dependency capability not approved")


def assert_dependency_not_authority(dependency: str, decision: str) -> None:
    contract = contract_for(dependency)
    if decision in contract.never_authoritative_for:
        raise IntegrationDenied("dependency cannot own requested PuffBuddies decision")


def admit_registry_snapshot(
    snapshot: RegistryServiceSnapshot,
    *,
    expected_chain_id: int,
    now_epoch: int,
    max_age_seconds: int = 300,
) -> RegistryServiceSnapshot:
    contract = contract_for(snapshot.dependency)
    if contract.service_id is None:
        raise IntegrationDenied("dependency has no Registry service identity requirement")
    if snapshot.service_id != contract.service_id:
        raise IntegrationDenied("Registry service identity mismatch")
    if not snapshot.active or snapshot.deprecated:
        raise IntegrationDenied("inactive/deprecated service")
    if snapshot.chain_id != expected_chain_id:
        raise IntegrationDenied("wrong-chain service snapshot")
    if now_epoch < snapshot.observed_at_epoch:
        raise IntegrationDenied("future Registry observation")
    if now_epoch - snapshot.observed_at_epoch > max_age_seconds:
        raise IntegrationDenied("stale Registry service snapshot")
    return snapshot


def validate_appstore_projection(registry: RegistryServiceSnapshot, listing: AppStoreProjection) -> AppStoreProjection:
    if registry.service_id != listing.service_id or registry.version != listing.service_version:
        raise IntegrationDenied("AppStore cannot rewrite Registry identity/version")
    if registry.active != listing.registry_active:
        raise IntegrationDenied("AppStore cannot rewrite Registry active state")
    return listing


def admit_analytics_aggregate(value: AnalyticsAggregate) -> AnalyticsAggregate:
    if value.contains_user_identifier or value.contains_private_payload:
        raise IntegrationDenied("protected PuffBuddies payload cannot enter Analytics")
    return value


def admit_derived_projection(
    value: DerivedProjection,
    *,
    expected_chain_id: int,
    now_epoch: int,
    max_age_seconds: int = 120,
) -> DerivedProjection:
    if value.canonical_authority_claimed:
        raise IntegrationDenied("derived service cannot claim canonical authority")
    if value.chain_id != expected_chain_id:
        raise IntegrationDenied("wrong-chain derived projection")
    if now_epoch < value.observed_at_epoch:
        raise IntegrationDenied("future derived observation")
    if now_epoch - value.observed_at_epoch > max_age_seconds:
        raise IntegrationDenied("stale derived projection")
    return value


def verification_evidence_may_support(value: str) -> bool:
    return value in {"deployment_authenticity", "source_build_correspondence"}


def assert_no_authority_inheritance(authority_by_domain: Mapping[str, str]) -> None:
    for decision in PROTECTED_PUFFBUDDIES_DECISIONS:
        owner = authority_by_domain.get(decision)
        if owner is not None and owner != "PuffBuddies":
            raise IntegrationDenied(f"{decision} authority transferred to {owner}")


def dependency_service_ids() -> frozenset[str]:
    return frozenset(x.service_id for x in CONTRACTS.values() if x.service_id is not None)
