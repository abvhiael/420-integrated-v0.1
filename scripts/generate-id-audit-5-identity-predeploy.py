#!/usr/bin/env python3
"""Generate and verify ID-AUDIT-5 Identity420 frozen predeploy materialization.

Consumes the retained ID-AUDIT-4 build artifact. The compiler-emitted deployed
bytecode template is patched at every immutable reference with the frozen
GovernanceTimelock address. Identity420's constructor performs no mutable
storage writes; profile/issuer/credential mappings begin empty.

The ID-AUDIT-4 build artifact remains unchanged. Final materialized runtime,
runtime code hash and explicit Genesis storage state are retained in
Identity420-predeploy-state.json and wired into the canonical predeploy and
deployment manifests.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
CONTRACT = "Identity420"
SOURCE = ROOT / "contracts/src/apps/Identity420.sol"
ARTIFACT = ROOT / "contracts/artifacts/Identity420.json"
OUTPUT_STATE = ROOT / "contracts/config/predeploy/Identity420-predeploy-state.json"
PREDEPLOY_PLAN = ROOT / "contracts/config/predeploy/predeploy-plan.json"
DEPLOYMENT_MANIFEST = ROOT / "contracts/config/deployment-manifest.json"
STORAGE_INIT = ROOT / "contracts/config/predeploy/storage-init.json"
NAMESPACE = ROOT / "contracts/config/genesis-address-namespace.json"
FOUNDRY_CONFIG = ROOT / "contracts/foundry.toml"
TOOLCHAIN = ROOT / "contracts/config/security/toolchain.json"

IDENTITY_ADDRESS = "0x0000000000000000000000000000000000000436"
GOVERNANCE_TIMELOCK = "0x0000000000000000000000000000000000000429"
ARTIFACT_PATH = "contracts/artifacts/Identity420.json"
STATE_PATH = "contracts/config/predeploy/Identity420-predeploy-state.json"


def fail(message: str) -> None:
    raise ValueError(message)


def run(*args: str) -> str:
    return subprocess.check_output(args, cwd=ROOT, text=True).strip()


def git_blob_sha(path: pathlib.Path) -> str:
    return run("git", "hash-object", str(path.relative_to(ROOT)))


def cast_keccak(hex_data: str) -> str:
    return run("cast", "keccak", hex_data).lower()


def normalize_hex(value: object) -> str:
    if not isinstance(value, str) or not value.startswith("0x"):
        fail("expected 0x-prefixed hex")
    body = value[2:]
    if len(body) % 2 or any(c not in "0123456789abcdefABCDEF" for c in body):
        fail("invalid hex payload")
    return "0x" + body.lower()


def patch_immutable_runtime(artifact: dict) -> tuple[str, list[dict], dict]:
    runtime = normalize_hex(artifact.get("deployedBytecodeTemplate"))
    refs = artifact.get("immutableReferences")
    if not isinstance(refs, dict) or not refs:
        fail("Identity420 artifact has no compiler immutableReferences")
    if len(refs) != 1:
        fail("unexpected Identity420 immutable identifier count: %d" % len(refs))

    encoded = bytes.fromhex("00" * 12 + GOVERNANCE_TIMELOCK[2:])
    code = bytearray.fromhex(runtime[2:])
    patched: list[dict] = []
    for immutable_id, locations in refs.items():
        if not isinstance(locations, list) or not locations:
            fail("empty immutable reference list")
        for location in locations:
            start = location.get("start")
            length = location.get("length")
            if not isinstance(start, int) or not isinstance(length, int):
                fail("malformed immutable reference")
            if length != 32:
                fail("unexpected immutable width %r" % length)
            if start < 0 or start + length > len(code):
                fail("immutable reference outside deployed bytecode")
            code[start:start + length] = encoded
            patched.append({
                "immutableId": str(immutable_id),
                "start": start,
                "length": length,
                "value": GOVERNANCE_TIMELOCK,
            })

    if len(patched) != artifact.get("immutableReferenceCount"):
        fail("materialized immutable count disagrees with ID-AUDIT-4 artifact")
    return "0x" + code.hex(), patched, refs


def validate_storage_layout(artifact: dict) -> dict:
    layout = artifact.get("storageLayout")
    if not isinstance(layout, dict):
        fail("Identity420 artifact missing compiler storageLayout")
    storage = layout.get("storage")
    if not isinstance(storage, list):
        fail("storageLayout.storage missing")

    labels = {entry.get("label") for entry in storage if isinstance(entry, dict)}
    if "governanceTimelock" in labels:
        fail("governanceTimelock unexpectedly occupies mutable storage")

    expected_state_labels = {"profiles", "issuers", "credentials", "_credentialCandidates"}
    missing = expected_state_labels - labels
    if missing:
        fail("Identity420 storage layout missing canonical state labels: " + ", ".join(sorted(missing)))
    return layout


def validate_authority(artifact: dict) -> None:
    if artifact.get("contractName") != CONTRACT:
        fail("ID-AUDIT-4 artifact contractName drift")
    if artifact.get("canonicalAddress", "").lower() != IDENTITY_ADDRESS:
        fail("ID-AUDIT-4 artifact canonical address drift")
    if artifact.get("source") != "contracts/src/apps/Identity420.sol":
        fail("ID-AUDIT-4 artifact source drift")
    if artifact.get("sourceBlobSha1") != git_blob_sha(SOURCE):
        fail("ID-AUDIT-4 source blob no longer matches Identity420 source")

    compiler = artifact.get("compiler", {})
    expected = {
        "solidity": "0.8.24",
        "evmVersion": "cancun",
        "optimizer": True,
        "optimizerRuns": 200,
        "viaIR": True,
    }
    for key, value in expected.items():
        if compiler.get(key) != value:
            fail("ID-AUDIT-4 compiler provenance drift for " + key)

    storage_init = json.loads(STORAGE_INIT.read_text(encoding="utf-8"))
    if storage_init.get("governance_timelock", "").lower() != GOVERNANCE_TIMELOCK:
        fail("storage-init GovernanceTimelock drift")
    entry = storage_init.get("entries", {}).get(CONTRACT)
    if entry != {"constructor": ["governance_timelock"]}:
        fail("Identity420 storage-init constructor authority drift")

    namespace = json.loads(NAMESPACE.read_text(encoding="utf-8"))
    fixed = namespace.get("fixedAssignments", [])
    owners = [x for x in fixed if str(x.get("address", "")).lower() == IDENTITY_ADDRESS]
    if len(owners) != 1 or owners[0].get("name") != CONTRACT:
        fail("frozen namespace does not uniquely assign 0x0436 to Identity420")
    duplicate_name = [x for x in fixed if x.get("name") == CONTRACT]
    if len(duplicate_name) != 1 or duplicate_name[0].get("address", "").lower() != IDENTITY_ADDRESS:
        fail("Identity420 frozen namespace assignment drift")


def build_state(artifact: dict) -> dict:
    validate_authority(artifact)
    runtime, patched, refs = patch_immutable_runtime(artifact)
    validate_storage_layout(artifact)

    runtime_hash = cast_keccak(runtime)
    empty_root = cast_keccak("0x80")
    if len(runtime_hash) != 66 or len(empty_root) != 66:
        fail("malformed keccak output")

    return {
        "schema": "420-identity-predeploy-state-v1",
        "status": "ID_AUDIT_5_FINAL_PREDEPLOY_STATE",
        "contractName": CONTRACT,
        "address": IDENTITY_ADDRESS,
        "source": "contracts/src/apps/Identity420.sol",
        "sourceBlobSha1": artifact["sourceBlobSha1"],
        "compiler": artifact["compiler"],
        "buildArtifact": ARTIFACT_PATH,
        "buildArtifactAbiSha256": artifact["abiSha256"],
        "deployedBytecodeTemplateKeccak256": artifact["deployedBytecodeTemplateKeccak256"],
        "runtimeBytecode": runtime,
        "runtimeCodeHash": runtime_hash,
        "runtimeCodeBytes": (len(runtime) - 2) // 2,
        "constructorMaterialization": {
            "strategy": "DIRECT_GENESIS_PREDEPLOY_IMMUTABLE_MATERIALIZATION",
            "governanceTimelock": GOVERNANCE_TIMELOCK,
            "immutableReferences": refs,
            "materializedReferences": patched,
            "immutableReferenceCount": len(patched),
            "method": "compiler-emitted immutableReferences patched with ABI-encoded GovernanceTimelock address",
        },
        "storage": {},
        "storageSlotCount": 0,
        "storageRoot": empty_root,
        "storageRootBasis": "Ethereum empty Merkle-Patricia storage trie root = keccak256(0x80)",
        "stateInitialization": {
            "profiles": "empty",
            "issuers": "empty",
            "credentials": "empty",
            "credentialCandidates": "empty",
        },
        "invariants": [
            "genesis alloc.code uses materialized deployed runtime bytecode, never creation bytecode",
            "governanceTimelock is embedded as a Solidity immutable and is not written to mutable storage",
            "Identity420 constructor performs no mutable storage writes",
            "all profiles, issuers, credentials and credential candidate indexes begin empty",
            "runtimeCodeHash equals keccak256(materialized runtimeBytecode)",
            "frozen Identity420 owner/address remains 0x0000000000000000000000000000000000000436",
        ],
        "limitations": [
            "This is deterministic offline Genesis predeploy evidence, not live-chain deployment evidence.",
            "ID-AUDIT-9 remains responsible for production-equivalent testnet eth_getCode/storage/immutable verification.",
        ],
    }


def update_plan(plan: dict, state: dict) -> dict:
    entries = [x for x in plan.get("predeploys", []) if x.get("name") == CONTRACT]
    if len(entries) != 1:
        fail("predeploy plan must contain exactly one Identity420 entry")
    entry = entries[0]
    if entry.get("address", "").lower() != IDENTITY_ADDRESS:
        fail("predeploy plan Identity address drift")
    if entry.get("source") != "apps/Identity420.sol":
        fail("predeploy plan Identity source drift")
    if entry.get("artifact") != ARTIFACT_PATH:
        fail("predeploy plan Identity artifact drift")

    entry["status"] = "ARTIFACT_READY"
    entry["constructor_strategy"] = "DIRECT_GENESIS_IMMUTABLE_MATERIALIZATION"
    entry["runtime_code_hash"] = state["runtimeCodeHash"]
    entry["predeploy_state"] = STATE_PATH
    entry["source_blob_sha1"] = state["sourceBlobSha1"]
    entry["notes"] = (
        "ID-AUDIT-5: pinned Solidity 0.8.24/Cancun runtime materialized from retained "
        "ID-AUDIT-4 artifact; governanceTimelock immutable patched to 0x0429 from compiler "
        "immutableReferences; mutable Genesis storage is explicitly empty. Live-chain "
        "verification remains ID-AUDIT-9."
    )
    return plan


def update_deployment_manifest(manifest: dict, state: dict) -> dict:
    entries = [x for x in manifest.get("contracts", []) if x.get("name") == CONTRACT]
    if len(entries) != 1:
        fail("deployment manifest must contain exactly one Identity420 entry")
    entry = entries[0]
    if entry.get("address", "").lower() != IDENTITY_ADDRESS:
        fail("deployment manifest Identity address drift")
    entry["runtime_artifact"] = ARTIFACT_PATH
    entry["runtime_code_hash"] = state["runtimeCodeHash"]
    entry["predeploy_state"] = STATE_PATH
    entry["source_blob_sha1"] = state["sourceBlobSha1"]
    entry["artifact_status"] = "ID_AUDIT_5_ARTIFACT_READY"
    return manifest


def canonical_json(obj: object) -> str:
    return json.dumps(obj, indent=2, sort_keys=True) + "\n"


def manifest_json(obj: object) -> str:
    return json.dumps(obj, indent=2) + "\n"


def main(argv=None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--print", action="store_true", dest="print_output")
    args = parser.parse_args(argv)

    try:
        artifact = json.loads(ARTIFACT.read_text(encoding="utf-8"))
        state = build_state(artifact)
        plan = update_plan(json.loads(PREDEPLOY_PLAN.read_text(encoding="utf-8")), state)
        deployment = update_deployment_manifest(
            json.loads(DEPLOYMENT_MANIFEST.read_text(encoding="utf-8")), state
        )

        state_text = canonical_json(state)
        plan_text = manifest_json(plan)
        deployment_text = manifest_json(deployment)

        if args.write:
            OUTPUT_STATE.parent.mkdir(parents=True, exist_ok=True)
            OUTPUT_STATE.write_text(state_text, encoding="utf-8")
            PREDEPLOY_PLAN.write_text(plan_text, encoding="utf-8")
            DEPLOYMENT_MANIFEST.write_text(deployment_text, encoding="utf-8")

        if args.check:
            if not OUTPUT_STATE.is_file():
                fail("committed Identity420 predeploy state missing")
            if OUTPUT_STATE.read_text(encoding="utf-8") != state_text:
                fail("Identity420 predeploy state is not reproducible")
            if PREDEPLOY_PLAN.read_text(encoding="utf-8") != plan_text:
                fail("Identity420 predeploy-plan materialization is not reproducible")
            if DEPLOYMENT_MANIFEST.read_text(encoding="utf-8") != deployment_text:
                fail("Identity420 deployment-manifest materialization is not reproducible")

        if args.print_output:
            print("=== Identity420-predeploy-state.json ===")
            print(state_text, end="")

        print("ID_AUDIT_5_PREDEPLOY=PASS")
        print("runtimeCodeHash=" + state["runtimeCodeHash"])
        print("sourceBlobSha1=" + state["sourceBlobSha1"])
        print("storageRoot=" + state["storageRoot"])
        print("immutableReferenceCount=" + str(state["constructorMaterialization"]["immutableReferenceCount"]))
        return 0
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError, json.JSONDecodeError) as exc:
        print("ID-AUDIT-5 blocked: %s" % exc, file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
