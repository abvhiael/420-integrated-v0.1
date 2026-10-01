#!/usr/bin/env python3
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
DOC = ROOT / "docs/apps/names/deployment-operations.md"
INDEX = ROOT / "docs/apps/names/index.md"
ARTIFACT = ROOT / "contracts/artifacts/Names420.json"
STATE = ROOT / "contracts/config/predeploy/Names420-predeploy-state.json"
PLAN = ROOT / "contracts/config/predeploy/predeploy-plan.json"
DEPLOYMENT = ROOT / "contracts/config/deployment-manifest.json"
DESCRIPTOR = ROOT / "420-indexer/descriptors/names420-v3.json"
SOURCE = ROOT / "contracts/src/apps/Names420.sol"
ROADMAP = ROOT / "docs/ROADMAP.md"

errors = []

def fail(msg):
    errors.append(msg)

def load(path):
    try:
        return json.loads(path.read_text())
    except Exception as exc:
        fail(f"{path.relative_to(ROOT)} unreadable JSON: {exc}")
        return {}

def require_text(text, needle, label=None):
    if needle not in text:
        fail(f"operator runbook missing {label or needle!r}")

if not DOC.exists():
    raise SystemExit("missing docs/apps/names/deployment-operations.md")

doc = DOC.read_text()
index = INDEX.read_text()
artifact = load(ARTIFACT)
state = load(STATE)
plan = load(PLAN)
deployment = load(DEPLOYMENT)
descriptor = load(DESCRIPTOR)
source = SOURCE.read_text()
roadmap = ROADMAP.read_text()

for heading in [
    "## Canonical deployment identity",
    "## Deployment order",
    "## Configuration",
    "## Deployment verification",
    "## Monitoring",
    "## Recovery",
    "## Threat model",
    "## Known limitations",
    "## Operator release checklist",
]:
    require_text(doc, heading, heading)

expected_address = "0x0000000000000000000000000000000000000435"
retired_address = "0x0000000000000000000000000000000000000445"
timelock = "0x0000000000000000000000000000000000000429"
runtime_hash = state.get("runtimeCodeHash")
storage_root = state.get("storageRoot")
source_blob = state.get("sourceBlobSha1")
artifact_digest = artifact.get("artifactPayloadSha256")
descriptor_digest = descriptor.get("descriptorSha256")

for value, label in [
    (expected_address, "canonical Names address"),
    (retired_address, "retired Names address warning"),
    (timelock, "governance timelock"),
    (runtime_hash, "runtime code hash"),
    (storage_root, "Genesis storage root"),
    (source_blob, "source blob SHA-1"),
    (artifact_digest, "artifact payload SHA-256"),
    (descriptor_digest, "Indexer descriptor SHA-256"),
]:
    if not isinstance(value, str) or not value:
        fail(f"repository source missing {label}")
    else:
        require_text(doc, value, label)

if artifact.get("contractName") != "Names420":
    fail("frozen artifact contractName is not Names420")
if artifact.get("canonicalAddress") != expected_address:
    fail("frozen artifact canonicalAddress drift")
if artifact.get("sourceBlobSha1") != source_blob:
    fail("artifact/predeploy source identity mismatch")
if state.get("address") != expected_address:
    fail("Names predeploy-state address drift")
if state.get("constructorMaterialization", {}).get("governanceTimelock") != timelock:
    fail("Names governance immutable drift")
if state.get("storageSlotCount") != 0 or state.get("storage") != {}:
    fail("Names Genesis mutable storage is no longer empty")

roots = state.get("storageLayoutRoots", {})
if roots != {"commitments": "1", "primaryNameByAddress": "2", "records": "0"}:
    fail(f"Names storage-layout roots drift: {roots}")

names_predeploys = [p for p in plan.get("predeploys", []) if p.get("name") == "Names420"]
if len(names_predeploys) != 1:
    fail("predeploy plan must contain exactly one Names420 entry")
else:
    p = names_predeploys[0]
    if p.get("address") != expected_address:
        fail("predeploy plan Names420 address drift")
    if p.get("runtime_code_hash") != runtime_hash:
        fail("predeploy plan Names420 runtime hash drift")
    if p.get("predeploy_state") != "contracts/config/predeploy/Names420-predeploy-state.json":
        fail("predeploy plan Names420 state binding drift")

# Deployment manifest shapes have evolved; locate the unique Names420 object recursively.
def objects(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from objects(child)
    elif isinstance(value, list):
        for child in value:
            yield from objects(child)

manifest_names = [o for o in objects(deployment) if o.get("name") == "Names420" or o.get("contractName") == "Names420"]
if manifest_names:
    if not any(o.get("address") == expected_address for o in manifest_names):
        fail("deployment manifest Names420 address drift")
    hash_values = {o.get(k) for o in manifest_names for k in ("runtimeCodeHash","runtime_code_hash","codeHash") if o.get(k)}
    if hash_values and runtime_hash not in hash_values:
        fail("deployment manifest Names420 runtime hash drift")

if descriptor.get("schema") != "420-names-release-descriptor-v1":
    fail("Names descriptor schema drift")
if descriptor.get("contractName") != "Names420" or descriptor.get("protocol") != "420Names":
    fail("Names descriptor identity drift")
if descriptor.get("protocolVersion") != 3:
    fail("Names descriptor protocol version drift")
if descriptor.get("canonicalAddress") != expected_address:
    fail("Names descriptor address drift")
if descriptor.get("artifact", {}).get("runtimeCodeHash") != runtime_hash:
    fail("Names descriptor runtime binding drift")
events = descriptor.get("events", [])
if len(events) != 7:
    fail("Names descriptor must contain exactly seven events")
expected_event_signatures = {
    "CommitmentMade(bytes32,address,uint64)",
    "NameRegistered(bytes32,address,uint64,uint8)",
    "NameRenewed(bytes32,address,uint64)",
    "NameTransferStarted(bytes32,address,address)",
    "NameTransferred(bytes32,address,address)",
    "ResolutionUpdated(bytes32,address,bytes32,bytes32)",
    "ReverseNameSet(address,bytes32)",
}
actual_event_signatures = {event.get("signature") for event in events if isinstance(event, dict)}
if actual_event_signatures != expected_event_signatures:
    fail(f"Names descriptor event signature set drift: {sorted(actual_event_signatures)}")
if len(actual_event_signatures) != len(events):
    fail("Names descriptor contains duplicate or malformed event signatures")

for required in [
    "NAMES-AUDIT-9",
    "60-second",
    "24-hour",
    "30 and 365 days",
    "not authority to mutate user records",
    "no operator/admin name-mutation",
    "ProtocolRegistry",
    "not",
    "direct Names420 runtime dependency",
    "canonical chain state wins",
    "fail closed",
    "seven frozen event families",
]:
    require_text(doc, required)

if "status: pre-genesis" not in doc:
    fail("operator runbook must remain explicitly pre-genesis until NAMES-AUDIT-9 live evidence exists")
if "audience:" not in doc or "operator" not in doc.split("# 420 Names deployment", 1)[0]:
    fail("operator runbook front matter must include operator audience")

if "## Operator documentation" not in index:
    fail("Names index missing Operator documentation section")
if "deployment-operations.md" not in index:
    fail("Names index does not link the operator runbook")

for required_roadmap in [
    "420Names — NAMES-AUDIT testnet handoff",
    "NAMES-AUDIT-9 — production-equivalent testnet deployment qualification",
    "expected chain ID, network and genesis identity",
    "eth_getCode",
    "0x0000000000000000000000000000000000000435",
    "0xa974fffd3a40e7f28db41e4ae30656b33789d2483b18b47c809ce2385de709b7",
    'systemName() == "Names420"',
    "protocolVersion() == 3",
    "0x0000000000000000000000000000000000000429",
    "initial predeploy/storage state",
    "commit/register behavior",
    "commitment timing",
    "renewal",
    "forward resolution",
    "reverse resolution",
    "transfer nomination and acceptance",
    "lease expiry behavior",
    "420Wallet",
    "420Indexer ingestion",
    "420Search reconstruction",
    "restart/reorg/recovery",
    "multi-provider/RPC disagreement handling",
    "fails closed",
    "durable live-chain evidence",
    "must not",
    "NAMES-AUDIT-10 — Genesis acceptance closeout",
    "NAMES-AUDIT-11 — production qualification",
]:
    if required_roadmap not in roadmap:
        fail(f"canonical roadmap missing Names testnet handoff item: {required_roadmap}")

for rel in [
    "contracts/artifacts/Names420.json",
    "contracts/config/predeploy/Names420-predeploy-state.json",
    "contracts/config/predeploy/predeploy-plan.json",
    "contracts/config/deployment-manifest.json",
    "420-indexer/descriptors/names420-v3.json",
    "docs/audit/420NAMES-AUDIT-6-GENESIS-STATE-QUALIFICATION.md",
    "docs/audit/420NAMES-AUDIT-7-INDEXER-SEARCH-QUALIFICATION.md",
]:
    if not (ROOT / rel).exists():
        fail(f"operator runbook dependency missing: {rel}")
    require_text(doc, rel)

# Recovery documentation must not promise an authority surface that source does not have.
for forbidden_function in ["pause", "unpause", "upgradeTo", "migrate", "adminSet", "forceTransfer"]:
    if re.search(rf"function\s+{re.escape(forbidden_function)}\b", source):
        fail(f"Names420 gained operator function {forbidden_function}; runbook recovery model requires review")

if re.search(r"\blive[- ]verified\b", doc, re.I) and "not live" not in doc.lower():
    fail("operator runbook appears to claim live verification without an explicit limitation")

if errors:
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)
    raise SystemExit(1)

print("NAMES_AUDIT_8_OPERATOR_DOCS=PASS")
print(f"canonicalAddress={expected_address}")
print(f"runtimeCodeHash={runtime_hash}")
print(f"storageRoot={storage_root}")
print(f"descriptorSha256={descriptor_digest}")
print(f"descriptorEventSignatures={len(actual_event_signatures)}")
print("requiredSections=9")
