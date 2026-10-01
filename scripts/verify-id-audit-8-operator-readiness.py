#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
DOC = ROOT / "docs/apps/identity/deployment-operations.md"
INDEX = ROOT / "docs/apps/identity/index.md"
STATE = ROOT / "contracts/config/predeploy/Identity420-predeploy-state.json"
ARTIFACT = ROOT / "contracts/artifacts/Identity420.json"
PLAN = ROOT / "contracts/config/predeploy/predeploy-plan.json"
DEPLOYMENT = ROOT / "contracts/config/deployment-manifest.json"
NAMESPACE = ROOT / "contracts/config/genesis-address-namespace.json"
SOURCE = ROOT / "contracts/src/apps/Identity420.sol"
SMOKE = ROOT / "scripts/identity-operator-smoke.py"
SMOKE_TEST = ROOT / "scripts/test-identity-operator-smoke.py"

IDENTITY = "0x0000000000000000000000000000000000000436"
TIMELOCK = "0x0000000000000000000000000000000000000429"

errors: list[str] = []

def fail(msg: str) -> None:
    errors.append(msg)

def load(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        fail(f"{path.relative_to(ROOT)} unreadable JSON: {exc}")
        return {}

def read(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except Exception as exc:
        fail(f"{path.relative_to(ROOT)} unreadable: {exc}")
        return ""

def require(text: str, needle: str, label: str | None = None) -> None:
    if needle not in text:
        fail(f"missing {label or needle!r}")

doc = read(DOC)
index = read(INDEX)
state = load(STATE)
artifact = load(ARTIFACT)
plan = load(PLAN)
deployment = load(DEPLOYMENT)
namespace = load(NAMESPACE)
source = read(SOURCE)
smoke = read(SMOKE)
smoke_test = read(SMOKE_TEST)

for heading in [
    "## Canonical deployment identity",
    "## Canonical authority model",
    "## Deployment order",
    "## Configuration and predeploy verification",
    "## Monitoring and events",
    "## Incident response",
    "## Derived-service rebuild",
    "## Rollback and recovery boundaries",
    "## Secrets and key management",
    "## Smoke test procedure",
    "## Known limitations",
    "## Operator release checklist",
]:
    require(doc, heading, heading)

runtime_hash = state.get("runtimeCodeHash")
storage_root = state.get("storageRoot")
source_blob = state.get("sourceBlobSha1")
abi_sha = state.get("buildArtifactAbiSha256")
template_hash = state.get("deployedBytecodeTemplateKeccak256")
runtime_bytes = state.get("runtimeCodeBytes")

for value, label in [
    (IDENTITY, "frozen Identity address"),
    (TIMELOCK, "GovernanceTimelock address"),
    (str(runtime_hash), "runtime code hash"),
    (str(storage_root), "storage root"),
    (str(source_blob), "source blob identity"),
    (str(abi_sha), "ABI digest"),
    (str(template_hash), "runtime-template identity"),
    (str(runtime_bytes), "runtime byte count"),
    ("Solidity", "compiler language"),
    ("0.8.24", "compiler version"),
    ("Cancun", "EVM target"),
]:
    require(doc, value, label)

materialization = state.get("constructorMaterialization", {})
if materialization.get("governanceTimelock", "").lower() != TIMELOCK:
    fail("predeploy state GovernanceTimelock drift")
if materialization.get("immutableReferenceCount") != 4:
    fail("predeploy state immutable-reference count drift")
if state.get("storage") != {} or state.get("storageSlotCount") != 0:
    fail("Identity initial mutable storage is not explicitly empty")
if artifact.get("sourceBlobSha1") != source_blob:
    fail("artifact/source provenance mismatch")
if artifact.get("abiSha256") != abi_sha:
    fail("artifact/ABI provenance mismatch")

plan_entries = [x for x in plan.get("predeploys", []) if x.get("name") == "Identity420"]
if len(plan_entries) != 1:
    fail("predeploy plan must contain exactly one Identity420 entry")
else:
    entry = plan_entries[0]
    if entry.get("address", "").lower() != IDENTITY:
        fail("predeploy plan Identity address drift")
    if entry.get("status") != "ARTIFACT_READY":
        fail("predeploy plan Identity status is not ARTIFACT_READY")
    if entry.get("runtime_code_hash") != runtime_hash:
        fail("predeploy plan runtime hash mismatch")
    if entry.get("predeploy_state") != "contracts/config/predeploy/Identity420-predeploy-state.json":
        fail("predeploy plan state path mismatch")

dep_entries = [x for x in deployment.get("contracts", []) if x.get("name") == "Identity420"]
if len(dep_entries) != 1:
    fail("deployment manifest must contain exactly one Identity420 entry")
else:
    entry = dep_entries[0]
    if entry.get("address", "").lower() != IDENTITY:
        fail("deployment manifest Identity address drift")
    if entry.get("runtime_code_hash") != runtime_hash:
        fail("deployment manifest runtime hash mismatch")
    if entry.get("artifact_status") != "ID_AUDIT_5_ARTIFACT_READY":
        fail("deployment manifest artifact status drift")

fixed = namespace.get("fixedAssignments", [])
owners = [x for x in fixed if str(x.get("address", "")).lower() == IDENTITY]
if len(owners) != 1 or owners[0].get("name") != "Identity420":
    fail("namespace does not uniquely assign 0x0436 to Identity420")

for event in [
    "ProfileCreated",
    "ProfileUpdated",
    "PrimaryNameSet",
    "ProfileControllerTransferStarted",
    "ProfileControllerTransferred",
    "IssuerSet",
    "CredentialIssued",
    "CredentialRevoked",
    "CredentialRejected",
]:
    require(doc, f"`{event}`", f"monitoring event {event}")

for requirement in [
    "Issuer compromise or suspected compromise",
    "Governance-key compromise",
    "420Indexer rebuild",
    "Search rebuild",
    "Explorer recovery",
    "subject credential rejection is irreversible",
    "no local pause switch",
    "does not prove legal identity",
    "Wallet uses chain-specific verified Identity/Names bindings",
    "ID-AUDIT-9",
]:
    require(doc, requirement, requirement)

require(index, "deployment-operations.md", "Identity index operator-runbook link")
require(index, "operator", "Identity index operator audience")

for token in [
    "offline_verify",
    "live_verify",
    "cast("chain-id"",
    "cast("code"",
    "systemName()(string)",
    "protocolVersion()(uint32)",
    "governanceTimelock()(address)",
    "credentialValid(bytes32)(bool)",
    "--expected-chain-id",
    "never printed",
]:
    require(smoke, token, f"smoke-tool control {token}")

for forbidden in [
    "eth_sendTransaction",
    "cast("send"",
    "privateKey",
    "mnemonic",
    "seedPhrase",
]:
    if forbidden in smoke:
        fail(f"operator smoke must remain read-only/secret-free: {forbidden}")

for token in [
    "test_offline_release_tree_verifies",
    "test_offline_runtime_hash_drift_fails_closed",
    "test_live_smoke_checks_chain_code_identity_version_timelock_and_unknown_credential",
    "test_live_wrong_chain_fails_closed_before_contract_calls",
    "test_live_missing_code_fails_closed",
    "test_live_wrong_runtime_hash_fails_closed",
    "test_live_wrong_governance_timelock_fails_closed",
    "test_live_unknown_credential_must_fail_closed",
]:
    require(smoke_test, token, f"smoke test {token}")

for source_token in [
    "function setIssuer(",
    "function setIssuerTrust(",
    "function revokeCredential(",
    "function credentialValid(",
]:
    require(source, source_token, f"operator-documented contract control {source_token}")

if errors:
    print("ID-AUDIT-8 operator readiness verification FAILED", file=sys.stderr)
    for error in errors:
        print(" - " + error, file=sys.stderr)
    raise SystemExit(1)

print("ID-AUDIT-8 operator readiness verification PASS")
print("Identity address:", IDENTITY)
print("GovernanceTimelock:", TIMELOCK)
print("runtimeCodeHash:", runtime_hash)
print("operator runbook:", DOC.relative_to(ROOT))
print("read-only smoke:", SMOKE.relative_to(ROOT))
