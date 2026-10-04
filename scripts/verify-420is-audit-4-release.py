#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
M = ROOT / "contracts/config/interop/420is-audit-4-release-materialization.json"
NS = ROOT / "contracts/config/genesis-address-namespace.json"
TEST = ROOT / "contracts/test/InteropDeploymentBinding420.t.sol"
SERVICE_IDS = ROOT / "contracts/src/libraries/ServiceIds420.sol"
REGISTRY = ROOT / "contracts/src/apps/ProtocolRegistry.sol"

errors = []

def need(cond, msg):
    if not cond:
        errors.append(msg)

d = json.loads(M.read_text())
ns = json.loads(NS.read_text())
test = TEST.read_text()
service_ids = SERVICE_IDS.read_text()
registry_src = REGISTRY.read_text()

need(d.get("schema") == "420-is-audit-4-release-materialization-v1", "schema drift")
need(d.get("step") == "IS-AUDIT-4", "step drift")
need(d.get("live_qualified") is False, "fabricated live qualification")

ap = d.get("address_policy", {})
need(ap.get("interop_router_status") == "REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS", "router address policy drift")
need(ap.get("new_frozen_predeploy_required") is False, "unexpected frozen predeploy")
need(ap.get("create2_policy") == "NOT_ADOPTED_DO_NOT_INVENT", "CREATE2 policy drift")

deps = d.get("canonical_dependencies", {})
need(
    deps.get("governance_timelock", {}).get("address")
    == "0x0000000000000000000000000000000000000429",
    "GovernanceTimelock drift",
)
need(
    deps.get("protocol_registry", {}).get("address")
    == "0x0000000000000000000000000000000000000434",
    "ProtocolRegistry drift",
)
need(
    deps.get("protocol_registry", {}).get("publication_api") == "publishRegisteredService",
    "Registry publication API drift",
)

rr = {x.get("id"): x for x in ns.get("registryResolved", [])}.get("interop-router")
need(rr is not None, "interop-router missing from namespace")
if rr:
    need(rr.get("contract") == "InteropRouter420.sol", "interop-router contract drift")
    need(rr.get("status") == "REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS", "interop-router status drift")

fixed = {x.get("name"): x.get("address") for x in ns.get("fixedAssignments", [])}
need("InteropRouter420" not in fixed, "InteropRouter became fixed predeploy")
need(
    fixed.get("GovernanceTimelock") == "0x0000000000000000000000000000000000000429",
    "fixed GovernanceTimelock drift",
)
need(
    fixed.get("ProtocolRegistry") == "0x0000000000000000000000000000000000000434",
    "fixed ProtocolRegistry drift",
)

need(
    'bytes32 internal constant INTEROP = keccak256("420/service/420-is/v1");'
    in service_ids,
    "canonical 420-IS service id missing",
)
need("function publishRegisteredService(" in registry_src, "ProtocolRegistry publication API missing")

order = d.get("deployment_order", [])
need([x.get("order") for x in order] == [1, 2, 3, 4, 5], "deployment order must be deterministic 1..5")
expected = [
    ("InteropProviderRegistry420", ["GovernanceTimelock"]),
    ("InteropNamespaceRegistry420", ["GovernanceTimelock", "InteropProviderRegistry420"]),
    ("InteropCheckpointRegistry420", ["InteropProviderRegistry420"]),
    (
        "InteropRouter420",
        [
            "InteropProviderRegistry420",
            "InteropNamespaceRegistry420",
            "InteropCheckpointRegistry420",
        ],
    ),
]
for i, (name, args) in enumerate(expected):
    item = order[i] if i < len(order) else {}
    need(item.get("contract") == name, f"deployment contract drift at {i + 1}")
    need(item.get("constructor") == args, f"constructor binding drift for {name}")

pub = order[4] if len(order) > 4 else {}
need(
    pub.get("contract") == "ProtocolRegistry"
    and pub.get("action") == "publishRegisteredService",
    "Registry publication path drift",
)
need(pub.get("service_id_preimage") == "420/service/420-is/v1", "420-IS service id drift")
need(pub.get("implementation") == "InteropRouter420", "420-IS service implementation drift")
need(pub.get("component_id_preimage") == "420/IS/COMPONENT/V1", "420-IS component id drift")

bootstrap = d.get("bootstrap_policy", {})
need(bootstrap.get("initial_live_providers") == [], "invented live provider bootstrap")
need(bootstrap.get("initial_live_namespaces") == [], "invented live namespace bootstrap")

for token in [
    "new InteropProviderRegistry420(address(this))",
    "new InteropNamespaceRegistry420(address(this), address(e.providers))",
    "new InteropCheckpointRegistry420(address(e.providers))",
    "new InteropRouter420(address(e.providers), address(e.namespaces), address(e.checkpoints))",
    "registerComponent(",
    "InteropIds420.COMPONENT_420_IS",
    "publishRegisteredService(",
    "INTEROP_SERVICE_ID",
    "deprecateService(INTEROP_SERVICE_ID)",
]:
    need(token in test, f"deployment binding test missing token: {token}")

expected_paths = [
    "contracts/out/InteropProviderRegistry420.sol/InteropProviderRegistry420.json",
    "contracts/out/InteropNamespaceRegistry420.sol/InteropNamespaceRegistry420.json",
    "contracts/out/InteropCheckpointRegistry420.sol/InteropCheckpointRegistry420.json",
    "contracts/out/InteropRouter420.sol/InteropRouter420.json",
]
need(
    d.get("artifact_identity", {}).get("artifact_paths") == expected_paths,
    "artifact path inventory drift",
)

live = d.get("live_testnet_evidence", {})
need(live.get("required_in_step") == "IS-AUDIT-5", "live evidence owner drift")
for key in ["chain_id", "genesis_hash", "evidence_block", "evidence_block_hash"]:
    need(live.get(key) is None, f"fabricated live {key}")
need(live.get("deployed_addresses") == {}, "fabricated live addresses")
need(
    live.get("deployment_transactions") == [] and live.get("registry_transactions") == [],
    "fabricated live transactions",
)
need(live.get("runtime_code_hashes") == {}, "fabricated live runtime hashes")
need(live.get("constructor_binding_receipts") == [], "fabricated live constructor receipts")

if errors:
    print(json.dumps({"pass": False, "errors": errors}, indent=2))
    raise SystemExit(1)

print(
    json.dumps(
        {
            "pass": True,
            "step": "IS-AUDIT-4",
            "repositoryReadyRecorded": d.get("repository_ready"),
            "deploymentOrder": [
                x.get("contract") + (":" + x.get("action") if x.get("action") else "")
                for x in order
            ],
            "interopRouterNamespace": rr,
            "serviceIdPreimage": "420/service/420-is/v1",
            "liveQualified": False,
            "liveEvidenceOwner": "IS-AUDIT-5",
        },
        indent=2,
    )
)
