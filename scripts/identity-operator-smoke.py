#!/usr/bin/env python3
"""Read-only Identity420 operator smoke and offline release-tree verifier.

ID-AUDIT-8 intentionally performs no state-changing transaction. Live lifecycle
qualification belongs to ID-AUDIT-9.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
STATE_PATH = ROOT / "contracts/config/predeploy/Identity420-predeploy-state.json"
ARTIFACT_PATH = ROOT / "contracts/artifacts/Identity420.json"
PLAN_PATH = ROOT / "contracts/config/predeploy/predeploy-plan.json"
DEPLOYMENT_PATH = ROOT / "contracts/config/deployment-manifest.json"
NAMESPACE_PATH = ROOT / "contracts/config/genesis-address-namespace.json"

IDENTITY = "0x0000000000000000000000000000000000000436"
TIMELOCK = "0x0000000000000000000000000000000000000429"
EXPECTED_VERSION = "3"
EMPTY_STORAGE_ROOT = "0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421"


class SmokeError(RuntimeError):
    pass


def load_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise SmokeError(f"{path.relative_to(ROOT)} unreadable: {exc}") from exc


def cast(*args: str) -> str:
    try:
        return subprocess.check_output(["cast", *args], cwd=ROOT, text=True, stderr=subprocess.STDOUT).strip()
    except FileNotFoundError as exc:
        raise SmokeError("Foundry cast is required for Identity operator smoke") from exc
    except subprocess.CalledProcessError as exc:
        output = (exc.output or "").strip()
        raise SmokeError(f"cast command failed: {output or exc}") from exc


def offline_verify() -> dict:
    state = load_json(STATE_PATH)
    artifact = load_json(ARTIFACT_PATH)
    plan = load_json(PLAN_PATH)
    deployment = load_json(DEPLOYMENT_PATH)
    namespace = load_json(NAMESPACE_PATH)

    if state.get("address", "").lower() != IDENTITY:
        raise SmokeError("Identity predeploy address drift")
    if state.get("runtimeCodeHash") is None:
        raise SmokeError("Identity runtime code hash missing")
    if state.get("storageRoot") != EMPTY_STORAGE_ROOT:
        raise SmokeError("Identity initial storage root is not canonical empty root")
    if state.get("storage") != {} or state.get("storageSlotCount") != 0:
        raise SmokeError("Identity mutable Genesis storage is not explicitly empty")
    materialization = state.get("constructorMaterialization", {})
    if materialization.get("governanceTimelock", "").lower() != TIMELOCK:
        raise SmokeError("Identity GovernanceTimelock immutable drift")
    refs = materialization.get("materializedReferences", [])
    if materialization.get("immutableReferenceCount") != 4 or len(refs) != 4:
        raise SmokeError("Identity immutable-reference count drift")
    if any(str(ref.get("value", "")).lower() != TIMELOCK for ref in refs):
        raise SmokeError("Identity immutable materialization value drift")

    runtime = state.get("runtimeBytecode", "")
    if not isinstance(runtime, str) or not runtime.startswith("0x") or len(runtime) <= 2:
        raise SmokeError("Identity materialized runtime missing")
    runtime_hash = cast("keccak", runtime).lower()
    if runtime_hash != state.get("runtimeCodeHash", "").lower():
        raise SmokeError("Identity materialized runtime hash mismatch")

    compiler = artifact.get("compiler", {})
    expected_compiler = {
        "solidity": "0.8.24",
        "evmVersion": "cancun",
        "optimizer": True,
        "optimizerRuns": 200,
        "viaIR": True,
    }
    for key, value in expected_compiler.items():
        if compiler.get(key) != value:
            raise SmokeError(f"Identity compiler profile drift for {key}")
    if artifact.get("sourceBlobSha1") != state.get("sourceBlobSha1"):
        raise SmokeError("Identity source provenance drift between artifact and predeploy state")
    if artifact.get("abiSha256") != state.get("buildArtifactAbiSha256"):
        raise SmokeError("Identity ABI provenance drift between artifact and predeploy state")

    plan_entries = [x for x in plan.get("predeploys", []) if x.get("name") == "Identity420"]
    if len(plan_entries) != 1:
        raise SmokeError("predeploy plan Identity420 cardinality drift")
    pe = plan_entries[0]
    if pe.get("address", "").lower() != IDENTITY or pe.get("status") != "ARTIFACT_READY":
        raise SmokeError("predeploy plan Identity420 is not frozen ARTIFACT_READY")
    if pe.get("runtime_code_hash", "").lower() != runtime_hash:
        raise SmokeError("predeploy plan Identity runtime hash drift")
    if pe.get("predeploy_state") != "contracts/config/predeploy/Identity420-predeploy-state.json":
        raise SmokeError("predeploy plan Identity state path drift")

    dep_entries = [x for x in deployment.get("contracts", []) if x.get("name") == "Identity420"]
    if len(dep_entries) != 1:
        raise SmokeError("deployment manifest Identity420 cardinality drift")
    de = dep_entries[0]
    if de.get("address", "").lower() != IDENTITY:
        raise SmokeError("deployment manifest Identity address drift")
    if de.get("runtime_code_hash", "").lower() != runtime_hash:
        raise SmokeError("deployment manifest Identity runtime hash drift")
    if de.get("artifact_status") != "ID_AUDIT_5_ARTIFACT_READY":
        raise SmokeError("deployment manifest Identity artifact status drift")

    fixed = namespace.get("fixedAssignments", [])
    owners = [x for x in fixed if str(x.get("address", "")).lower() == IDENTITY]
    if len(owners) != 1 or owners[0].get("name") != "Identity420":
        raise SmokeError("frozen namespace does not uniquely assign 0x0436 to Identity420")

    return {
        "address": IDENTITY,
        "runtimeCodeHash": runtime_hash,
        "runtimeCodeBytes": state.get("runtimeCodeBytes"),
        "storageRoot": state.get("storageRoot"),
        "governanceTimelock": TIMELOCK,
        "sourceBlobSha1": state.get("sourceBlobSha1"),
        "abiSha256": state.get("buildArtifactAbiSha256"),
        "status": "OFFLINE_RELEASE_TREE_VERIFIED",
    }


def live_verify(rpc_url: str, expected_chain_id: int) -> dict:
    if not rpc_url:
        raise SmokeError("--rpc-url is required for live smoke")
    if expected_chain_id <= 0:
        raise SmokeError("--expected-chain-id must be positive")

    offline = offline_verify()

    chain_id = int(cast("chain-id", "--rpc-url", rpc_url), 10)
    if chain_id != expected_chain_id:
        raise SmokeError(f"chain ID mismatch: expected {expected_chain_id}, got {chain_id}")

    code = cast("code", IDENTITY, "--rpc-url", rpc_url).lower()
    if code in ("", "0x"):
        raise SmokeError("no deployed code at Identity420 frozen address")
    code_hash = cast("keccak", code).lower()
    if code_hash != offline["runtimeCodeHash"]:
        raise SmokeError("live Identity420 runtime hash mismatch")

    system_name = cast("call", IDENTITY, "systemName()(string)", "--rpc-url", rpc_url).strip().strip('"')
    if system_name != "Identity420":
        raise SmokeError(f"Identity420 systemName mismatch: {system_name!r}")

    version = cast("call", IDENTITY, "protocolVersion()(uint32)", "--rpc-url", rpc_url).strip()
    if version != EXPECTED_VERSION:
        raise SmokeError(f"Identity420 protocolVersion mismatch: expected {EXPECTED_VERSION}, got {version}")

    timelock = cast("call", IDENTITY, "governanceTimelock()(address)", "--rpc-url", rpc_url).strip().lower()
    if timelock != TIMELOCK:
        raise SmokeError(f"Identity420 GovernanceTimelock mismatch: {timelock}")

    zero = "0x" + "00" * 32
    unknown_valid = cast(
        "call", IDENTITY, "credentialValid(bytes32)(bool)", zero, "--rpc-url", rpc_url
    ).strip().lower()
    if unknown_valid not in ("false", "0"):
        raise SmokeError("unknown zero credential did not fail closed")

    return {
        **offline,
        "chainId": chain_id,
        "systemName": system_name,
        "protocolVersion": int(version),
        "unknownCredentialFailsClosed": True,
        "status": "LIVE_READ_ONLY_SMOKE_PASS",
    }


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--offline", action="store_true", help="verify retained release-tree/predeploy authority only")
    parser.add_argument("--rpc-url", help="qualified RPC endpoint; never printed")
    parser.add_argument("--expected-chain-id", type=int, help="required with --rpc-url")
    parser.add_argument("--json", action="store_true", help="emit machine-readable result")
    args = parser.parse_args(argv)

    try:
        if args.rpc_url:
            if args.expected_chain_id is None:
                raise SmokeError("--expected-chain-id is required with --rpc-url")
            result = live_verify(args.rpc_url, args.expected_chain_id)
        else:
            result = offline_verify()

        if args.json:
            print(json.dumps(result, indent=2, sort_keys=True))
        else:
            print("Identity420 operator smoke PASS")
            for key in ("status", "address", "runtimeCodeHash", "governanceTimelock", "chainId", "systemName", "protocolVersion"):
                if key in result:
                    print(f"{key}={result[key]}")
        return 0
    except SmokeError as exc:
        print(f"Identity420 operator smoke FAILED: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
