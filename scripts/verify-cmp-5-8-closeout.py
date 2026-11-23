#!/usr/bin/env python3
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
LEDGER=ROOT/"contracts/config/compute-market/cmp-5.8-phase-closeout.json"
ROADMAP=ROOT/"docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"
CLOSEOUT=ROOT/"docs/compute-market/CMP-5.8-PHASE-CLOSEOUT.md"
FOUNDRY=ROOT/".github/workflows/contracts-foundry.yml"
GENESIS=ROOT/".github/workflows/genesis-address-authority.yml"
QUAL=ROOT/".github/workflows/qualification.yml"
SCOPED=ROOT/".github/workflows/cmp-phase-closeouts.yml"
DOCS=ROOT/".github/workflows/docs-qualify.yml"
COMPUTE=ROOT/".github/workflows/compute-market.yml"

def fail(msg):
    raise SystemExit("CMP-5.8 closeout verification failed: "+msg)

for p in (LEDGER,ROADMAP,CLOSEOUT,FOUNDRY,GENESIS,QUAL,SCOPED,DOCS,COMPUTE):
    if not p.is_file(): fail(f"missing {p.relative_to(ROOT)}")

d=json.loads(LEDGER.read_text())
if d.get("step")!="CMP-5.8" or d.get("status")!="COMPLETE":
    fail("candidate ledger state drift")
rec=d.get("reconciliation",{})
if rec.get("main_sha")!="44e4a17fade829c8e7facb13ed2eea7879e02507":
    fail("reconciliation main drift")
if rec.get("reconciled_anchor_sha")!="ff8e8d1a625f31d98b64f7cbad39503ada5de4ad" or rec.get("behind_main")!=0:
    fail("reconciled anchor drift")
if d.get("qualified_prerequisites")!=[f"CMP-5.{i}" for i in range(1,8)]:
    fail("prerequisite inventory drift")
lvl=d.get("level_3_required",{})
for key in ("solidity_full_inventory","genesis_address_authority","integrated_global","docs_global","retained_compute_market_suite","phase_config_verification","adversarial_invariant_security","deployment_config_verification"):
    if lvl.get(key) is not True: fail(f"Level 3 owner missing {key}")
if d.get("next_canonical_step")!="CMP-6 — Useful-computation rewards":
    fail("next phase drift")

road=ROADMAP.read_text()
for i in range(1,8):
    pos=road.find(f"## CMP-5.{i} —")
    if pos<0 or "COMPLETE" not in road[pos:pos+1000]:
        fail(f"roadmap prerequisite CMP-5.{i} not COMPLETE")
if "## CMP-5.8 — Phase closeout" not in road:
    fail("roadmap closeout heading missing")
if "LEVEL 3 CLOSEOUT CANDIDATE" not in road and "COMPLETE — Level 3 exact-head qualified" not in road:
    fail("roadmap closeout state drift")

fw=FOUNDRY.read_text()
for token in ("matrix:\n        shard: [0, 1, 2, 3]","cmp-5.8-phase-closeout.json","qualify-foundry-shard.sh"):
    if token not in fw: fail(f"Foundry Level 3 ownership missing {token}")

gw=GENESIS.read_text()
if "Canonical full Foundry qualification is owned once by Solidity Contracts" not in gw:
    fail("Genesis duplication boundary missing")

# CI-GUARD-02 prohibits implicit execution of the complete integrated Level 3
# suite. Verify scoped automatic triggers plus the retained global dispatch.
qw=QUAL.read_text()
if "\n  workflow_dispatch:" not in qw or any("\n  "+event in qw for event in ("pull_request:","push:","schedule:")):
    fail("global Level 3 qualification must remain manual-only")
sw=SCOPED.read_text()
for token in ("pull_request:","push:","Verify exact head","contracts/config/compute-market/cmp-5.8-phase-closeout.json","docs/compute-market/CMP-5.8-PHASE-CLOSEOUT.md","scripts/verify-cmp-5-8-closeout.py","run: python scripts/verify-cmp-5-8-closeout.py"):
    if token not in sw: fail(f"scoped closeout qualification trigger missing {token}")

dw=DOCS.read_text()
if "docs/**" not in dw:
    fail("Docs global ownership missing")

cw=COMPUTE.read_text()
for i in range(1,9):
    token=f"verify-cmp-5-{i}-"
    if token not in cw: fail(f"retained Compute verifier ownership missing CMP-5.{i}")

print("CMP-5.8 phase closeout inventory: LEVEL 3 CANDIDATE READY")
