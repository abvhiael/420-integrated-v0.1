#!/usr/bin/env python3
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
LEDGER = ROOT / "contracts/config/compute-market/cmp-1.3-deferred-closeout-ledger.json"
CLOSEOUT = ROOT / "docs/compute-market/CMP-1.3.16-WORKER-REGISTRY-PHASE-CLOSEOUT.md"
DEFERRED = ROOT / "docs/compute-market/CMP-1.3-DEFERRED-CLOSEOUT-DRAFT.md"
INVARIANTS = ROOT / "docs/compute-market/cmp-1.3.14-invariant-evidence.json"
RELEASE = ROOT / "contracts/config/compute-market/cmp-1.3.15-worker-release-candidate.json"

def fail(msg: str) -> None:
    print(f"CMP-1.3.16 closeout verification failed: {msg}", file=sys.stderr)
    raise SystemExit(1)

data = json.loads(LEDGER.read_text())
if data.get("schema") != "420Integrated.ComputeMarket.CMP-1.3.16.CloseoutLedger.v1":
    fail("unexpected closeout-ledger schema")
if data.get("step") != "CMP-1.3.16":
    fail("wrong closeout step")
if data.get("status") != "QUALIFICATION_PENDING":
    fail("ledger must remain a qualification-pending inventory; final exact-SHA proof belongs in the durable closeout document")
if data.get("repository_closeout_candidate") is not True:
    fail("closeout candidate flag must be true")
if data.get("live_release") is not False:
    fail("repository closeout must not claim live release")
if data.get("migrated_from_deferred_closeout") is not True:
    fail("deferred closeout migration must be explicit")

expected_prereqs = [f"CMP-1.3.{i}" for i in range(8, 16)]
if data.get("qualified_prerequisites") != expected_prereqs:
    fail("CMP-1.3.8 through CMP-1.3.15 prerequisites must be recorded exactly")

for key in ("phase_sources", "retained_tests", "retained_client_surfaces", "retained_docs", "retained_configuration"):
    values = data.get(key)
    if not isinstance(values, list) or not values:
        fail(f"{key} must be a non-empty inventory")
    if len(values) != len(set(values)):
        fail(f"{key} contains duplicate entries")
    for rel in values:
        if not (ROOT / rel).is_file():
            fail(f"missing inventoried path: {rel}")

inv = json.loads(INVARIANTS.read_text())
ids = [item.get("id") for item in inv.get("invariants", [])]
expected_ids = [f"CMP-INV-{i:03d}" for i in range(1, 31)]
if ids != expected_ids:
    fail("retained invariant matrix is not exactly CMP-INV-001 through CMP-INV-030")

if data.get("invariant_evidence", {}).get("matrix") != "docs/compute-market/cmp-1.3.14-invariant-evidence.json":
    fail("wrong invariant evidence matrix")
if data.get("invariant_evidence", {}).get("authority_separation_verified") is not True:
    fail("authority-separation conclusion must be retained")
if not data.get("authority_boundaries"):
    fail("authority boundaries must remain explicit")
if not data.get("external_release_blockers"):
    fail("live release blockers must remain explicit")

release = json.loads(RELEASE.read_text())
if release.get("repository_ready") is not True:
    fail("CMP-1.3.15 release candidate must remain repository ready")
if release.get("live_qualified") is not False:
    fail("CMP-1.3.15 live deployment must remain fail-closed until real evidence exists")

deferred_text = DEFERRED.read_text()
if "MIGRATED INTO AUTHORIZED CMP-1.3.16 CLOSEOUT" not in deferred_text:
    fail("deferred closeout provenance was not marked migrated")
if not CLOSEOUT.is_file():
    fail("missing durable CMP-1.3.16 closeout document")

closeout_text = CLOSEOUT.read_text()
required_headings = [
    "## Canonical definition",
    "## Repository baseline",
    "## Gap analysis",
    "## Inventory",
    "## Historical evidence reconciliation",
    "## Invariant and authority-boundary reconciliation",
    "## Repository qualification versus live deployment",
    "## Qualification gate",
    "## Completion",
]
for heading in required_headings:
    if heading not in closeout_text:
        fail(f"missing closeout heading: {heading}")

print("CMP-1.3.16 closeout inventory/reconciliation: qualified for exact-head CI")
