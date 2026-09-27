#!/usr/bin/env python3
import csv, json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
EVIDENCE=ROOT/"exp-0-3-8-evidence"

FILES={
  "decision":"docs/audit/EXP-0.3.8-governance-scope-decision.json",
  "apps":"config/genesis-applications.json",
  "profile":"contracts/config/420explorer-genesis.json",
  "cap":"docs/audit/EXP-0.2.1-genesis-capability-matrix.json",
  "wf":"docs/audit/EXP-0.2.2-user-workflow-matrix.json",
  "gaps":"docs/audit/EXP-0.2.5-genesis-gap-register.json",
  "acs":"docs/audit/EXP-0.2.6-genesis-acceptance-criteria.json",
  "req":"docs/audit/EXP-0.3.1-authoritative-genesis-requirements.json",
  "paths":"docs/audit/EXP-0.3.2-mandatory-capability-paths.json",
  "tests":"docs/audit/EXP-0.3.3-mandatory-acceptance-tests.json",
  "freeze":"docs/audit/EXP-0.3.4-qualification-status-freeze.json",
  "excl":"docs/audit/EXP-0.3.5-nonblocking-scope-exclusions.json",
  "conf":"docs/audit/EXP-0.3.6-scope-conflict-resolution-register.json",
  "trace":"docs/audit/EXP-0.3.7-bidirectional-traceability.json",
}

def load(rel):
    return json.loads((ROOT/rel).read_text(encoding="utf-8"))

def main():
    errors=[]
    for rel in FILES.values():
        if not (ROOT/rel).exists(): errors.append(f"missing required reconciliation file: {rel}")
    if errors:
        print(json.dumps({"pass":False,"errors":errors},indent=2))
        raise SystemExit(1)

    d={k:load(v) for k,v in FILES.items()}
    dec=d["decision"]
    if dec.get("schema")!="420explorer-exp-0.3.8-governance-scope-decision-v1": errors.append("decision schema drift")
    if dec.get("milestone")!="EXP-0.3.8" or dec.get("status")!="resolved": errors.append("decision milestone/status drift")
    if dec.get("conflict_id")!="EXP-SCOPE-CONFLICT-001" or dec.get("decision")!="EXP-SCOPE-RESOLUTION-B": errors.append("decision identity drift")
    if dec.get("outcome")!="not_required_as_dedicated_view": errors.append("decision outcome drift")

    app=next((x for x in d["apps"].get("apps",[]) if x.get("name")=="420 Explorer"),None)
    if not app: errors.append("420 Explorer application record missing")
    purpose="" if not app else str(app.get("purpose",""))
    if "governance" in purpose.lower(): errors.append("application purpose still names governance")
    if purpose!="Blocks, transactions, contracts, validators, assets, finality": errors.append("reconciled Explorer purpose drift")

    views=[str(x).lower() for x in d["profile"].get("requiredViews",[])]
    if len(views)!=10: errors.append(f"requiredViews count drift: {len(views)}")
    if "governance" in views: errors.append("governance unexpectedly present in requiredViews")

    caps=d["cap"].get("capabilities",[])
    if any(x.get("id")=="EXP-CAP-019" for x in caps): errors.append("EXP-CAP-019 remains active")
    cap_res=d["cap"].get("resolved_scope_decisions",[])
    if len(cap_res)!=1 or cap_res[0].get("decision")!="EXP-SCOPE-RESOLUTION-B": errors.append("capability matrix resolution record missing")

    for w in d["wf"].get("workflows",[]):
        if any("governance remains a separate unresolved scope decision" in str(x).lower() for x in w.get("limitations",[])):
            errors.append(f"{w.get('id')}: stale unresolved governance limitation")
    if d["wf"].get("scope_resolution",{}).get("decision")!="EXP-SCOPE-RESOLUTION-B": errors.append("workflow scope resolution missing")

    gap=next((x for x in d["gaps"].get("findings",[]) if x.get("id")=="EXP-FIND-001"),None)
    if not gap: errors.append("EXP-FIND-001 historical record missing")
    else:
        if gap.get("genesis_blocking") is not False: errors.append("EXP-FIND-001 remains Genesis-blocking")
        if gap.get("resolution_status")!="resolved": errors.append("EXP-FIND-001 is not marked resolved")
        if gap.get("acceptance_criteria")!=[]: errors.append("resolved EXP-FIND-001 still maps to active acceptance criteria")

    ac_by={x.get("id"):x for x in d["acs"].get("criteria",[])}
    for acid in ("AC-5","AC-10"):
        if "EXP-FIND-001" in ac_by.get(acid,{}).get("blocking_findings",[]): errors.append(f"{acid} still lists EXP-FIND-001")
        if any("governance" in str(x).lower() for x in ac_by.get(acid,{}).get("required_evidence",[])): errors.append(f"{acid} retains stale governance evidence requirement")

    reqs=d["req"].get("requirements",[])
    mandatory=[x for x in reqs if x.get("classification")=="mandatory_genesis"]
    scope=[x for x in reqs if x.get("classification")=="scope_decision_required"]
    if len(reqs)!=64: errors.append(f"active requirement total drift: {len(reqs)}")
    if len(mandatory)!=60: errors.append(f"mandatory requirement count drift: {len(mandatory)}")
    if scope: errors.append("active scope-decision requirement remains")
    if any(x.get("id")=="EXP-REQ-SCOPE-001" for x in reqs): errors.append("EXP-REQ-SCOPE-001 remains active")
    if d["req"].get("resolved_scope_decisions",[{}])[0].get("decision")!="EXP-SCOPE-RESOLUTION-B": errors.append("requirement inventory resolution record missing")

    if d["paths"].get("scope_resolution",{}).get("decision")!="EXP-SCOPE-RESOLUTION-B": errors.append("path map resolution record missing")
    if d["tests"].get("scope_resolution",{}).get("decision")!="EXP-SCOPE-RESOLUTION-B": errors.append("acceptance-test map resolution record missing")

    freeze=d["freeze"]
    if len(freeze.get("entries",[]))!=64: errors.append("status-freeze active entry count drift")
    if any(x.get("requirement_id")=="EXP-REQ-SCOPE-001" for x in freeze.get("entries",[])): errors.append("retired scope requirement remains in status freeze")
    if freeze.get("frozen_status_counts",{}).get("scope_decision_required")!=0: errors.append("status freeze still counts unresolved scope decision")
    if freeze.get("resolved_scope_decisions",[{}])[0].get("decision")!="EXP-SCOPE-RESOLUTION-B": errors.append("status-freeze resolution record missing")

    excl=d["excl"]
    if excl.get("protected_scope_decisions")!=[]: errors.append("unresolved protected scope decision remains in exclusion ledger")
    if excl.get("summary",{}).get("protected_scope_decisions")!=0: errors.append("exclusion summary still counts protected scope decision")
    if excl.get("resolved_scope_decisions",[{}])[0].get("decision")!="EXP-SCOPE-RESOLUTION-B": errors.append("exclusion resolution record missing")
    if any(x.get("requirement_id")=="EXP-REQ-SCOPE-001" for x in excl.get("exclusions",[])): errors.append("governance incorrectly converted into optional/post-Genesis exclusion")

    conflicts=d["conf"].get("conflicts",[])
    if len(conflicts)!=1: errors.append("scope-conflict register count drift")
    c=conflicts[0] if conflicts else {}
    if c.get("status")!="resolved" or c.get("selected_resolution")!="EXP-SCOPE-RESOLUTION-B": errors.append("scope-conflict register not resolved by Resolution B")
    if c.get("genesis_blocking") is not False: errors.append("resolved scope conflict remains blocking")
    if d["conf"].get("summary",{})!={"conflicts":1,"unresolved":0,"resolved":1,"genesis_blocking":0,"admissible_resolution_paths":2,"final_exp0_closeout_blocked":False}: errors.append("scope-conflict summary drift")

    trace=d["trace"]
    fwd=trace.get("forward_requirement_traces",[])
    rev=trace.get("reverse_blocker_traces",[])
    if len(fwd)!=60: errors.append(f"forward trace count drift: {len(fwd)}")
    if len(rev)!=10: errors.append(f"reverse blocker count drift: {len(rev)}")
    if any(x.get("requirement_id")=="EXP-REQ-SCOPE-001" for x in fwd): errors.append("retired scope requirement remains in forward trace")
    if any(x.get("finding_id")=="EXP-FIND-001" for x in rev): errors.append("resolved governance finding remains in blocker trace")
    ts=trace.get("summary",{})
    if ts.get("scope_decision_requirements")!=0 or ts.get("traced_requirements")!=60 or ts.get("genesis_blocking_findings")!=10: errors.append("traceability summary drift")
    if trace.get("resolved_scope_decisions",[{}])[0].get("decision")!="EXP-SCOPE-RESOLUTION-B": errors.append("traceability resolution record missing")

    manifest=dec.get("atomic_reconciliation_manifest",[])
    if set(manifest)!=set(d["conf"].get("conflicts",[{}])[0].get("atomic_reconciliation_manifest",[]))|{"docs/audit/EXP-0.3.7-bidirectional-traceability.json"}:
        errors.append("decision atomic reconciliation manifest drift")
    for rel in manifest:
        if not (ROOT/rel).exists(): errors.append(f"atomic manifest file missing: {rel}")

    EVIDENCE.mkdir(exist_ok=True)
    out={
      "schema":"exp-0.3.8-evidence-v1","milestone":"EXP-0.3.8",
      "decision":"EXP-SCOPE-RESOLUTION-B","status":"resolved",
      "active_requirements":len(reqs),"mandatory_requirements":len(mandatory),
      "active_scope_decisions":len(scope),
      "genesis_blocking_findings":sum(bool(x.get("genesis_blocking")) for x in d["gaps"].get("findings",[])),
      "unresolved_scope_conflicts":sum(x.get("status")=="unresolved" for x in conflicts),
      "resolved_scope_conflicts":sum(x.get("status")=="resolved" for x in conflicts),
      "errors":errors,"pass":not errors
    }
    (EVIDENCE/"summary.json").write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    with (EVIDENCE/"reconciliation.tsv").open("w",encoding="utf-8",newline="") as fh:
        w=csv.writer(fh,delimiter="\t"); w.writerow(["path","exists"])
        for rel in manifest: w.writerow([rel,str((ROOT/rel).exists()).lower()])
    print(json.dumps(out,indent=2))
    if errors: raise SystemExit(1)

if __name__=="__main__":
    main()
