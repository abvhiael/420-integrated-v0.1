#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
M = ROOT / "contracts/config/arbitration/arbitration-audit-4-release-materialization.json"
NS = ROOT / "contracts/config/genesis-address-namespace.json"
CFG = ROOT / "contracts/config/420arbitration-genesis.json"
TEST = ROOT / "contracts/test/ArbitrationDeploymentBinding420.t.sol"
ROUTER = ROOT / "contracts/src/arbitration/ArbitrationRouter420.sol"
SERVICE_IDS = ROOT / "contracts/src/libraries/ServiceIds420.sol"
WALLET = ROOT / "wallet/web/core/genesis-app-catalog.js"
RUNTIME = ROOT / "wallet/web/core/arbitration-runtime.js"

errors = []
def need(cond, msg):
    if not cond:
        errors.append(msg)

d = json.loads(M.read_text())
ns = json.loads(NS.read_text())
cfg = json.loads(CFG.read_text())
test = TEST.read_text()
router = ROUTER.read_text()
service_ids = SERVICE_IDS.read_text()
wallet = WALLET.read_text()
runtime = RUNTIME.read_text()

need(d.get("schema") == "420-arbitration-audit-4-release-materialization-v1", "schema drift")
need(d.get("step") == "ARBITRATION-AUDIT-4", "step drift")
need(d.get("repository_ready") is True, "repository readiness missing")
need(d.get("live_qualified") is False, "fabricated live qualification")

ap = d.get("address_policy", {})
need(ap.get("arbitration_router_status") == "REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS", "router address policy drift")
need(ap.get("new_frozen_predeploy_required") is False, "unexpected frozen predeploy")
need(ap.get("create2_policy") == "NOT_ADOPTED_DO_NOT_INVENT", "CREATE2 policy drift")

rr = {x.get("id"): x for x in ns.get("registryResolved", [])}.get("arbitration-router")
need(rr is not None, "arbitration-router missing from namespace")
if rr:
    need(rr.get("contract") == "ArbitrationRouter420.sol", "arbitration-router contract drift")
    need(rr.get("status") == "REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS", "arbitration-router namespace drift")
fixed = {x.get("name") for x in ns.get("fixedAssignments", [])}
need("ArbitrationRouter420" not in fixed, "ArbitrationRouter became fixed predeploy")

need('ARBITRATION = keccak256("420/service/arbitration/v1")' in service_ids, "canonical service id missing")
need("420/service/arbitration/v1" in wallet, "Wallet Arbitration catalogue missing")
need("ARBITRATION_SERVICE_ID = '420/service/arbitration/v1'" in runtime, "Wallet runtime service drift")
need("arbitrationActionTarget" in runtime and "validateArbitrationRuntime" in runtime, "Wallet runtime binding missing")

order = d.get("deployment_order", [])
need([x.get("order") for x in order] == list(range(1, 8)), "deployment order must be 1..7")
expected = [
    ("ArbitrationPolicyRegistry420", ["GovernanceTimelock"]),
    ("ArbitrationCaseRegistry420", ["GovernanceTimelock","ArbitrationPolicyRegistry420"]),
    ("ArbitrationRulingRegistry420", ["ArbitrationCaseRegistry420"]),
]
for i, (name,args) in enumerate(expected):
    item = order[i] if i < len(order) else {}
    need(item.get("contract") == name, f"deployment contract drift at {i+1}")
    need(item.get("constructor") == args, f"constructor drift for {name}")
need(order[3].get("action") == "bindRulingRegistry" and order[3].get("one_time") is True, "one-time ruling binding drift")
need(order[4].get("contract") == "ArbitrationRouter420", "router deployment missing")
need(order[5].get("action") == "registerComponent" and order[5].get("implementation") == "ArbitrationRouter420", "component registration drift")
need(order[6].get("action") == "publishRegisteredService", "service publication missing")
need(order[6].get("service_id_preimage") == "420/service/arbitration/v1", "service id drift")
need(order[6].get("implementation") == "ArbitrationRouter420", "service implementation drift")

for token in [
    "ArbitrationPolicyRegistry420 public immutable policies",
    "ArbitrationCaseRegistry420 public immutable cases",
    "ArbitrationRulingRegistry420 public immutable rulings",
    "DependencyMismatch",
]:
    need(token in router, f"router invariant missing: {token}")

for token in [
    "new ArbitrationPolicyRegistry420(address(this))",
    "new ArbitrationCaseRegistry420(address(this), address(e.policies))",
    "new ArbitrationRulingRegistry420(address(e.cases))",
    "bindRulingRegistry(address(e.rulings))",
    "new ArbitrationRouter420(address(e.policies), address(e.cases), address(e.rulings))",
    "registerComponent(",
    "publishRegisteredService(",
    "deprecateService(SID)",
]:
    need(token in test, f"deployment binding test missing: {token}")

deployment = cfg.get("deployment", {})
need(deployment.get("addressModel") == "REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS", "genesis address model drift")
need(deployment.get("serviceImplementation") == "ArbitrationRouter420", "genesis service endpoint drift")
need(deployment.get("releaseMaterialization") == "contracts/config/arbitration/arbitration-audit-4-release-materialization.json", "release pointer drift")

runtime_cfg = cfg.get("userRuntime", {})
need(runtime_cfg.get("canonicalPath") == "WALLET_INTEGRATED_GENESIS_APP", "user runtime path drift")
need(runtime_cfg.get("binding") == "wallet/web/core/arbitration-runtime.js", "runtime binding pointer drift")

live = d.get("live_testnet_evidence", {})
need(live.get("required_in_step") == "ARBITRATION-AUDIT-5", "live owner drift")
for key in ["chain_id","genesis_hash","evidence_block","evidence_block_hash"]:
    need(live.get(key) is None, f"fabricated live {key}")
need(live.get("deployed_addresses") == {}, "fabricated live addresses")
need(live.get("deployment_transactions") == [] and live.get("registry_transactions") == [], "fabricated live transactions")
need(live.get("runtime_code_hashes") == {}, "fabricated live runtime hashes")

if errors:
    print(json.dumps({"pass": False, "errors": errors}, indent=2))
    raise SystemExit(1)

print(json.dumps({
    "pass": True,
    "step": "ARBITRATION-AUDIT-4",
    "serviceImplementation": "ArbitrationRouter420",
    "namespace": rr,
    "userRuntime": runtime_cfg,
    "liveQualified": False,
    "liveEvidenceOwner": "ARBITRATION-AUDIT-5"
}, indent=2))
