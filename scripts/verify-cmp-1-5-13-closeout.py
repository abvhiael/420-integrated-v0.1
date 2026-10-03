#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LEDGER = ROOT / "contracts/config/compute-market/cmp-1.5.13-phase-closeout.json"
ROADMAP = ROOT / "docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"
CLOSEOUT = ROOT / "docs/compute-market/CMP-1.5.13-PHASE-CLOSEOUT.md"
RELEASE = ROOT / "contracts/config/compute-market/cmp-1.5.12-release-candidate.json"

def fail(msg):
    raise SystemExit("CMP-1.5.13 closeout verification failed: " + msg)

d = json.loads(LEDGER.read_text())
if d.get("step") != "CMP-1.5.13" or d.get("canonical_definition") != "Phase closeout":
    fail("step/definition drift")
if d.get("status") != "LEVEL_3_QUALIFICATION_PENDING":
    fail("ledger must remain qualification-pending; final exact-SHA proof belongs in durable evidence")
if d.get("repository_closeout_candidate") is not True or d.get("live_release") is not False:
    fail("repository/live closeout flags drift")
rec = d.get("reconciliation", {})
if rec.get("main_sha") != "14d46231aa4350b2e84dee52f0f664bdd2e785f4":
    fail("reconciliation main SHA drift")
if rec.get("behind_main") != 0:
    fail("candidate was not reconciled to current main")

expected = [f"CMP-1.5.{i}" for i in range(13)]
if d.get("qualified_prerequisites") != expected:
    fail("CMP-1.5.0 through CMP-1.5.12 prerequisite inventory drift")

for key in ("prerequisite_evidence","phase_sources","retained_tests","retained_configuration","retained_client_surfaces"):
    values = d.get(key)
    if not isinstance(values, list) or not values:
        fail(f"{key} missing")
    if len(values) != len(set(values)):
        fail(f"{key} has duplicates")
    for rel in values:
        if not (ROOT / rel).is_file():
            fail(f"missing inventoried path {rel}")

for i, rel in enumerate(d["prerequisite_evidence"]):
    ev = json.loads((ROOT / rel).read_text())
    if ev.get("step") != f"CMP-1.5.{i}":
        fail(f"evidence step mismatch {rel}")
    if not ev.get("implementation_sha"):
        fail(f"missing implementation SHA {rel}")
    state = str(ev.get("completion_state",""))
    if "COMPLETE" not in state:
        fail(f"prerequisite not complete {rel}")

release = json.loads(RELEASE.read_text())
if release.get("repository_ready") is not True or release.get("live_qualified") is not False:
    fail("release candidate readiness/live state drift")
if release.get("status") != "REPOSITORY_READY_LIVE_BLOCKED":
    fail("release candidate status drift")
for k in ("public_testnet_available","live_compute_stake_deployment_qualified","protocol_registry_publication_complete"):
    if release.get("dependency_reconciliation",{}).get(k) is not False:
        fail(f"live blocker {k} must remain false")

lvl3 = d.get("level_3_required",{})
for k in ("solidity_full_inventory","genesis_address_authority","integrated_global","docs_global","retained_compute_suite","indexer_global","sdk_build_test","release_config_verification","adversarial_invariant_security"):
    if lvl3.get(k) is not True:
        fail(f"Level 3 owner missing {k}")

if d.get("next_canonical_step") != "CMP-2.1 — Worker offers":
    fail("next canonical step drift")

road = ROADMAP.read_text()
for i in range(13):
    marker = f"### CMP-1.5.{i} —"
    pos = road.find(marker)
    if pos < 0:
        fail(f"roadmap missing CMP-1.5.{i}")
    chunk = road[pos:pos+500]
    if i < 13 and i != 13 and i <= 12 and "COMPLETE" not in chunk:
        fail(f"roadmap prerequisite CMP-1.5.{i} not COMPLETE")

close = CLOSEOUT.read_text()
for heading in (
    "## Canonical definition","## Reconciliation baseline","## Gap analysis","## Phase inventory",
    "## Authority and economic boundaries","## Client/service reconciliation",
    "## Repository qualification versus live deployment","## Level 3 qualification gate","## Completion"
):
    if heading not in close:
        fail(f"missing heading {heading}")

print("CMP-1.5.13 phase closeout inventory/reconciliation: READY FOR LEVEL 3")
