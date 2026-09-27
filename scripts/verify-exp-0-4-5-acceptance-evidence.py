#!/usr/bin/env python3
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
M=ROOT/"docs/audit/EXP-0.4.5-acceptance-criterion-evidence.json"
AC=ROOT/"docs/audit/EXP-0.2.6-genesis-acceptance-criteria.json"
GAPS=ROOT/"docs/audit/EXP-0.2.5-genesis-gap-register.json"
COV=ROOT/"docs/audit/EXP-0.4.4-requirement-ci-coverage.json"
PROV=ROOT/"docs/audit/EXP-0.4.3-qualification-evidence-ledger.json"
EVIDENCE=ROOT/"exp-0-4-5-evidence"

def load(p): return json.loads(p.read_text(encoding="utf-8"))
def main():
 errors=[]
 for p in (M,AC,GAPS,COV,PROV):
  if not p.exists(): errors.append(f"missing {p.relative_to(ROOT)}")
 if errors:
  print(json.dumps({"pass":False,"errors":errors},indent=2)); raise SystemExit(1)
 m,ac,gaps,cov,prov=map(load,(M,AC,GAPS,COV,PROV))
 if m.get("schema")!="420explorer-exp-0.4.5-acceptance-criterion-evidence-v1": errors.append("schema drift")
 if m.get("milestone")!="EXP-0.4.5": errors.append("milestone drift")
 expected_ids=[f"AC-{i}" for i in range(1,11)]
 entries=m.get("criteria",[])
 ids=[e.get("acceptance_criterion") for e in entries]
 if ids!=expected_ids: errors.append(f"criterion sequence drift: {ids}")
 if len(ids)!=len(set(ids)): errors.append("duplicate criterion")
 ac_by={c["id"]:c for c in ac.get("criteria",[])}
 blockers=[f for f in gaps.get("findings",[]) if f.get("genesis_blocking")]
 cov_entries=cov.get("entries",[])
 for e in entries:
  cid=e.get("acceptance_criterion"); c=ac_by.get(cid)
  if not c: errors.append(f"{cid}: missing authoritative acceptance criterion"); continue
  for field in ("question","current_status","primary_owner","supporting_owners","verification_method","required_evidence"):
   if e.get(field)!=c.get(field): errors.append(f"{cid}: {field} drift")
  expected_blockers=[f["id"] for f in blockers if cid in f.get("acceptance_criteria",[])]
  if e.get("mapped_blocking_findings")!=expected_blockers: errors.append(f"{cid}: blocker mapping drift")
  expected_reqs=[r["requirement_id"] for r in cov_entries if cid in r.get("acceptance_criteria",[])]
  if e.get("mapped_mandatory_requirements")!=expected_reqs: errors.append(f"{cid}: requirement mapping drift")
  if e.get("orphaned") is not False: errors.append(f"{cid}: orphaned")
  if e.get("ac_satisfied") is not False: errors.append(f"{cid}: prematurely satisfied")
  if e.get("current_status")!="unverified": errors.append(f"{cid}: unexpectedly promoted")
  missing=e.get("missing_release_evidence",[])
  if [x.get("evidence") for x in missing]!=c.get("required_evidence",[]): errors.append(f"{cid}: missing-evidence accounting drift")
  if any(x.get("status")!="missing_or_not_release_candidate_qualified" for x in missing): errors.append(f"{cid}: invalid missing-evidence status")
  present=e.get("present_repository_evidence",[])
  if not present: errors.append(f"{cid}: no present evidence accounting")
  for item in present:
   if item.get("scope") in ("runtime_qualified","deployment_qualified","live_network_qualified","genesis_qualified"): errors.append(f"{cid}: repository evidence overpromoted")
   for p in item.get("refs",[]):
    if "/" in p and (p.endswith(".py") or p.endswith(".go") or p.endswith(".json") or p.endswith(".md")) and not (ROOT/p).exists(): errors.append(f"{cid}: missing evidence ref {p}")
 summary=m.get("summary",{})
 if summary.get("acceptance_criteria")!=10 or summary.get("unverified")!=10 or summary.get("satisfied")!=0: errors.append("summary acceptance status drift")
 if summary.get("orphaned_criteria")!=0: errors.append("summary orphan drift")
 if summary.get("current_genesis_blockers")!=10 or len(blockers)!=10: errors.append("Genesis blocker count drift")
 if summary.get("criteria_without_individual_blockers")!=["AC-9","AC-10"]: errors.append("criteria-without-blockers drift")
 if summary.get("genesis_ready") is not False: errors.append("Genesis readiness invented")
 if prov.get("summary",{}).get("runtime_qualified_events")!=0 or prov.get("summary",{}).get("deployment_qualified_events")!=0 or prov.get("summary",{}).get("live_network_qualified_events")!=0 or prov.get("summary",{}).get("genesis_qualified_events")!=0: errors.append("provenance level drift")
 EVIDENCE.mkdir(exist_ok=True)
 out={"schema":"exp-0.4.5-evidence-v1","milestone":"EXP-0.4.5","criteria":len(entries),"unverified":sum(1 for e in entries if e.get("current_status")=="unverified"),"criteria_with_blockers":sum(1 for e in entries if e.get("mapped_blocking_findings")),"blocker_links":sum(len(e.get("mapped_blocking_findings",[])) for e in entries),"requirement_links":sum(len(e.get("mapped_mandatory_requirements",[])) for e in entries),"orphaned":sum(1 for e in entries if e.get("orphaned")),"errors":errors,"pass":not errors}
 (EVIDENCE/"summary.json").write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
 (EVIDENCE/"acceptance-criterion-evidence.json").write_text(json.dumps({"criteria":[{"id":e["acceptance_criterion"],"status":e["current_status"],"blockers":e["mapped_blocking_findings"],"requirements":e["mapped_mandatory_requirements"],"missing_evidence":[x["evidence"] for x in e["missing_release_evidence"]]} for e in entries]},indent=2)+"\n",encoding="utf-8")
 print(json.dumps(out,indent=2))
 if errors: raise SystemExit(1)
if __name__=="__main__": main()
