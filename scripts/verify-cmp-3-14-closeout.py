#!/usr/bin/env python3
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
LEDGER=ROOT/"contracts/config/compute-market/cmp-3.14-phase-closeout.json"
ROADMAP=ROOT/"docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"
CLOSEOUT=ROOT/"docs/compute-market/CMP-3.14-PHASE-CLOSEOUT.md"
FOUNDRY=ROOT/".github/workflows/contracts-foundry.yml"
QUAL=ROOT/".github/workflows/qualification.yml"
FAST=ROOT/".github/workflows/compute-worker-fast.yml"
INTEGRATION=ROOT/".github/workflows/compute-worker-integration.yml"

def fail(msg):
    raise SystemExit("CMP-3.14 closeout verification failed: "+msg)

for p in (LEDGER,ROADMAP,CLOSEOUT,FOUNDRY,QUAL,FAST,INTEGRATION):
    if not p.is_file(): fail(f"missing {p.relative_to(ROOT)}")

d=json.loads(LEDGER.read_text())
definition="Reconcile the complete accumulated CMP-3 node420 worker runtime against current main, run the required Level 3 qualification on one exact merge-candidate implementation SHA, preserve durable evidence, and prepare the handoff to CMP-4 — Scientific compute framework."
if d.get("step")!="CMP-3.14" or d.get("canonical_definition")!=definition: fail("step/definition drift")
if d.get("status")!="COMPLETE": fail("ledger closeout status must be COMPLETE after durable exact-SHA qualification")
if d.get("completion_state")!="COMPLETE": fail("completion state drift")
q=d.get("qualification",{})
if q.get("level")!=3 or q.get("exact_sha") is not True: fail("durable exact-SHA Level 3 evidence missing")
if q.get("implementation_sha")!="0fcb699e6270bc863538eacb08ba204ce2f41b6c": fail("qualified implementation SHA drift")
for owner in ("solidity_contracts","genesis_address_authority","integrated_global","docs_global","retained_compute_market","worker_fast","worker_integration","node420_release_gate"):
    if q.get(owner,{}).get("result")!="SUCCESS":
        fail(f"durable Level 3 evidence missing SUCCESS for {owner}")
if d.get("repository_closeout_candidate") is not True or d.get("live_release") is not False: fail("repository/live flags drift")
rec=d.get("reconciliation",{})
if rec.get("main_sha")!="b338b9c9c140957b0ea8619b0b20bfed415f2c6d" or rec.get("github_test_merge_sha")!="c72d4795e178b66a1d4ae4737af8033f475a736a" or rec.get("reconciled_anchor_sha")!="c62b01be3dfed2618e8b0bbedf8c8e73e5fd02b1" or rec.get("behind_main")!=0:
    fail("reconciliation baseline drift")
expected=[f"CMP-3.{i}" for i in range(1,14)]
if d.get("qualified_prerequisites")!=expected: fail("prerequisite step inventory drift")
for rel in d.get("prerequisite_evidence",[]):
    p=ROOT/rel
    if not p.is_file(): fail(f"missing prerequisite evidence {rel}")
    if "COMPLETE" not in p.read_text(): fail(f"prerequisite evidence not complete {rel}")
if len(d.get("prerequisite_evidence",[]))!=13: fail("prerequisite evidence count drift")
for rel in d.get("phase_verifiers",[]):
    if not (ROOT/rel).is_file(): fail(f"missing phase verifier {rel}")
if len(d.get("phase_verifiers",[]))!=13: fail("phase verifier count drift")
for rel in ("compute/worker","execution/cmd/node420-compute","packaging/node420-compute"):
    if not (ROOT/rel).exists(): fail(f"missing phase source {rel}")
lvl=d.get("level_3_required",{})
for key in ("solidity_full_inventory","genesis_address_authority","integrated_global","docs_global","retained_compute_market_suite","worker_fast_suite","worker_integration_suite","node420_release_gate","phase_config_verification","adversarial_invariant_security","deployment_config_verification"):
    if lvl.get(key) is not True: fail(f"Level 3 owner missing {key}")
if d.get("next_canonical_step")!="CMP-4 — Scientific compute framework": fail("next canonical step drift")
road=ROADMAP.read_text()
for i in range(1,14):
    pos=road.find(f"## CMP-3.{i} —")
    if pos<0 or "COMPLETE" not in road[pos:pos+600]: fail(f"roadmap prerequisite CMP-3.{i} not COMPLETE")
if "## CMP-3.14 — Phase closeout" not in road or "Status: COMPLETE — Level 3 exact-head qualified" not in road:
    fail("roadmap completed closeout state drift")
fw=FOUNDRY.read_text()
for token in ("matrix:\n        shard: [0, 1, 2, 3]","cmp-3.14-phase-closeout.json","qualify-foundry-shard.sh"):
    if token not in fw: fail(f"full Foundry ownership/trigger missing {token}")
qw=QUAL.read_text()
for token in ("contracts/config/compute-market/cmp-3.14-phase-closeout.json","docs/compute-market/CMP-3.14-PHASE-CLOSEOUT.md","scripts/verify-cmp-3-14-closeout.py"):
    if token not in qw: fail(f"global qualification trigger missing {token}")
fast=FAST.read_text()
for i in range(1,14):
    token=f"verify-cmp-3-{i}-"
    if token not in fast and i!=13:
        fail(f"worker fast retained verifier missing CMP-3.{i}")
if "verify-cmp-3-13-packaging.py" not in fast: fail("worker fast packaging verifier missing")
for token in ("Verify CMP-3.14 phase closeout inventory","verify-cmp-3-14-closeout.py"):
    if token not in fast: fail(f"worker fast CMP-3.14 closeout verifier ownership missing {token}")
iw=INTEGRATION.read_text()
for token in ("cmp-worker-level2","Run retained worker integration suite","go test ./compute/worker -count=1"):
    if token not in iw: fail(f"worker integration ownership missing {token}")
close=CLOSEOUT.read_text()
for heading in ("## Canonical definition","## Reconciliation baseline","## Phase inventory","## Authority and security boundaries","## Client/service reconciliation","## Repository qualification versus live deployment","## Level 3 qualification gate","## Full Solidity ownership","## Completion"):
    if heading not in close: fail(f"missing heading {heading}")
print("CMP-3.14 phase closeout inventory/reconciliation: COMPLETE — LEVEL 3 EVIDENCE VERIFIED")
