#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUNDLE = ROOT / "contracts/config/creative/420hz-deployment-smoke-bundle.json"
TEST = ROOT / "contracts/test/HzDeploymentSmoke420.t.sol"
GRAPH = ROOT / "contracts/src/creative/deployment/HzDeploymentGraph420.sol"
AUTH = ROOT / "contracts/src/creative/deployment/HzRegistryAuthorityPlan420.sol"
ECON = ROOT / "contracts/src/creative/economics/HzStreamEconomicsPlan420.sol"
DEPLOY = ROOT / "contracts/script/HzConsolidatedDeploy420.s.sol"

errors = []

def need(condition, message):
    if not condition:
        errors.append(message)

for p in [BUNDLE, TEST, GRAPH, AUTH, ECON, DEPLOY]:
    need(p.is_file(), f"missing required file: {p.relative_to(ROOT)}")

if errors:
    print(json.dumps({"pass": False, "errors": errors}, indent=2))
    raise SystemExit(2)

d = json.loads(BUNDLE.read_text())
test = TEST.read_text()
graph = GRAPH.read_text()
auth = AUTH.read_text()
econ = ECON.read_text()
deploy = DEPLOY.read_text()

need(d.get("schema") == "420.hz.deployment.smoke.bundle.v1", "schema drift")
need(d.get("roadmap_step") == "HZ-AUDIT-5", "roadmap step drift")
need(d.get("status") == "REPOSITORY_DEPLOYMENT_SMOKE_READY_LIVE_TESTNET_DEFERRED", "status drift")
need(d.get("repository_ready") is True, "repository readiness missing")
need(d.get("live_qualified") is False, "fabricated live qualification")
need(d.get("deployment_source") == "contracts/src/creative/deployment/HzDeploymentGraph420.sol", "deployment source drift")
need(d.get("deployment_script") == "contracts/script/HzConsolidatedDeploy420.s.sol", "deployment script drift")
need(d.get("smoke_test") == "contracts/test/HzDeploymentSmoke420.t.sol", "smoke test drift")

requirements = d.get("convergence_requirements", [])
for token in [
    "all 20 HZ-1 through HZ-4 contracts",
    "canonical GovernanceTimelock-only internal wiring",
    "exact 20-module CreativeProtocolRegistry420 inventory",
    "canonical external ProtocolRegistry component and service identities",
    "ORIGINAL and REMIX RevenueType.STREAM version-1 schedules",
    "CreatorProfile, Work and ORIGINAL Recording",
    "uninitialized deployment state fails closed",
]:
    need(any(token in x for x in requirements), f"missing convergence requirement: {token}")

milestone = d.get("level_2_milestone", {})
need(milestone.get("required") is True, "post-HZ-AUDIT-5 Level 2 milestone must be required")
need(milestone.get("repository_wide_level_3") is False, "Level 2 incorrectly promoted to Level 3")
need("deployment + authority/Registry + STREAM economics + smoke behavior" in milestone.get("boundary", ""), "Level 2 boundary drift")

for token in [
    "testDeploymentSmokeMaterializesInitializedHzGraph",
    "testDeploymentSmokeFailsClosedBeforeRequiredInitialization",
    "HzDeploymentGraph420.deploy(address(this), TREASURY)",
    "_wireGovernance(d)",
    "_registerModules(d)",
    "_registerStreamEconomics(d)",
    "_publishExternalRegistry(d, registry)",
    "_assertCodeMaterialized(d)",
    "createProfile(IdentityType.ARTIST_PROJECT",
    "registerWork(",
    "registerRecording(",
    "activateWork(workId)",
    "activateRecording(recordingId, LicenseId.wrap(0))",
    "resolveActive(HzRegistryAuthorityPlan420.serviceId())",
    "smoke/unwired-work-activated",
    "smoke/uninitialized-stream-schedule",
]:
    need(token in test, f"smoke test missing invariant: {token}")

need("struct Deployment" in graph and "StreamingRoyaltySettlement420 streamingRoyaltySettlement" in graph, "20-contract deployment graph drift")
need('SERVICE_ID = keccak256("420/service/hz/v1")' in auth, "HZ service identity drift")
need("function dependencyRoot(" in auth, "HZ dependency root policy missing")
need("ORIGINAL_WORK_BPS = 1_250" in econ and "REMIX_SOURCE_BPS = 1_500" in econ, "STREAM economics drift")
need('MANIFEST_SCHEMA = "420.hz.deployment.v1"' in deploy, "deployment manifest schema drift")
need('envAddress("HZ_GOVERNANCE_TIMELOCK")' in deploy, "deployment governance runtime input missing")
need('envAddress("HZ_PROTOCOL_TREASURY")' in deploy, "deployment treasury runtime input missing")

live = d.get("live_evidence", {})
need(live.get("required_in_step") == "HZ-AUDIT-7", "live evidence owner drift")
for key in ["network", "chain_id"]:
    need(live.get(key) is None, f"fabricated live value present: {key}")
for key in [
    "deployment_transactions",
    "governance_transactions",
    "registry_transactions",
    "schedule_registration_transactions",
    "smoke_transactions",
]:
    need(live.get(key) == [], f"fabricated live list present: {key}")
need(live.get("deployed_addresses") == {}, "fabricated deployed addresses present")
need(live.get("runtime_code_hashes") == {}, "fabricated runtime hashes present")

out = {
    "pass": not errors,
    "step": "HZ-AUDIT-5",
    "bundle": str(BUNDLE.relative_to(ROOT)),
    "checks": {
        "deployment_graph_contracts": 20,
        "authority_registry_convergence": True,
        "stream_economics_convergence": True,
        "local_smoke_asset_path": "CreatorProfile -> Work ACTIVE -> ORIGINAL Recording ACTIVE",
        "level_2_required": True,
        "live_evidence_deferred_to": "HZ-AUDIT-7",
    },
    "errors": errors,
}
print(json.dumps(out, indent=2))
raise SystemExit(0 if not errors else 2)
