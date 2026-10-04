#!/usr/bin/env python3
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
LEDGER=ROOT/"contracts/config/compute-market/cmp-2.8-phase-closeout.json"
ROADMAP=ROOT/"docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"
CLOSEOUT=ROOT/"docs/compute-market/CMP-2.8-PHASE-CLOSEOUT.md"
FOUNDRY=ROOT/".github/workflows/contracts-foundry.yml"
QUAL=ROOT/".github/workflows/qualification.yml"

def fail(msg):
    raise SystemExit("CMP-2.8 closeout verification failed: "+msg)

for p in (LEDGER,ROADMAP,CLOSEOUT,FOUNDRY,QUAL):
    if not p.is_file(): fail(f"missing {p.relative_to(ROOT)}")

d=json.loads(LEDGER.read_text())
definition="Reconcile the accumulated matching-market graph, run the required Level 3 qualification, preserve durable evidence, and prepare the handoff to CMP-3 — node420 worker runtime."
if d.get("step")!="CMP-2.8" or d.get("canonical_definition")!=definition: fail("step/definition drift")
if d.get("status")!="LEVEL_3_QUALIFICATION_PENDING": fail("ledger must remain qualification-pending until durable exact-SHA evidence")
if d.get("repository_closeout_candidate") is not True or d.get("live_release") is not False: fail("repository/live flags drift")
rec=d.get("reconciliation",{})
if rec.get("main_sha")!="834fcdd58bbe597716657bf69d3f302897f7227f" or rec.get("merge_commit_sha")!="808748b291164e38e0c67afc6640b989815dfb48" or rec.get("behind_main")!=0:
    fail("reconciliation baseline drift")
expected=[f"CMP-2.{i}" for i in range(1,8)]
if d.get("qualified_prerequisites")!=expected: fail("prerequisite step inventory drift")
for key in ("prerequisite_evidence","phase_sources","retained_tests","retained_configuration","retained_client_surfaces"):
    vals=d.get(key)
    if not isinstance(vals,list) or not vals: fail(f"{key} missing")
    if len(vals)!=len(set(vals)): fail(f"{key} duplicates")
    for rel in vals:
        if not (ROOT/rel).is_file(): fail(f"missing inventoried path {rel}")
for rel in d["prerequisite_evidence"]:
    txt=(ROOT/rel).read_text()
    if "COMPLETE" not in txt: fail(f"prerequisite evidence not complete {rel}")
lvl=d.get("level_3_required",{})
for key in ("solidity_full_inventory","genesis_address_authority","integrated_global","docs_global","retained_compute_suite","indexer_global","sdk_build_test","phase_config_verification","adversarial_invariant_security","deployment_config_verification"):
    if lvl.get(key) is not True: fail(f"Level 3 owner missing {key}")
if d.get("next_canonical_step")!="CMP-3 — node420 compute worker runtime": fail("next canonical step drift")
road=ROADMAP.read_text()
for i in range(1,8):
    pos=road.find(f"## CMP-2.{i} —")
    if pos<0 or "COMPLETE" not in road[pos:pos+500]: fail(f"roadmap prerequisite CMP-2.{i} not COMPLETE")
if "## CMP-2.8 — Phase closeout" not in road or "Level 3 comprehensive qualification in progress" not in road:
    fail("roadmap closeout state drift")
fw=FOUNDRY.read_text()
for token in ("matrix:\n        shard: [0, 1, 2, 3]","cmp-2.8-phase-closeout.json","qualify-foundry-shard.sh"):
    if token not in fw: fail(f"full Foundry ownership/trigger missing {token}")
qw=QUAL.read_text()
for token in ("contracts/config/compute-market/cmp-2.8-phase-closeout.json","docs/compute-market/CMP-2.8-PHASE-CLOSEOUT.md","scripts/verify-cmp-2-8-phase-closeout.py"):
    if token not in qw: fail(f"global qualification trigger missing {token}")
close=CLOSEOUT.read_text()
for heading in ("## Canonical definition","## Reconciliation baseline","## Phase inventory","## Prerequisite disposition","## Authority and security boundaries","## Client/service reconciliation","## Repository qualification versus live deployment","## Level 3 qualification gate","## Full Solidity ownership","## Completion"):
    if heading not in close: fail(f"missing heading {heading}")
print("CMP-2.8 phase closeout inventory/reconciliation: READY FOR LEVEL 3")
