#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUNDLE = ROOT / "contracts/config/creative/420hz-authority-registry-bundle.json"
PLAN = ROOT / "contracts/src/creative/deployment/HzRegistryAuthorityPlan420.sol"
TEST = ROOT / "contracts/test/HzRegistryAuthority420.t.sol"
NAMESPACE = ROOT / "contracts/config/genesis-address-namespace.json"
PROTO = ROOT / "contracts/src/apps/ProtocolRegistry.sol"

errors = []

def need(condition, message):
    if not condition:
        errors.append(message)

for path in [BUNDLE, PLAN, TEST, NAMESPACE, PROTO]:
    need(path.is_file(), f"missing required file: {path.relative_to(ROOT)}")

if errors:
    print(json.dumps({"pass": False, "errors": errors}, indent=2))
    raise SystemExit(2)

d = json.loads(BUNDLE.read_text())
plan = PLAN.read_text()
test = TEST.read_text()
ns = json.loads(NAMESPACE.read_text())
proto = PROTO.read_text()

need(d.get("schema") == "420.hz.authority.registry.bundle.v1", "schema drift")
need(d.get("roadmap_step") == "HZ-AUDIT-3", "roadmap step drift")
need(d.get("status") == "REPOSITORY_AUTHORITY_REGISTRY_READY_LIVE_EXECUTION_DEFERRED", "status drift")
need(d.get("repository_ready") is True, "repository readiness missing")
need(d.get("live_qualified") is False, "fabricated live qualification")
need(d.get("classification") == "FIRST_YEAR_FLAGSHIP_NOT_FROZEN_GENESIS_APP", "classification drift")

fixed = {x.get("name"): x.get("address") for x in ns.get("fixedAssignments", [])}
need(fixed.get("GovernanceTimelock") == "0x0000000000000000000000000000000000000429", "GovernanceTimelock address drift")
need(fixed.get("ProtocolRegistry") == "0x0000000000000000000000000000000000000434", "ProtocolRegistry address drift")
for forbidden in ["420Hz", "HzRegistry", "CreativeProtocolRegistry420"]:
    need(forbidden not in fixed, f"HZ unexpectedly gained fixed Genesis assignment: {forbidden}")

policy = d.get("address_policy", {})
need(policy.get("governance_timelock") == fixed.get("GovernanceTimelock"), "bundle GovernanceTimelock drift")
need(policy.get("protocol_registry") == fixed.get("ProtocolRegistry"), "bundle ProtocolRegistry drift")
need(policy.get("hz_fixed_genesis_address") is False, "HZ fixed-address policy drift")
need(policy.get("hz_discovery_model") == "PROTOCOL_REGISTRY_RESOLVED", "HZ discovery model drift")
need(policy.get("create2_policy") == "NOT_ADOPTED_DO_NOT_INVENT", "CREATE2 policy drift")

expected_wiring = [
    "WorkRegistry420.setRightsRegistry(RightsRegistry420)",
    "RecordingRegistry420.configureDependencies(RightsRegistry420,AuthorizationRegistry420)",
    "RightsRegistry420.setRoyaltyAccounting(RoyaltyVault420)",
    "AuthorizationRegistry420.setLicenseRegistry(LicenseRegistry420)",
    "LicenseRegistry420.setRoyaltyRouter(RoyaltyRouter420)",
    "RoyaltyVault420.setRoyaltyRouter(RoyaltyRouter420)",
    "RoyaltyRouter420.setSettlementSource(LicenseRegistry420,true)",
    "RoyaltyRouter420.setSettlementSource(StreamingRoyaltySettlement420,true)",
    "PlaybackAccounting420.setSubmitter(playback_submitter,true)",
    "StreamingSettlementEpoch420.setSubmitter(settlement_submitter,true)",
]
need(d.get("internal_governance_wiring") == expected_wiring, "governance wiring inventory/order drift")

expected_modules = [
    ("CREATIVE_PROTOCOL_REGISTRY", "CreativeProtocolRegistry420"),
    ("CREATOR_PROFILE_REGISTRY", "CreatorProfileRegistry420"),
    ("WORK_REGISTRY", "WorkRegistry420"),
    ("RECORDING_REGISTRY", "RecordingRegistry420"),
    ("CONTRIBUTOR_REGISTRY", "ContributorRegistry420"),
    ("RIGHTS_REGISTRY", "RightsRegistry420"),
    ("AUTHORIZATION_REGISTRY", "AuthorizationRegistry420"),
    ("LICENSE_REGISTRY", "LicenseRegistry420"),
    ("ROYALTY_SCHEDULE_REGISTRY", "RoyaltyScheduleRegistry420"),
    ("ROYALTY_VAULT", "RoyaltyVault420"),
    ("ROYALTY_ROUTER", "RoyaltyRouter420"),
    ("CATALOG_REGISTRY", "CatalogRegistry420"),
    ("CATALOG_METADATA_REGISTRY", "CatalogMetadataRegistry420"),
    ("MEDIA_MANIFEST_REGISTRY", "MediaManifestRegistry420"),
    ("STORAGE_SOURCE_REGISTRY", "StorageSourceRegistry420"),
    ("PLAYBACK_RESOLVER", "PlaybackResolver420"),
    ("PLAYBACK_ACCOUNTING", "PlaybackAccounting420"),
    ("STREAMING_SETTLEMENT_EPOCH", "StreamingSettlementEpoch420"),
    ("STREAMING_REVENUE_ALLOCATOR", "StreamingRevenueAllocator420"),
    ("STREAMING_ROYALTY_SETTLEMENT", "StreamingRoyaltySettlement420"),
]
modules = d.get("creative_protocol_modules", [])
need(len(modules) == 20, "HZ module inventory must contain exactly 20 modules")
need(
    [(x.get("key_preimage"), x.get("implementation")) for x in modules] == expected_modules,
    "HZ module inventory/order drift",
)
need(all(x.get("version") == 1 for x in modules), "HZ module version drift")
need(d.get("creative_protocol_module_manifest_hash_preimage") == "420/HZ/AUDIT-3/MODULE-MANIFEST/V1", "module manifest commitment drift")

identity = d.get("external_protocol_registry", {})
need(identity.get("root_implementation") == "CreativeProtocolRegistry420", "external Registry root drift")
need(identity.get("component_id_preimage") == "420/component/hz/creative-protocol-registry/v1", "component id drift")
need(identity.get("component_version") == {"major": 1, "minor": 0, "patch": 0}, "component version drift")
need(identity.get("component_lifecycle") == "ACTIVE", "component lifecycle drift")
need(identity.get("service_id_preimage") == "420/service/hz/v1", "service id drift")
need(identity.get("service_requires_extension_approval") is True, "extension approval requirement drift")
need(identity.get("service_version") == 1 and identity.get("service_active") is True, "service version/lifecycle drift")
need(identity.get("component_type") == "APPLICATION", "service registration component type drift")
for key in [
    "service_descriptor_hash_preimage",
    "metadata_hash_preimage",
    "manifest_hash_preimage",
    "interface_hash_preimage",
    "dependency_root_policy",
]:
    need(bool(identity.get(key)), f"missing Registry commitment: {key}")

expected_sequence = [
    "ProtocolRegistry.registerComponent(componentId,CreativeProtocolRegistry420,1.0.0,ACTIVE)",
    "ProtocolRegistry.approveServiceId(serviceId,serviceDescriptorHash)",
    "ProtocolRegistry.publishRegisteredService(serviceId,CreativeProtocolRegistry420,metadataHash,1,true,APPLICATION,manifestHash,dependencyRoot,interfaceHash)",
]
need(identity.get("governance_sequence") == expected_sequence, "external ProtocolRegistry governance sequence drift")

for token in [
    'keccak256("420/component/hz/creative-protocol-registry/v1")',
    'keccak256("420/service/hz/v1")',
    'keccak256("420/HZ/SERVICE/DESCRIPTOR/V1")',
    'keccak256("420/HZ/AUDIT-3/MODULE-MANIFEST/V1")',
    'keccak256("420/HZ/AUDIT-3/REGISTRY-MANIFEST/V1")',
    'keccak256("420/HZ/CREATIVE_PROTOCOL_REGISTRY/INTERFACE/V1")',
    "function dependencyRoot(",
]:
    need(token in plan, f"authority plan missing commitment: {token}")

for label, _ in expected_modules:
    need(f'keccak256("{label}")' in plan, f"authority plan missing module key: {label}")
    need(f'"{label}"' in test, f"focused test missing module registration/assertion: {label}")

for token in [
    "setSubmitter(PLAYBACK_SUBMITTER, true)",
    "setSubmitter(SETTLEMENT_SUBMITTER, true)",
    "registerComponent(",
    "approveServiceId(",
    "publishRegisteredService(",
    "ComponentType.APPLICATION",
    "unapproved extension service published",
    "service version replay accepted",
    "unauthorized playback submitter",
    "unauthorized module registration",
    "unauthorized service approval",
]:
    need(token in test, f"focused authority test missing invariant: {token}")

need("function approveServiceId(" in proto, "ProtocolRegistry extension approval API missing")
need("function registerComponent(" in proto, "ProtocolRegistry component API missing")
need("function publishRegisteredService(" in proto, "ProtocolRegistry publication API missing")

live = d.get("live_evidence", {})
need(live.get("required_in_step") == "HZ-AUDIT-7", "live evidence boundary drift")
for key in [
    "network",
    "chain_id",
    "governance_timelock",
    "protocol_registry",
    "playback_submitter",
    "settlement_submitter",
]:
    need(live.get(key) is None, f"fabricated live value present: {key}")
for key in [
    "governance_transactions",
    "module_registration_transactions",
    "protocol_registry_transactions",
    "registry_resolution_evidence",
]:
    need(live.get(key) == [], f"fabricated live list present: {key}")
need(live.get("hz_contract_addresses") == {}, "fabricated HZ live addresses present")
need(live.get("runtime_code_hashes") == {}, "fabricated live runtime hashes present")

out = {
    "pass": not errors,
    "step": "HZ-AUDIT-3",
    "bundle": str(BUNDLE.relative_to(ROOT)),
    "checks": {
        "modules": len(expected_modules),
        "governance_actions": len(expected_wiring),
        "component_id_preimage": identity.get("component_id_preimage"),
        "service_id_preimage": identity.get("service_id_preimage"),
        "live_evidence_deferred_to": live.get("required_in_step"),
    },
    "errors": errors,
}
print(json.dumps(out, indent=2))
raise SystemExit(0 if not errors else 2)
