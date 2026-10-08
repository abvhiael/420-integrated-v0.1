#!/usr/bin/env python3
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
LEDGER=ROOT/"contracts/config/compute-market/cmp-7.10-phase-closeout.json"
ROADMAP=ROOT/"docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"
CLOSEOUT=ROOT/"docs/compute-market/CMP-7.10-PHASE-CLOSEOUT.md"
FOUNDRY=ROOT/".github/workflows/contracts-foundry.yml"
GENESIS=ROOT/".github/workflows/genesis-address-authority.yml"
QUAL=ROOT/".github/workflows/qualification.yml"
DOCS=ROOT/".github/workflows/docs-qualify.yml"
COMPUTE=ROOT/".github/workflows/compute-market.yml"
DEV=ROOT/".github/workflows/compute-developer.yml"
IDX_DIRECT=ROOT/".github/workflows/420-indexer.yml"
IDX_SHARED=ROOT/".github/workflows/420indexer.yml"
HARDENING=ROOT/".github/workflows/contracts-hardening.yml"

def fail(msg):
    raise SystemExit("CMP-7.10 closeout verification failed: "+msg)

for p in (LEDGER,ROADMAP,CLOSEOUT,FOUNDRY,GENESIS,QUAL,DOCS,COMPUTE,DEV,IDX_DIRECT,IDX_SHARED,HARDENING):
    if not p.is_file(): fail(f"missing {p.relative_to(ROOT)}")

d=json.loads(LEDGER.read_text())
if d.get("step")!="CMP-7.10" or d.get("status")!="LEVEL_3_CANDIDATE":
    fail("candidate ledger state drift")
rec=d.get("reconciliation",{})
if rec.get("main_sha")!="c6b62a6ea75be97564564e56b779dfad7df3f784":
    fail("reconciliation main drift")
if rec.get("reconciled_anchor_sha")!="63b0bf7d77389685e464edb1f8db10548b72e181" or rec.get("behind_main")!=0:
    fail("reconciliation anchor drift")
if d.get("qualified_prerequisites")!=[f"CMP-7.{i}" for i in range(1,10)]:
    fail("prerequisite inventory drift")
if d.get("level_2_milestones")!=["CMP-7.5 — Research project API","CMP-7.9 — CLI"]:
    fail("Level 2 milestone inventory drift")
for key in ("solidity_full_inventory","genesis_address_authority","integrated_global","docs_global","retained_compute_market_suite","compute_developer_surfaces","indexer_shared_consumers","phase_config_verification","contract_hardening_static_analysis"):
    if d.get("level_3_required",{}).get(key) is not True:
        fail("Level 3 owner missing "+key)
if d.get("next_canonical_step")!="CMP-8 — 420Compute application":
    fail("next phase drift")

road=ROADMAP.read_text()
for i in range(1,10):
    heading=f"## CMP-7.{i} —"
    pos=road.find(heading)
    if pos<0:
        fail(f"roadmap prerequisite CMP-7.{i} missing")
    if "COMPLETE" not in road[pos:pos+900]:
        fail(f"roadmap prerequisite CMP-7.{i} not COMPLETE")
if "## CMP-7.10 — Phase closeout" not in road or "LEVEL 3 CLOSEOUT CANDIDATE" not in road:
    fail("roadmap closeout state drift")

specs=[
    "CMP-7.1-COMPUTE-SDK.md","CMP-7.2-JOB-SUBMISSION-API.md","CMP-7.3-WORKER-API.md",
    "CMP-7.4-VERIFIER-API.md","CMP-7.5-RESEARCH-PROJECT-API.md","CMP-7.6-COMPUTE-INDEXER.md",
    "CMP-7.7-HISTORICAL-ANALYTICS.md","CMP-7.8-DEVELOPER-DOCUMENTATION.md","CMP-7.9-CLI.md",
]
for name in specs:
    p=ROOT/"docs/compute-market"/name
    if not p.is_file() or "Status: **COMPLETE" not in p.read_text():
        fail("qualified prerequisite spec status missing "+name)

fw=FOUNDRY.read_text()
for token in ("matrix:\n        shard: [0, 1, 2, 3]","cmp-7.10-phase-closeout.json","qualify-foundry-shard.sh"):
    if token not in fw: fail("Foundry Level 3 ownership missing "+token)

gw=GENESIS.read_text()
if "Canonical full Foundry qualification is owned once by Solidity Contracts" not in gw:
    fail("Genesis duplication boundary missing")
if "contracts/config/**" not in gw:
    fail("Genesis config trigger coverage missing")

qw=QUAL.read_text()
for token in ("contracts/config/compute-market/cmp-7.10-phase-closeout.json","docs/compute-market/CMP-7.10-PHASE-CLOSEOUT.md","scripts/verify-cmp-7-10-closeout.py"):
    if qw.count(token)<2: fail("global qualification push/PR trigger missing "+token)

if "docs/**" not in DOCS.read_text():
    fail("Docs global ownership missing")

cw=COMPUTE.read_text()
if "verify-cmp-7-10-closeout.py" not in cw:
    fail("Compute closeout verifier ownership missing")

dw=DEV.read_text()
for token in ("level3_closeout","cmp-7.10-phase-closeout.json","level3-integration"):
    if token not in dw: fail("developer Level 3 coverage missing "+token)

for p in (IDX_DIRECT,IDX_SHARED):
    if "cmp-7.10-phase-closeout.json" not in p.read_text():
        fail("Indexer closeout trigger missing "+p.name)

hw=HARDENING.read_text()
if "cmp-7.10-phase-closeout.json" not in hw or "Slither high-severity gate" not in hw:
    fail("Contract Hardening Level 3 coverage missing")

for required in (
    "packages/420-sdk/src/compute-client.ts",
    "services/compute-api/src/job-api.ts",
    "420-indexer/src/compute-read-model.ts",
    "420-indexer/src/compute-analytics.ts",
    "packages/420-cli/lib/compute.mjs",
    "docs/developers/compute-market-integration.md",
):
    if not (ROOT/required).is_file(): fail("CMP-7 implementation surface missing "+required)

print("CMP-7.10 phase closeout inventory: LEVEL 3 CANDIDATE READY")
