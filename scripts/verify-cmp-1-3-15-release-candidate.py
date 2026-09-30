#!/usr/bin/env python3
import argparse
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "contracts/config/compute-market/cmp-1.3.15-worker-release-candidate.json"
HISTORICAL = ROOT / "contracts/config/compute-market/cmp-1.3.7-worker-deployment-evidence.json"

REQUIRED_ROLES = [
    "ComputeJobRegistry420",
    "ComputeJobWorkerSnapshotEvidence420",
    "ComputeAuthorization420",
    "ComputeWorkerRegistry420",
    "ComputeWorkerCapabilityProfile420",
    "ComputeWorkerAttestedEligibility420",
    "ComputeWorkerCapabilityEligibility420",
    "ComputeWorkerAttestation420",
    "ComputeWorkerTrust420",
    "ComputeWorkerStake420",
    "ComputeWorkerCapacityReservation420",
    "ComputeWorkerReadModel420",
    "ComputeWorkerReleaseCandidateWiring420",
]

REQUIRED_BINDINGS = [
    "jobs_worker_evidence", "jobs_match_evidence",
    "worker_evidence_authorization", "worker_registry_authorization",
    "worker_evidence_workers", "profiles_workers",
    "attested_eligibility_workers", "attested_eligibility_attestation",
    "capability_eligibility_profiles", "capability_eligibility_attested_eligibility",
    "worker_evidence_attestation", "worker_evidence_trust", "worker_evidence_stake",
    "worker_evidence_capacity", "capacity_controller",
    "read_model_workers", "read_model_profiles", "read_model_capability_eligibility",
    "read_model_attestation", "read_model_trust", "read_model_stake",
    "read_model_capacity", "read_model_snapshots",
]

def fail(msg):
    print(f"FAIL: {msg}", file=sys.stderr)
    raise SystemExit(1)

def is_hex(value, nbytes):
    if not isinstance(value, str) or not value.startswith("0x") or len(value) != 2 + nbytes * 2:
        return False
    try:
        int(value[2:], 16)
        return True
    except ValueError:
        return False

def load():
    if not HISTORICAL.is_file():
        fail("historical CMP-1.3.7 deployment evidence must remain present")
    data = json.loads(EVIDENCE.read_text())
    if data.get("schema") != "420Integrated.ComputeMarket.CMP-1.3.15.ReleaseCandidate.v1":
        fail("unexpected release-candidate schema")
    return data

def repository_ready(data, allow_live=False):
    if data.get("repository_ready") is not True:
        fail("repository_ready must be true")
    if not allow_live:
        if data.get("live_qualified") is not False:
            fail("repository package must not claim live qualification")
        if data.get("status") != "REPOSITORY_READY_LIVE_BLOCKED":
            fail("release candidate must remain truthfully live-blocked")

    registry = data.get("protocol_registry", {})
    if registry.get("address") != "0x0000000000000000000000000000000000000434":
        fail("ProtocolRegistry differs from frozen address authority")
    if registry.get("publication_api") != "publishRegisteredService":
        fail("non-canonical ProtocolRegistry publication API")
    if not allow_live and registry.get("publication_complete") is not False:
        fail("repository evidence must not fabricate live publication")

    rc = data.get("release_candidate", {})
    if rc.get("wiring_contract") != "contracts/src/compute/ComputeWorkerReleaseCandidateWiring420.sol":
        fail("unexpected release-candidate wiring contract")
    components = rc.get("components", [])
    roles = [x.get("role") for x in components]
    if roles != REQUIRED_ROLES:
        fail("release-candidate component graph is incomplete or reordered")
    for item in components:
        source = item.get("source")
        if not isinstance(source, str) or not (ROOT / source).is_file():
            fail(f"missing source for {item.get('role')}: {source}")
        if not allow_live:
            for field in ("address", "deployment_tx", "deployment_block", "runtime_code_hash"):
                if item.get(field) is not None:
                    fail(f"{item['role']}: {field} must remain null until real live evidence exists")

    bindings = data.get("bindings", {})
    if list(bindings.keys()) != REQUIRED_BINDINGS:
        fail("binding inventory is incomplete or reordered")
    if not allow_live and any(bindings[k] is not None for k in REQUIRED_BINDINGS):
        fail("live binding evidence must remain null before canonical deployment")

    deps = data.get("dependency_reconciliation", {})
    if deps.get("cmp_1_5_compute_stake_required_for_stake_required_live_admission") is not True:
        fail("CMP-1.5 dependency not preserved")
    if not allow_live:
        if deps.get("cmp_1_5_compute_stake_live_source_qualified") is not False:
            fail("CMP-1.5 live source must remain blocked")
        if deps.get("public_testnet_available") is not False:
            fail("public testnet must remain blocked absent evidence")
    if deps.get("no_fixed_genesis_predeploy_allocated") is not True:
        fail("release candidate must not allocate a fixed Genesis predeploy")
    if deps.get("discovery_path") != "ProtocolRegistry":
        fail("release candidate discovery must remain ProtocolRegistry-based")

    gates = data.get("release_gates", {})
    for step in (
        "cmp_1_3_8_authorization", "cmp_1_3_9_execution_key", "cmp_1_3_10_capacity",
        "cmp_1_3_11_provenance", "cmp_1_3_12_attempt_lifecycle",
        "cmp_1_3_13_read_model", "cmp_1_3_14_invariant_qualification"
    ):
        if gates.get(step) is not True:
            fail(f"missing prerequisite release gate: {step}")
    if not allow_live:
        if gates.get("cmp_1_5_compute_stake_live_source") is not False:
            fail("CMP-1.5 live release gate must remain false")
        if gates.get("public_testnet_live") is not False:
            fail("public-testnet live release gate must remain false")

    print("CMP-1.3.15 repository release-candidate package: READY")

def live_ready(data):
    repository_ready(data, allow_live=True)
    if data.get("live_qualified") is not True:
        fail("live_qualified is false")
    if data.get("status") != "LIVE_QUALIFIED":
        fail("live status is not LIVE_QUALIFIED")

    network = data.get("network", {})
    if not isinstance(network.get("chain_id"), int) or network["chain_id"] <= 0:
        fail("missing live chain id")
    if not network.get("network_name"):
        fail("missing live network name")
    if not isinstance(network.get("rpc_evidence_block"), int):
        fail("missing live evidence block")
    if not is_hex(network.get("rpc_evidence_block_hash"), 32):
        fail("missing/invalid live evidence block hash")

    for item in data["release_candidate"]["components"]:
        if not is_hex(item.get("address"), 20):
            fail(f"{item['role']}: missing/invalid address")
        if not is_hex(item.get("deployment_tx"), 32):
            fail(f"{item['role']}: missing/invalid deployment transaction")
        if not isinstance(item.get("deployment_block"), int):
            fail(f"{item['role']}: missing deployment block")
        if not is_hex(item.get("runtime_code_hash"), 32):
            fail(f"{item['role']}: missing/invalid runtime code hash")

    if not is_hex(data["release_candidate"].get("graph_hash"), 32):
        fail("missing release-candidate graph hash")
    for key, value in data["bindings"].items():
        if not is_hex(value, 20):
            fail(f"missing/invalid live binding: {key}")

    if data["dependency_reconciliation"].get("cmp_1_5_compute_stake_live_source_qualified") is not True:
        fail("CMP-1.5 live compute-stake source is not qualified")
    if data["dependency_reconciliation"].get("public_testnet_available") is not True:
        fail("canonical public testnet is not available")
    if data["protocol_registry"].get("publication_complete") is not True:
        fail("ProtocolRegistry publication is incomplete")
    if not data["protocol_registry"].get("service_entries"):
        fail("ProtocolRegistry service publication evidence is missing")

    print("CMP-1.3.15 live release-candidate qualification: PASS")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repository-ready", action="store_true")
    args = ap.parse_args()
    data = load()
    if args.repository_ready:
        repository_ready(data)
    else:
        live_ready(data)

if __name__ == "__main__":
    main()
