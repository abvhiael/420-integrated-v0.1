#!/usr/bin/env python3
import csv,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
MATRIX=ROOT/"docs/audit/EXP-0.3.5-nonblocking-scope-exclusions.json"
REQS=ROOT/"docs/audit/EXP-0.3.1-authoritative-genesis-requirements.json"
FREEZE=ROOT/"docs/audit/EXP-0.3.4-qualification-status-freeze.json"
DEPS=ROOT/"docs/audit/EXP-0.2.4-dependency-readiness-matrix.json"
GAPS=ROOT/"docs/audit/EXP-0.2.5-genesis-gap-register.json"
ACS=ROOT/"docs/audit/EXP-0.2.6-genesis-acceptance-criteria.json"
PROFILE=ROOT/"contracts/config/420explorer-genesis.json"
EVIDENCE=ROOT/"exp-0-3-5-evidence"
def load(p): return json.loads(p.read_text(encoding="utf-8"))
def main():
  errors=[]
  m=load(MATRIX); req=load(REQS); freeze=load(FREEZE); deps=load(DEPS); gaps=load(GAPS); acs=load(ACS); profile=load(PROFILE)
  if m.get("schema")!="420explorer-exp-0.3.5-nonblocking-scope-exclusions-v1": errors.append("schema drift")
  if m.get("milestone")!="EXP-0.3.5": errors.append("milestone drift")
  xs=m.get("exclusions",[])
  if len(xs)!=4: errors.append(f"expected 4 exclusions, found {len(xs)}")
  if len({x.get("id") for x in xs})!=len(xs): errors.append("duplicate exclusion id")
  req_by={r["id"]:r for r in req.get("requirements",[])}
  freeze_by={e["requirement_id"]:e for e in freeze.get("entries",[])}
  dep_by={d["id"]:d for d in deps.get("dependencies",[])}
  gap_by={g["id"]:g for g in gaps.get("findings",[])}
  optional=0; post=0
  allowed_req={"EXP-REQ-SRC-005","EXP-REQ-SRC-006","EXP-REQ-POST-001","EXP-REQ-POST-002"}
  if {x.get("requirement_id") for x in xs}!=allowed_req: errors.append("excluded requirement set drift")
  for x in xs:
    xid=x.get("id","<missing>"); rid=x.get("requirement_id")
    r=req_by.get(rid); f=freeze_by.get(rid)
    if not r: errors.append(f"{xid}: requirement missing")
    else:
      if r.get("classification")!=x.get("classification"): errors.append(f"{xid}: classification drift from requirement inventory")
      if r.get("current_status")!=x.get("frozen_status"): errors.append(f"{xid}: status drift from requirement inventory")
      if r.get("acceptance_criteria"): errors.append(f"{xid}: excluded requirement has core acceptance criteria")
    if not f: errors.append(f"{xid}: frozen status entry missing")
    elif f.get("frozen_status")!=x.get("frozen_status"): errors.append(f"{xid}: EXP-0.3.4 freeze mismatch")
    if x.get("genesis_blocking") is not False: errors.append(f"{xid}: excluded item is Genesis-blocking")
    if x.get("acceptance_criteria")!=[]: errors.append(f"{xid}: exclusion maps to acceptance criteria")
    if x.get("classification")=="optional_integration": optional+=1
    elif x.get("classification")=="post_genesis_enhancement": post+=1
    else: errors.append(f"{xid}: invalid exclusion classification")
    for did in x.get("dependency_refs",[]):
      d=dep_by.get(did)
      if not d: errors.append(f"{xid}: dependency missing {did}")
      elif d.get("required_for_genesis") is not False: errors.append(f"{xid}: dependency {did} became required_for_genesis")
    for fid in x.get("finding_refs",[]):
      g=gap_by.get(fid)
      if not g: errors.append(f"{xid}: finding missing {fid}")
      elif g.get("genesis_blocking") is not False: errors.append(f"{xid}: finding {fid} became Genesis-blocking")
  if optional!=2 or post!=2: errors.append(f"classification totals drift: optional={optional} post={post}")

  for did in ("EXP-DEP-009","EXP-DEP-010","EXP-DEP-011"):
    d=dep_by.get(did)
    if not d or d.get("required_for_genesis") is not False or d.get("dependency_class")!="optional_enrichment":
      errors.append(f"{did}: optional dependency discipline drift")

  for fid in ("EXP-FIND-012","EXP-FIND-014"):
    g=gap_by.get(fid)
    if not g or g.get("genesis_blocking") is not False: errors.append(f"{fid}: post-Genesis finding blocker drift")
    if g and g.get("acceptance_criteria")!=[]: errors.append(f"{fid}: post-Genesis finding has acceptance criteria")
    for ac in acs.get("criteria",[]):
      if fid in ac.get("blocking_findings",[]): errors.append(f"{fid}: appears in {ac.get('id')} blocking findings")

  views=[str(v).lower() for v in profile.get("requiredViews",[])]
  forbidden=("names","identity","staking","reward","verify")
  for tok in forbidden:
    if any(tok in v for v in views): errors.append(f"requiredViews unexpectedly contains excluded token: {tok}")
  sources=profile.get("sources",{})
  if sources.get("optionalNaming")!="420 Names display enrichment": errors.append("optionalNaming source drift")
  if sources.get("optionalIdentity")!="420 Identity public display enrichment": errors.append("optionalIdentity source drift")

  protected=m.get("protected_scope_decisions",[])
  if len(protected)!=1 or protected[0].get("requirement_id")!="EXP-REQ-SCOPE-001": errors.append("protected governance decision missing")
  gov=req_by.get("EXP-REQ-SCOPE-001")
  gov_gap=gap_by.get("EXP-FIND-001")
  if not gov or gov.get("classification")!="scope_decision_required" or gov.get("current_status")!="scope_decision_required":
    errors.append("governance requirement no longer scope_decision_required")
  if not gov_gap or gov_gap.get("genesis_blocking") is not True: errors.append("governance finding no longer Genesis-blocking")
  if "EXP-REQ-SCOPE-001" in {x.get("requirement_id") for x in xs}: errors.append("governance was incorrectly excluded")

  s=m.get("summary",{})
  expected={"excluded_entries":4,"optional_integrations":2,"post_genesis_enhancements":2,"excluded_genesis_blockers":0,"protected_scope_decisions":1}
  if s!=expected: errors.append(f"summary drift: {s}")

  EVIDENCE.mkdir(exist_ok=True)
  out={"schema":"exp-0.3.5-evidence-v1","milestone":"EXP-0.3.5","excluded_entries":len(xs),"optional_integrations":optional,"post_genesis_enhancements":post,"excluded_genesis_blockers":sum(bool(x.get("genesis_blocking")) for x in xs),"protected_scope_decisions":len(protected),"errors":errors,"pass":not errors}
  (EVIDENCE/"summary.json").write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
  with (EVIDENCE/"exclusions.tsv").open("w",encoding="utf-8",newline="") as fh:
    w=csv.writer(fh,delimiter="\t"); w.writerow(["id","requirement_id","name","classification","frozen_status","dependency_refs","finding_refs","genesis_blocking"])
    for x in xs: w.writerow([x["id"],x["requirement_id"],x["name"],x["classification"],x["frozen_status"],",".join(x["dependency_refs"]),",".join(x["finding_refs"]),str(x["genesis_blocking"]).lower()])
  print(json.dumps(out,indent=2))
  if errors: raise SystemExit(1)
if __name__=="__main__": main()
