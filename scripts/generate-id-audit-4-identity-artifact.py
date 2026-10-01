#!/usr/bin/env python3
"""Generate and verify the canonical ID-AUDIT-4 Identity420 build artifact.

ID-AUDIT-4 retains compiler output identity, ABI, source/compiler provenance and
generated-reference metadata. It deliberately does NOT materialize constructor
immutables into the deployed runtime; that belongs to ID-AUDIT-5.

The retained deployedBytecodeTemplate therefore contains the compiler-emitted
immutable placeholders plus immutableReferences. ID-AUDIT-5 must patch those
references with the frozen GovernanceTimelock and derive the final runtime
code hash before Genesis placement.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
CONTRACT = "Identity420"
SOURCE = ROOT / "contracts/src/apps/Identity420.sol"
FOUNDRY_ARTIFACT = ROOT / "contracts/out/Identity420.sol/Identity420.json"
OUTPUT_ARTIFACT = ROOT / "contracts/artifacts/Identity420.json"
CATALOGUE = ROOT / "developer-hub/catalogue/local.example.json"
PREDEPLOY_PLAN = ROOT / "contracts/config/predeploy/predeploy-plan.json"
FOUNDRY_CONFIG = ROOT / "contracts/foundry.toml"
TOOLCHAIN = ROOT / "contracts/config/security/toolchain.json"

IDENTITY_ADDRESS = "0x0000000000000000000000000000000000000436"
INTERFACE_PATH = "contracts/src/interfaces/genesis/IIdentityCredential420.sol"
ARTIFACT_PATH = "contracts/artifacts/Identity420.json"
SOURCE_PATH = "contracts/src/apps/Identity420.sol"


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


def canonical_abi(abi: object) -> str:
    return json.dumps(abi, separators=(",", ":"), ensure_ascii=True)


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def validate_inputs(raw: dict) -> dict:
    plan = json.loads(PREDEPLOY_PLAN.read_text(encoding="utf-8"))
    entries = [e for e in plan.get("predeploys", []) if e.get("name") == CONTRACT]
    if len(entries) != 1:
        fail("predeploy plan must contain exactly one Identity420 entry")
    entry = entries[0]
    if entry.get("address", "").lower() != IDENTITY_ADDRESS:
        fail("predeploy plan Identity420 address drift")
    if entry.get("source") != "apps/Identity420.sol":
        fail("predeploy plan Identity420 source drift")
    if entry.get("artifact") != ARTIFACT_PATH:
        fail("predeploy plan Identity420 artifact drift")

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
    compiler_version = str(metadata.get("compiler", {}).get("version", ""))
    if not compiler_version.startswith("0.8.24"):
        fail("compiler metadata is not Solidity 0.8.24")

    return entry


def build_artifact(raw: dict) -> dict:
    validate_inputs(raw)

    abi = raw.get("abi")
    if not isinstance(abi, list) or not abi:
        fail("Foundry artifact missing ABI")

    creation = raw.get("bytecode")
    deployed = raw.get("deployedBytecode")
    if not isinstance(creation, dict) or not isinstance(deployed, dict):
        fail("Foundry artifact missing bytecode/deployedBytecode objects")

    creation_object = normalize_hex(creation.get("object"))
    deployed_template = normalize_hex(deployed.get("object"))
    immutable_refs = deployed.get("immutableReferences")
    if not isinstance(immutable_refs, dict) or not immutable_refs:
        fail("Identity420 deployed bytecode must expose governanceTimelock immutableReferences")
    if len(immutable_refs) != 1:
        fail("unexpected Identity420 immutable identifier count: %d" % len(immutable_refs))
    immutable_count = 0
    for locations in immutable_refs.values():
        if not isinstance(locations, list) or not locations:
            fail("empty immutable reference list")
        for location in locations:
            if location.get("length") != 32:
                fail("unexpected immutable reference width")
            start = location.get("start")
            if not isinstance(start, int) or start < 0 or start + 32 > (len(deployed_template) - 2) // 2:
                fail("immutable reference outside deployed bytecode")
            immutable_count += 1

    storage_layout = raw.get("storageLayout")
    if not isinstance(storage_layout, dict):
        try:
            inspected = subprocess.check_output(
                ["forge", "inspect", "src/apps/Identity420.sol:Identity420", "storage-layout", "--json"],
                cwd=ROOT / "contracts",
                text=True,
            ).strip()
            storage_layout = json.loads(inspected)
        except (subprocess.CalledProcessError, json.JSONDecodeError) as exc:
            fail("compiler storage-layout inspection failed: %s" % exc)

    source_blob = git_blob_sha(SOURCE)
    foundry_blob = git_blob_sha(FOUNDRY_CONFIG)
    toolchain_blob = git_blob_sha(TOOLCHAIN)
    abi_hash = sha256_text(canonical_abi(abi))

    return {
        "schema": "420-identity-build-artifact-v1",
        "status": "ID_AUDIT_4_GENERATED_ARTIFACT",
        "contractName": CONTRACT,
        "source": SOURCE_PATH,
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
        "canonicalAddress": IDENTITY_ADDRESS,
        "constructor": {
            "arguments": [{"name": "timelock_", "type": "address"}],
            "materialized": False,
            "materializationOwner": "ID-AUDIT-5",
        },
        "creationBytecode": creation_object,
        "creationBytecodeSha256": hashlib.sha256(bytes.fromhex(creation_object[2:])).hexdigest(),
        "deployedBytecodeTemplate": deployed_template,
        "deployedBytecodeTemplateKeccak256": cast_keccak(deployed_template),
        "deployedBytecodeTemplateBytes": (len(deployed_template) - 2) // 2,
        "immutableReferences": immutable_refs,
        "immutableReferenceCount": immutable_count,
        "abi": abi,
        "abiSha256": abi_hash,
        "storageLayout": storage_layout,
        "runtimeIdentityBoundary": {
            "templateOnly": True,
            "finalRuntimeCodeHashAvailable": False,
            "reason": "governanceTimelock immutable is intentionally materialized in ID-AUDIT-5",
        },
    }


def expected_catalogue(artifact: dict) -> dict:
    catalogue = json.loads(CATALOGUE.read_text(encoding="utf-8"))
    if catalogue.get("schemaVersion") != "1.0.0":
        fail("unsupported contract catalogue schemaVersion")
    contracts = catalogue.get("contracts")
    if not isinstance(contracts, list):
        fail("contract catalogue contracts must be an array")

    identity = {
        "name": CONTRACT,
        "protocol": "420Identity",
        "address": IDENTITY_ADDRESS,
        "source": "genesis",
        "version": "3.0.0",
        "deploymentBlock": 0,
        "artifact": ARTIFACT_PATH,
        "interface": INTERFACE_PATH,
        "abiSha256": artifact["abiSha256"],
        "verified": True,
    }
    kept = [entry for entry in contracts if entry.get("name") != CONTRACT]
    kept.append(identity)
    kept.sort(key=lambda entry: str(entry.get("name", "")))
    catalogue["contracts"] = kept
    return catalogue


def canonical_json(obj: object) -> str:
    return json.dumps(obj, indent=2, sort_keys=True) + "\n"


def catalogue_json(obj: object) -> str:
    return json.dumps(obj, indent=2) + "\n"


def main(argv=None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--print", action="store_true", dest="print_output")
    args = parser.parse_args(argv)

    if not FOUNDRY_ARTIFACT.is_file():
        print("ID-AUDIT-4 blocked: build Identity420 with pinned Foundry first", file=sys.stderr)
        return 2

    try:
        raw = json.loads(FOUNDRY_ARTIFACT.read_text(encoding="utf-8"))
        artifact = build_artifact(raw)
        catalogue = expected_catalogue(artifact)
        artifact_text = canonical_json(artifact)
        catalogue_text = catalogue_json(catalogue)

        if args.write:
            OUTPUT_ARTIFACT.parent.mkdir(parents=True, exist_ok=True)
            OUTPUT_ARTIFACT.write_text(artifact_text, encoding="utf-8")
            CATALOGUE.write_text(catalogue_text, encoding="utf-8")

        if args.check:
            if not OUTPUT_ARTIFACT.is_file():
                fail("committed Identity420 artifact missing")
            if OUTPUT_ARTIFACT.read_text(encoding="utf-8") != artifact_text:
                fail("Identity420 artifact is not reproducible from current source/compiler inputs")
            if CATALOGUE.read_text(encoding="utf-8") != catalogue_text:
                fail("Identity420 catalogue metadata is not reproducible from retained artifact ABI")

        if args.print_output:
            print("=== Identity420 artifact ===")
            print(artifact_text, end="")
            print("=== Identity catalogue entry ===")
            print(json.dumps([x for x in catalogue["contracts"] if x.get("name") == CONTRACT], indent=2))

        print("ID_AUDIT_4_ARTIFACT=PASS")
        print("sourceBlobSha1=" + artifact["sourceBlobSha1"])
        print("abiSha256=" + artifact["abiSha256"])
        print("deployedBytecodeTemplateKeccak256=" + artifact["deployedBytecodeTemplateKeccak256"])
        print("immutableReferenceCount=" + str(artifact["immutableReferenceCount"]))
        return 0
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError, json.JSONDecodeError) as exc:
        print("ID-AUDIT-4 blocked: %s" % exc, file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
