#!/usr/bin/env python3
import argparse
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "contracts/config/compute-market/cmp-1.3.7-worker-deployment-evidence.json"

REQUIRED_SOURCES = [
    "contracts/src/compute/ComputeWorkerRegistry420.sol",
    "contracts/src/compute/ComputeWorkerAttestation420.sol",
    "contracts/src/compute/ComputeWorkerCapabilityProfile420.sol",
    "contracts/src/compute/ComputeWorkerTrust420.sol",
    "contracts/src/compute/ComputeWorkerStake420.sol",
    "contracts/src/compute/ComputeJobWorkerSnapshotEvidence420.sol",
    "contracts/src/compute/ComputeWorkerCanonicalWiring420.sol",
]

REQUIRED_COMPONENTS = [
    "ComputeJobRegistry420",
    "ComputeJobWorkerSnapshotEvidence420",
    "ComputeWorkerRegistry420",
    "ComputeWorkerAttestation420",
    "ComputeWorkerTrust420",
    "ComputeWorkerStake420",
    "ComputeWorkerCanonicalWiring420",
]

def fail(msg):
    print(f"FAIL: {msg}", file=sys.stderr)
    raise SystemExit(1)

def nonempty_hex(value, bytes_len=None):
    if not isinstance(value, str) or not value.startswith("0x"):
        return False
    body = value[2:]
    if bytes_len is not None and len(body) != bytes_len * 2:
        return False
    try:
        int(body, 16)
        return True
    except ValueError:
        return False

def repository_ready(data):
    if data.get("schema") != "420Integrated.ComputeMarket.CMP-1.3.7.DeploymentEvidence.v1":
        fail("unexpected evidence schema")
    if data.get("repository_ready") is not True:
        fail("repository_ready must be true")
    for rel in REQUIRED_SOURCES:
        if not (ROOT / rel).is_file():
            fail(f"missing source: {rel}")
    components = data.get("components", {})
    for name in REQUIRED_COMPONENTS:
        if name not in components:
            fail(f"missing component evidence slot: {name}")
    reg = data.get("protocol_registry", {})
    if reg.get("address") != "0x0000000000000000000000000000000000000434":
        fail("ProtocolRegistry address differs from frozen authority")
    print("CMP-1.3.7 repository deployment package: READY")

def live_ready(data):
    repository_ready(data)
    if data.get("live_qualified") is not True:
        fail("live_qualified is false")
    network = data.get("network", {})
    if not isinstance(network.get("chain_id"), int) or network["chain_id"] <= 0:
        fail("missing live chain_id")
    if not network.get("network_name"):
        fail("missing live network_name")
    if not isinstance(network.get("rpc_evidence_block"), int):
        fail("missing live evidence block")
    if not nonempty_hex(network.get("rpc_evidence_block_hash"), 32):
        fail("missing/invalid live evidence block hash")

    for name, record in data["components"].items():
        if not nonempty_hex(record.get("address"), 20):
            fail(f"{name}: missing/invalid deployed address")
        if not nonempty_hex(record.get("deployment_tx"), 32):
            fail(f"{name}: missing/invalid deployment tx")
        if not isinstance(record.get("deployment_block"), int):
            fail(f"{name}: missing deployment block")
        if not nonempty_hex(record.get("runtime_code_hash"), 32):
            fail(f"{name}: missing/invalid runtime code hash")

    bindings = data.get("bindings", {})
    if not nonempty_hex(bindings.get("graph_hash"), 32):
        fail("missing graph_hash")
    for key in (
        "jobs_worker_evidence", "jobs_match_evidence", "worker_evidence_workers",
        "worker_evidence_attestation", "worker_evidence_trust", "worker_evidence_stake",
        "worker_evidence_authorization", "worker_evidence_matches"
    ):
        if not nonempty_hex(bindings.get(key), 20):
            fail(f"missing/invalid binding {key}")

    registry = data.get("protocol_registry", {})
    if registry.get("publication_complete") is not True:
        fail("ProtocolRegistry publication not complete")
    if not nonempty_hex(data.get("governance", {}).get("publication_transaction"), 32):
        fail("missing governance publication transaction")
    if not registry.get("service_entries"):
        fail("no ProtocolRegistry service publication evidence")

    gates = data.get("release_gates", {})
    if gates.get("public_testnet_live") is not True:
        fail("public_testnet_live is false")
    if gates.get("cmp_1_5_compute_stake_live_source") is not True:
        fail("CMP-1.5 live compute-stake source is not qualified")

    print("CMP-1.3.7 live deployment qualification: PASS")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repository-ready", action="store_true")
    args = ap.parse_args()
    data = json.loads(EVIDENCE.read_text())
    if args.repository_ready:
        repository_ready(data)
    else:
        live_ready(data)

if __name__ == "__main__":
    main()
