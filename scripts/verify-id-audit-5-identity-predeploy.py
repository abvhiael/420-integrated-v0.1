#!/usr/bin/env python3
"""Independent ID-AUDIT-5 verification of retained Identity Genesis materialization."""
from __future__ import annotations

import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / "contracts/config/predeploy/Identity420-predeploy-state.json"
ARTIFACT = ROOT / "contracts/artifacts/Identity420.json"
PLAN = ROOT / "contracts/config/predeploy/predeploy-plan.json"
DEPLOYMENT = ROOT / "contracts/config/deployment-manifest.json"
STORAGE_INIT = ROOT / "contracts/config/predeploy/storage-init.json"
NAMESPACE = ROOT / "contracts/config/genesis-address-namespace.json"
SOURCE = ROOT / "contracts/src/apps/Identity420.sol"

ADDRESS = "0x0000000000000000000000000000000000000436"
TIMELOCK = "0x0000000000000000000000000000000000000429"
ARTIFACT_PATH = "contracts/artifacts/Identity420.json"
STATE_PATH = "contracts/config/predeploy/Identity420-predeploy-state.json"
EMPTY_STORAGE_ROOT = "0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421"

errors: list[str] = []


def fail(message: str) -> None:
    errors.append(message)


def load(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        fail(f"{path.relative_to(ROOT)} unreadable: {exc}")
        return {}


def git_blob_sha(path: Path) -> str:
    try:
        return subprocess.check_output(
            ["git", "hash-object", str(path.relative_to(ROOT))],
            cwd=ROOT,
            text=True,
        ).strip()
    except subprocess.CalledProcessError as exc:
        fail(f"git hash-object failed for {path.relative_to(ROOT)}: {exc}")
        return ""


def cast_keccak(value: str) -> str:
    try:
        return subprocess.check_output(["cast", "keccak", value], cwd=ROOT, text=True).strip().lower()
    except subprocess.CalledProcessError as exc:
        fail(f"cast keccak failed: {exc}")
        return ""


state = load(STATE)
artifact = load(ARTIFACT)
plan = load(PLAN)
deployment = load(DEPLOYMENT)
storage_init = load(STORAGE_INIT)
namespace = load(NAMESPACE)

if state.get("schema") != "420-identity-predeploy-state-v1":
    fail("Identity predeploy-state schema drift")
if state.get("status") != "ID_AUDIT_5_FINAL_PREDEPLOY_STATE":
    fail("Identity predeploy-state status drift")
if state.get("contractName") != "Identity420":
    fail("Identity predeploy-state contractName drift")
if state.get("address", "").lower() != ADDRESS:
    fail("Identity predeploy-state address drift")
if state.get("buildArtifact") != ARTIFACT_PATH:
    fail("Identity predeploy-state artifact path drift")
if state.get("sourceBlobSha1") != git_blob_sha(SOURCE):
    fail("Identity predeploy-state source provenance drift")
if state.get("sourceBlobSha1") != artifact.get("sourceBlobSha1"):
    fail("Identity predeploy-state source does not match ID-AUDIT-4 artifact")

runtime = state.get("runtimeBytecode")
if not isinstance(runtime, str) or not runtime.startswith("0x") or len(runtime) <= 2:
    fail("Identity materialized runtime missing")
else:
    if state.get("runtimeCodeHash") != cast_keccak(runtime):
        fail("Identity runtimeCodeHash does not match materialized runtime")
    if state.get("runtimeCodeBytes") != (len(runtime) - 2) // 2:
        fail("Identity runtime byte length mismatch")

constructor = state.get("constructorMaterialization", {})
if constructor.get("governanceTimelock", "").lower() != TIMELOCK:
    fail("Identity GovernanceTimelock materialization drift")
if constructor.get("strategy") != "DIRECT_GENESIS_PREDEPLOY_IMMUTABLE_MATERIALIZATION":
    fail("Identity constructor materialization strategy drift")
materialized = constructor.get("materializedReferences")
if not isinstance(materialized, list) or not materialized:
    fail("Identity materialized immutable references missing")
else:
    if constructor.get("immutableReferenceCount") != len(materialized):
        fail("Identity materialized immutable reference count mismatch")
    if len(materialized) != artifact.get("immutableReferenceCount"):
        fail("Identity materialized references disagree with ID-AUDIT-4 artifact")
    for ref in materialized:
        if ref.get("value", "").lower() != TIMELOCK:
            fail("Identity immutable materialized with unexpected value")
        if ref.get("length") != 32:
            fail("Identity immutable materialized with unexpected width")

if state.get("storage") != {} or state.get("storageSlotCount") != 0:
    fail("Identity Genesis mutable storage must begin explicitly empty")
if state.get("storageRoot") != EMPTY_STORAGE_ROOT:
    fail("Identity empty storage root mismatch")

expected_init = {"constructor": ["governance_timelock"]}
if storage_init.get("governance_timelock", "").lower() != TIMELOCK:
    fail("storage-init governance timelock drift")
if storage_init.get("entries", {}).get("Identity420") != expected_init:
    fail("storage-init Identity constructor declaration drift")

plan_entries = [x for x in plan.get("predeploys", []) if x.get("name") == "Identity420"]
if len(plan_entries) != 1:
    fail("predeploy plan must contain exactly one Identity420 entry")
else:
    entry = plan_entries[0]
    if entry.get("address", "").lower() != ADDRESS:
        fail("predeploy plan Identity address drift")
    if entry.get("status") != "ARTIFACT_READY":
        fail("predeploy plan Identity status is not ARTIFACT_READY")
    if entry.get("artifact") != ARTIFACT_PATH:
        fail("predeploy plan Identity artifact path drift")
    if entry.get("predeploy_state") != STATE_PATH:
        fail("predeploy plan Identity state path drift")
    if entry.get("runtime_code_hash") != state.get("runtimeCodeHash"):
        fail("predeploy plan Identity runtime hash mismatch")
    if entry.get("source_blob_sha1") != state.get("sourceBlobSha1"):
        fail("predeploy plan Identity source provenance mismatch")

dep_entries = [x for x in deployment.get("contracts", []) if x.get("name") == "Identity420"]
if len(dep_entries) != 1:
    fail("deployment manifest must contain exactly one Identity420 entry")
else:
    entry = dep_entries[0]
    if entry.get("address", "").lower() != ADDRESS:
        fail("deployment manifest Identity address drift")
    if entry.get("runtime_artifact") != ARTIFACT_PATH:
        fail("deployment manifest Identity artifact path drift")
    if entry.get("predeploy_state") != STATE_PATH:
        fail("deployment manifest Identity state path drift")
    if entry.get("runtime_code_hash") != state.get("runtimeCodeHash"):
        fail("deployment manifest Identity runtime hash mismatch")
    if entry.get("source_blob_sha1") != state.get("sourceBlobSha1"):
        fail("deployment manifest Identity source provenance mismatch")
    if entry.get("artifact_status") != "ID_AUDIT_5_ARTIFACT_READY":
        fail("deployment manifest Identity artifact status drift")

fixed = namespace.get("fixedAssignments", [])
owners = [x for x in fixed if str(x.get("address", "")).lower() == ADDRESS]
if len(owners) != 1 or owners[0].get("name") != "Identity420":
    fail("namespace 0x0436 is not uniquely owned by Identity420")
identity_entries = [x for x in fixed if x.get("name") == "Identity420"]
if len(identity_entries) != 1 or identity_entries[0].get("address", "").lower() != ADDRESS:
    fail("namespace Identity420 assignment drift")

if errors:
    print("ID-AUDIT-5 qualification FAILED", file=sys.stderr)
    for error in errors:
        print(" - " + error, file=sys.stderr)
    raise SystemExit(1)

print("ID-AUDIT-5 qualification PASS")
print("Identity420 address: " + ADDRESS)
print("GovernanceTimelock: " + TIMELOCK)
print("runtimeCodeHash: " + str(state.get("runtimeCodeHash")))
print("storageRoot: " + str(state.get("storageRoot")))
print("sourceBlobSha1: " + str(state.get("sourceBlobSha1")))
print("immutableReferenceCount: " + str(constructor.get("immutableReferenceCount")))
