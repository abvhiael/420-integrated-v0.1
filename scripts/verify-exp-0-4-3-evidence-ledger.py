#!/usr/bin/env python3
import csv,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
LEDGER=ROOT/"docs/audit/EXP-0.4.3-qualification-evidence-ledger.json"
GAPS=ROOT/"docs/audit/EXP-0.2.5-genesis-gap-register.json"
ACS=ROOT/"docs/audit/EXP-0.2.6-genesis-acceptance-criteria.json"
HIST=ROOT/"docs/audit/EXP-0.4.2-historical-closeout-inventory.json"
EVIDENCE=ROOT/"exp-0-4-3-evidence"
SHA=re.compile(r"^[0-9a-f]{40}$")
LAYERS={"source_qualified","integration_qualified","runtime_qualified","deployment_qualified","live_network_qualified","genesis_qualified"}

def load(p): return json.loads(p.read_text(encoding="utf-8"))
def main():
 errors=[]
 if not LEDGER.exists(): errors.append("missing provenance ledger")
 if errors:
  print(json.dumps({"pass":False,"errors":errors},indent=2)); raise SystemExit(1)
 l=load(LEDGER); gaps=load(GAPS); acs=load(ACS); hist=load(HIST)
 if l.get("schema")!="420explorer-exp-0.4.3-qualification-evidence-ledger-v1": errors.append("schema drift")
 if l.get("milestone")!="EXP-0.4.3": errors.append("milestone drift")
 profiles=l.get("qualification_profiles",{})
 if set(profiles)!={"EXP-QP-001","EXP-QP-002","EXP-QP-003"}: errors.append("qualification profile set drift")
 for pid,p in profiles.items():
  if not p.get("commands") or not p.get("layers"): errors.append(f"{pid}: incomplete profile")
  if any(x not in LAYERS for x in p.get("layers",[])): errors.append(f"{pid}: invalid layer")
 events=l.get("events",[])
 if len(events)!=16: errors.append(f"event count drift: {len(events)}")
 ids=[e.get("id") for e in events]
 if len(ids)!=len(set(ids)) or any(not x for x in ids): errors.append("event IDs missing/duplicate")
 milestones=[e.get("milestone") for e in events]
 expected=["EXP-0.1.1-0.1.3","EXP-0.2.1-0.2.2","EXP-0.2.3","EXP-0.2.4","EXP-0.2.5","EXP-0.2.6","EXP-0.3.1","EXP-0.3.2","EXP-0.3.3","EXP-0.3.4","EXP-0.3.5","EXP-0.3.6","EXP-0.3.7","EXP-0.3.8","EXP-0.4.1","EXP-0.4.2"]
 if milestones!=expected: errors.append("milestone provenance sequence drift")
 for e in events:
  eid=e.get("id","<missing>")
  if not SHA.match(e.get("base_sha","")): errors.append(f"{eid}: invalid base sha")
  if not SHA.match(e.get("qualified_head","")): errors.append(f"{eid}: invalid qualified head")
  if not isinstance(e.get("pr"),int): errors.append(f"{eid}: PR missing")
  runs=e.get("runs",[])
  if not runs: errors.append(f"{eid}: no workflow runs")
  for r in runs:
   if not isinstance(r.get("run_id"),int): errors.append(f"{eid}: run id missing")
   if not r.get("job_ids") or any(not isinstance(x,int) for x in r.get("job_ids",[])): errors.append(f"{eid}: job IDs missing")
   if r.get("conclusion")!="success": errors.append(f"{eid}: non-success retained qualification run")
   if r.get("qualification_profile") not in profiles: errors.append(f"{eid}: unknown qualification profile")
  arts=e.get("artifacts",[])
  if not arts or any(not isinstance(a.get("id"),int) for a in arts): errors.append(f"{eid}: artifact provenance missing")
  for a in arts:
   d=a.get("digest")
   if d is not None and not re.match(r"^sha256:[0-9a-f]{64}$",d): errors.append(f"{eid}: invalid artifact digest")
   if d is None and not a.get("provenance_status"): errors.append(f"{eid}: missing digest without provenance explanation")
  layers=e.get("evidence_layers",[])
  if not layers or any(x not in LAYERS for x in layers): errors.append(f"{eid}: invalid evidence layers")
  if any(x in layers for x in ("runtime_qualified","deployment_qualified","live_network_qualified","genesis_qualified")): errors.append(f"{eid}: later evidence level invented")
  for f in ("evidence_scope","requirement_scope","finding_scope","acceptance_scope","limitations"):
   if f not in e: errors.append(f"{eid}: missing {f}")
 # Current status discipline must agree with authoritative current records.
 blockers=[f for f in gaps.get("findings",[]) if f.get("genesis_blocking")]
 criteria=acs.get("criteria",[])
 if len(blockers)!=10: errors.append(f"expected 10 blockers, got {len(blockers)}")
 if len(criteria)!=10 or any(c.get("current_status")!="unverified" for c in criteria): errors.append("acceptance status drift")
 # EXP-0.4.2 qualification must be represented exactly.
 q=hist.get("qualification",{})
 e42=next((e for e in events if e.get("milestone")=="EXP-0.4.2"),None)
 if not e42 or e42.get("qualified_head")!=q.get("qualified_head"): errors.append("EXP-0.4.2 qualified head provenance drift")
 summary=l.get("summary",{})
 expected_summary={
  "event_count":16,"exact_head_events":16,"events_with_run_ids":16,"events_with_job_ids":16,"events_with_artifact_ids":16,
  "events_with_complete_artifact_digests":15,"source_qualified_events":16,"integration_qualified_events":11,
  "runtime_qualified_events":0,"deployment_qualified_events":0,"live_network_qualified_events":0,"genesis_qualified_events":0,
  "current_genesis_blockers":10,"current_acceptance_criteria_unverified":10
 }
 for k,v in expected_summary.items():
  if summary.get(k)!=v: errors.append(f"summary drift: {k}")
 EVIDENCE.mkdir(exist_ok=True)
 out={"schema":"exp-0.4.3-evidence-v1","milestone":"EXP-0.4.3","events":len(events),"workflow_runs":sum(len(e.get("runs",[])) for e in events),"job_ids":sum(len(r.get("job_ids",[])) for e in events for r in e.get("runs",[])),"artifacts":sum(len(e.get("artifacts",[])) for e in events),"current_genesis_blockers":len(blockers),"current_acceptance_criteria_unverified":sum(1 for c in criteria if c.get("current_status")=="unverified"),"errors":errors,"pass":not errors}
 (EVIDENCE/"summary.json").write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
 with (EVIDENCE/"qualification-provenance.tsv").open("w",encoding="utf-8",newline="") as fh:
  w=csv.writer(fh,delimiter="\t"); w.writerow(["id","milestone","pr","base_sha","qualified_head","layers","runs","artifacts","applicability"])
  for e in events:w.writerow([e["id"],e["milestone"],e["pr"],e["base_sha"],e["qualified_head"],",".join(e["evidence_layers"]),",".join(str(r["run_id"]) for r in e["runs"]),",".join(str(a["id"]) for a in e["artifacts"]),e["applicability"]])
 print(json.dumps(out,indent=2))
 if errors: raise SystemExit(1)
if __name__=="__main__": main()
