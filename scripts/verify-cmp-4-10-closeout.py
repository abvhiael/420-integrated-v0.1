#!/usr/bin/env python3
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
LEDGER=ROOT/"contracts/config/compute-market/cmp-4.10-phase-closeout.json"
ROADMAP=ROOT/"docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"
CLOSEOUT=ROOT/"docs/compute-market/CMP-4.10-PHASE-CLOSEOUT.md"
FOUNDRY=ROOT/".github/workflows/contracts-foundry.yml"
QUAL=ROOT/".github/workflows/qualification.yml"
COMPUTE=ROOT/".github/workflows/compute-market.yml"

def fail(msg):
    raise SystemExit("CMP-4.10 closeout verification failed: "+msg)

for p in (LEDGER,ROADMAP,CLOSEOUT,FOUNDRY,QUAL,COMPUTE):
    if not p.is_file(): fail(f"missing {p.relative_to(ROOT)}")

d=json.loads(LEDGER.read_text())
if d.get("step")!="CMP-4.10" or d.get("status")!="QUALIFICATION_PENDING": fail("candidate ledger state drift")
rec=d.get("reconciliation",{})
if rec.get("main_sha")!="23ebff000a471bfbc4439894f797f3b17a530867" or rec.get("reconciled_anchor_sha")!="21024d2da887d9d64dff7dd947f773d95ea54e69" or rec.get("behind_main")!=0:
    fail("reconciliation baseline drift")
if d.get("qualified_prerequisites")!=[f"CMP-4.{i}" for i in range(1,10)]: fail("prerequisite inventory drift")
lvl=d.get("level_3_required",{})
for key in ("solidity_full_inventory","genesis_address_authority","integrated_global","docs_global","retained_compute_market_suite","phase_config_verification","adversarial_invariant_security","deployment_config_verification"):
    if lvl.get(key) is not True: fail(f"Level 3 owner missing {key}")
if d.get("next_canonical_step")!="CMP-5 — External distributed-compute adapters": fail("next phase drift")

road=ROADMAP.read_text()
for i in range(1,10):
    pos=road.find(f"## CMP-4.{i} —")
    if pos<0 or "COMPLETE" not in road[pos:pos+700]: fail(f"roadmap prerequisite CMP-4.{i} not COMPLETE")
if "## CMP-4.10 — Phase closeout" not in road:
    fail("roadmap closeout heading missing")
if "LEVEL 3 CLOSEOUT CANDIDATE" not in road and "COMPLETE — Level 3 exact-head qualified" not in road:
    fail("roadmap closeout state drift")

fw=FOUNDRY.read_text()
for token in ("matrix:\n        shard: [0, 1, 2, 3]","cmp-4.10-phase-closeout.json","qualify-foundry-shard.sh"):
    if token not in fw: fail(f"Foundry Level 3 ownership missing {token}")
qw=QUAL.read_text()
for token in ("contracts/config/compute-market/cmp-4.10-phase-closeout.json","docs/compute-market/CMP-4.10-PHASE-CLOSEOUT.md","scripts/verify-cmp-4-10-closeout.py"):
    if qw.count(token)<2: fail(f"global qualification push/PR trigger missing {token}")
cw=COMPUTE.read_text()
for i in range(1,11):
    token=f"verify-cmp-4-{i}-"
    if token not in cw: fail(f"retained Compute verifier ownership missing CMP-4.{i}")
print("CMP-4.10 phase closeout inventory: LEVEL 3 CANDIDATE READY")
