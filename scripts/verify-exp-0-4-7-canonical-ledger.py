#!/usr/bin/env python3
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
M=ROOT/"docs/audit/EXP-0.4.7-canonical-qualification-ledger.json"
REQ=ROOT/"docs/audit/EXP-0.3.1-authoritative-genesis-requirements.json"
FREEZE=ROOT/"docs/audit/EXP-0.3.4-qualification-status-freeze.json"
GAPS=ROOT/"docs/audit/EXP-0.2.5-genesis-gap-register.json"
AC=ROOT/"docs/audit/EXP-0.2.6-genesis-acceptance-criteria.json"
COV=ROOT/"docs/audit/EXP-0.4.4-requirement-ci-coverage.json"
ACE=ROOT/"docs/audit/EXP-0.4.5-acceptance-criterion-evidence.json"
CONTRA=ROOT/"docs/audit/EXP-0.4.6-historical-contradiction-reconciliation.json"
EVIDENCE=ROOT/"exp-0-4-7-evidence"

def load(p): return json.loads(p.read_text(encoding="utf-8"))
def main():
 errors=[]
 for p in (M,REQ,FREEZE,GAPS,AC,COV,ACE,CONTRA):
  if not p.exists(): errors.append(f"missing {p.relative_to(ROOT)}")
 if errors:
  print(json.dumps({"pass":False,"errors":errors},indent=2)); raise SystemExit(1)
 m,req,freeze,gaps,ac,cov,ace,contra=map(load,(M,REQ,FREEZE,GAPS,AC,COV,ACE,CONTRA))
 if m.get("schema")!="420explorer-exp-0.4.7-canonical-qualification-ledger-v1": errors.append("schema drift")
 if m.get("milestone")!="EXP-0.4.7": errors.append("milestone drift")
 mandatory=[r for r in req.get("requirements",[]) if r.get("classification")=="mandatory_genesis"]
 active=[f for f in gaps.get("findings",[]) if f.get("genesis_blocking")]
 criteria=ac.get("criteria",[])
 if len(mandatory)!=60: errors.append(f"mandatory count drift: {len(mandatory)}")
 if len(active)!=10: errors.append(f"blocker count drift: {len(active)}")
 if [c.get("id") for c in criteria]!=[f"AC-{i}" for i in range(1,11)]: errors.append("AC sequence drift")
 rb={e["requirement_id"]:e for e in m.get("requirement_entries",[])}
 fb={e["finding_id"]:e for e in m.get("blocker_entries",[])}
 ab={e["acceptance_criterion"]:e for e in m.get("acceptance_criterion_entries",[])}
 freeze_by={e["requirement_id"]:e for e in freeze.get("entries",[]) if e.get("classification")=="mandatory_genesis"}
 cov_by={e["requirement_id"]:e for e in cov.get("entries",[])}
 ace_by={e["acceptance_criterion"]:e for e in ace.get("criteria",[])}
 if set(rb)!=set(r["id"] for r in mandatory): errors.append("canonical requirement set mismatch")
 if set(fb)!=set(f["id"] for f in active): errors.append("canonical blocker set mismatch")
 if set(ab)!=set(c["id"] for c in criteria): errors.append("canonical AC set mismatch")
 for r in mandatory:
  rid=r["id"]; e=rb.get(rid,{}); f=freeze_by.get(rid,{}); c=cov_by.get(rid,{})
  if e.get("status")!=r.get("current_status") or e.get("status")!=f.get("frozen_status"): errors.append(f"{rid}: status drift")
  if e.get("genesis_qualified") is not False or f.get("genesis_qualified") is not False: errors.append(f"{rid}: premature Genesis qualification")
  if e.get("acceptance_criteria")!=r.get("acceptance_criteria",[]): errors.append(f"{rid}: AC link drift")
  if e.get("blocking_findings")!=c.get("blocking_findings",[]): errors.append(f"{rid}: blocker link drift")
  if e.get("missing_evidence_layers")!=c.get("missing_evidence_layers",[]): errors.append(f"{rid}: missing-layer drift")
  if e.get("future_qualification_owners")!=c.get("future_qualification_owners",[]): errors.append(f"{rid}: future-owner drift")
  cev=e.get("current_evidence",{})
  if cev.get("freshness")!="current_exact_head_revalidated": errors.append(f"{rid}: repository evidence freshness drift")
  for g in cev.get("model_gates",[]):
   p=g.get("ref")
   if p and not (ROOT/p).exists(): errors.append(f"{rid}: missing model gate {p}")
  for p in cev.get("functional_test_files",[]):
   if not (ROOT/p).exists(): errors.append(f"{rid}: missing functional test {p}")
 for f in active:
  fid=f["id"]; e=fb.get(fid,{})
  if e.get("genesis_blocking") is not True: errors.append(f"{fid}: no longer blocking in ledger")
  if e.get("acceptance_criteria")!=f.get("acceptance_criteria",[]): errors.append(f"{fid}: AC link drift")
  if e.get("later_owners")!=f.get("later_owner",[]): errors.append(f"{fid}: owner drift")
  if e.get("status")=="resolved": errors.append(f"{fid}: active blocker marked resolved")
 for c in criteria:
  cid=c["id"]; e=ab.get(cid,{}); ae=ace_by.get(cid,{})
  if e.get("status")!=c.get("current_status") or e.get("status")!="unverified": errors.append(f"{cid}: status drift")
  if e.get("satisfied") is not False: errors.append(f"{cid}: premature satisfaction")
  if e.get("mapped_blocking_findings")!=ae.get("mapped_blocking_findings",[]): errors.append(f"{cid}: blocker mapping drift")
  if e.get("mapped_mandatory_requirements")!=ae.get("mapped_mandatory_requirements",[]): errors.append(f"{cid}: requirement mapping drift")
  if e.get("required_evidence")!=c.get("required_evidence",[]): errors.append(f"{cid}: required evidence drift")
  if e.get("missing_release_evidence")!=ae.get("missing_release_evidence",[]): errors.append(f"{cid}: missing release evidence drift")
 state=m.get("current_state",{})
 expected_state={"mandatory_requirements":60,"genesis_qualified_requirements":0,"active_genesis_blockers":10,"acceptance_criteria":10,"satisfied_acceptance_criteria":0,"unverified_acceptance_criteria":10,"unresolved_scope_conflicts":0,"runtime_qualified_events":0,"deployment_qualified_events":0,"live_network_qualified_events":0,"genesis_qualified_events":0,"genesis_ready":False}
 for k,v in expected_state.items():
  if state.get(k)!=v: errors.append(f"current state drift: {k}")
 guard=m.get("historical_evidence_guard",{})
 if guard.get("records")!=contra.get("summary",{}).get("records"): errors.append("historical guard record count drift")
 for k in ("stale_governance_claims_promoted","placeholder_deployments_promoted","historical_qualified_claims_promoted_to_genesis"):
  if guard.get(k)!=0: errors.append(f"historical guard promotion drift: {k}")
 s=m.get("summary",{})
 if s.get("requirements")!=60 or s.get("blockers")!=10 or s.get("acceptance_criteria")!=10: errors.append("summary population drift")
 if s.get("orphan_requirements")!=0: errors.append("orphan requirements")
 if s.get("orphan_blockers")!=0: errors.append("orphan blockers")
 if s.get("orphan_acceptance_criteria")!=0: errors.append("orphan ACs")
 if s.get("promoted_requirements")!=0 or s.get("satisfied_acceptance_criteria")!=0 or s.get("genesis_ready") is not False: errors.append("premature promotion in summary")
 EVIDENCE.mkdir(exist_ok=True)
 out={"schema":"exp-0.4.7-evidence-v1","milestone":"EXP-0.4.7","requirements":len(rb),"blockers":len(fb),"acceptance_criteria":len(ab),"requirement_blocker_links":sum(len(e.get("blocking_findings",[])) for e in rb.values()),"requirement_ac_links":sum(len(e.get("acceptance_criteria",[])) for e in rb.values()),"ac_blocker_links":sum(len(e.get("mapped_blocking_findings",[])) for e in ab.values()),"ac_requirement_links":sum(len(e.get("mapped_mandatory_requirements",[])) for e in ab.values()),"errors":errors,"pass":not errors}
 (EVIDENCE/"summary.json").write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
 (EVIDENCE/"canonical-state.json").write_text(json.dumps({"current_state":state,"promotion_model":m.get("promotion_model"),"historical_evidence_guard":guard},indent=2)+"\n",encoding="utf-8")
 print(json.dumps(out,indent=2))
 if errors: raise SystemExit(1)
if __name__=="__main__": main()
