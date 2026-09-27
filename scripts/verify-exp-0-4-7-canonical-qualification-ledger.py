#!/usr/bin/env python3
import json
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
M=ROOT/"docs/audit/EXP-0.4.7-canonical-qualification-ledger.json"
STATUS=ROOT/"docs/audit/EXP-0.3.4-qualification-status-freeze.json"
COV=ROOT/"docs/audit/EXP-0.4.4-requirement-ci-coverage.json"
AC=ROOT/"docs/audit/EXP-0.4.5-acceptance-criterion-evidence.json"
GAPS=ROOT/"docs/audit/EXP-0.2.5-genesis-gap-register.json"
CONTRA=ROOT/"docs/audit/EXP-0.4.6-historical-contradiction-reconciliation.json"
PROV=ROOT/"docs/audit/EXP-0.4.3-qualification-evidence-ledger.json"
EVIDENCE=ROOT/"exp-0-4-7-evidence"
def load(p): return json.loads(p.read_text(encoding="utf-8"))
def main():
 errors=[]
 for p in (M,STATUS,COV,AC,GAPS,CONTRA,PROV):
  if not p.exists(): errors.append(f"missing {p.relative_to(ROOT)}")
 if errors:
  print(json.dumps({"pass":False,"errors":errors},indent=2)); raise SystemExit(1)
 m,status,cov,ac,gaps,contra,prov=map(load,(M,STATUS,COV,AC,GAPS,CONTRA,PROV))
 if m.get("schema")!="420explorer-exp-0.4.7-canonical-qualification-ledger-v1": errors.append("schema drift")
 if m.get("milestone")!="EXP-0.4.7": errors.append("milestone drift")
 reqs=m.get("requirements",[]); req_ids=[r.get("requirement_id") for r in reqs]
 cov_entries=cov.get("entries",[])
 cov_ids=[r["requirement_id"] for r in cov_entries]
 if req_ids!=cov_ids: errors.append("mandatory requirement ordering/set drift")
 if len(req_ids)!=60 or len(set(req_ids))!=60: errors.append("mandatory requirement cardinality drift")
 sby={x["requirement_id"]:x for x in status.get("entries",[])}
 cby={x["requirement_id"]:x for x in cov_entries}
 for r in reqs:
  rid=r["requirement_id"]; s=sby.get(rid); c=cby.get(rid)
  if not s or not c: errors.append(f"{rid}: missing upstream"); continue
  checks={
   "name":c["name"],"category":c["category"],"classification":s["classification"],
   "current_status":c["current_status"],"status_scope":s["status_scope"],
   "acceptance_criteria":c["acceptance_criteria"],"blocking_findings":c["blocking_findings"],
   "dependency_refs":s.get("dependency_refs",[]),"current_automated_gates":c["current_automated_gates"],
   "current_functional_test_files":c["current_functional_test_files"],
   "current_coverage_layers":c["current_coverage_layers"],
   "future_qualification_owners":c["future_qualification_owners"],
   "future_qualification_procedures":c["future_qualification_procedures"],
   "missing_evidence_layers":c["missing_evidence_layers"],"promotion_gate":c["promotion_gate"]
  }
  for k,v in checks.items():
   if r.get(k)!=v: errors.append(f"{rid}: {k} drift")
  for k in ("runtime_qualified","deployment_qualified","live_network_qualified","genesis_qualified","orphan"):
   if r.get(k) is not False: errors.append(f"{rid}: invalid {k} promotion")
  if r.get("repository_evidence_head")!="298f73b99b384704a3231e5dfdfebef0bff3faab": errors.append(f"{rid}: repository evidence head drift")
  for gate in r.get("current_automated_gates",[]):
   p=gate.get("ref")
   if p and not (ROOT/p).exists(): errors.append(f"{rid}: missing gate {p}")
  for p in r.get("current_functional_test_files",[]):
   if not (ROOT/p).exists(): errors.append(f"{rid}: missing test {p}")
 acs=m.get("acceptance_criteria",[])
 if [x.get("acceptance_criterion") for x in acs] != [x["acceptance_criterion"] for x in ac.get("criteria",[])]: errors.append("AC ordering/set drift")
 if len(acs)!=10: errors.append("AC cardinality drift")
 aby={x["acceptance_criterion"]:x for x in ac.get("criteria",[])}
 for x in acs:
  aid=x["acceptance_criterion"]; a=aby[aid]
  for k in ("question","current_status","primary_owner","supporting_owners","mapped_mandatory_requirements","mapped_blocking_findings","required_evidence","missing_release_evidence","current_functional_test_files","current_model_verifiers","satisfaction_rule"):
   if x.get(k)!=a.get(k): errors.append(f"{aid}: {k} drift")
  if x.get("satisfied") is not False or x.get("current_status")!="unverified": errors.append(f"{aid}: prematurely satisfied")
 blockers=m.get("active_genesis_blockers",[])
 active=[f for f in gaps.get("findings",[]) if f.get("genesis_blocking")]
 if [x["finding_id"] for x in blockers] != [x["id"] for x in active]: errors.append("blocker ordering/set drift")
 for b,f in zip(blockers,active):
  if b.get("title")!=f.get("title") or b.get("classification")!=f.get("classification") or b.get("severity")!=f.get("severity"): errors.append(f"{f['id']}: blocker metadata drift")
  if b.get("later_owners")!=f.get("later_owner",[]) or b.get("acceptance_criteria")!=f.get("acceptance_criteria",[]): errors.append(f"{f['id']}: blocker ownership/AC drift")
  exp_reqs=[r["requirement_id"] for r in reqs if f["id"] in r.get("blocking_findings",[])]
  if b.get("mapped_requirements")!=exp_reqs: errors.append(f"{f['id']}: blocker requirement reverse-map drift")
  if b.get("genesis_blocking") is not True: errors.append(f"{f['id']}: blocker demoted")
 ev=m.get("evidence_state",{})
 if ev.get("latest_requalified_repository_head")!="298f73b99b384704a3231e5dfdfebef0bff3faab": errors.append("latest repository evidence head drift")
 for k in ("runtime_qualified","deployment_qualified","live_network_qualified","genesis_qualified"):
  if ev.get(k) is not False: errors.append(f"evidence state overpromotion: {k}")
 if ev.get("historical_contradiction_records")!=contra.get("summary",{}).get("records"): errors.append("contradiction ledger count drift")
 ps=prov.get("summary",{})
 for k in ("runtime_qualified_events","deployment_qualified_events","live_network_qualified_events","genesis_qualified_events"):
  if ps.get(k)!=0: errors.append(f"provenance promotion drift: {k}")
 summary=m.get("summary",{})
 counts=dict(Counter(r["current_status"] for r in reqs))
 expected={
  "mandatory_requirements":60,
  "requirement_status_counts":counts,
  "genesis_qualified_requirements":0,
  "acceptance_criteria":10,
  "unverified_acceptance_criteria":10,
  "satisfied_acceptance_criteria":0,
  "active_genesis_blockers":10,
  "requirements_with_blockers":sum(1 for r in reqs if r["blocking_findings"]),
  "requirements_without_blockers":sum(1 for r in reqs if not r["blocking_findings"]),
  "orphan_requirements":0,
  "runtime_qualified_requirements":0,
  "deployment_qualified_requirements":0,
  "live_network_qualified_requirements":0,
  "genesis_ready":False
 }
 for k,v in expected.items():
  if summary.get(k)!=v: errors.append(f"summary drift: {k}")
 EVIDENCE.mkdir(exist_ok=True)
 out={"schema":"exp-0.4.7-evidence-v1","milestone":"EXP-0.4.7","requirements":len(reqs),"acceptance_criteria":len(acs),"active_genesis_blockers":len(blockers),"status_counts":counts,"genesis_qualified_requirements":0,"satisfied_acceptance_criteria":0,"runtime_qualified_requirements":0,"deployment_qualified_requirements":0,"live_network_qualified_requirements":0,"errors":errors,"pass":not errors}
 (EVIDENCE/"summary.json").write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
 (EVIDENCE/"canonical-ledger-snapshot.json").write_text(json.dumps({"requirements":[{"id":r["requirement_id"],"status":r["current_status"],"blockers":r["blocking_findings"],"acs":r["acceptance_criteria"],"missing_layers":r["missing_evidence_layers"]} for r in reqs],"acceptance_criteria":[{"id":a["acceptance_criterion"],"status":a["current_status"],"blockers":a["mapped_blocking_findings"]} for a in acs],"blockers":[{"id":b["finding_id"],"requirements":b["mapped_requirements"],"acs":b["acceptance_criteria"]} for b in blockers]},indent=2)+"\n",encoding="utf-8")
 print(json.dumps(out,indent=2))
 if errors: raise SystemExit(1)
if __name__=="__main__": main()
