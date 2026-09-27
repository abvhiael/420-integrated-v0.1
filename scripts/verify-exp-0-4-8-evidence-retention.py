#!/usr/bin/env python3
import json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
M=ROOT/"docs/audit/EXP-0.4.8-evidence-retention-reproducibility.json"
PROV=ROOT/"docs/audit/EXP-0.4.3-qualification-evidence-ledger.json"
CANON=ROOT/"docs/audit/EXP-0.4.7-canonical-qualification-ledger.json"
CI=ROOT/"docs/audit/EXP-0.4.1-ci-qualification-inventory.json"
EVIDENCE=ROOT/"exp-0-4-8-evidence"
SHA=re.compile(r"^[0-9a-f]{40}$")
DIG=re.compile(r"^sha256:[0-9a-f]{64}$")
def load(p): return json.loads(p.read_text(encoding="utf-8"))
def main():
 errors=[]
 for p in (M,PROV,CANON,CI):
  if not p.exists(): errors.append(f"missing {p.relative_to(ROOT)}")
 if errors:
  print(json.dumps({"pass":False,"errors":errors},indent=2)); raise SystemExit(1)
 m,prov,canon,ci=map(load,(M,PROV,CANON,CI))
 if m.get("schema")!="420explorer-exp-0.4.8-evidence-retention-reproducibility-v1": errors.append("schema drift")
 if m.get("milestone")!="EXP-0.4.8": errors.append("milestone drift")
 if m.get("baseline",{}).get("exp_0_4_7_final_qualified_head")!="c3b2d13d74ffed8be15edcecd144bc88959e5ab1": errors.append("0.4.7 baseline drift")
 for p in m.get("repository_retained_records",[]):
  if not (ROOT/p).exists(): errors.append(f"missing retained record {p}")
 roll=m.get("historical_provenance_rollup",{})
 expected_keys=("event_count","exact_head_events","events_with_run_ids","events_with_job_ids","events_with_artifact_ids","events_with_complete_artifact_digests")
 for k in expected_keys:
  if roll.get(k)!=prov.get("summary",{}).get(k): errors.append(f"provenance rollup drift: {k}")
 missing=[]
 for e in prov.get("events",[]):
  if not SHA.match(e.get("qualified_head","")): errors.append(f"{e.get('id')}: invalid exact head")
  if not e.get("runs"): errors.append(f"{e.get('id')}: no retained runs")
  if any(r.get("conclusion")!="success" for r in e.get("runs",[])): errors.append(f"{e.get('id')}: non-success retained run")
  for a in e.get("artifacts",[]):
   if a.get("digest") is None: missing.append((e.get("id"),a.get("id")))
   elif not DIG.match(a.get("digest","")): errors.append(f"{e.get('id')}: invalid digest")
 recorded={(x.get("id"),aid) for x in roll.get("known_missing_digest_events",[]) for aid in x.get("artifact_ids",[])}
 if set(missing)!=recorded: errors.append("missing-digest accounting drift")
 for x in roll.get("known_missing_digest_events",[]):
  if x.get("disposition")!="historical_digest_unavailable_not_invented": errors.append(f"{x.get('id')}: missing digest disposition drift")
 close=m.get("final_closeouts",[])
 if [x.get("milestone") for x in close] != [f"EXP-0.4.{i}" for i in range(3,8)]: errors.append("final closeout sequence drift")
 for x in close:
  if not SHA.match(x.get("head","")): errors.append(f"{x.get('milestone')}: invalid final head")
  if len(x.get("runs",[]))!=3: errors.append(f"{x.get('milestone')}: expected three retained workflows")
  names={r.get("workflow") for r in x.get("runs",[])}
  if names!={"420Indexer","420Docs Qualification","420 Integrated Qualification"}: errors.append(f"{x.get('milestone')}: workflow set drift")
  if any(r.get("conclusion")!="success" or not isinstance(r.get("run_id"),int) for r in x.get("runs",[])): errors.append(f"{x.get('milestone')}: invalid run provenance")
  a=x.get("artifact",{})
  if not isinstance(a.get("id"),int) or not a.get("name") or not DIG.match(a.get("digest","")): errors.append(f"{x.get('milestone')}: artifact provenance incomplete")
 profiles=m.get("replay_profiles",[])
 if [x.get("id") for x in profiles]!=["EXP-REPLAY-001","EXP-REPLAY-002","EXP-REPLAY-003","EXP-REPLAY-004"]: errors.append("replay profile set drift")
 for x in profiles:
  p=x.get("workflow")
  if not p or not (ROOT/p).exists(): errors.append(f"{x.get('id')}: missing workflow {p}")
  if x.get("exact_head_required") is not True: errors.append(f"{x.get('id')}: exact-head requirement missing")
  if not x.get("commands") or not x.get("qualification_scope"): errors.append(f"{x.get('id')}: incomplete replay recipe")
 checks=m.get("reproducibility_checks",{})
 for k in ("repository_records_exist","workflow_definitions_exist","verifier_chain_retained","historical_exact_heads_retained","final_closeout_digests_retained"):
  if checks.get(k) is not True: errors.append(f"reproducibility check failed: {k}")
 if checks.get("external_artifact_permanence_required") is not False: errors.append("artifact permanence incorrectly required")
 if checks.get("missing_historical_digest_fabricated") is not False: errors.append("historical digest fabrication")
 if checks.get("live_environment_reproducibility_requires_new_execution") is not True: errors.append("live replay boundary drift")
 state=canon.get("current_state",{})
 if state.get("genesis_ready") is not False or state.get("active_genesis_blockers")!=10 or state.get("unverified_acceptance_criteria")!=10: errors.append("canonical qualification state drift")
 s=m.get("summary",{})
 expected={"provenance_events":prov["summary"]["event_count"],"final_closeouts_recorded":5,"final_closeouts_with_digests":5,"known_historical_missing_artifact_digests":1,"replay_profiles":4,"repository_retained_records":7,"unreconciled_retention_gaps":0,"fabricated_evidence":0,"runtime_or_live_claims_created":0,"genesis_ready":False}
 for k,v in expected.items():
  if s.get(k)!=v: errors.append(f"summary drift: {k}")
 EVIDENCE.mkdir(exist_ok=True)
 out={"schema":"exp-0.4.8-evidence-v1","milestone":"EXP-0.4.8","historical_events":prov["summary"]["event_count"],"missing_historical_digests":len(missing),"final_closeouts":len(close),"replay_profiles":len(profiles),"external_artifact_permanence_required":False,"fabricated_evidence":0,"errors":errors,"pass":not errors}
 (EVIDENCE/"summary.json").write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
 (EVIDENCE/"replay-manifest.json").write_text(json.dumps({"baseline":m.get("baseline"),"final_closeouts":close,"replay_profiles":profiles,"known_missing_digest_events":roll.get("known_missing_digest_events",[])},indent=2)+"\n",encoding="utf-8")
 print(json.dumps(out,indent=2))
 if errors: raise SystemExit(1)
if __name__=="__main__": main()
