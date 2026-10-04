#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUNDLE = ROOT / "contracts/config/randomness/random-audit-4-deployment-bundle.json"
NS = ROOT / "contracts/config/genesis-address-namespace.json"
CANON = ROOT / "contracts/config/genesis-canonical-addresses.json"
ARTIFACT = ROOT / "contracts/artifacts/RandomnessRegistry.json"
STATE = ROOT / "contracts/config/predeploy/RandomnessRegistry-predeploy-state.json"
TEST = ROOT / "contracts/test/RandomnessDeploymentBinding420.t.sol"
PROTO = ROOT / "contracts/src/apps/ProtocolRegistry.sol"
SERVICE_IDS = ROOT / "contracts/src/libraries/ServiceIds420.sol"

errors = []

def need(condition, message):
    if not condition:
        errors.append(message)

for p in [BUNDLE, NS, CANON, ARTIFACT, STATE, TEST, PROTO, SERVICE_IDS]:
    need(p.is_file(), f"missing required file: {p.relative_to(ROOT)}")

if errors:
    print(json.dumps({"pass": False, "errors": errors}, indent=2))
    raise SystemExit(2)

d = json.loads(BUNDLE.read_text())
ns = json.loads(NS.read_text())
canon = json.loads(CANON.read_text())
artifact = json.loads(ARTIFACT.read_text())
state = json.loads(STATE.read_text())
test = TEST.read_text()
proto = PROTO.read_text()
service_ids = SERVICE_IDS.read_text()

need(d.get("schema") == "420-randomness-audit-4-deployment-bundle-v1", "schema drift")
need(d.get("step") == "RANDOM-AUDIT-4", "step drift")
need(d.get("status") == "REPOSITORY_DEPLOYMENT_BUNDLE_READY_LIVE_TESTNET_DEFERRED", "bundle status drift")
need(d.get("repository_ready") is True, "repository bundle not marked ready")
need(d.get("live_qualified") is False, "fabricated live qualification")

policy = d.get("address_policy", {})
need(policy.get("randomness_registry") == "0x0000000000000000000000000000000000000428", "RandomnessRegistry address policy drift")
need(policy.get("randomness_router_status") == "REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS", "router address policy drift")
need(policy.get("new_frozen_predeploy_required") is False, "unexpected new frozen predeploy")
need(policy.get("create2_policy") == "NOT_ADOPTED_DO_NOT_INVENT", "CREATE2 policy drift")

deps = d.get("canonical_dependencies", {})
need(deps.get("governance_timelock", {}).get("address") == "0x0000000000000000000000000000000000000429", "GovernanceTimelock drift")
need(deps.get("protocol_registry", {}).get("address") == "0x0000000000000000000000000000000000000434", "ProtocolRegistry drift")
need(deps.get("protocol_registry", {}).get("component_api") == "registerComponent", "component publication API drift")
need(deps.get("protocol_registry", {}).get("publication_api") == "publishRegisteredService", "service publication API drift")
need(deps.get("randomness_registry", {}).get("address") == "0x0000000000000000000000000000000000000428", "bundle registry address drift")
need(deps.get("randomness_registry", {}).get("runtime_code_hash") == artifact.get("runtimeCodeHash"), "bundle/artifact runtime hash drift")
need(deps.get("randomness_registry", {}).get("runtime_code_hash") == state.get("runtimeCodeHash"), "bundle/state runtime hash drift")
need(deps.get("randomness_registry", {}).get("binding_api") == "bindRouter", "router binding API drift")

fixed = {x.get("name"): x.get("address") for x in ns.get("fixedAssignments", [])}
need(fixed.get("RandomnessRegistry") == "0x0000000000000000000000000000000000000428", "namespace RandomnessRegistry drift")
need(fixed.get("GovernanceTimelock") == "0x0000000000000000000000000000000000000429", "namespace GovernanceTimelock drift")
need(fixed.get("ProtocolRegistry") == "0x0000000000000000000000000000000000000434", "namespace ProtocolRegistry drift")
need("RandomnessRouter420" not in fixed and "RandomnessRouter" not in fixed, "RandomnessRouter became a fixed predeploy")

resolved = {x.get("id"): x for x in ns.get("registryResolved", [])}
router = resolved.get("randomness-router")
need(router is not None, "randomness-router missing from namespace")
if router:
    need(router.get("contract") == "RandomnessRouter420.sol", "randomness-router contract drift")
    need(router.get("status") == "REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS", "randomness-router namespace status drift")

canon_resolved = {x.get("id"): x for x in canon.get("registry_resolved", [])}
need(canon_resolved.get("randomness-router", {}).get("contract") == "RandomnessRouter420.sol", "canonical-address randomness-router drift")
need(not canon_resolved.get("randomness-router", {}).get("address"), "canonical-address file invented fixed router address")

identity = d.get("protocol_registry_identity", {})
need(identity.get("router_component_id_preimage") == "420/APP/420RANDOM/RANDOMNESS_ROUTER", "router component id drift")
need(identity.get("router_component_version") == {"major": 1, "minor": 0, "patch": 0}, "router component version drift")
need(identity.get("router_component_lifecycle") == "ACTIVE", "router component lifecycle drift")
need(identity.get("service_id_preimage") == "420/service/randomness/v1", "randomness service id drift")
need(identity.get("service_version") == 1 and identity.get("service_active") is True, "randomness service lifecycle drift")
need(identity.get("component_type") == "SERVICE", "randomness component type drift")
for key in ["metadata_hash_preimage", "manifest_hash_preimage", "interface_hash_preimage", "dependency_root_policy"]:
    need(bool(identity.get(key)), f"missing Registry commitment policy: {key}")

need('RANDOMNESS = keccak256("420/service/randomness/v1")' in service_ids, "ServiceIds420 randomness identity drift")
need("function registerComponent(" in proto, "ProtocolRegistry registerComponent API missing")
need("function publishRegisteredService(" in proto, "ProtocolRegistry publishRegisteredService API missing")

order = d.get("deployment_order", [])
need([x.get("order") for x in order] == list(range(1, 7)), "deployment order must be deterministic 1..6")
expected = [
    ("RandomnessRouteRegistry420", ["GovernanceTimelock"]),
    ("RandomnessProfileRegistry420", ["GovernanceTimelock"]),
    ("RandomnessRouter420", [
        "RandomnessProfileRegistry420",
        "RandomnessRouteRegistry420",
        "RandomnessRegistry@0x0000000000000000000000000000000000000428",
    ]),
]
for i, (name, args) in enumerate(expected):
    item = order[i] if i < len(order) else {}
    need(item.get("contract") == name, f"deployment contract drift at order {i + 1}")
    need(item.get("constructor") == args, f"constructor binding drift for {name}")

component = order[3] if len(order) > 3 else {}
need(component.get("contract") == "ProtocolRegistry", "component publication contract drift")
need(component.get("action") == "registerComponent", "component publication action drift")
need(component.get("component_id_preimage") == identity.get("router_component_id_preimage"), "component id publication drift")
need(component.get("implementation") == "RandomnessRouter420", "component implementation drift")
need(component.get("version") == {"major": 1, "minor": 0, "patch": 0}, "component version publication drift")
need(component.get("lifecycle") == "ACTIVE", "component lifecycle publication drift")

service = order[4] if len(order) > 4 else {}
need(service.get("contract") == "ProtocolRegistry", "service publication contract drift")
need(service.get("action") == "publishRegisteredService", "service publication action drift")
need(service.get("service_id_preimage") == identity.get("service_id_preimage"), "service id publication drift")
need(service.get("implementation") == "RandomnessRouter420", "service implementation drift")
need(service.get("version") == 1 and service.get("active") is True, "service version/lifecycle publication drift")
need(service.get("component_type") == "SERVICE", "service component type publication drift")
need(service.get("metadata_hash_preimage") == identity.get("metadata_hash_preimage"), "metadata commitment drift")
need(service.get("manifest_hash_preimage") == identity.get("manifest_hash_preimage"), "manifest commitment drift")
need(service.get("interface_hash_preimage") == identity.get("interface_hash_preimage"), "interface commitment drift")

bind = order[5] if len(order) > 5 else {}
need(bind.get("contract") == "RandomnessRegistry@0x0000000000000000000000000000000000000428", "bind target drift")
need(bind.get("action") == "bindRouter", "bind action drift")
need(bind.get("args") == ["RandomnessRouter420"], "bind router argument drift")
need(bind.get("one_time") is True, "bindRouter must remain one-time")
need(bind.get("governance_only") is True, "bindRouter must remain governance-only")
need("ProtocolRegistry" in bind.get("precondition", ""), "bindRouter must remain after Registry publication")

live = d.get("live_testnet_evidence", {})
need(live.get("required_in_step") == "RANDOM-AUDIT-5", "live qualification boundary drift")
for key in ["chain_id", "genesis_hash", "evidence_block", "evidence_block_hash", "route_registry_address", "profile_registry_address", "router_address", "bind_router_transaction"]:
    need(live.get(key) is None, f"fabricated live value present: {key}")
for key in ["deployment_transactions", "registry_transactions", "configured_routes", "configured_profiles"]:
    need(live.get(key) == [], f"fabricated live list present: {key}")
need(live.get("runtime_code_hashes") == {}, "fabricated live runtime hashes present")

required_test_fragments = [
    'keccak256("420/service/randomness/v1")',
    'keccak256("420/APP/420RANDOM/RANDOMNESS_ROUTER")',
    "new RandomnessRouteRegistry420(address(this))",
    "new RandomnessProfileRegistry420(address(this))",
    "new RandomnessRouter420(address(e.profiles), address(e.routes), address(e.randomnessRegistry))",
    "registerComponent(",
    "publishRegisteredService(",
    "bindRouter(address(e.router))",
    "RouterAlreadyBound.selector",
    "service.implementation == e.randomnessRegistry.randomnessRouter()",
]
for fragment in required_test_fragments:
    need(fragment in test, f"deployment binding test missing invariant: {fragment}")

out = {
    "pass": not errors,
    "step": "RANDOM-AUDIT-4",
    "bundle": str(BUNDLE.relative_to(ROOT)),
    "checks": {
        "frozen_registry": "0x0000000000000000000000000000000000000428",
        "governance_timelock": "0x0000000000000000000000000000000000000429",
        "protocol_registry": "0x0000000000000000000000000000000000000434",
        "router_policy": "REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS",
        "service_id_preimage": "420/service/randomness/v1",
        "deployment_steps": 6,
        "live_evidence_deferred_to": "RANDOM-AUDIT-5",
    },
    "errors": errors,
}
print(json.dumps(out, indent=2))
raise SystemExit(0 if not errors else 2)
