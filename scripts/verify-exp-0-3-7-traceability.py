#!/usr/bin/env python3
import csv,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
LEDGER=ROOT/"docs/audit/EXP-0.3.7-bidirectional-traceability.json"
REQ=ROOT/"docs/audit/EXP-0.3.1-authoritative-genesis-requirements.json"
PATHS=ROOT/"docs/audit/EXP-0.3.2-mandatory-capability-paths.json"
TESTS=ROOT/"docs/audit/EXP-0.3.3-mandatory-acceptance-tests.json"
GAPS=ROOT/"docs/audit/EXP-0.2.5-genesis-gap-register.json"
ACS=ROOT/"docs/audit/EXP-0.2.6-genesis-acceptance-criteria.json"
CONFLICTS=ROOT/"docs/audit/EXP-0.3.6-scope-conflict-resolution-register.json"
EVIDENCE=ROOT/"exp-0-3-7-evidence"

def load(p): return json.loads(p.read_text(encoding="utf-8"))

def main():
    errors=[]
    l=load(LEDGER); req=load(REQ); paths=load(PATHS); tests=load(TESTS); gaps=load(GAPS); acs=load(ACS); conflicts=load(CONFLICTS)

    if l.get("schema")!="420explorer-exp-0.3.7-bidirectional-traceability-v1": errors.append("schema drift")
    if l.get("milestone")!="EXP-0.3.7": errors.append("milestone drift")

    req_by={r["id"]:r for r in req.get("requirements",[])}
    mandatory={rid:r for rid,r in req_by.items() if r.get("classification")=="mandatory_genesis"}
    scope={rid:r for rid,r in req_by.items() if r.get("classification")=="scope_decision_required"}
    path_by={p["requirement_id"]:p for p in paths.get("paths",[])}
    test_by={t["requirement_id"]:t for t in tests.get("entries",[])}
    gap_by={g["id"]:g for g in gaps.get("findings",[])}
    ac_by={a["id"]:a for a in acs.get("criteria",[])}

    fwd=l.get("forward_requirement_traces",[])
    fwd_by={x["requirement_id"]:x for x in fwd}
    if len(mandatory)!=60: errors.append(f"authoritative mandatory count drift: {len(mandatory)}")
    if len(scope)!=0: errors.append(f"scope decision count drift: {len(scope)}")
    if len(fwd)!=60 or len(fwd_by)!=60: errors.append("forward trace count/uniqueness drift")
    if set(fwd_by)!=set(mandatory): errors.append("forward trace requirement set mismatch")

    valid_owner=re.compile(r"^EXP-(?:0\.3\.8|[1-8])$")
    for rid,r in mandatory.items():
        t=fwd_by.get(rid,{})
        if t.get("classification")!="mandatory_genesis": errors.append(f"{rid}: classification mismatch")
        if t.get("current_status")!=r.get("current_status"): errors.append(f"{rid}: status mismatch")
        if not t.get("implementation_paths"): errors.append(f"{rid}: implementation path missing")
        for rel in t.get("implementation_paths",[]):
            if not (ROOT/rel).exists(): errors.append(f"{rid}: missing implementation path {rel}")
        if not t.get("remediation_milestones"): errors.append(f"{rid}: remediation/qualification milestones missing")
        for owner in t.get("remediation_milestones",[]):
            if not valid_owner.match(owner): errors.append(f"{rid}: invalid milestone {owner}")
        if not t.get("acceptance_criteria"): errors.append(f"{rid}: AC mapping missing")
        for acid in t.get("acceptance_criteria",[]):
            if acid not in ac_by: errors.append(f"{rid}: unknown AC {acid}")
        if not t.get("required_evidence"): errors.append(f"{rid}: required evidence missing")
        at=t.get("acceptance_test_trace",{})
        if not at.get("kind") or not at.get("later_qualification_procedures"): errors.append(f"{rid}: required test path missing")
        if r.get("category")=="required_view":
            p=path_by.get(rid); q=test_by.get(rid)
            if not p or t.get("implementation_path_ref")!=p.get("id"): errors.append(f"{rid}: dedicated path trace mismatch")
            if not q or at.get("test_map_id")!=q.get("id"): errors.append(f"{rid}: dedicated test trace mismatch")
        if t.get("trace_complete") is not True: errors.append(f"{rid}: trace_complete false")

    if "EXP-REQ-SCOPE-001" in fwd_by: errors.append("retired governance requirement remains traced as active")
    resolved_scope=l.get("resolved_scope_decisions",[])
    if len(resolved_scope)!=1 or resolved_scope[0].get("decision")!="EXP-SCOPE-RESOLUTION-B":
        errors.append("resolved governance scope decision missing from traceability ledger")

    blockers=[g for g in gaps.get("findings",[]) if g.get("genesis_blocking") is True]
    if len(blockers)!=10: errors.append(f"Genesis blocker count drift: {len(blockers)}")
    rev=l.get("reverse_blocker_traces",[])
    rev_by={x["finding_id"]:x for x in rev}
    if len(rev)!=10 or len(rev_by)!=10: errors.append("reverse blocker trace count/uniqueness drift")
    if set(rev_by)!={g["id"] for g in blockers}: errors.append("reverse blocker ID set mismatch")

    for g in blockers:
        fid=g["id"]; x=rev_by.get(fid,{})
        if x.get("genesis_blocking") is not True: errors.append(f"{fid}: reverse trace not blocking")
        affected=x.get("affected_requirement_ids",[])
        if not affected: errors.append(f"{fid}: affected requirements missing")
        for rid in affected:
            if rid not in fwd_by: errors.append(f"{fid}: unknown affected requirement {rid}")
            elif fid not in fwd_by[rid].get("blocking_finding_refs",[]): errors.append(f"{fid}: reciprocal reference missing from {rid}")
        if not x.get("remediation_milestones"): errors.append(f"{fid}: remediation milestone missing")
        for owner in x.get("remediation_milestones",[]):
            if not valid_owner.match(owner): errors.append(f"{fid}: invalid remediation milestone {owner}")
        if set(x.get("acceptance_criteria",[]))!=set(g.get("acceptance_criteria",[])): errors.append(f"{fid}: AC mapping drift")
        if not x.get("required_evidence"): errors.append(f"{fid}: required evidence missing")
        if x.get("orphaned") is not False: errors.append(f"{fid}: marked orphaned")

    # Reciprocal requirement -> finding refs must exist in reverse mapping.
    for rid,t in fwd_by.items():
        for fid in t.get("blocking_finding_refs",[]):
            if fid not in rev_by: errors.append(f"{rid}: unknown blocker {fid}")
            elif rid not in rev_by[fid].get("affected_requirement_ids",[]): errors.append(f"{rid}: reverse blocker reciprocity missing for {fid}")

    # Cover all acceptance criteria. AC-9 is global by design.
    covered=set()
    for t in fwd: covered.update(t.get("acceptance_criteria",[]))
    globals_=l.get("global_acceptance_traces",[])
    if len(globals_)!=1 or globals_[0].get("acceptance_criterion")!="AC-9": errors.append("global AC-9 trace missing/drifted")
    else:
        if globals_[0].get("requirement_binding")!="global_not_single_requirement": errors.append("AC-9 global binding drift")
        if not globals_[0].get("required_evidence"): errors.append("AC-9 required evidence missing")
        covered.add("AC-9")
    if covered!={f"AC-{i}" for i in range(1,11)}: errors.append(f"AC coverage incomplete: {sorted(covered)}")

    # EXP-0.3.8 must have resolved the registered governance conflict.
    cs=conflicts.get("conflicts",[])
    if len(cs)!=1 or cs[0].get("status")!="resolved" or cs[0].get("selected_resolution")!="EXP-SCOPE-RESOLUTION-B":
        errors.append("governance conflict is not resolved by EXP-0.3.8")

    summary=l.get("summary",{})
    if summary.get("mandatory_requirements")!=60: errors.append("summary mandatory count drift")
    if summary.get("scope_decision_requirements")!=0: errors.append("summary scope count drift")
    if summary.get("traced_requirements")!=60: errors.append("summary traced count drift")
    if summary.get("genesis_blocking_findings")!=10: errors.append("summary blocker count drift")
    if summary.get("orphaned_mandatory_requirements")!=0: errors.append("orphaned mandatory requirement count nonzero")
    if summary.get("orphaned_genesis_blockers")!=0: errors.append("orphaned Genesis blocker count nonzero")
    if summary.get("global_acceptance_traces")!=1: errors.append("global acceptance trace count drift")
    if set(summary.get("acceptance_criteria_covered",[]))!={f"AC-{i}" for i in range(1,11)}: errors.append("summary AC coverage drift")

    rules=" ".join(l.get("rules",[])).lower()
    for token in ("every mandatory genesis requirement","every genesis-blocking finding","reciprocated","does not mean"):
        if token not in rules: errors.append(f"traceability rule token missing: {token}")

    EVIDENCE.mkdir(exist_ok=True)
    out={
      "schema":"exp-0.3.7-evidence-v1","milestone":"EXP-0.3.7",
      "mandatory_requirements":len(mandatory),"scope_decision_requirements":len(scope),
      "traced_requirements":len(fwd),"genesis_blocking_findings":len(blockers),
      "orphaned_mandatory_requirements":sum(1 for rid in mandatory if rid not in fwd_by),
      "orphaned_genesis_blockers":sum(1 for g in blockers if g["id"] not in rev_by),
      "acceptance_criteria_covered":sorted(covered,key=lambda x:int(x.split("-")[1])),
      "errors":errors,"pass":not errors
    }
    (EVIDENCE/"summary.json").write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    with (EVIDENCE/"requirement-traces.tsv").open("w",encoding="utf-8",newline="") as fh:
        w=csv.writer(fh,delimiter="\t")
        w.writerow(["requirement_id","name","classification","status","implementation_path_ref","findings","remediation_milestones","acceptance_criteria","test_kind"])
        for t in fwd:
            w.writerow([t["requirement_id"],t["name"],t["classification"],t["current_status"],t.get("implementation_path_ref") or "",",".join(t["blocking_finding_refs"]),",".join(t["remediation_milestones"]),",".join(t["acceptance_criteria"]),t["acceptance_test_trace"]["kind"]])
    with (EVIDENCE/"blocker-traces.tsv").open("w",encoding="utf-8",newline="") as fh:
        w=csv.writer(fh,delimiter="\t")
        w.writerow(["finding_id","title","classification","affected_requirements","remediation_milestones","acceptance_criteria","orphaned"])
        for x in rev:
            w.writerow([x["finding_id"],x["title"],x["classification"],",".join(x["affected_requirement_ids"]),",".join(x["remediation_milestones"]),",".join(x["acceptance_criteria"]),str(x["orphaned"]).lower()])
    print(json.dumps(out,indent=2))
    if errors: raise SystemExit(1)

if __name__=="__main__": main()
