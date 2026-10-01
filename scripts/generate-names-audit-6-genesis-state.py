#!/usr/bin/env python3
"""Generate and verify NAMES-AUDIT-6 deterministic Names420 Genesis state.

Consumes the frozen NAMES-AUDIT-5 compiler artifact. The direct Genesis predeploy
does not execute Solidity constructors, so the inherited SystemAccess
governanceTimelock immutable must be materialized at the compiler-reported
immutable reference. Names420's constructor performs no mutable storage writes;
its three mappings therefore begin empty.
"""
import argparse
import copy
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
ARTIFACT = ROOT / "contracts/artifacts/Names420.json"
STATE = ROOT / "contracts/config/predeploy/Names420-predeploy-state.json"
PREDEPLOY_PLAN = ROOT / "contracts/config/predeploy/predeploy-plan.json"
DEPLOYMENT_MANIFEST = ROOT / "contracts/config/deployment-manifest.json"
STORAGE_INIT = ROOT / "contracts/config/predeploy/storage-init.json"

CONTRACT = "Names420"
ADDRESS = "0x0000000000000000000000000000000000000435"
GOVERNANCE_TIMELOCK = "0x0000000000000000000000000000000000000429"
SOURCE_BLOB = "4cb9b06b4a3febb3bf024c087f3ade1eebdcf31d"
COMPILER_RUNTIME_SHA256 = "7b34c5506c526d9c7015d4d2c4514cacac585bd571050a53655ea2270d1210bd"
COMPILER_PAYLOAD_SHA256 = "c40970d3a04503309f9467eaca00c915f5ce3dd1e993c2df3318aa6cd149ab2c"


def fail(message):
    raise ValueError(message)


def run(*args):
    return subprocess.check_output(args, cwd=ROOT, text=True).strip()


def cast_keccak(hex_data):
    value = run("cast", "keccak", hex_data).lower()
    if len(value) != 66 or not value.startswith("0x"):
        fail("cast returned malformed keccak256")
    return value


def normalize_hex(value):
    if not isinstance(value, str) or not value.startswith("0x"):
        fail("expected 0x-prefixed hex")
    body = value[2:]
    if len(body) % 2 or any(c not in "0123456789abcdefABCDEF" for c in body):
        fail("invalid hex payload")
    return "0x" + body.lower()


def frozen_compiler_view(artifact):
    required = {
        "schema": "420-names-compiler-artifact-v1",
        "contractName": CONTRACT,
        "source": "contracts/src/apps/Names420.sol",
        "sourceBlobSha1": SOURCE_BLOB,
        "canonicalAddress": ADDRESS,
        "compilerRuntimeTemplateSha256": COMPILER_RUNTIME_SHA256,
        "artifactPayloadSha256": COMPILER_PAYLOAD_SHA256,
    }
    for key, value in required.items():
        if artifact.get(key) != value:
            fail("NAMES-AUDIT-5 frozen artifact drift for %s" % key)
    if artifact.get("compiler", {}).get("solidity") != "0.8.24":
        fail("frozen compiler Solidity version drift")
    if artifact.get("compiler", {}).get("evmVersion") != "cancun":
        fail("frozen compiler EVM version drift")
    if artifact.get("compiler", {}).get("optimizerRuns") != 200:
        fail("frozen compiler optimizer-runs drift")
    if artifact.get("compiler", {}).get("viaIR") is not True:
        fail("frozen compiler viaIR drift")


def patch_runtime(artifact):
    runtime = normalize_hex(artifact.get("compilerDeployedBytecode"))
    refs = artifact.get("immutableReferences")
    if not isinstance(refs, dict) or len(refs) != 1:
        fail("expected exactly one immutable identifier")
    locations = next(iter(refs.values()))
    if not isinstance(locations, list) or len(locations) != 1:
        fail("expected exactly one immutable materialization location")
    loc = locations[0]
    start, length = loc.get("start"), loc.get("length")
    if not isinstance(start, int) or length != 32:
        fail("malformed governanceTimelock immutable reference")
    code = bytearray.fromhex(runtime[2:])
    if start < 0 or start + length > len(code):
        fail("immutable reference outside runtime")
    encoded = bytes.fromhex("00" * 12 + GOVERNANCE_TIMELOCK[2:])
    original = bytes(code[start:start + length])
    code[start:start + length] = encoded
    materialized = "0x" + code.hex()
    return materialized, {
        "compilerIdentifier": next(iter(refs.keys())),
        "start": start,
        "length": length,
        "originalCompilerBytes": "0x" + original.hex(),
        "materializedValue": "0x" + encoded.hex(),
    }


def validate_storage(artifact):
    layout = artifact.get("storageLayout")
    if not isinstance(layout, dict) or not isinstance(layout.get("storage"), list):
        fail("frozen artifact missing storage layout")
    storage = layout["storage"]
    roots = {entry.get("label"): entry.get("slot") for entry in storage if isinstance(entry, dict)}
    expected = {"records": "0", "commitments": "1", "primaryNameByAddress": "2"}
    if roots != expected:
        fail("Names420 root storage layout drift: %r" % roots)
    if "governanceTimelock" in roots:
        fail("governanceTimelock unexpectedly occupies mutable storage")
    return roots


def validate_storage_init():
    cfg = json.loads(STORAGE_INIT.read_text(encoding="utf-8"))
    if cfg.get("schema") != "420-predeploy-storage-init-v2":
        fail("storage-init schema drift")
    if cfg.get("governance_timelock", "").lower() != GOVERNANCE_TIMELOCK:
        fail("storage-init governance_timelock drift")
    entries = cfg.get("entries")
    item = entries.get(CONTRACT) if isinstance(entries, dict) else None
    if not isinstance(item, dict):
        fail("storage-init Names420 entry missing")
    if item.get("constructor") != ["governance_timelock"]:
        fail("storage-init Names420 constructor drift")


def canonical_json(value):
    return json.dumps(value, indent=2, sort_keys=True) + "\n"


def build_records(artifact):
    frozen_compiler_view(artifact)
    validate_storage(artifact)
    validate_storage_init()
    runtime, materialization = patch_runtime(artifact)
    runtime_hash = cast_keccak(runtime)
    empty_root = cast_keccak("0x80")
    if empty_root != "0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421":
        fail("unexpected Ethereum empty storage trie root")

    genesis = {
        "strategy": "DIRECT_GENESIS_PREDEPLOY_IMMUTABLE_MATERIALIZATION",
        "predeployAddress": ADDRESS,
        "constructorArguments": {"timelock_": GOVERNANCE_TIMELOCK},
        "deployedBytecode": runtime,
        "runtimeCodeBytes": (len(runtime) - 2) // 2,
        "runtimeCodeHash": runtime_hash,
        "immutableMaterialization": [materialization],
        "mutableConstructorStorageWrites": 0,
        "storageRoot": empty_root,
        "storageSlotCount": 0,
    }

    final_artifact = copy.deepcopy(artifact)
    final_artifact["status"] = "NAMES_AUDIT_6_GENESIS_PREDEPLOY_READY"
    final_artifact["genesisMaterialization"] = genesis

    state = {
        "schema": "420-names-predeploy-state-v1",
        "status": "NAMES_AUDIT_6_FINAL_PREDEPLOY_STATE",
        "qualificationMilestone": "NAMES_AUDIT_6_LEVEL_2",
        "qualificationRequirement": "LEVEL_2_APP_INTEGRATION",
        "contractName": CONTRACT,
        "address": ADDRESS,
        "sourceBlobSha1": SOURCE_BLOB,
        "runtimeArtifact": "contracts/artifacts/Names420.json",
        "runtimeCodeHash": runtime_hash,
        "runtimeCodeBytes": genesis["runtimeCodeBytes"],
        "constructorMaterialization": {
            "governanceTimelock": GOVERNANCE_TIMELOCK,
            "immutableReferenceCount": 1,
            "materializedReferences": [materialization],
            "method": "compiler-emitted immutableReferences patched with ABI-encoded constructor address",
        },
        "storageLayoutRoots": {
            "records": "0",
            "commitments": "1",
            "primaryNameByAddress": "2",
        },
        "storage": {},
        "storageSlotCount": 0,
        "storageRoot": empty_root,
        "storageRootBasis": "Ethereum empty Merkle-Patricia storage trie root = keccak256(0x80)",
        "invariants": [
            "genesis alloc.code uses materialized deployed runtime bytecode, never creation bytecode",
            "governanceTimelock is embedded as a Solidity immutable and is not written to storage",
            "Names420 constructor performs no mutable storage writes",
            "records, commitments and primaryNameByAddress mappings begin empty",
            "runtimeCodeHash equals keccak256(materialized deployed runtime bytecode)",
            "materialized runtime differs from the compiler template only at compiler-reported immutable references",
        ],
        "limitations": [
            "This is deterministic offline Genesis predeploy evidence, not live-chain deployment evidence.",
            "NAMES-AUDIT-9 remains responsible for production-equivalent testnet eth_getCode/storage/governance verification.",
        ],
    }
    return final_artifact, state


def validate_bindings(final_artifact, state):
    plan = json.loads(PREDEPLOY_PLAN.read_text(encoding="utf-8"))
    matches = [e for e in plan.get("predeploys", []) if e.get("name") == CONTRACT]
    if len(matches) != 1:
        fail("predeploy plan Names420 entry count drift")
    p = matches[0]
    required_plan = {
        "address": ADDRESS,
        "source": "apps/Names420.sol",
        "artifact": "contracts/artifacts/Names420.json",
        "status": "ARTIFACT_READY",
        "constructor_strategy": "DIRECT_GENESIS_IMMUTABLE_MATERIALIZATION",
        "runtime_code_hash": state["runtimeCodeHash"],
        "predeploy_state": "contracts/config/predeploy/Names420-predeploy-state.json",
        "source_blob_sha1": SOURCE_BLOB,
    }
    for key, value in required_plan.items():
        if p.get(key) != value:
            fail("predeploy-plan Names420 binding drift for %s" % key)

    manifest = json.loads(DEPLOYMENT_MANIFEST.read_text(encoding="utf-8"))
    matches = [e for e in manifest.get("contracts", []) if e.get("name") == CONTRACT]
    if len(matches) != 1:
        fail("deployment manifest Names420 entry count drift")
    d = matches[0]
    required_manifest = {
        "address": ADDRESS,
        "deployment": "GENESIS_SYSTEM_ADDRESS",
        "runtime_artifact": "contracts/artifacts/Names420.json",
        "runtime_code_hash": state["runtimeCodeHash"],
        "predeploy_state": "contracts/config/predeploy/Names420-predeploy-state.json",
        "source_blob_sha1": SOURCE_BLOB,
        "artifact_status": "NAMES_AUDIT_6_ARTIFACT_READY",
    }
    for key, value in required_manifest.items():
        if d.get(key) != value:
            fail("deployment-manifest Names420 binding drift for %s" % key)


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--print", action="store_true", dest="print_output")
    args = parser.parse_args(argv)

    if not ARTIFACT.is_file():
        print("NAMES-AUDIT-6 blocked: frozen Names420 artifact missing", file=sys.stderr)
        return 2

    try:
        artifact = json.loads(ARTIFACT.read_text(encoding="utf-8"))
        # Regeneration must always start from the frozen compiler view, never from
        # a previously materialized runtime.
        artifact.pop("genesisMaterialization", None)
        artifact["status"] = "NAMES_AUDIT_5_FROZEN_COMPILER_ARTIFACT"
        final_artifact, state = build_records(artifact)
        artifact_text = canonical_json(final_artifact)
        state_text = canonical_json(state)

        if args.write:
            ARTIFACT.write_text(artifact_text, encoding="utf-8")
            STATE.parent.mkdir(parents=True, exist_ok=True)
            STATE.write_text(state_text, encoding="utf-8")

        if args.check:
            if not STATE.is_file():
                fail("committed Names420 predeploy-state file missing")
            committed_artifact = json.loads(ARTIFACT.read_text(encoding="utf-8"))
            committed_state = json.loads(STATE.read_text(encoding="utf-8"))
            if canonical_json(committed_artifact) != artifact_text:
                fail("Names420 materialized runtime artifact is not reproducible")
            if canonical_json(committed_state) != state_text:
                fail("Names420 predeploy state is not reproducible")
            validate_bindings(committed_artifact, committed_state)

        if args.print_output:
            print("===BEGIN_NAMES420_MATERIALIZED_ARTIFACT===")
            print(artifact_text, end="")
            print("===END_NAMES420_MATERIALIZED_ARTIFACT===")
            print("===BEGIN_NAMES420_PREDEPLOY_STATE===")
            print(state_text, end="")
            print("===END_NAMES420_PREDEPLOY_STATE===")

        print("NAMES_AUDIT_6_GENESIS_STATE=PASS")
        print("runtimeCodeHash=" + state["runtimeCodeHash"])
        print("storageRoot=" + state["storageRoot"])
        print("runtimeCodeBytes=" + str(state["runtimeCodeBytes"]))
        return 0
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError, json.JSONDecodeError) as exc:
        print("NAMES-AUDIT-6 blocked: %s" % exc, file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
