#!/usr/bin/env python3
import json, pathlib, sys

ROOT=pathlib.Path(__file__).resolve().parents[1]
M=ROOT/"contracts/config/compute-market/cmp-1.2.10-phase-closeout.json"
P=ROOT/"config/protocol.json"
D0=ROOT/"docs/compute-market/CMP-1.2.0-VAULT-BASELINE-AND-ECONOMIC-DESIGN.md"
D9=ROOT/"docs/compute-market/CMP-1.2.9-TESTNET-DEPLOYMENT-QUALIFICATION.md"
LEDGER=ROOT/"docs/compute-market/CMP-1.2.1-VAULT-PAYER-FUNDING-QUALIFICATION.md"
ROADMAP=ROOT/"docs/compute-market/CMP-1-IMPLEMENTATION-ROADMAP.md"

e=json.loads(M.read_text())
p=json.loads(P.read_text())
errors=[]

if e.get("schema")!="cmp-1.2.10-phase-closeout-v1": errors.append("unexpected closeout schema")
if e.get("reconciled_main")!="304cb61286c94f72d0b05e32e5f713b9d68bc450": errors.append("unexpected reconciled main")
if e.get("reconciliation_commit")!="cc42be007f5a2aa5adc830152247565d6a0b6346": errors.append("unexpected reconciliation commit")

for f in (D0,D9,LEDGER,ROADMAP):
    if not f.is_file(): errors.append("missing required closeout source: "+str(f.relative_to(ROOT)))

t0=D0.read_text()
if "superseded repository implementation evidence recorded in CMP-1.2.1 through CMP-1.2.8" not in t0:
    errors.append("1.2.0 supersession reconciliation missing")
if "slash redistribution" not in t0 or "CMP-1.5" not in t0:
    errors.append("stake-slash cross-phase boundary missing")

ledger=LEDGER.read_text()
for step in range(2,10):
    if f"## CMP-1.2.{step}" not in ledger:
        errors.append(f"ledger missing CMP-1.2.{step}")

roadmap=ROADMAP.read_text()
for req in ("deposit","reserve","release","refund","partial release","timeout refund","dispute freeze","slash redistribution"):
    if req not in roadmap:
        errors.append("roadmap requirement missing: "+req)

scope=e.get("repository_scope",{})
for step in [f"CMP-1.2.{i}" for i in range(1,9)]:
    if scope.get(step)!="COMPLETE_REPOSITORY_SCOPE":
        errors.append(step+" repository status not complete")
if scope.get("CMP-1.2.9")!="REPOSITORY_DEPLOYMENT_READY_LIVE_BLOCKED":
    errors.append("1.2.9 live blocker status not preserved")

req=e.get("original_compute_escrow_requirements",{})
for k in ("deposit","reserve","release","refund","partial_release","timeout_refund","dispute_freeze"):
    if req.get(k)!="QUALIFIED_REPOSITORY_SCOPE":
        errors.append("repository requirement not qualified: "+k)
if req.get("slash_redistribution")!="FAIL_CLOSED_PENDING_CMP_1_5_STAKE":
    errors.append("slash redistribution must remain fail-closed pending CMP-1.5")

public_live=bool(p.get("step5",{}).get("substep_5_4",{}).get("public_testnet_live",False))
if public_live:
    errors.append("closeout manifest is stale: public testnet is now live; rerun CMP-1.2.9 live gate first")

blockers={b.get("id") for b in e.get("release_blockers",[])}
if blockers!={"CMP-1.2.9-LIVE","CMP-1.5-STAKE-SLASH"}:
    errors.append("unexpected release blocker set")

repository_closeout_ok=not errors
release_ready=repository_closeout_ok and not e.get("release_blockers")

print(json.dumps({
  "step":"CMP-1.2.10",
  "repository_closeout_ok":repository_closeout_ok,
  "release_ready":release_ready,
  "public_testnet_live":public_live,
  "release_blockers":sorted(blockers),
  "errors":errors
},indent=2))
sys.exit(0 if repository_closeout_ok else 1)
