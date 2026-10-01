#!/usr/bin/env python3
"""Mechanical ID-AUDIT-4 artifact/reference qualification."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "contracts/artifacts/Identity420.json"
SRC = ROOT / "contracts/src/apps/Identity420.sol"
CAT = ROOT / "developer-hub/catalogue/local.example.json"
GEN_CONTRACTS = ROOT / "docs/reference/generated/contracts.md"
GEN_EVENTS = ROOT / "docs/reference/generated/events-errors.md"
ABI_MANIFEST = ROOT / "420-indexer/src/abi-manifest.ts"
PREDEPLOY = ROOT / "contracts/config/predeploy/predeploy-plan.json"
IFACE = ROOT / "contracts/src/interfaces/genesis/IIdentityCredential420.sol"

ADDRESS = "0x0000000000000000000000000000000000000436"
ARTIFACT_PATH = "contracts/artifacts/Identity420.json"
INTERFACE_PATH = "contracts/src/interfaces/genesis/IIdentityCredential420.sol"

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


art = load(ART)
cat = load(CAT)
pre = load(PREDEPLOY)

if art.get("schema") != "420-identity-build-artifact-v1":
    fail("Identity artifact schema drift")
if art.get("status") != "ID_AUDIT_4_GENERATED_ARTIFACT":
    fail("Identity artifact status drift")
if art.get("contractName") != "Identity420":
    fail("Identity artifact contractName drift")
if art.get("canonicalAddress", "").lower() != ADDRESS:
    fail("Identity artifact canonical address drift")
if art.get("source") != "contracts/src/apps/Identity420.sol":
    fail("Identity artifact source path drift")
if art.get("sourceBlobSha1") != git_blob_sha(SRC):
    fail("Identity artifact source blob does not match exact source")

compiler = art.get("compiler", {})
for key, expected in {
    "solidity": "0.8.24",
    "evmVersion": "cancun",
    "optimizer": True,
    "optimizerRuns": 200,
    "viaIR": True,
}.items():
    if compiler.get(key) != expected:
        fail(f"Identity artifact compiler profile drift: {key}")

abi = art.get("abi")
if not isinstance(abi, list) or not abi:
    fail("Identity artifact ABI missing")
else:
    canonical = json.dumps(abi, separators=(",", ":"), ensure_ascii=True)
    expected_abi = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    if art.get("abiSha256") != expected_abi:
        fail("Identity artifact ABI SHA-256 mismatch")

creation = art.get("creationBytecode")
runtime = art.get("deployedBytecodeTemplate")
for label, value in [("creationBytecode", creation), ("deployedBytecodeTemplate", runtime)]:
    if not isinstance(value, str) or not value.startswith("0x") or len(value) <= 2:
        fail(f"Identity artifact {label} missing")
if isinstance(creation, str) and creation.startswith("0x"):
    expected_creation = hashlib.sha256(bytes.fromhex(creation[2:])).hexdigest()
    if art.get("creationBytecodeSha256") != expected_creation:
        fail("Identity creation-bytecode SHA-256 mismatch")

refs = art.get("immutableReferences")
if not isinstance(refs, dict) or len(refs) != 1:
    fail("Identity artifact must retain exactly one immutable identifier")
else:
    count = sum(len(v) for v in refs.values() if isinstance(v, list))
    if art.get("immutableReferenceCount") != count or count < 1:
        fail("Identity immutable reference count mismatch")

boundary = art.get("runtimeIdentityBoundary", {})
if boundary.get("templateOnly") is not True:
    fail("ID-AUDIT-4 must retain a runtime template, not a materialized runtime")
if boundary.get("finalRuntimeCodeHashAvailable") is not False:
    fail("ID-AUDIT-4 must not claim final runtime hash before ID-AUDIT-5")
if art.get("constructor", {}).get("materializationOwner") != "ID-AUDIT-5":
    fail("Identity immutable materialization ownership drift")

entries = [x for x in cat.get("contracts", []) if x.get("name") == "Identity420"]
if len(entries) != 1:
    fail("catalogue must contain exactly one Identity420 entry")
else:
    entry = entries[0]
    if entry.get("protocol") != "420Identity":
        fail("catalogue Identity protocol drift")
    if entry.get("address", "").lower() != ADDRESS:
        fail("catalogue Identity address drift")
    if entry.get("artifact") != ARTIFACT_PATH:
        fail("catalogue Identity artifact path drift")
    if entry.get("interface") != INTERFACE_PATH:
        fail("catalogue Identity interface path drift")
    if entry.get("abiSha256") != art.get("abiSha256"):
        fail("catalogue Identity ABI hash mismatch")
    if entry.get("verified") is not True:
        fail("catalogue Identity retained artifact must be verified")
    if entry.get("version") != "3.0.0":
        fail("catalogue Identity version must reflect protocolVersion 3")

pre_entries = [x for x in pre.get("predeploys", []) if x.get("name") == "Identity420"]
if len(pre_entries) != 1:
    fail("predeploy plan must contain exactly one Identity420 entry")
else:
    pre_entry = pre_entries[0]
    if pre_entry.get("address", "").lower() != ADDRESS:
        fail("predeploy Identity address drift")
    if pre_entry.get("artifact") != ARTIFACT_PATH:
        fail("predeploy Identity artifact path drift")
    # ID-AUDIT-4 intentionally leaves SOURCE_READY; ID-AUDIT-5 owns artifact-ready predeploy state.
    if pre_entry.get("status") != "SOURCE_READY":
        fail("ID-AUDIT-4 must not advance Identity predeploy status before ID-AUDIT-5")

if not IFACE.is_file():
    fail("frozen Identity credential interface missing")

contracts_text = GEN_CONTRACTS.read_text(encoding="utf-8") if GEN_CONTRACTS.is_file() else ""
events_text = GEN_EVENTS.read_text(encoding="utf-8") if GEN_EVENTS.is_file() else ""
for label, text in [("contracts reference", contracts_text), ("events reference", events_text)]:
    if "Identity420" not in text:
        fail(f"generated {label} missing Identity420")

if f"Catalogue address: `{ADDRESS}` (**local example only**)" not in contracts_text:
    fail("generated contract reference Identity address/scope missing")
if f"Declared artifact: `{ARTIFACT_PATH}` (present)" not in contracts_text:
    fail("generated contract reference does not use retained Identity artifact")
if f"Declared interface: `{INTERFACE_PATH}` (present)" not in contracts_text:
    fail("generated contract reference does not use frozen Identity interface")

identity_section = contracts_text.split("## Identity420", 1)
if len(identity_section) != 2 or "Distributable verified ABI: **YES**" not in identity_section[1].split("\n## ", 1)[0]:
    fail("generated Identity reference does not publish qualified ABI")

abi_manifest_text = ABI_MANIFEST.read_text(encoding="utf-8") if ABI_MANIFEST.is_file() else ""
if "Identity420: '420Identity'" not in abi_manifest_text:
    fail("420Indexer ABI manifest mapping for Identity420 is missing")

event_names = {item.get("name") for item in abi if isinstance(item, dict) and item.get("type") == "event"} if isinstance(abi, list) else set()
required_events = {
    "ProfileCreated",
    "ProfileUpdated",
    "PrimaryNameSet",
    "ProfileControllerTransferStarted",
    "ProfileControllerTransferred",
    "IssuerSet",
    "CredentialIssued",
    "CredentialRevoked",
    "CredentialRejected",
}
missing_events = sorted(required_events - event_names)
if missing_events:
    fail("Identity artifact ABI missing events: " + ", ".join(missing_events))

if errors:
    print("ID-AUDIT-4 qualification FAILED", file=sys.stderr)
    for error in errors:
        print(" - " + error, file=sys.stderr)
    raise SystemExit(1)

print("ID-AUDIT-4 qualification PASS")
print("Identity420 address: " + ADDRESS)
print("artifact: " + ARTIFACT_PATH)
print("interface: " + INTERFACE_PATH)
print("sourceBlobSha1: " + str(art.get("sourceBlobSha1")))
print("ABI SHA-256: " + str(art.get("abiSha256")))
print("deployed template keccak256: " + str(art.get("deployedBytecodeTemplateKeccak256")))
print("immutable references: " + str(art.get("immutableReferenceCount")))
