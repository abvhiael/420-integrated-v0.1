#!/usr/bin/env python3
import csv, json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
REGISTER=ROOT/"docs/audit/EXP-0.2.5-genesis-gap-register.json"
CAP=ROOT/"docs/audit/EXP-0.2.1-genesis-capability-matrix.json"
WF=ROOT/"docs/audit/EXP-0.2.2-user-workflow-matrix.json"
DEP=ROOT/"docs/audit/EXP-0.2.4-dependency-readiness-matrix.json"
EVIDENCE=ROOT/"exp-0-2-5-evidence"

CLASSIFICATIONS={
"Genesis blocker","Qualification gap","Integration gap",
"Documentation gap","Operational risk","Post-Genesis enhancement"
}
SEVERITIES={"critical","high","medium","low"}
EXPECTED_IDS=[f"EXP-FIND-{i:03d}" for i in range(1,15)]

def load(p): return json.loads(p.read_text(encoding="utf-8"))

def main():
    errors=[]
    reg=load(REGISTER); cap=load(CAP); wf=load(WF); dep=load(DEP)
    findings=reg.get("findings",[])

    if reg.get("schema")!="420explorer-exp-0.2.5-genesis-gap-register-v1": errors.append("unexpected schema")
    if reg.get("milestone")!="EXP-0.2.5": errors.append("unexpected milestone")
    ids=[f.get("id") for f in findings]
    if ids!=EXPECTED_IDS: errors.append(f"finding ID/order mismatch: {ids}")
    if len(ids)!=len(set(ids)): errors.append("duplicate finding id")

    for f in findings:
        fid=f.get("id","<missing>")
        if f.get("classification") not in CLASSIFICATIONS: errors.append(f"{fid}: invalid classification")
        if f.get("severity") not in SEVERITIES: errors.append(f"{fid}: invalid severity")
        for key in ("title","description","root_cause","blocking_rationale"):
            if not isinstance(f.get(key),str) or not f.get(key).strip(): errors.append(f"{fid}: missing {key}")
        for key in ("affected","evidence","consequences","dependencies","prerequisite_work","remediation","tests","later_owner"):
            if not isinstance(f.get(key),list) or not f.get(key): errors.append(f"{fid}: missing/non-empty list required for {key}")
        if not isinstance(f.get("acceptance_criteria"),list): errors.append(f"{fid}: acceptance_criteria must be list")
        if not isinstance(f.get("genesis_blocking"),bool): errors.append(f"{fid}: genesis_blocking must be bool")
        for rel in f.get("affected",[]):
            if "/" in rel and not (ROOT/rel).exists():
                errors.append(f"{fid}: affected path missing: {rel}")

    by={f["id"]:f for f in findings}

    # Preserve confirmed implementation blockers from EXP-0.2.2.
    wf_by={w["name"]:w for w in wf.get("workflows",[])}
    required_blockers={
      "EXP-FIND-008":"inspect transaction fees",
      "EXP-FIND-009":"inspect validator-produced blocks",
      "EXP-FIND-010":"examine contract events",
    }
    for fid,name in required_blockers.items():
        f=by[fid]; w=wf_by.get(name,{})
        if f["classification"]!="Genesis blocker" or f["genesis_blocking"] is not True:
            errors.append(f"{fid}: required implementation gap no longer blocker")
        if w.get("acceptance_status")!="gap_requires_implementation":
            errors.append(f"{fid}: source workflow no longer marked implementation gap")

    # Governance ambiguity must remain explicit until sources reconcile.
    gov=[c for c in cap.get("capabilities",[]) if c.get("name")=="governance view"]
    if gov and gov[0].get("classification")=="scope_decision_required":
        f=by["EXP-FIND-001"]
        if f["classification"]!="Documentation gap" or not f["genesis_blocking"]:
            errors.append("governance scope ambiguity not preserved as closeout blocker")

    # Optional dependencies/features may not block core Genesis.
    optional_dep={d["name"] for d in dep.get("dependencies",[]) if not d.get("required_for_genesis")}
    for fid in ("EXP-FIND-012","EXP-FIND-013","EXP-FIND-014"):
        f=by[fid]
        if f["classification"]!="Post-Genesis enhancement" or f["genesis_blocking"]:
            errors.append(f"{fid}: optional enhancement incorrectly blocks Genesis")
        if f.get("acceptance_criteria"):
            errors.append(f"{fid}: post-Genesis enhancement assigned Genesis acceptance criteria")

    # Required dependencies remain unqualified where readiness matrix says so.
    dep_by={d["name"]:d for d in dep.get("dependencies",[])}
    if dep_by["420Indexer /v1 read service"]["live_qualification"]!="unverified":
        errors.append("Indexer readiness changed; reconcile EXP-FIND-002")
    if by["EXP-FIND-002"]["classification"]!="Qualification gap": errors.append("EXP-FIND-002 classification drift")
    if by["EXP-FIND-005"]["classification"]!="Integration gap": errors.append("EXP-FIND-005 classification drift")
    if by["EXP-FIND-007"]["classification"]!="Integration gap": errors.append("EXP-FIND-007 classification drift")

    counts={c:sum(f["classification"]==c for f in findings) for c in CLASSIFICATIONS}
    expected_counts={
      "Genesis blocker":3,
      "Qualification gap":3,
      "Integration gap":3,
      "Documentation gap":1,
      "Operational risk":1,
      "Post-Genesis enhancement":3,
    }
    if counts!=expected_counts: errors.append(f"classification counts drift: {counts}")

    rules=reg.get("rules",{})
    if "speculative" not in rules.get("no_speculative_blockers","").lower(): errors.append("no-speculative-blocker rule missing")
    if "unverified" not in rules.get("unverified_not_failed","").lower(): errors.append("unverified-not-failed rule missing")
    if "must not block" not in rules.get("optional_features","").lower(): errors.append("optional-feature non-blocking rule missing")

    EVIDENCE.mkdir(exist_ok=True)
    summary={
      "schema":"exp-0.2.5-evidence-v1",
      "milestone":"EXP-0.2.5",
      "findings":len(findings),
      "genesis_blocking":sum(f["genesis_blocking"] for f in findings),
      "non_blocking":sum(not f["genesis_blocking"] for f in findings),
      "classification_counts":counts,
      "errors":errors,
      "pass":not errors
    }
    (EVIDENCE/"summary.json").write_text(json.dumps(summary,indent=2)+"\n",encoding="utf-8")
    with (EVIDENCE/"findings.tsv").open("w",encoding="utf-8",newline="") as fh:
        w=csv.writer(fh,delimiter="\t")
        w.writerow(["id","classification","severity","genesis_blocking","title","later_owner"])
        for f in findings:
            w.writerow([f["id"],f["classification"],f["severity"],f["genesis_blocking"],f["title"],",".join(f["later_owner"])])
    print(json.dumps(summary,indent=2))
    if errors: raise SystemExit(1)

if __name__=="__main__": main()
