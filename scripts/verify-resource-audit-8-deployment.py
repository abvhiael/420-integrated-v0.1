#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "contracts/config/resource/resource-audit-8-deployment-package.json"
GENESIS = ROOT / "contracts/config/420resource-genesis.json"
NS = ROOT / "contracts/config/genesis-address-namespace.json"
CANON = ROOT / "contracts/config/genesis-canonical-addresses.json"
PROTO = ROOT / "contracts/src/apps/ProtocolRegistry.sol"
SERVICE_IDS = ROOT / "contracts/src/libraries/ServiceIds420.sol"
TEST = ROOT / "contracts/test/ResourceDeploymentBinding420.t.sol"

errors = []

def need(condition, message):
    if not condition:
        errors.append(message)

for p in [PACKAGE, GENESIS, NS, CANON, PROTO, SERVICE_IDS, TEST]:
    need(p.is_file(), f"missing required file: {p.relative_to(ROOT)}")

if errors:
    print(json.dumps({"pass": False, "errors": errors}, indent=2))
    raise SystemExit(2)

d = json.loads(PACKAGE.read_text())
genesis = json.loads(GENESIS.read_text())
ns = json.loads(NS.read_text())
canon = json.loads(CANON.read_text())
proto = PROTO.read_text()
service_ids = SERVICE_IDS.read_text()
test = TEST.read_text()

need(d.get("schema") == "420-resource-audit-8-deployment-package-v1", "schema drift")
need(d.get("step") == "RESOURCE-AUDIT-8", "step drift")
need(d.get("status") == "REPOSITORY_DEPLOYMENT_PACKAGE_READY_LIVE_TESTNET_DEFERRED", "status drift")
need(d.get("repository_ready") is True, "repository package not marked ready")
need(d.get("live_qualified") is False, "fabricated live qualification")

policy = d.get("address_policy", {})
need(policy.get("resource_router_status") == "REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS", "router policy drift")
need(policy.get("new_frozen_predeploy_required") is False, "unexpected frozen predeploy")
need(policy.get("create2_policy") == "NOT_ADOPTED_DO_NOT_INVENT", "CREATE2 policy drift")
need(policy.get("production_addresses_source") == "LIVE_DEPLOYMENT_PLUS_PROTOCOL_REGISTRY_IN_RESOURCE_AUDIT_9", "live address owner drift")

fixed_entries = ns.get("fixedAssignments", ns.get("fixed", []))
fixed = {x.get("name"): x.get("address") for x in fixed_entries}
need(fixed.get("GovernanceTimelock") == "0x0000000000000000000000000000000000000429", "GovernanceTimelock drift")
need(fixed.get("ProtocolRegistry") == "0x0000000000000000000000000000000000000434", "ProtocolRegistry drift")
need("ResourceRouter420" not in fixed and "ResourceRouter" not in fixed, "ResourceRouter became fixed predeploy")

resolved_entries = ns.get("registryResolved", ns.get("registry_resolved", []))
resolved = {x.get("id"): x for x in resolved_entries}
router = resolved.get("resource-router")
need(router is not None, "resource-router missing from namespace")
if router:
    need(router.get("contract") in ("ResourceRouter420.sol", "ResourceRouter420"), "resource-router contract drift")
    need(router.get("status") == "REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS", "resource-router status drift")

canon_entries = canon.get("registry_resolved", canon.get("registryResolved", []))
canon_resolved = {x.get("id"): x for x in canon_entries}
need(canon_resolved.get("resource-router", {}).get("contract") in ("ResourceRouter420.sol", "ResourceRouter420"), "canonical resource-router drift")
need(not canon_resolved.get("resource-router", {}).get("address"), "canonical file invented ResourceRouter address")

deps = d.get("canonical_dependencies", {})
need(deps.get("governance_timelock", {}).get("address") == "0x0000000000000000000000000000000000000429", "package timelock drift")
need(deps.get("protocol_registry", {}).get("address") == "0x0000000000000000000000000000000000000434", "package ProtocolRegistry drift")
need(deps.get("protocol_registry", {}).get("publication_api") == "publishRegisteredService", "Registry publication API drift")
need(deps.get("capability_registry", {}).get("candidate_address") == "0x0000000000000000000000000000000000000447", "CapabilityRegistry candidate drift")
need(deps.get("capability_registry", {}).get("status") == "CANDIDATE_NOT_DEPLOYED_NOT_FROZEN", "CapabilityRegistry status overclaim")
need(deps.get("vault", {}).get("binding_model") == "PER_STORAGE_SETTLEMENT_OPEN", "Vault binding model drift")
need(deps.get("vault", {}).get("constructor_dependency") is False, "Vault incorrectly made constructor dependency")

active = {x.get("name"): x for x in ns.get("activeNonPredeployReservations", [])}
cap = active.get("CapabilityRegistry420")
need(cap is not None, "CapabilityRegistry reservation missing")
if cap:
    need(cap.get("address") == "0x0000000000000000000000000000000000000447", "CapabilityRegistry reservation address drift")
    need(cap.get("status") == "CANDIDATE_NOT_DEPLOYED_NOT_FROZEN", "CapabilityRegistry reservation status drift")

identity = d.get("protocol_registry_identity", {})
need(identity.get("service_id_preimage") == "420/service/resource-protocol/v1", "Resource service ID drift")
need(identity.get("service_version") == 1 and identity.get("service_active") is True, "Resource service lifecycle drift")
need(identity.get("component_type") == "SERVICE", "component type drift")
need(identity.get("implementation") == "ResourceRouter420", "Registry implementation drift")
for key in ["metadata_hash_preimage", "manifest_hash_preimage", "interface_hash_preimage", "dependency_root_policy"]:
    need(bool(identity.get(key)), f"missing Registry commitment policy: {key}")
component = identity.get("component_registration", {})
need(component.get("status") == "NOT_PUBLISHED_NO_CANONICAL_COMPONENT_ID_APPROVED", "invented Resource component registration")
need("Do not invent" in component.get("rule", ""), "component ID non-invention rule missing")

need('RESOURCE_PROTOCOL = keccak256("420/service/resource-protocol/v1")' in service_ids, "ServiceIds420 Resource Protocol identity drift")
need("function publishRegisteredService(" in proto, "ProtocolRegistry publication API missing")

order = d.get("deployment_order", [])
need([x.get("order") for x in order] == list(range(1, 17)), "deployment order must be deterministic 1..16")
expected = [
    ("ResourceAuthorization420", ["CapabilityRegistry420"]),
    ("ResourcePolicyRegistry420", ["GovernanceTimelock"]),
    ("ResourceProviderRegistry420", ["ResourceAuthorization420"]),
    ("ResourceNodeRegistry420", ["ResourceAuthorization420", "ResourceProviderRegistry420"]),
    ("ResourceOfferRegistry420", ["ResourceNodeRegistry420", "ResourceProviderRegistry420", "ResourcePolicyRegistry420", "ResourceAuthorization420"]),
    ("ResourceSessionRegistry420", ["ResourceOfferRegistry420", "ResourceAuthorization420"]),
    ("ResourceReceiptRegistry420", ["ResourceSessionRegistry420", "ResourceOfferRegistry420", "ResourceNodeRegistry420"]),
    ("ResourceRouter420", ["ResourcePolicyRegistry420", "ResourceNodeRegistry420", "ResourceOfferRegistry420"]),
    ("StorageProofSchemeRegistry420", ["ResourceAuthorization420"]),
    ("StorageCapacityRegistry420", ["ResourceAuthorization420", "ResourceNodeRegistry420", "ResourceProviderRegistry420"]),
    ("StorageCommitmentRegistry420", ["ResourceAuthorization420", "ResourceProviderRegistry420", "ResourceNodeRegistry420", "StorageProofSchemeRegistry420"]),
    ("StorageProofRegistry420", ["StorageCommitmentRegistry420", "StorageProofSchemeRegistry420", "ResourceNodeRegistry420"]),
    ("StorageAgreementRegistry420", ["ResourceAuthorization420", "ResourceOfferRegistry420", "ResourceNodeRegistry420", "ResourceProviderRegistry420", "StorageProofSchemeRegistry420", "StorageCommitmentRegistry420", "StorageCapacityRegistry420"]),
    ("StorageObjectManifestRegistry420", ["StorageAgreementRegistry420", "StorageCommitmentRegistry420"]),
    ("StorageSettlementRegistry420", ["StorageAgreementRegistry420", "StorageProofRegistry420"]),
]
for i, (name, args) in enumerate(expected):
    item = order[i] if i < len(order) else {}
    need(item.get("contract") == name, f"deployment contract drift at order {i+1}")
    need(item.get("constructor") == args, f"constructor binding drift for {name}")
    source = ROOT / item.get("source", "")
    need(source.is_file(), f"missing deployment source for {name}")
    if source.is_file():
        need(f"contract {name}" in source.read_text(), f"source contract declaration drift for {name}")

publication = order[15] if len(order) > 15 else {}
need(publication.get("contract") == "ProtocolRegistry", "publication target drift")
need(publication.get("action") == "publishRegisteredService", "publication action drift")
need(publication.get("service_id_preimage") == identity.get("service_id_preimage"), "publication service ID drift")
need(publication.get("implementation") == "ResourceRouter420", "publication implementation drift")
need(publication.get("version") == 1 and publication.get("active") is True, "publication lifecycle drift")
need(publication.get("component_type") == "SERVICE", "publication component type drift")

artifacts = d.get("artifact_identity", {})
need(artifacts.get("compiler") == "Solidity 0.8.24", "compiler policy drift")
need(artifacts.get("build_profile") == "ci", "build profile drift")
need(len(artifacts.get("artifact_paths", [])) == 15, "artifact inventory must cover 15 deployed contracts")
need("EXTCODEHASH" in artifacts.get("runtime_codehash_commitment", ""), "runtime codehash commitment missing")

checks = d.get("post_deployment_verification", [])
for required in ["eth_getCode", "runtime code hash", "constructor dependency", "ProtocolRegistry", "CapabilityRegistry", "420Vault"]:
    need(any(required in x for x in checks), f"post-deployment verification missing: {required}")

live = d.get("live_testnet_evidence", {})
need(live.get("required_in_step") == "RESOURCE-AUDIT-9", "live evidence owner drift")
for key in ["chain_id", "genesis_hash", "evidence_block", "evidence_block_hash"]:
    need(live.get(key) is None, f"fabricated live value present: {key}")
for key in ["deployment_transactions", "registry_transactions", "constructor_binding_receipts", "capability_grant_revocation_receipts", "vault_binding_receipts", "smoke_transactions"]:
    need(live.get(key) == [], f"fabricated live list present: {key}")
need(live.get("deployed_addresses") == {}, "fabricated live addresses present")
need(live.get("runtime_code_hashes") == {}, "fabricated live runtime hashes present")

need(genesis.get("deployment_package") == "contracts/config/resource/resource-audit-8-deployment-package.json", "Resource genesis descriptor missing deployment package link")

required_test_fragments = [
    'RESOURCE_SERVICE_ID = keccak256("420/service/resource-protocol/v1")',
    "new CapabilityRegistry420()",
    "new ResourceAuthorization420(address(e.caps))",
    "new ResourcePolicyRegistry420(address(this))",
    "new ResourceProviderRegistry420(address(e.authorization))",
    "new ResourceNodeRegistry420(address(e.authorization), address(e.providers))",
    "new ResourceRouter420(address(e.policy), address(e.nodes), address(e.offers))",
    "new StorageSettlementRegistry420(address(e.agreements), address(e.proofs))",
    "registerProtocolComponent(ResourceIds420.COMPONENT_RESOURCE, address(this))",
    "publishRegisteredService(",
    "service.codeHash == address(e.router).codehash",
    "profile.dependencyRoot == e.dependencyRoot",
    "ServiceIds420.RESOURCE_PROTOCOL",
]
for fragment in required_test_fragments:
    need(fragment in test, f"deployment binding test missing invariant: {fragment}")

out = {
    "pass": not errors,
    "step": "RESOURCE-AUDIT-8",
    "package": str(PACKAGE.relative_to(ROOT)),
    "checks": {
        "governance_timelock": "0x0000000000000000000000000000000000000429",
        "protocol_registry": "0x0000000000000000000000000000000000000434",
        "capability_registry": "candidate-only 0x0000000000000000000000000000000000000447",
        "resource_router_policy": "REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS",
        "service_id_preimage": "420/service/resource-protocol/v1",
        "deployed_contracts": 15,
        "publication_steps": 1,
        "live_evidence_deferred_to": "RESOURCE-AUDIT-9",
    },
    "errors": errors,
}
print(json.dumps(out, indent=2))
raise SystemExit(0 if not errors else 2)
