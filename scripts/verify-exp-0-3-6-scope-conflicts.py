#!/usr/bin/env python3
import csv,json
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
EVIDENCE=ROOT/"exp-0-3-6-evidence"

def load(p): return json.loads(p.read_text(encoding="utf-8"))

def main():
    errors=[]
    reg=load(REG); cap=load(CAP); gaps=load(GAPS); acs=load(ACS); req=load(REQ); freeze=load(FREEZE); excl=load(EXCL); apps=load(APPS); profile=load(PROFILE)

    if reg.get("schema")!="420explorer-exp-0.3.6-scope-conflict-resolution-register-v1":
        errors.append("schema drift")
    if reg.get("milestone")!="EXP-0.3.6":
        errors.append("milestone drift")

    conflicts=reg.get("conflicts",[])
    if len(conflicts)!=1:
        errors.append(f"expected exactly one conflict, found {len(conflicts)}")
    c=conflicts[0] if conflicts else {}

    if c.get("id")!="EXP-SCOPE-CONFLICT-001" or c.get("subject")!="governance view":
        errors.append("governance conflict identity drift")
    if c.get("status")!="unresolved":
        errors.append("governance conflict must remain unresolved absent explicit decision record")
    if c.get("genesis_blocking") is not True:
        errors.append("governance conflict must remain Genesis-blocking")

    explorer=next((x for x in apps.get("apps",[]) if x.get("name")=="420 Explorer"),None)
    if not explorer:
        errors.append("420 Explorer application record missing")
        purpose=""
    else:
        purpose=str(explorer.get("purpose",""))
        if "governance" not in purpose.lower():
            errors.append("source A no longer names governance")

    required=[str(x).lower() for x in profile.get("requiredViews",[])]
    if "governance" in required:
        errors.append("source B now includes governance; conflict register requires reconciliation")
    if c.get("source_a",{}).get("value")!=purpose:
        errors.append("source A value in register drifted")
    if c.get("source_b",{}).get("value")!=profile.get("requiredViews",[]):
        errors.append("source B value in register drifted")

    caprec=next((x for x in cap.get("capabilities",[]) if x.get("id")=="EXP-CAP-019"),None)
    if not caprec or caprec.get("classification")!="scope_decision_required" or caprec.get("qualification_status")!="scope_decision_required":
        errors.append("EXP-CAP-019 no longer preserves scope decision")

    gap=next((x for x in gaps.get("findings",[]) if x.get("id")=="EXP-FIND-001"),None)
    if not gap or gap.get("genesis_blocking") is not True:
        errors.append("EXP-FIND-001 no longer Genesis-blocking")

    reqrec=next((x for x in req.get("requirements",[]) if x.get("id")=="EXP-REQ-SCOPE-001"),None)
    if not reqrec or reqrec.get("classification")!="scope_decision_required" or reqrec.get("current_status")!="scope_decision_required":
        errors.append("EXP-REQ-SCOPE-001 status drift")

    frec=next((x for x in freeze.get("entries",[]) if x.get("requirement_id")=="EXP-REQ-SCOPE-001"),None)
    if not frec or frec.get("frozen_status")!="scope_decision_required" or frec.get("genesis_qualified") is not False:
        errors.append("EXP-0.3.4 governance freeze drift")

    protected=excl.get("protected_scope_decisions",[])
    if len(protected)!=1 or protected[0].get("requirement_id")!="EXP-REQ-SCOPE-001" or protected[0].get("genesis_blocking") is not True:
        errors.append("EXP-0.3.5 no longer protects governance")
    if any(x.get("requirement_id")=="EXP-REQ-SCOPE-001" for x in excl.get("exclusions",[])):
        errors.append("governance was incorrectly excluded")

    ac_by={x.get("id"):x for x in acs.get("criteria",[])}
    for acid in ("AC-5","AC-10"):
        if "EXP-FIND-001" not in ac_by.get(acid,{}).get("blocking_findings",[]):
            errors.append(f"{acid} no longer blocked by EXP-FIND-001")

    if c.get("capability_id")!="EXP-CAP-019" or c.get("finding_id")!="EXP-FIND-001" or c.get("requirement_id")!="EXP-REQ-SCOPE-001":
        errors.append("conflict trace chain drift")
    if c.get("acceptance_criteria")!=["AC-5","AC-10"]:
        errors.append("conflict acceptance-criteria chain drift")

    authority=c.get("decision_authority",{})
    if authority.get("repository_owner_action_required") is not True or authority.get("decision_record_required") is not True:
        errors.append("explicit authoritative decision requirement missing")

    resolutions=c.get("admissible_resolutions",[])
    if len(resolutions)!=2:
        errors.append("expected exactly two admissible resolutions")
    else:
        ids={x.get("id") for x in resolutions}
        if ids!={"EXP-SCOPE-RESOLUTION-A","EXP-SCOPE-RESOLUTION-B"}:
            errors.append("admissible resolution IDs drift")
        for r in resolutions:
            if not r.get("required_actions"):
                errors.append(f"{r.get('id')}: required_actions missing")
            if not r.get("prohibited_shortcut"):
                errors.append(f"{r.get('id')}: prohibited shortcut missing")

    manifest=c.get("atomic_reconciliation_manifest",[])
    required_manifest={
        "config/genesis-applications.json",
        "contracts/config/420explorer-genesis.json",
        "docs/audit/EXP-0.2.1-genesis-capability-matrix.json",
        "docs/audit/EXP-0.2.2-user-workflow-matrix.json",
        "docs/audit/EXP-0.2.5-genesis-gap-register.json",
        "docs/audit/EXP-0.2.6-genesis-acceptance-criteria.json",
        "docs/audit/EXP-0.3.1-authoritative-genesis-requirements.json",
        "docs/audit/EXP-0.3.2-mandatory-capability-paths.json",
        "docs/audit/EXP-0.3.3-mandatory-acceptance-tests.json",
        "docs/audit/EXP-0.3.4-qualification-status-freeze.json",
        "docs/audit/EXP-0.3.5-nonblocking-scope-exclusions.json",
        "docs/audit/EXP-0.3.6-scope-conflict-resolution-register.json"
    }
    if set(manifest)!=required_manifest:
        errors.append("atomic reconciliation manifest drift")
    for rel in manifest:
        if not (ROOT/rel).exists():
            errors.append(f"manifest file missing: {rel}")

    if c.get("next_resolution_owner")!="EXP-0.3.8":
        errors.append("next resolution owner drift")

    summary=reg.get("summary",{})
    expected={
        "conflicts":1,
        "unresolved":1,
        "resolved":0,
        "genesis_blocking":1,
        "admissible_resolution_paths":2,
        "final_exp0_closeout_blocked":True
    }
    if summary!=expected:
        errors.append(f"summary drift: {summary}")

    rules=" ".join(reg.get("rules",[])).lower()
    for token in ("explicit authoritative decision","atomic_reconciliation_manifest","final exp-0/genesis scope closeout","does not mean"):
        if token not in rules:
            errors.append(f"register rule token missing: {token}")

    EVIDENCE.mkdir(exist_ok=True)
    out={
        "schema":"exp-0.3.6-evidence-v1",
        "milestone":"EXP-0.3.6",
        "conflicts":len(conflicts),
        "unresolved":sum(x.get("status")=="unresolved" for x in conflicts),
        "genesis_blocking":sum(bool(x.get("genesis_blocking")) for x in conflicts),
        "admissible_resolution_paths":sum(len(x.get("admissible_resolutions",[])) for x in conflicts),
        "final_exp0_closeout_blocked":summary.get("final_exp0_closeout_blocked"),
        "errors":errors,
        "pass":not errors
    }
    (EVIDENCE/"summary.json").write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    with (EVIDENCE/"conflicts.tsv").open("w",encoding="utf-8",newline="") as fh:
        w=csv.writer(fh,delimiter="\t")
        w.writerow(["id","subject","status","genesis_blocking","capability_id","finding_id","requirement_id","acceptance_criteria","resolution_paths","next_resolution_owner"])
        for x in conflicts:
            w.writerow([x["id"],x["subject"],x["status"],str(x["genesis_blocking"]).lower(),x["capability_id"],x["finding_id"],x["requirement_id"],",".join(x["acceptance_criteria"]),str(len(x["admissible_resolutions"])),x["next_resolution_owner"]])

    print(json.dumps(out,indent=2))
    if errors:
        raise SystemExit(1)

if __name__=="__main__":
    main()
