#!/usr/bin/env python3
"""Generate and verify the NAMES-AUDIT-5 canonical Names420 compiler artifact.

NAMES-AUDIT-5 freezes compiler output only. It deliberately does NOT materialize
constructor immutables or derive the final Genesis runtime code hash/storage root;
those are NAMES-AUDIT-6 responsibilities.

The retained artifact contains the exact ABI, compiler-emitted deployed-runtime
template, creation bytecode, immutable references, storage layout, compiler
metadata identity, pinned build settings, and source/config provenance.
"""
import argparse
import hashlib
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
CONTRACT = "Names420"
SOURCE_REL = "contracts/src/apps/Names420.sol"
SOURCE = ROOT / SOURCE_REL
FOUNDRY_ARTIFACT = ROOT / "contracts/out/Names420.sol/Names420.json"
OUTPUT_ARTIFACT = ROOT / "contracts/artifacts/Names420.json"
FOUNDRY_CONFIG = ROOT / "contracts/foundry.toml"
TOOLCHAIN = ROOT / "contracts/config/security/toolchain.json"
PREDEPLOY_PLAN = ROOT / "contracts/config/predeploy/predeploy-plan.json"
CANONICAL_ADDRESS = "0x0000000000000000000000000000000000000435"


def fail(message):
    raise ValueError(message)


def run(*args, cwd=ROOT):
    return subprocess.check_output(args, cwd=cwd, text=True).strip()


def git_blob_sha(path):
    return run("git", "hash-object", str(path.relative_to(ROOT)))


def normalize_hex(value):
    if not isinstance(value, str) or not value.startswith("0x"):
        fail("expected 0x-prefixed hex")
    body = value[2:]
    if len(body) % 2 or any(c not in "0123456789abcdefABCDEF" for c in body):
        fail("invalid hex payload")
    return "0x" + body.lower()


def sha256_text(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def parse_metadata(raw):
    metadata = raw.get("metadata")
    if isinstance(metadata, str):
        try:
            metadata = json.loads(metadata)
        except json.JSONDecodeError as exc:
            fail("Foundry metadata is not valid JSON: %s" % exc)
    if not isinstance(metadata, dict):
        fail("Foundry artifact missing compiler metadata")
    version = str(metadata.get("compiler", {}).get("version", ""))
    if not version.startswith("0.8.24"):
        fail("compiler metadata is not Solidity 0.8.24")
    return metadata


def validate_inputs(raw):
    plan = json.loads(PREDEPLOY_PLAN.read_text(encoding="utf-8"))
    entries = [e for e in plan.get("predeploys", []) if e.get("name") == CONTRACT]
    if len(entries) != 1:
        fail("predeploy plan must contain exactly one Names420 entry")
    entry = entries[0]
    if entry.get("address", "").lower() != CANONICAL_ADDRESS:
        fail("Names420 canonical address drift")
    if entry.get("source") != "apps/Names420.sol":
        fail("Names420 predeploy source drift")
    if entry.get("artifact") != "contracts/artifacts/Names420.json":
        fail("Names420 artifact path drift")

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

    parse_metadata(raw)


def validate_abi(abi):
    if not isinstance(abi, list) or not abi:
        fail("Names420 ABI missing")
    function_names = {item.get("name") for item in abi if item.get("type") == "function"}
    required = {
        "makeCommitment", "commit", "register", "renew", "setResolution",
        "setReverseName", "reverseResolve", "nameClaimsProfile", "transferName",
        "acceptName", "isAvailable", "resolve", "protocolVersion", "systemName",
        "governanceTimelock",
    }
    missing = sorted(required - function_names)
    if missing:
        fail("Names420 ABI missing required functions: " + ", ".join(missing))
    event_names = {item.get("name") for item in abi if item.get("type") == "event"}
    required_events = {
        "CommitmentMade", "NameRegistered", "NameRenewed", "ResolutionUpdated",
        "ReverseNameSet", "NameTransferStarted", "NameTransferred",
    }
    missing_events = sorted(required_events - event_names)
    if missing_events:
        fail("Names420 ABI missing required events: " + ", ".join(missing_events))


def validate_storage_layout(raw):
    layout = raw.get("storageLayout")
    if not isinstance(layout, dict):
        try:
            inspected = run(
                "forge", "inspect", "src/apps/Names420.sol:Names420",
                "storage-layout", "--json", cwd=ROOT / "contracts"
            )
            layout = json.loads(inspected)
        except (subprocess.CalledProcessError, json.JSONDecodeError) as exc:
            fail("compiler storage-layout inspection failed: %s" % exc)
    storage = layout.get("storage")
    if not isinstance(storage, list):
        fail("storageLayout.storage missing")
    labels = [entry.get("label") for entry in storage if isinstance(entry, dict)]
    for required in ["records", "commitments", "primaryNameByAddress"]:
        if required not in labels:
            fail("Names420 storage layout missing " + required)
    if "governanceTimelock" in labels:
        fail("governanceTimelock unexpectedly occupies mutable storage")
    return layout


def validate_immutables(raw):
    deployed = raw.get("deployedBytecode")
    if not isinstance(deployed, dict):
        fail("Foundry artifact missing deployedBytecode object")
    runtime = normalize_hex(deployed.get("object"))
    refs = deployed.get("immutableReferences")
    if not isinstance(refs, dict) or not refs:
        fail("Names420 deployed bytecode has no immutableReferences")
    if len(refs) != 1:
        fail("unexpected Names420 immutable identifier count: %d" % len(refs))
    normalized = {}
    count = 0
    runtime_len = (len(runtime) - 2) // 2
    for immutable_id, locations in refs.items():
        if not isinstance(locations, list) or not locations:
            fail("empty immutable reference list")
        out = []
        for location in locations:
            start = location.get("start")
            length = location.get("length")
            if not isinstance(start, int) or not isinstance(length, int):
                fail("malformed immutable reference")
            if length != 32:
                fail("unexpected immutable width %r" % length)
            if start < 0 or start + length > runtime_len:
                fail("immutable reference outside deployed bytecode")
            out.append({"start": start, "length": length})
            count += 1
        normalized[str(immutable_id)] = out
    return runtime, normalized, count


def validate_plan_freeze_binding(artifact):
    plan = json.loads(PREDEPLOY_PLAN.read_text(encoding="utf-8"))
    entries = [e for e in plan.get("predeploys", []) if e.get("name") == CONTRACT]
    if len(entries) != 1:
        fail("predeploy plan must contain exactly one Names420 entry")
    entry = entries[0]
    expected = {
        "source_blob_sha1": artifact["sourceBlobSha1"],
        "compiler_runtime_template_sha256": artifact["compilerRuntimeTemplateSha256"],
        "artifact_payload_sha256": artifact["artifactPayloadSha256"],
    }
    if entry.get("status") not in {"COMPILER_ARTIFACT_FROZEN", "ARTIFACT_READY"}:
        fail("Names420 predeploy artifact status is not a recognized post-freeze state")
    for key, value in expected.items():
        if entry.get(key) != value:
            fail("Names420 predeploy artifact binding drift for %s" % key)


def canonical_json(obj):
    return json.dumps(obj, indent=2, sort_keys=True) + "\n"


def build_artifact(raw):
    validate_inputs(raw)
    abi = raw.get("abi")
    validate_abi(abi)
    runtime, immutable_refs, immutable_count = validate_immutables(raw)
    creation = raw.get("bytecode")
    if not isinstance(creation, dict):
        fail("Foundry artifact missing creation bytecode object")
    creation_object = normalize_hex(creation.get("object"))
    storage_layout = validate_storage_layout(raw)
    metadata = parse_metadata(raw)

    metadata_canonical = json.dumps(metadata, sort_keys=True, separators=(",", ":"))
    compiler_runtime_sha256 = hashlib.sha256(bytes.fromhex(runtime[2:])).hexdigest()
    creation_sha256 = hashlib.sha256(bytes.fromhex(creation_object[2:])).hexdigest()

    artifact = {
        "schema": "420-names-compiler-artifact-v1",
        "status": "NAMES_AUDIT_5_FROZEN_COMPILER_ARTIFACT",
        "contractName": CONTRACT,
        "source": SOURCE_REL,
        "sourceBlobSha1": git_blob_sha(SOURCE),
        "canonicalAddress": CANONICAL_ADDRESS,
        "compiler": {
            "solidity": "0.8.24",
            "evmVersion": "cancun",
            "optimizer": True,
            "optimizerRuns": 200,
            "viaIR": True,
            "foundryConfigBlobSha1": git_blob_sha(FOUNDRY_CONFIG),
            "toolchainConfigBlobSha1": git_blob_sha(TOOLCHAIN),
            "metadataSha256": sha256_text(metadata_canonical),
        },
        "abi": abi,
        "creationBytecode": creation_object,
        "creationBytecodeBytes": (len(creation_object) - 2) // 2,
        "creationBytecodeSha256": creation_sha256,
        "compilerDeployedBytecode": runtime,
        "compilerRuntimeTemplateBytes": (len(runtime) - 2) // 2,
        "compilerRuntimeTemplateSha256": compiler_runtime_sha256,
        "immutableReferences": immutable_refs,
        "immutableReferenceCount": immutable_count,
        "storageLayout": storage_layout,
        "freezeBoundary": {
            "constructorImmutablesMaterialized": False,
            "finalRuntimeCodeHashDerived": False,
            "genesisStorageDerived": False,
            "nextStep": "NAMES-AUDIT-6",
            "note": "NAMES-AUDIT-5 freezes compiler output. Constructor immutable materialization, final runtime keccak256/extcodehash and deterministic Genesis storage are NAMES-AUDIT-6.",
        },
    }
    artifact["artifactPayloadSha256"] = sha256_text(canonical_json(artifact))
    return artifact


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--print", action="store_true", dest="print_output")
    args = parser.parse_args(argv)

    if not FOUNDRY_ARTIFACT.is_file():
        print("NAMES-AUDIT-5 blocked: build Names420 with pinned Foundry first", file=sys.stderr)
        return 2

    try:
        raw = json.loads(FOUNDRY_ARTIFACT.read_text(encoding="utf-8"))
        artifact = build_artifact(raw)
        artifact_text = canonical_json(artifact)

        if args.write:
            OUTPUT_ARTIFACT.parent.mkdir(parents=True, exist_ok=True)
            OUTPUT_ARTIFACT.write_text(artifact_text, encoding="utf-8")

        if args.check:
            if not OUTPUT_ARTIFACT.is_file():
                fail("committed Names420 artifact missing")
            committed = json.loads(OUTPUT_ARTIFACT.read_text(encoding="utf-8"))
            # Later roadmap steps may append deterministic Genesis materialization,
            # but the NAMES-AUDIT-5 compiler projection must remain byte-for-byte stable.
            committed.pop("genesisMaterialization", None)
            committed["status"] = "NAMES_AUDIT_5_FROZEN_COMPILER_ARTIFACT"
            if canonical_json(committed) != artifact_text:
                fail("Names420 frozen compiler projection is not reproducible from current source/compiler inputs")
            validate_plan_freeze_binding(artifact)

        if args.print_output:
            print("===BEGIN_NAMES420_ARTIFACT===")
            print(artifact_text, end="")
            print("===END_NAMES420_ARTIFACT===")

        print("NAMES_AUDIT_5_ARTIFACT=PASS")
        print("sourceBlobSha1=" + artifact["sourceBlobSha1"])
        print("compilerRuntimeTemplateSha256=" + artifact["compilerRuntimeTemplateSha256"])
        print("artifactPayloadSha256=" + artifact["artifactPayloadSha256"])
        print("immutableReferenceCount=" + str(artifact["immutableReferenceCount"]))
        return 0
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError, json.JSONDecodeError) as exc:
        print("NAMES-AUDIT-5 blocked: %s" % exc, file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
