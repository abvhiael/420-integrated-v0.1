#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
M = ROOT / "contracts/config/grants/grants-audit-5-release-materialization.json"
NS = ROOT / "contracts/config/genesis-address-namespace.json"
CANON = ROOT / "contracts/config/genesis-canonical-addresses.json"
CFG = ROOT / "contracts/config/420grants-genesis.json"
TEST = ROOT / "contracts/test/GrantsDeploymentBinding420.t.sol"
SERVICE_IDS = ROOT / "contracts/src/libraries/ServiceIds420.sol"
REGISTRY = ROOT / "contracts/src/apps/ProtocolRegistry.sol"

errors = []

def need(cond, msg):
    if not cond:
        errors.append(msg)

d = json.loads(M.read_text())
ns = json.loads(NS.read_text())
canon = json.loads(CANON.read_text())
cfg = json.loads(CFG.read_text())
test = TEST.read_text()
service_ids = SERVICE_IDS.read_text()
registry_src = REGISTRY.read_text()

need(d.get("schema") == "420-grants-audit-5-release-materialization-v1", "schema drift")
need(d.get("step") == "GRANTS-AUDIT-5", "step drift")
need(d.get("live_qualified") is False, "fabricated live qualification")
need(d.get("address_policy", {}).get("grants_router_status") == "REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS", "router address policy drift")
need(d.get("address_policy", {}).get("new_frozen_predeploy_required") is False, "unexpected frozen predeploy")
need(d.get("address_policy", {}).get("create2_policy") == "NOT_ADOPTED_DO_NOT_INVENT", "CREATE2 policy drift")

deps = d.get("canonical_dependencies", {})
need(deps.get("governance_timelock", {}).get("address") == "0x0000000000000000000000000000000000000429", "GovernanceTimelock drift")
need(deps.get("protocol_registry", {}).get("address") == "0x0000000000000000000000000000000000000434", "ProtocolRegistry drift")
need(deps.get("protocol_registry", {}).get("publication_api") == "publishRegisteredService", "Registry publication API drift")
need(deps.get("capability_registry", {}).get("candidate_address") == "0x0000000000000000000000000000000000000447", "CapabilityRegistry candidate drift")
need(deps.get("capability_registry", {}).get("status") == "CANDIDATE_NOT_DEPLOYED_NOT_FROZEN", "CapabilityRegistry live-state drift")
need(deps.get("treasury_disbursement_registry", {}).get("address") is None, "fabricated Treasury dependency address")
need(deps.get("treasury_disbursement_registry", {}).get("service_id_preimage") == "420/service/treasury/v1", "Treasury service dependency drift")

registry_resolved = {x.get("id"): x for x in ns.get("registryResolved", [])}
router = registry_resolved.get("grants-router")
need(router is not None, "grants-router missing from namespace")
if router:
    need(router.get("contract") == "GrantRouter420.sol", "grants-router contract drift")
    need(router.get("status") == "REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS", "grants-router namespace status drift")

fixed = {x.get("name"): x.get("address") for x in ns.get("fixedAssignments", [])}
need("GrantRouter420" not in fixed and "GrantsRouter" not in fixed, "GrantRouter became fixed predeploy")
need(fixed.get("GovernanceTimelock") == "0x0000000000000000000000000000000000000429", "fixed GovernanceTimelock drift")
need(fixed.get("ProtocolRegistry") == "0x0000000000000000000000000000000000000434", "fixed ProtocolRegistry drift")

active = {x.get("name"): x for x in ns.get("activeNonPredeployReservations", [])}
cap = active.get("CapabilityRegistry420")
need(cap is not None, "CapabilityRegistry reservation missing")
if cap:
    need(cap.get("address") == "0x0000000000000000000000000000000000000447", "CapabilityRegistry reservation address drift")
    need(cap.get("status") == "CANDIDATE_NOT_DEPLOYED_NOT_FROZEN", "CapabilityRegistry reservation status drift")

need('bytes32 internal constant GRANTS = keccak256("420/service/grants/v1");' in service_ids, "canonical Grants service id missing")
need("function publishRegisteredService(" in registry_src, "ProtocolRegistry genesis-grade publication path missing")

order = d.get("deployment_order", [])
need([x.get("order") for x in order] == list(range(1, 9)), "deployment order is not deterministic 1..8")
expected = [
    ("GrantAuthorization420", ["CapabilityRegistry420"]),
    ("GrantProgramRegistry420", ["GovernanceTimelock"]),
    ("GrantApplicationRegistry420", ["GrantAuthorization420", "GrantProgramRegistry420"]),
    ("GrantAwardRegistry420", ["GovernanceTimelock", "GrantProgramRegistry420", "GrantApplicationRegistry420"]),
]
for i, (name, args) in enumerate(expected):
    item = order[i] if i < len(order) else {}
    need(item.get("contract") == name, f"deployment order contract drift at {i+1}")
    need(item.get("constructor") == args, f"constructor binding drift for {name}")

need(order[4].get("action") == "bindAwardRegistry" and order[4].get("args") == ["GrantAwardRegistry420"] and order[4].get("one_time") is True, "award registry post-init drift")
need(order[5].get("contract") == "GrantMilestoneRegistry420", "milestone deployment order drift")
need(order[5].get("constructor") == ["GovernanceTimelock", "GrantAuthorization420", "GrantProgramRegistry420", "GrantAwardRegistry420", "TreasuryDisbursementRegistry420"], "milestone constructor binding drift")
need(order[6].get("contract") == "GrantRouter420" and order[6].get("constructor") == ["GrantProgramRegistry420", "GrantAwardRegistry420", "GrantMilestoneRegistry420"], "router binding drift")
need(order[7].get("contract") == "ProtocolRegistry" and order[7].get("action") == "publishRegisteredService", "Registry publication path drift")
need(order[7].get("service_id_preimage") == "420/service/grants/v1", "Grants service id drift")
need(order[7].get("implementation") == "GrantRouter420", "Grants service implementation drift")
need(order[7].get("component_id_preimage") == "420/GRANTS/COMPONENT/V1", "Grants component id drift")

for token in [
    "new GrantAuthorization420(address(e.caps))",
    "new GrantProgramRegistry420(address(this))",
    "new GrantApplicationRegistry420(address(e.authorization), address(e.programs))",
    "new GrantAwardRegistry420(address(this), address(e.programs), address(e.applications))",
    "e.programs.bindAwardRegistry(address(e.awards))",
    "new GrantMilestoneRegistry420(",
    "address(e.treasuryDisbursements)",
    "new GrantRouter420(address(e.programs), address(e.awards), address(e.milestones))",
    "registerComponent(",
    "GrantIds420.COMPONENT_GRANTS",
    "publishRegisteredService(",
    "GRANTS_SERVICE_ID",
    "address(e.router).codehash",
]:
    need(token in test, f"deployment binding test missing token: {token}")

artifact = d.get("artifact_identity", {})
paths = artifact.get("artifact_paths", [])
expected_paths = [
    "contracts/out/GrantAuthorization420.sol/GrantAuthorization420.json",
    "contracts/out/GrantProgramRegistry420.sol/GrantProgramRegistry420.json",
    "contracts/out/GrantApplicationRegistry420.sol/GrantApplicationRegistry420.json",
    "contracts/out/GrantAwardRegistry420.sol/GrantAwardRegistry420.json",
    "contracts/out/GrantMilestoneRegistry420.sol/GrantMilestoneRegistry420.json",
    "contracts/out/GrantRouter420.sol/GrantRouter420.json",
]
need(paths == expected_paths, "artifact path inventory drift")
need(artifact.get("hash_evidence") == "QUALIFICATION_LOG_AND_DURABLE_AUDIT_EVIDENCE", "artifact hash evidence policy drift")

need(cfg.get("deployment", {}).get("addressModel") == "REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS", "Grants genesis address model drift")
need(cfg.get("deployment", {}).get("releaseMaterialization") == "contracts/config/grants/grants-audit-5-release-materialization.json", "Grants release materialization pointer drift")

canon_entries = {x.get("id"): x for x in canon.get("registry_resolved", canon.get("registryResolved", []))}
if "grants-router" in canon_entries:
    need(canon_entries["grants-router"].get("contract") in ("GrantRouter420", "GrantRouter420.sol"), "canonical grants-router contract drift")

live = d.get("live_testnet_evidence", {})
need(live.get("required_in_step") == "GRANTS-AUDIT-9", "live evidence owner drift")
for key in ["chain_id", "genesis_hash", "evidence_block", "evidence_block_hash"]:
    need(live.get(key) is None, f"fabricated live {key}")
need(live.get("deployed_addresses") == {}, "fabricated live deployed addresses")
need(live.get("deployment_transactions") == [] and live.get("registry_transactions") == [], "fabricated live transactions")
need(live.get("runtime_code_hashes") == {}, "fabricated live runtime hashes")
need(live.get("constructor_binding_receipts") == [], "fabricated live constructor receipts")

if errors:
    print(json.dumps({"pass": False, "errors": errors}, indent=2))
    raise SystemExit(1)

print(json.dumps({
    "pass": True,
    "step": "GRANTS-AUDIT-5",
    "deploymentOrder": [x.get("contract") + (":" + x.get("action") if x.get("action") else "") for x in order],
    "grantsRouterNamespace": router,
    "serviceIdPreimage": "420/service/grants/v1",
    "liveQualified": False,
    "liveEvidenceOwner": "GRANTS-AUDIT-9"
}, indent=2))
