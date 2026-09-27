#!/usr/bin/env python3
import csv, json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
REG=ROOT/"docs/audit/EXP-0.3.6-scope-conflict-resolution-register.json"
CAP=ROOT/"docs/audit/EXP-0.2.1-genesis-capability-matrix.json"
GAPS=ROOT/"docs/audit/EXP-0.2.5-genesis-gap-register.json"
ACS=ROOT/"docs/audit/EXP-0.2.6-genesis-acceptance-criteria.json"
REQ=ROOT/"docs/audit/EXP-0.3.1-authoritative-genesis-requirements.json"
FREEZE=ROOT/"docs/audit/EXP-0.3.4-qualification-status-freeze.json"
EXCL=ROOT/"docs/audit/EXP-0.3.5-nonblocking-scope-exclusions.json"
APPS=ROOT/"config/genesis-applications.json"
PROFILE=ROOT/"contracts/config/420explorer-genesis.json"
DECISION=ROOT/"docs/audit/EXP-0.3.8-governance-scope-decision.json"
EVIDENCE=ROOT/"exp-0-3-6-evidence"

def load(p): return json.loads(p.read_text(encoding="utf-8"))

def main():
    errors=[]
    reg=load(REG); cap=load(CAP); gaps=load(GAPS); acs=load(ACS); req=load(REQ)
    freeze=load(FREEZE); excl=load(EXCL); apps=load(APPS); profile=load(PROFILE)
    decision=load(DECISION) if DECISION.exists() else {}

    if reg.get("schema")!="420explorer-exp-0.3.6-scope-conflict-resolution-register-v1": errors.append("schema drift")
    if reg.get("milestone")!="EXP-0.3.6": errors.append("milestone drift")
    conflicts=reg.get("conflicts",[])
    if len(conflicts)!=1: errors.append(f"expected exactly one registered conflict, found {len(conflicts)}")
    c=conflicts[0] if conflicts else {}

    if c.get("id")!="EXP-SCOPE-CONFLICT-001" or c.get("subject")!="governance view": errors.append("governance conflict identity drift")
    if c.get("status")!="resolved": errors.append("governance conflict is not resolved")
    if c.get("genesis_blocking") is not False: errors.append("resolved governance conflict remains Genesis-blocking")
    if c.get("selected_resolution")!="EXP-SCOPE-RESOLUTION-B": errors.append("selected resolution drift")
    if c.get("resolution_record")!="docs/audit/EXP-0.3.8-governance-scope-decision.json": errors.append("resolution record drift")

    explorer=next((x for x in apps.get("apps",[]) if x.get("name")=="420 Explorer"),{})
    purpose=str(explorer.get("purpose",""))
    required=[str(x).lower() for x in profile.get("requiredViews",[])]
    if "governance" in purpose.lower(): errors.append("application purpose still names governance")
    if "governance" in required: errors.append("dedicated profile unexpectedly requires governance")
    if c.get("source_a",{}).get("value")!=purpose: errors.append("source A value in register drifted")
    if c.get("source_b",{}).get("value")!=profile.get("requiredViews",[]): errors.append("source B value in register drifted")

    if any(x.get("id")=="EXP-CAP-019" for x in cap.get("capabilities",[])): errors.append("retired EXP-CAP-019 remains active")
    gap=next((x for x in gaps.get("findings",[]) if x.get("id")=="EXP-FIND-001"),None)
    if not gap or gap.get("genesis_blocking") is not False: errors.append("EXP-FIND-001 not retained as resolved non-blocking evidence")
    if any(x.get("id")=="EXP-REQ-SCOPE-001" for x in req.get("requirements",[])): errors.append("retired EXP-REQ-SCOPE-001 remains active")
    if any(x.get("requirement_id")=="EXP-REQ-SCOPE-001" for x in freeze.get("entries",[])): errors.append("retired governance requirement remains in status freeze")
    if excl.get("protected_scope_decisions"): errors.append("resolved governance decision remains protected as unresolved")
    resolved=excl.get("resolved_scope_decisions",[])
    if len(resolved)!=1 or resolved[0].get("decision")!="EXP-SCOPE-RESOLUTION-B": errors.append("exclusion ledger lacks resolved scope decision")

    ac_by={x.get("id"):x for x in acs.get("criteria",[])}
    for acid in ("AC-5","AC-10"):
        if "EXP-FIND-001" in ac_by.get(acid,{}).get("blocking_findings",[]): errors.append(f"{acid} still blocked by EXP-FIND-001")

    resolutions=c.get("admissible_resolutions",[])
    if {x.get("id") for x in resolutions}!={"EXP-SCOPE-RESOLUTION-A","EXP-SCOPE-RESOLUTION-B"}: errors.append("admissible resolution history drift")
    manifest=c.get("atomic_reconciliation_manifest",[])
    for rel in manifest:
        if not (ROOT/rel).exists(): errors.append(f"manifest file missing: {rel}")

    if decision.get("decision")!="EXP-SCOPE-RESOLUTION-B" or decision.get("status")!="resolved": errors.append("EXP-0.3.8 decision record missing or invalid")

    expected={"conflicts":1,"unresolved":0,"resolved":1,"genesis_blocking":0,"admissible_resolution_paths":2,"final_exp0_closeout_blocked":False}
    if reg.get("summary")!=expected: errors.append(f"summary drift: {reg.get('summary')}")

    EVIDENCE.mkdir(exist_ok=True)
    out={"schema":"exp-0.3.6-evidence-v2","milestone":"EXP-0.3.6","conflicts":len(conflicts),
         "unresolved":sum(x.get("status")=="unresolved" for x in conflicts),
         "resolved":sum(x.get("status")=="resolved" for x in conflicts),
         "genesis_blocking":sum(bool(x.get("genesis_blocking")) for x in conflicts),
         "selected_resolution":c.get("selected_resolution"),"errors":errors,"pass":not errors}
    (EVIDENCE/"summary.json").write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    with (EVIDENCE/"conflicts.tsv").open("w",encoding="utf-8",newline="") as fh:
        w=csv.writer(fh,delimiter="\t"); w.writerow(["id","subject","status","genesis_blocking","selected_resolution","resolution_record"])
        for x in conflicts: w.writerow([x.get("id"),x.get("subject"),x.get("status"),str(x.get("genesis_blocking")).lower(),x.get("selected_resolution",""),x.get("resolution_record","")])
    print(json.dumps(out,indent=2))
    if errors: raise SystemExit(1)

if __name__=="__main__": main()
