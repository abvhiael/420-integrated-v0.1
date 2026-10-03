#!/usr/bin/env python3
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
QUAL = ROOT / "contracts/config/oracle-audit-7-testnet-qualification.json"
LAUNCH = ROOT / "testnet/config/launch.json"
ENDPOINTS = ROOT / "testnet/services/endpoints.json"
OFFICIAL = ROOT / "developer-hub/manifests/testnet.json"
DEPLOYMENT = ROOT / "contracts/config/420oracle-genesis.json"
SERVICE_IDS = ROOT / "contracts/src/libraries/ServiceIds420.sol"
PROTOCOL_REGISTRY = ROOT / "contracts/src/apps/ProtocolRegistry.sol"
RUNTIME_IFACE = ROOT / "contracts/src/interfaces/IOracle420.sol"
PROVIDER = ROOT / "contracts/src/oracle/OracleProviderRegistry420.sol"
FEED = ROOT / "contracts/src/oracle/OracleFeedRegistry420.sol"
RISK = ROOT / "contracts/src/oracle/OracleRiskPolicy420.sol"
ROUTER = ROOT / "contracts/src/oracle/OracleRouter420.sol"
AUTOMATION = ROOT / "420-automation/src/oracle.ts"
SWAP_ADAPTER = ROOT / "contracts/src/oracle/TWAPOracleSourceAdapter420.sol"
EVIDENCE = ROOT / "docs/audit/ORACLE-AUDIT-7-LIVE-TESTNET-EVIDENCE.json"
LAUNCH_AUTH = ROOT / "docs/STEP-5-TESTNET-LAUNCH.md"
PUBLIC_AUTH = ROOT / "docs/STEP-5.4-PUBLIC-TESTNET.md"

errors = []

def fail(msg):
    errors.append(msg)

def load(path):
    try:
        return json.loads(path.read_text())
    except Exception as exc:
        fail(f"{path.relative_to(ROOT)} invalid JSON: {exc}")
        return {}

for p in [
    QUAL, LAUNCH, ENDPOINTS, DEPLOYMENT, SERVICE_IDS, PROTOCOL_REGISTRY,
    RUNTIME_IFACE, PROVIDER, FEED, RISK, ROUTER, AUTOMATION, SWAP_ADAPTER,
    LAUNCH_AUTH, PUBLIC_AUTH
]:
    if not p.exists():
        fail(f"missing ORACLE-AUDIT-7 prerequisite: {p.relative_to(ROOT)}")

q = load(QUAL)
if q.get("schema") != "420-oracle-audit-7-testnet-qualification-v1":
    fail("qualification schema drift")
if q.get("phase") != "ORACLE-AUDIT-7":
    fail("phase drift")
if q.get("repository_ready") is not True:
    fail("repository readiness not declared")
if q.get("live_qualified") is not False and not EVIDENCE.exists():
    fail("live qualification claimed without retained evidence")

required_ids = {
    "NETWORK_IDENTITY",
    "DEPLOYMENT_BINDINGS",
    "REGISTRY_DISCOVERY",
    "GOVERNANCE_AUTHORITY",
    "PROVIDER_PROVISIONING",
    "NUMERIC_QUORUM",
    "RESULT_QUORUM",
    "FRESHNESS_FAILURES",
    "REPLAY_ORDERING",
    "EPOCH_INVALIDATION",
    "RISK_CONTROLS",
    "SWAP_ADAPTER",
    "AUTOMATION_CONSUMER",
    "RESTART_REORG_RECONCILIATION",
}
checks = q.get("live_checks", [])
ids = {item.get("id") for item in checks}
if ids != required_ids:
    fail(f"live check inventory drift: {sorted(ids)}")
for item in checks:
    if item.get("required") is not True:
        fail(f"{item.get('id')} not required")
    if not item.get("requirement"):
        fail(f"{item.get('id')} requirement missing")

deployment = load(DEPLOYMENT)
if deployment.get("status") != "REPOSITORY_READY_TESTNET_DEPLOYMENT_REQUIRED":
    fail("Oracle deployment manifest status drift")
discovery = deployment.get("serviceDiscovery", {})
if discovery.get("fixedAddress") is not None:
    fail("Oracle router incorrectly assigned a fixed address")
if discovery.get("addressPolicy") != "REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS":
    fail("Oracle address policy drift")
if discovery.get("registry") != "ProtocolRegistry":
    fail("Oracle registry discovery source drift")
if deployment.get("serviceId") != "420/service/oracle/v1":
    fail("Oracle service ID drift")

service_ids = SERVICE_IDS.read_text() if SERVICE_IDS.exists() else ""
runtime_iface = RUNTIME_IFACE.read_text() if RUNTIME_IFACE.exists() else ""
provider = PROVIDER.read_text() if PROVIDER.exists() else ""
feed = FEED.read_text() if FEED.exists() else ""
risk = RISK.read_text() if RISK.exists() else ""
router = ROUTER.read_text() if ROUTER.exists() else ""
automation = AUTOMATION.read_text() if AUTOMATION.exists() else ""
swap_adapter = SWAP_ADAPTER.read_text() if SWAP_ADAPTER.exists() else ""

for marker in ['keccak256("420/service/oracle/v1")']:
    if marker not in service_ids:
        fail(f"service ID source missing {marker}")
for marker in ["readNumeric", "readResult", "confidenceBps"]:
    if marker not in runtime_iface:
        fail(f"runtime interface missing {marker}")
for marker in ["setProvider", "providerEpoch", "isAuthorizedOperator"]:
    if marker not in provider:
        fail(f"provider registry missing {marker}")
for marker in ["MAX_SOURCES = 16", "setFeed", "setSource", "feedRevision", "sourceEpoch"]:
    if marker not in feed:
        fail(f"feed registry missing {marker}")
for marker in ["setPolicy", "minConfidenceBps", "maxDeviationBps", "halted"]:
    if marker not in risk:
        fail(f"risk policy missing {marker}")
for marker in [
    "ObservationReplay",
    "ObservationNotNewer",
    "InsufficientFreshSources",
    "AmbiguousQuorum",
    "CircuitBreakerActive",
    "ConfidenceTooLow",
    "ExcessiveDeviation",
]:
    if marker not in router:
        fail(f"router missing fail-closed marker {marker}")
for marker in ["420OracleRouter", "providerNeutral: true", "AUT8_CHAIN_ID_MISMATCH", "AUT8_ROUTER_MISMATCH"]:
    if marker not in automation:
        fail(f"Automation consumer missing {marker}")
for marker in ["IOracleSourceAdapter420", "readObservation", "HEALTHY"]:
    if marker not in swap_adapter:
        fail(f"Swap adapter missing {marker}")

launch = load(LAUNCH)
endpoints = load(ENDPOINTS)
official_exists = OFFICIAL.exists()

if official_exists:
    manifest = load(OFFICIAL)
    if manifest.get("network", {}).get("environment") != "testnet":
        fail("official testnet manifest is not testnet")
    rpc = manifest.get("rpc", {}).get("http", [])
    if not rpc or any(
        not isinstance(v, str) or not v.startswith("https://") or "REPLACE" in v or "PLACEHOLDER" in v
        for v in rpc
    ):
        fail("official testnet RPC absent/insecure/placeholder")
    if not EVIDENCE.exists():
        fail("official testnet manifest exists but ORACLE-AUDIT-7 live evidence is absent")
    else:
        ev = load(EVIDENCE)
        if ev.get("phase") != "ORACLE-AUDIT-7" or ev.get("status") != "PASS":
            fail("retained ORACLE-AUDIT-7 evidence is not PASS")
        ev_ids = {x.get("id") for x in ev.get("live_checks", []) if x.get("status") == "PASS"}
        if ev_ids != required_ids:
            fail("not every required Oracle live check is retained as PASS")
else:
    if EVIDENCE.exists():
        fail("live Oracle evidence exists without official testnet manifest")
    if q.get("status") != "BLOCKED_OFFICIAL_TESTNET_NOT_LIVE":
        fail("qualification state does not fail closed while official testnet is absent")
    if q.get("live_qualified") is not False:
        fail("live qualification overclaimed while official testnet is absent")

    exact = q.get("exact_release_candidate", {})
    for key in ("implementation_sha", "chain_id", "genesis_hash", "evidence_block", "evidence_block_hash"):
        if exact.get(key) is not None:
            fail(f"fabricated live release evidence: {key}")

    dep = q.get("deployment_evidence", {})
    nullable = (
        "governance_timelock_address",
        "protocol_registry_address",
        "protocol_registry_code_hash",
        "provider_registry_address",
        "provider_registry_code_hash",
        "feed_registry_address",
        "feed_registry_code_hash",
        "risk_policy_address",
        "risk_policy_code_hash",
        "oracle_router_address",
        "oracle_router_code_hash",
        "oracle_router_protocol_version",
        "protocol_registry_service_version",
        "protocol_registry_service_active",
    )
    for key in nullable:
        if dep.get(key) is not None:
            fail(f"fabricated deployed evidence: {key}")
    if dep.get("constructor_bindings_verified") is not False:
        fail("fabricated constructor-binding verification")
    for key in ("registry_transactions", "governance_configuration_transactions", "provider_submission_transactions"):
        if dep.get(key) != []:
            fail(f"fabricated live transactions: {key}")

    providers = q.get("provider_evidence", {})
    if providers.get("minimum_independent_active_providers") != 2:
        fail("minimum live provider-diversity requirement drift")
    for key in ("active_provider_ids", "provider_operator_addresses", "provider_metadata_hashes"):
        if providers.get(key) != []:
            fail(f"fabricated provider evidence: {key}")
    if providers.get("operator_key_custody_reviewed") is not False:
        fail("fabricated provider key-custody review")

    feed_ev = q.get("feed_evidence", {})
    for key, value in feed_ev.items():
        if key == "active_source_ids":
            if value != []:
                fail("fabricated live source IDs")
        elif value is not None:
            fail(f"fabricated live feed evidence: {key}")

    for item in checks:
        if item.get("status") != "PENDING_LIVE_TESTNET" or item.get("evidence") is not None:
            fail(f"{item.get('id')} overclaims live evidence")

    wf = q.get("live_workflow_runs", {})
    if any(v is not None for v in wf.values()):
        fail("fabricated live workflow run IDs")

    if launch.get("chain_id", {}).get("status") == "FROZEN":
        fail("launch config claims frozen chain ID while official testnet manifest is absent")
    if "PUBLIC TESTNET NOT YET AUTHORIZED" not in LAUNCH_AUTH.read_text():
        fail("testnet launch authority no longer states public testnet is unauthorized")
    if "TESTNET NOT DECLARED LIVE" not in PUBLIC_AUTH.read_text():
        fail("public-testnet authority no longer states testnet is not live")
    raw = json.dumps(endpoints)
    if "PLACEHOLDER" not in raw and "REPLACE_WITH_" not in raw:
        fail("public testnet endpoints appear resolved while official manifest is absent")

if errors:
    for e in errors:
        print("ERROR:", e, file=sys.stderr)
    raise SystemExit(1)

if official_exists:
    print("ORACLE_AUDIT_7_READINESS=LIVE_EVIDENCE_RETAINED")
    print("liveQualificationComplete=true")
else:
    print("ORACLE_AUDIT_7_READINESS=BLOCKED_OFFICIAL_TESTNET_NOT_LIVE")
    print("liveQualificationComplete=false")
print("requiredLiveChecks=" + str(len(required_ids)))
print("retainedEvidence=docs/audit/ORACLE-AUDIT-7-LIVE-TESTNET-EVIDENCE.json")
