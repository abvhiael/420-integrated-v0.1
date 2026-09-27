#!/usr/bin/env python3
import csv,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
M=ROOT/"docs/audit/EXP-0.4.4-requirement-ci-coverage.json"
REQ=ROOT/"docs/audit/EXP-0.3.1-authoritative-genesis-requirements.json"
TRACE=ROOT/"docs/audit/EXP-0.3.7-bidirectional-traceability.json"
FREEZE=ROOT/"docs/audit/EXP-0.3.4-qualification-status-freeze.json"
EVIDENCE=ROOT/"exp-0-4-4-evidence"
OWNER_LAYER={
 "EXP-1":"blockchain_data_integrity_runtime","EXP-2":"explorer_service_api_runtime","EXP-3":"contract_registry_runtime",
 "EXP-4":"deployed_ui_workflow","EXP-5":"ecosystem_integration","EXP-6":"security_operations_recovery",
 "EXP-7":"deployment_live_network","EXP-8":"exact_release_candidate_genesis_closeout"
}
REQUIRED_GATES={"scripts/verify-exp-0-3-1-authoritative-requirements.py","scripts/verify-exp-0-3-4-status-freeze.py","scripts/verify-exp-0-3-7-traceability.py"}

def load(p): return json.loads(p.read_text(encoding="utf-8"))
def main():
 errors=[]
 m=load(M); req=load(REQ); trace=load(TRACE); freeze=load(FREEZE)
 if m.get("schema")!="420explorer-exp-0.4.4-requirement-ci-coverage-v1": errors.append("schema drift")
 if m.get("milestone")!="EXP-0.4.4": errors.append("milestone drift")
 mandatory=[r for r in req.get("requirements",[]) if r.get("classification")=="mandatory_genesis"]
 entries=m.get("entries",[])
 if len(mandatory)!=60: errors.append(f"authoritative mandatory requirement count drift: {len(mandatory)}")
 if len(entries)!=60: errors.append(f"coverage entry count drift: {len(entries)}")
 by_req={r["id"]:r for r in mandatory}; by_e={e.get("requirement_id"):e for e in entries}
 by_t={t["requirement_id"]:t for t in trace.get("forward_requirement_traces",[]) if t.get("classification")=="mandatory_genesis"}
 by_f={f["requirement_id"]:f for f in freeze.get("entries",[]) if f.get("classification")=="mandatory_genesis"}
 if set(by_req)!=set(by_e): errors.append("mandatory requirement coverage set mismatch")
 if set(by_req)!=set(by_t): errors.append("mandatory trace set mismatch")
 if set(by_req)!=set(by_f): errors.append("mandatory status-freeze set mismatch")
 for rid,r in by_req.items():
  e=by_e.get(rid,{})
  t=by_t.get(rid,{})
  f=by_f.get(rid,{})
  if e.get("name")!=r.get("name") or e.get("category")!=r.get("category"): errors.append(f"{rid}: identity drift")
  if e.get("current_status")!=r.get("current_status") or e.get("current_status")!=f.get("frozen_status"): errors.append(f"{rid}: status drift")
  if e.get("acceptance_criteria")!=r.get("acceptance_criteria",[]): errors.append(f"{rid}: AC drift")
  if e.get("blocking_findings")!=t.get("blocking_finding_refs",[]): errors.append(f"{rid}: finding drift")
  gates={g.get("ref") for g in e.get("current_automated_gates",[])}
  if not REQUIRED_GATES.issubset(gates): errors.append(f"{rid}: required model gates missing")
  for p in gates:
   if not (ROOT/p).exists(): errors.append(f"{rid}: gate path missing {p}")
  expected_files=t.get("acceptance_test_trace",{}).get("current_test_files",[])
  if e.get("current_functional_test_files")!=expected_files: errors.append(f"{rid}: functional-test mapping drift")
  for p in expected_files:
   if not (ROOT/p).exists(): errors.append(f"{rid}: functional test file missing {p}")
  expected_later=t.get("acceptance_test_trace",{}).get("later_qualification_procedures",[])
  if e.get("future_qualification_procedures")!=expected_later: errors.append(f"{rid}: later procedure drift")
  if not expected_later: errors.append(f"{rid}: no future qualification procedure")
  direct=r.get("later_qualification_owners",[])
  proc_owners=[]
  for p in expected_later:
   if p.get("owner") and p.get("owner") not in proc_owners: proc_owners.append(p.get("owner"))
  owners=list(direct)
  for o in proc_owners:
   if o not in owners: owners.append(o)
  extras=[o for o in proc_owners if o not in direct]
  if e.get("authoritative_later_owners")!=direct: errors.append(f"{rid}: authoritative later owner drift")
  if e.get("procedure_owners")!=proc_owners: errors.append(f"{rid}: procedure owner drift")
  if e.get("future_qualification_owners")!=owners: errors.append(f"{rid}: combined owner drift")
  if e.get("cross_owner_procedure_owners")!=extras: errors.append(f"{rid}: cross-owner procedure drift")
  expected_layers=[]
  for o in owners:
   if o in OWNER_LAYER and OWNER_LAYER[o] not in expected_layers: expected_layers.append(OWNER_LAYER[o])
  if e.get("missing_evidence_layers")!=expected_layers: errors.append(f"{rid}: missing evidence layer drift")
  if e.get("promotion_gate")!=f.get("promotion_gate"): errors.append(f"{rid}: promotion gate drift")
  if e.get("orphan") is not False: errors.append(f"{rid}: orphaned")
  if not e.get("current_automated_gates") and not expected_later: errors.append(f"{rid}: no current or future gate")
  if e.get("coverage_class") not in ("functional_plus_model_plus_future","model_plus_future_procedure"): errors.append(f"{rid}: invalid coverage class")
 summary=m.get("summary",{})
 status_counts={}
 for e in entries: status_counts[e["current_status"]]=status_counts.get(e["current_status"],0)+1
 expected_summary={
  "mandatory_requirements":60,
  "requirements_with_current_model_gates":60,
  "requirements_with_current_functional_test_files":10,
  "requirements_without_current_functional_test_files":50,
  "requirements_with_future_procedures":60,
  "orphaned_mandatory_requirements":0,
  "current_status_counts":{"implemented_source":6,"partial_source":4,"source_qualified":47,"deployment_pending":1,"runtime_unverified":2},
  "genesis_qualified_requirements":0,
  "requirements_with_cross_owner_procedures":8
 }
 for k,v in expected_summary.items():
  if summary.get(k)!=v: errors.append(f"summary drift: {k}")
 if status_counts!=expected_summary["current_status_counts"]: errors.append("computed status count drift")
 EVIDENCE.mkdir(exist_ok=True)
 out={"schema":"exp-0.4.4-evidence-v1","milestone":"EXP-0.4.4","mandatory_requirements":len(entries),"functional_test_mapped":sum(1 for e in entries if e.get("current_functional_test_files")),"future_procedure_mapped":sum(1 for e in entries if e.get("future_qualification_procedures")),"orphaned":sum(1 for e in entries if e.get("orphan")),"errors":errors,"pass":not errors}
 (EVIDENCE/"summary.json").write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
 with (EVIDENCE/"requirement-ci-coverage.tsv").open("w",encoding="utf-8",newline="") as fh:
  w=csv.writer(fh,delimiter="\t");w.writerow(["requirement_id","category","status","coverage_class","functional_test_files","future_owners","missing_layers","blockers"])
  for e in entries:w.writerow([e["requirement_id"],e["category"],e["current_status"],e["coverage_class"],",".join(e["current_functional_test_files"]),",".join(e["future_qualification_owners"]),",".join(e["missing_evidence_layers"]),",".join(e["blocking_findings"])])
 print(json.dumps(out,indent=2))
 if errors: raise SystemExit(1)
if __name__=="__main__": main()
