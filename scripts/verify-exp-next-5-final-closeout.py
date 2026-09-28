#!/usr/bin/env python3
import json,pathlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
errors=[]
def load(p): return json.loads((ROOT/p).read_text())
road=load("docs/audit/EXP-2R.5-authoritative-next-phase-roadmap.json")
step=next((s for s in road["sequence"] if s["id"]=="EXP-NEXT.5"),None)
if not step or step.get("title")!="Final Genesis acceptance and release closeout":
    errors.append("canonical EXP-NEXT.5 definition mismatch")

next4=load("docs/audit/EXP-NEXT.4-live-deployment-recovery.json")
accept=load("docs/audit/EXP-0.2.6-genesis-acceptance-criteria.json")
gaps=load("docs/audit/EXP-0.2.5-genesis-gap-register.json")
check=load("docs/audit/EXP-NEXT.5-final-genesis-acceptance-checklist.json")
idx=load("docs/audit/EXP-NEXT.5-ac-evidence-index.json")
blockers=load("docs/audit/EXP-NEXT.5-final-blocker-register.json")
manifest=load("docs/audit/EXP-NEXT.5-release-candidate-manifest.json")

if next4.get("status")!="NOT_YET_COMPLETE":
    errors.append("EXP-NEXT.4 status changed; EXP-NEXT.5 closeout must be fully re-evaluated")
if check.get("status")!="NOT_YET_COMPLETE" or check.get("decision")!="NO_GO":
    errors.append("EXP-NEXT.5 checklist must remain fail-closed while EXP-NEXT.4 is incomplete")
if check.get("exact_release_candidate",{}).get("frozen") is not False:
    errors.append("release candidate must not be frozen before EXP-NEXT.4 completion")
if manifest.get("status")!="UNFROZEN" or manifest.get("decision")!="NO_GO":
    errors.append("release-candidate manifest overclaims readiness")
if manifest.get("productionEquivalent") is not False:
    errors.append("manifest must not claim productionEquivalent")
if blockers.get("status")!="OPEN":
    errors.append("blocker register cannot be CLOSED")

criteria=accept.get("criteria",[])
if [c.get("id") for c in criteria] != [f"AC-{i}" for i in range(1,11)]:
    errors.append("authoritative AC-1 through AC-10 set changed")
for c in criteria:
    cid=c["id"]
    if c.get("current_status")!="unverified":
        errors.append(f"{cid} authoritative status changed; closeout requires re-evaluation")
    if idx.get("criteria",{}).get(cid,{}).get("status")!="unverified":
        errors.append(f"{cid} closeout evidence index overclaims status")
    row=next((x for x in check.get("acceptance_criteria",[]) if x.get("id")==cid),None)
    if not row or row.get("status")!="unverified":
        errors.append(f"{cid} checklist status mismatch")

# Derive the authoritative set of currently Genesis-blocking findings.
findings=gaps.get("findings",[])
authoritative_open=sorted(x["id"] for x in findings if x.get("genesis_blocking") is True)
recorded=sorted(blockers.get("unresolved_genesis_blockers",[]))
if authoritative_open!=recorded:
    errors.append(f"final blocker register mismatch authoritative={authoritative_open} recorded={recorded}")

# Negative invariants: repository-only evidence may not be promoted to Genesis acceptance.
if check.get("exit_criteria",{}).get("no_mandatory_criterion_unverified") is not False:
    errors.append("mandatory criterion exit condition overclaimed")
if check.get("exit_criteria",{}).get("no_genesis_blocker_unresolved") is not False:
    errors.append("Genesis blocker exit condition overclaimed")
if check.get("exit_criteria",{}).get("exact_release_candidate_and_deployed_stack_fully_evidenced") is not False:
    errors.append("release/deployment exit condition overclaimed")
if manifest.get("workflowRuns") or manifest.get("artifactDigests"):
    errors.append("unfrozen release manifest must not contain final workflow/artifact provenance")

required=[
 "docs/audit/EXP-NEXT.5-final-genesis-acceptance-checklist.json",
 "docs/audit/EXP-NEXT.5-ac-evidence-index.json",
 "docs/audit/EXP-NEXT.5-final-blocker-register.json",
 "docs/audit/EXP-NEXT.5-release-candidate-manifest.json"
]
for p in required:
    if not (ROOT/p).exists(): errors.append("missing closeout artifact "+p)

out=ROOT/"exp-next-5-closeout-readiness-evidence";out.mkdir(exist_ok=True)
summary={
 "step":"EXP-NEXT.5",
 "status":check.get("status"),
 "decision":check.get("decision"),
 "expNext4Status":next4.get("status"),
 "acceptanceCriteria":{c["id"]:c["current_status"] for c in criteria},
 "unresolvedGenesisBlockers":authoritative_open,
 "errors":errors
}
(out/"summary.json").write_text(json.dumps(summary,indent=2)+"\n")
if errors:
    print("\n".join("ERROR: "+e for e in errors));sys.exit(1)
print("EXP-NEXT.5 closeout-readiness verifier passed; final Genesis acceptance remains blocked")
