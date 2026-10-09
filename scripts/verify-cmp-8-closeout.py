#!/usr/bin/env python3
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
LEDGER=ROOT/"contracts/config/compute-market/cmp-8-phase-closeout.json"
ROADMAP=ROOT/"docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"
SPEC=ROOT/"docs/compute-market/CMP-8-420COMPUTE-APPLICATION.md"
CLOSEOUT=ROOT/"docs/compute-market/CMP-8-PHASE-CLOSEOUT.md"
FOUNDRY=ROOT/".github/workflows/contracts-foundry.yml"
GENESIS=ROOT/".github/workflows/genesis-address-authority.yml"
QUAL=ROOT/".github/workflows/qualification.yml"
DOCS=ROOT/".github/workflows/docs-qualify.yml"
COMPUTE=ROOT/".github/workflows/compute-market.yml"
APP=ROOT/".github/workflows/420compute-app.yml"
IDX_DIRECT=ROOT/".github/workflows/420-indexer.yml"
IDX_SHARED=ROOT/".github/workflows/420indexer.yml"
HARDENING=ROOT/".github/workflows/contracts-hardening.yml"

def fail(msg): raise SystemExit("CMP-8 closeout verification failed: "+msg)

for p in (LEDGER,ROADMAP,SPEC,CLOSEOUT,FOUNDRY,GENESIS,QUAL,DOCS,COMPUTE,APP,IDX_DIRECT,IDX_SHARED,HARDENING):
    if not p.is_file(): fail("missing "+str(p.relative_to(ROOT)))

d=json.loads(LEDGER.read_text())
if d.get("step")!="CMP-8" or d.get("status")!="LEVEL_3_CANDIDATE": fail("candidate ledger state drift")
r=d.get("reconciliation",{})
if r.get("main_sha")!="0993ff5b5b3b213a0768dbde90e4734df5ab4cc0": fail("reconciliation main drift")
if r.get("reconciled_anchor_sha")!="f8970cc02d5d780471c04bab955d396032eeee74" or r.get("behind_main")!=0: fail("reconciliation anchor drift")
if d.get("level_2_milestones")!=["human participation convergence"]: fail("Level 2 milestone drift")
for key in ("solidity_full_inventory","genesis_address_authority","integrated_global","docs_global","retained_compute_market_suite","compute_app_retained_integration","indexer_direct","indexer_shared_consumers","phase_config_verification","contract_hardening_static_analysis"):
    if d.get("level_3_required",{}).get(key) is not True: fail("Level 3 owner missing "+key)
if d.get("next_canonical_step")!="CMP-9 — Public testnet compute": fail("next phase drift")

road=ROADMAP.read_text()
if "# CMP-8 — 420Compute application" not in road or "LEVEL 3 CLOSEOUT CANDIDATE" not in road: fail("roadmap CMP-8 closeout state drift")
if "Status: **COMPLETE — Level 3 exact-head qualified on `1889713a30ebee9afbdfc21b151d7c69789c1e09`." not in SPEC.read_text(): fail("CMP-8 spec completed qualification status drift")

for required in (
    "compute/web/index.html","compute/web/core/controller.js","compute/web/core/participation.js",
    "420-indexer/src/compute-app-read-model.ts","services/compute-api/src/job-api.ts",
    "packaging/node420-compute/common/worker.args.example","scripts/verify-cmp-8-420compute-app.py"
):
    if not (ROOT/required).is_file(): fail("CMP-8 implementation surface missing "+required)

fw=FOUNDRY.read_text()
for token in ("matrix:\n        shard: [0, 1, 2, 3]","cmp-8-phase-closeout.json","qualify-foundry-shard.sh"):
    if token not in fw: fail("Foundry Level 3 ownership missing "+token)
gw=GENESIS.read_text()
if "Canonical full Foundry qualification is owned once by Solidity Contracts" not in gw: fail("Genesis duplication boundary missing")
if "contracts/config/**" not in gw: fail("Genesis config trigger coverage missing")
qw=QUAL.read_text()
for token in ("contracts/config/compute-market/cmp-8-phase-closeout.json","docs/compute-market/CMP-8-PHASE-CLOSEOUT.md","scripts/verify-cmp-8-closeout.py"):
    if qw.count(token)<2: fail("global qualification push/PR trigger missing "+token)
if "docs/**" not in DOCS.read_text(): fail("Docs global ownership missing")
if "verify-cmp-8-closeout.py" not in COMPUTE.read_text(): fail("Compute closeout verifier ownership missing")
aw=APP.read_text()
for token in ("cmp-8-phase-closeout.json","verify-cmp-8-closeout.py","integration:"):
    if token not in aw: fail("420Compute Level 3 coverage missing "+token)
for p in (IDX_DIRECT,IDX_SHARED):
    if "cmp-8-phase-closeout.json" not in p.read_text(): fail("Indexer closeout trigger missing "+p.name)
hw=HARDENING.read_text()
if "cmp-8-phase-closeout.json" not in hw or "Slither high-severity gate" not in hw: fail("Contract Hardening Level 3 coverage missing")

print("CMP-8 phase closeout inventory: LEVEL 3 CANDIDATE READY")
