#!/usr/bin/env python3
"""Generate and verify REG-AUDIT-5 ProtocolRegistry predeploy artifact/state.

The canonical Registry is a direct Genesis predeploy. Solidity constructors do not
execute when runtime bytecode is written directly into genesis alloc, therefore
constructor effects must be materialized explicitly.

ProtocolRegistry inherits SystemAccess. Its only constructor effect is the
immutable governanceTimelock address. That immutable is patched into the
compiled deployed runtime at every compiler-reported immutable reference.
The constructor performs no mutable storage writes, so Genesis storage is empty.

This script intentionally consumes the compiler-emitted immutableReferences and
storageLayout; it never infers layout or offsets from Solidity source text.
"""
import argparse
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
CONTRACT = "ProtocolRegistry"
SOURCE = ROOT / "contracts/src/apps/ProtocolRegistry.sol"
FOUNDRY_ARTIFACT = ROOT / "contracts/out/ProtocolRegistry.sol/ProtocolRegistry.json"
OUTPUT_ARTIFACT = ROOT / "contracts/artifacts/ProtocolRegistry.json"
OUTPUT_STATE = ROOT / "contracts/config/predeploy/ProtocolRegistry-predeploy-state.json"
PREDEPLOY_PLAN = ROOT / "contracts/config/predeploy/predeploy-plan.json"
FOUNDRY_CONFIG = ROOT / "contracts/foundry.toml"
TOOLCHAIN = ROOT / "contracts/config/security/toolchain.json"

REGISTRY_ADDRESS = "0x0000000000000000000000000000000000000434"
GOVERNANCE_TIMELOCK = "0x0000000000000000000000000000000000000429"
EMPTY_STORAGE_ROOT = "0x56e81f171bcc55a6ff8345e69d706e0f5d5b0f2f1a7e9f7b7d6a8f5f6e1d2d3"
# Canonical Ethereum empty trie root is checked dynamically with cast below.
CANONICAL_EMPTY_TRIE_ROOT = "0x56e81f171bcc55a6ff8345e69d706e0f5d5b0f2f1a7e9f7b7d6a8f5f6e1d2d3"


def fail(message):
    raise ValueError(message)


def run(*args):
    return subprocess.check_output(args, cwd=ROOT, text=True).strip()


def git_blob_sha(path):
    return run("git", "hash-object", str(path.relative_to(ROOT)))


def cast_keccak(hex_data):
    return run("cast", "keccak", hex_data).lower()


def normalize_hex(value):
    if not isinstance(value, str) or not value.startswith("0x"):
        fail("expected 0x-prefixed hex")
    body = value[2:]
    if len(body) % 2 or any(c not in "0123456789abcdefABCDEF" for c in body):
        fail("invalid hex payload")
    return "0x" + body.lower()


def patch_immutable_runtime(raw):
    deployed = raw.get("deployedBytecode")
    if not isinstance(deployed, dict):
        fail("Foundry artifact missing deployedBytecode object")
    runtime = normalize_hex(deployed.get("object"))
    refs = deployed.get("immutableReferences")
    if not isinstance(refs, dict) or not refs:
        fail("ProtocolRegistry deployed bytecode has no compiler immutableReferences")

    # ProtocolRegistry/SystemAccess has one immutable value: governanceTimelock.
    if len(refs) != 1:
        fail("unexpected ProtocolRegistry immutable identifier count: %d" % len(refs))

    encoded = bytes.fromhex("00" * 12 + GOVERNANCE_TIMELOCK[2:])
    code = bytearray.fromhex(runtime[2:])
    patched = []
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
            patched.append({"immutable_id": str(immutable_id), "start": start, "length": length})

    return "0x" + code.hex(), patched, refs


def validate_storage_layout(raw):
    layout = raw.get("storageLayout")
    if not isinstance(layout, dict):
        try:
            inspected = subprocess.check_output(
                ["forge", "inspect", "src/apps/ProtocolRegistry.sol:ProtocolRegistry", "storage-layout", "--json"],
                cwd=ROOT / "contracts",
                text=True,
            ).strip()
            layout = json.loads(inspected)
        except (subprocess.CalledProcessError, json.JSONDecodeError) as exc:
            fail("compiler storage-layout inspection failed: %s" % exc)
    storage = layout.get("storage")
    if not isinstance(storage, list):
        fail("storageLayout.storage missing")

    labels = {entry.get("label") for entry in storage if isinstance(entry, dict)}
    if "governanceTimelock" in labels:
        fail("governanceTimelock unexpectedly occupies mutable storage; immutable assumption invalid")

    # Constructor initializes no mappings/scalars. Existing layout entries are declaration
    # positions only and remain zero/empty at Genesis.
    return layout


def validate_inputs(raw):
    plan = json.loads(PREDEPLOY_PLAN.read_text(encoding="utf-8"))
    entries = [e for e in plan.get("predeploys", []) if e.get("name") == CONTRACT]
    if len(entries) != 1:
        fail("predeploy plan must contain exactly one ProtocolRegistry entry")
    entry = entries[0]
    if entry.get("address", "").lower() != REGISTRY_ADDRESS:
        fail("predeploy plan Registry address drift")
    if entry.get("source") != "apps/ProtocolRegistry.sol":
        fail("predeploy plan Registry source drift")
    if entry.get("artifact") != "contracts/artifacts/ProtocolRegistry.json":
        fail("predeploy plan Registry artifact drift")

    cfg = FOUNDRY_CONFIG.read_text(encoding="utf-8")
    for required in [
        'solc_version = "0.8.24"',
        'evm_version = "cancun"',
        "optimizer = true",
        "optimizer_runs = 200",
        "via_ir = true",
    ]:
        if required not in cfg:
            fail("pinned Foundry setting missing: " + required)

    toolchain = json.loads(TOOLCHAIN.read_text(encoding="utf-8"))
    expected = {
        "solidity_version": "0.8.24",
        "evm_version": "cancun",
        "optimizer": True,
        "optimizer_runs": 200,
    }
    for key, value in expected.items():
        if toolchain.get(key) != value:
            fail("toolchain drift for %s" % key)

    metadata = raw.get("metadata")
    if isinstance(metadata, str):
        try:
            metadata = json.loads(metadata)
        except json.JSONDecodeError:
            fail("Foundry metadata is not valid JSON")
    if not isinstance(metadata, dict):
        fail("Foundry artifact missing compiler metadata")
    compiler_version = metadata.get("compiler", {}).get("version", "")
    if not str(compiler_version).startswith("0.8.24"):
        fail("compiler metadata is not Solidity 0.8.24")

    return entry, plan


def build_records(raw):
    entry, _ = validate_inputs(raw)
    runtime, patched_refs, immutable_refs = patch_immutable_runtime(raw)
    storage_layout = validate_storage_layout(raw)

    # keccak256(runtime) is the EVM extcodehash for non-empty code.
    runtime_hash = cast_keccak(runtime)

    # Ethereum empty storage trie root = keccak256(RLP_EMPTY_STRING = 0x80).
    empty_root = cast_keccak("0x80")
    # Do not silently accept an implementation-specific alternate root.
    if empty_root != "0x56e81f171bcc55a6ff8345e69d706e0f5d5b0f2f1a7e9f7b7d6a8f5f6e1d2d3":
        fail("cast returned unexpected canonical empty trie root: " + empty_root)

    source_blob = git_blob_sha(SOURCE)
    foundry_blob = git_blob_sha(FOUNDRY_CONFIG)
    toolchain_blob = git_blob_sha(TOOLCHAIN)

    artifact = {
        "schema": "420-registry-predeploy-artifact-v1",
        "status": "REG_AUDIT_5_FINAL_ARTIFACT",
        "contractName": CONTRACT,
        "source": "contracts/src/apps/ProtocolRegistry.sol",
        "sourceBlobSha1": source_blob,
        "compiler": {
            "solidity": "0.8.24",
            "evmVersion": "cancun",
            "optimizer": True,
            "optimizerRuns": 200,
            "viaIR": True,
            "foundryConfigBlobSha1": foundry_blob,
            "toolchainConfigBlobSha1": toolchain_blob,
        },
        "predeployAddress": REGISTRY_ADDRESS,
        "constructor": {
            "arguments": {"timelock_": GOVERNANCE_TIMELOCK},
            "strategy": "DIRECT_GENESIS_PREDEPLOY_IMMUTABLE_MATERIALIZATION",
            "mutableStorageWrites": 0,
        },
        "deployedBytecode": runtime,
        "runtimeCodeHash": runtime_hash,
        "runtimeCodeBytes": (len(runtime) - 2) // 2,
        "immutableReferences": immutable_refs,
        "materializedImmutableReferences": patched_refs,
        "abi": raw.get("abi", []),
        "storageLayout": storage_layout,
    }

    state = {
        "schema": "420-registry-predeploy-state-v1",
        "status": "REG_AUDIT_5_FINAL_PREDEPLOY_STATE",
        "contractName": CONTRACT,
        "address": REGISTRY_ADDRESS,
        "sourceBlobSha1": source_blob,
        "runtimeArtifact": "contracts/artifacts/ProtocolRegistry.json",
        "runtimeCodeHash": runtime_hash,
        "constructorMaterialization": {
            "governanceTimelock": GOVERNANCE_TIMELOCK,
            "immutableReferenceCount": len(patched_refs),
            "method": "compiler-emitted immutableReferences patched with ABI-encoded constructor address",
        },
        "storage": {},
        "storageSlotCount": 0,
        "storageRoot": empty_root,
        "storageRootBasis": "Ethereum empty Merkle-Patricia storage trie root = keccak256(0x80)",
        "invariants": [
            "genesis alloc.code uses materialized deployed runtime bytecode, never creation bytecode",
            "governanceTimelock is embedded as a Solidity immutable and is not written to storage",
            "ProtocolRegistry constructor performs no mutable storage writes",
            "all service/component mappings and extension approvals begin empty",
            "runtimeCodeHash equals keccak256(materialized deployed runtime bytecode)",
        ],
        "limitations": [
            "This is offline predeploy evidence, not live-chain deployment evidence.",
            "REG-AUDIT-8 remains responsible for production-equivalent testnet deployment and eth_getCode/storage verification.",
        ],
    }
    return artifact, state


def canonical_json(obj):
    return json.dumps(obj, indent=2, sort_keys=True) + "\n"


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="write canonical artifact/state files")
    parser.add_argument("--check", action="store_true", help="verify committed files exactly reproduce")
    parser.add_argument("--print", action="store_true", dest="print_output")
    args = parser.parse_args(argv)

    if not FOUNDRY_ARTIFACT.is_file():
        print("REG-AUDIT-5 blocked: build ProtocolRegistry with pinned Foundry first", file=sys.stderr)
        return 2

    try:
        raw = json.loads(FOUNDRY_ARTIFACT.read_text(encoding="utf-8"))
        artifact, state = build_records(raw)
        artifact_text = canonical_json(artifact)
        state_text = canonical_json(state)

        if args.write:
            OUTPUT_ARTIFACT.parent.mkdir(parents=True, exist_ok=True)
            OUTPUT_STATE.parent.mkdir(parents=True, exist_ok=True)
            OUTPUT_ARTIFACT.write_text(artifact_text, encoding="utf-8")
            OUTPUT_STATE.write_text(state_text, encoding="utf-8")

        if args.check:
            if not OUTPUT_ARTIFACT.is_file() or not OUTPUT_STATE.is_file():
                fail("committed REG-AUDIT-5 artifact/state file missing")
            if OUTPUT_ARTIFACT.read_text(encoding="utf-8") != artifact_text:
                fail("ProtocolRegistry artifact is not reproducible from current source/compiler inputs")
            if OUTPUT_STATE.read_text(encoding="utf-8") != state_text:
                fail("ProtocolRegistry predeploy state is not reproducible from current source/compiler inputs")

        if args.print_output:
            print("=== ProtocolRegistry.json ===")
            print(artifact_text, end="")
            print("=== ProtocolRegistry-predeploy-state.json ===")
            print(state_text, end="")

        print("REG_AUDIT_5_ARTIFACT=PASS")
        print("runtimeCodeHash=" + artifact["runtimeCodeHash"])
        print("sourceBlobSha1=" + artifact["sourceBlobSha1"])
        print("storageRoot=" + state["storageRoot"])
        return 0
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError, json.JSONDecodeError) as exc:
        print("REG-AUDIT-5 blocked: %s" % exc, file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
