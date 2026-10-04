#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
M = ROOT / "contracts/config/rights/rights-audit-4-release-materialization.json"
NS = ROOT / "contracts/config/genesis-address-namespace.json"
CFG = ROOT / "contracts/config/420rights-genesis.json"
TEST = ROOT / "contracts/test/RightsDeploymentBinding420.t.sol"
SERVICE_IDS = ROOT / "contracts/src/libraries/ServiceIds420.sol"
REGISTRY = ROOT / "contracts/src/apps/ProtocolRegistry.sol"
BINDER = ROOT / "420-indexer/src/rights-descriptors.ts"

errors = []
def need(cond, msg):
    if not cond:
        errors.append(msg)

d = json.loads(M.read_text())
ns = json.loads(NS.read_text())
cfg = json.loads(CFG.read_text())
test = TEST.read_text()
service_ids = SERVICE_IDS.read_text()
registry_src = REGISTRY.read_text()
binder = BINDER.read_text()

need(d.get("schema") == "420-rights-audit-4-release-materialization-v1", "schema drift")
need(d.get("step") == "RIGHTS-AUDIT-4", "step drift")
need(d.get("repository_ready") is True, "repository readiness not recorded")
need(d.get("live_qualified") is False, "fabricated live qualification")
ap = d.get("address_policy", {})
need(ap.get("rights_router_status") == "REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS", "router address policy drift")
need(ap.get("new_frozen_predeploy_required") is False, "unexpected frozen predeploy")
need(ap.get("create2_policy") == "NOT_ADOPTED_DO_NOT_INVENT", "CREATE2 policy drift")

deps = d.get("canonical_dependencies", {})
need(deps.get("governance_timelock", {}).get("address") == "0x0000000000000000000000000000000000000429", "GovernanceTimelock drift")
need(deps.get("protocol_registry", {}).get("address") == "0x0000000000000000000000000000000000000434", "ProtocolRegistry drift")
need(deps.get("protocol_registry", {}).get("publication_api") == "publishRegisteredService", "Registry publication API drift")
need(deps.get("capability_registry", {}).get("candidate_address") == "0x0000000000000000000000000000000000000447", "CapabilityRegistry candidate drift")
need(deps.get("capability_registry", {}).get("status") == "CANDIDATE_NOT_DEPLOYED_NOT_FROZEN", "CapabilityRegistry status drift")

rr = {x.get("id"): x for x in ns.get("registryResolved", [])}.get("rights-router")
need(rr is not None, "rights-router missing from namespace")
if rr:
    need(rr.get("contract") == "RightsRouter420.sol", "rights-router contract drift")
    need(rr.get("status") == "REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS", "rights-router namespace status drift")
fixed = {x.get("name"): x.get("address") for x in ns.get("fixedAssignments", [])}
need("RightsRouter420" not in fixed, "RightsRouter became fixed predeploy")
need(fixed.get("GovernanceTimelock") == "0x0000000000000000000000000000000000000429", "fixed GovernanceTimelock drift")
need(fixed.get("ProtocolRegistry") == "0x0000000000000000000000000000000000000434", "fixed ProtocolRegistry drift")
cap = {x.get("name"): x for x in ns.get("activeNonPredeployReservations", [])}.get("CapabilityRegistry420")
need(cap is not None, "CapabilityRegistry reservation missing")
if cap:
    need(cap.get("address") == "0x0000000000000000000000000000000000000447", "CapabilityRegistry reservation address drift")
    need(cap.get("status") == "CANDIDATE_NOT_DEPLOYED_NOT_FROZEN", "CapabilityRegistry reservation status drift")

need('bytes32 internal constant RIGHTS = keccak256("420/service/rights/v1");' in service_ids, "canonical Rights service id missing")
need("function publishRegisteredService(" in registry_src, "ProtocolRegistry publication API missing")

classes = d.get("right_class_metadata_commitments", {}).get("classes", [])
expected_classes = ["COPYRIGHT","TRADEMARK","PATENT","PERSONALITY","GENETIC","DATA","MODEL","CONTRACTUAL"]
need([x.get("name") for x in classes] == expected_classes, "right class commitment inventory drift")
need(all(x.get("metadata_hash") is None for x in classes), "invented live right-class metadata hash")
need(d.get("right_class_metadata_commitments", {}).get("authority") == "GovernanceTimelock", "right-class authority drift")

order = d.get("deployment_order", [])
need([x.get("order") for x in order] == list(range(1, 8)), "deployment order must be deterministic 1..7")
expected = [
    ("RightsAuthorization420", ["CapabilityRegistry420"]),
    ("RightsPolicyRegistry420", ["GovernanceTimelock"]),
    ("RightsAssetRegistry420", ["RightsAuthorization420"]),
    ("RightsClaimRegistry420", ["RightsAuthorization420","RightsAssetRegistry420","RightsPolicyRegistry420"]),
    ("RightsLicenseRegistry420", ["RightsAuthorization420","RightsClaimRegistry420"]),
    ("RightsRouter420", ["RightsClaimRegistry420","RightsLicenseRegistry420"])
]
for i, (name, args) in enumerate(expected):
    item = order[i] if i < len(order) else {}
    need(item.get("contract") == name, f"deployment contract drift at {i+1}")
    need(item.get("constructor") == args, f"constructor binding drift for {name}")
pub = order[6] if len(order) > 6 else {}
need(pub.get("contract") == "ProtocolRegistry" and pub.get("action") == "publishRegisteredService", "Registry publication path drift")
need(pub.get("service_id_preimage") == "420/service/rights/v1", "Rights service id drift")
need(pub.get("implementation") == "RightsRouter420", "Rights service implementation drift")
need(pub.get("component_id_preimage") == "420/RIGHTS/COMPONENT/V1", "Rights component id drift")

for token in [
    "new RightsAuthorization420(address(e.caps))",
    "new RightsPolicyRegistry420(address(this))",
    "new RightsAssetRegistry420(address(e.authorization))",
    "new RightsClaimRegistry420(address(e.authorization), address(e.assets), address(e.policy))",
    "new RightsLicenseRegistry420(address(e.authorization), address(e.claims))",
    "new RightsRouter420(address(e.claims), address(e.licenses))",
    "registerComponent(",
    "RightsIds420.COMPONENT_RIGHTS",
    "publishRegisteredService(",
    "RIGHTS_SERVICE_ID",
    "deprecateService(RIGHTS_SERVICE_ID)",
]:
    need(token in test, f"deployment binding test missing token: {token}")

expected_paths = [
    "contracts/out/RightsAuthorization420.sol/RightsAuthorization420.json",
    "contracts/out/RightsPolicyRegistry420.sol/RightsPolicyRegistry420.json",
    "contracts/out/RightsAssetRegistry420.sol/RightsAssetRegistry420.json",
    "contracts/out/RightsClaimRegistry420.sol/RightsClaimRegistry420.json",
    "contracts/out/RightsLicenseRegistry420.sol/RightsLicenseRegistry420.json",
    "contracts/out/RightsRouter420.sol/RightsRouter420.json"
]
need(d.get("artifact_identity", {}).get("artifact_paths") == expected_paths, "artifact path inventory drift")
need(d.get("indexer_binding", {}).get("binding_api") == "bindRightsDescriptorsWithCodeIdentity420", "Indexer binding API drift")
need("bindRightsDescriptorsWithCodeIdentity420" in binder, "Indexer code-identity binding implementation missing")

deployment = cfg.get("deployment", {})
need(deployment.get("addressModel") == "REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS", "Rights genesis address model drift")
need(deployment.get("releaseMaterialization") == "contracts/config/rights/rights-audit-4-release-materialization.json", "Rights release materialization pointer drift")

live = d.get("live_testnet_evidence", {})
need(live.get("required_in_step") == "RIGHTS-AUDIT-5", "live evidence owner drift")
for key in ["chain_id","genesis_hash","evidence_block","evidence_block_hash"]:
    need(live.get(key) is None, f"fabricated live {key}")
need(live.get("deployed_addresses") == {}, "fabricated live addresses")
need(live.get("deployment_transactions") == [] and live.get("registry_transactions") == [], "fabricated live transactions")
need(live.get("runtime_code_hashes") == {}, "fabricated live runtime hashes")
need(live.get("constructor_binding_receipts") == [], "fabricated live constructor receipts")

if errors:
    print(json.dumps({"pass": False, "errors": errors}, indent=2))
    raise SystemExit(1)

print(json.dumps({
    "pass": True,
    "step": "RIGHTS-AUDIT-4",
    "deploymentOrder": [x.get("contract") + (":" + x.get("action") if x.get("action") else "") for x in order],
    "rightsRouterNamespace": rr,
    "rightClasses": expected_classes,
    "serviceIdPreimage": "420/service/rights/v1",
    "liveQualified": False,
    "liveEvidenceOwner": "RIGHTS-AUDIT-5"
}, indent=2))
