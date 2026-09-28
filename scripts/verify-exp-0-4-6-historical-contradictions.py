#!/usr/bin/env python3
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
M=ROOT/"docs/audit/EXP-0.4.6-historical-contradiction-reconciliation.json"
GOV35=ROOT/"docs/audit/EXP-0.3.5-nonblocking-scope-exclusions.json"
GOV38=ROOT/"docs/audit/EXP-0.3.8-governance-scope-decision.json"
IDX=ROOT/"testnet/public-services/indexer/readiness.json"
EXP=ROOT/"testnet/public-services/explorer/readiness.json"
SYS=ROOT/"config/system-addresses.json"
CSYS=ROOT/"contracts/config/system-addresses.json"
HIST=ROOT/"docs/audit/EXP-0.4.2-historical-closeout-inventory.json"
PROV=ROOT/"docs/audit/EXP-0.4.3-qualification-evidence-ledger.json"
AC=ROOT/"docs/audit/EXP-0.4.5-acceptance-criterion-evidence.json"
UI=ROOT/"explorer/web/static/index.html"
EVIDENCE=ROOT/"exp-0-4-6-evidence"
VOCAB={"superseded_by","historical_only","still_applicable","requires_requalification"}
def load(p): return json.loads(p.read_text(encoding="utf-8"))
def main():
 errors=[]
 for p in (M,GOV35,GOV38,IDX,EXP,SYS,CSYS,HIST,PROV,AC,UI):
  if not p.exists(): errors.append(f"missing {p.relative_to(ROOT)}")
 if errors:
  print(json.dumps({"pass":False,"errors":errors},indent=2)); raise SystemExit(1)
 m=load(M); gov35=load(GOV35); gov38=load(GOV38); idx=load(IDX); exp=load(EXP); sysa=load(SYS); csysa=load(CSYS); hist=load(HIST); prov=load(PROV); ac=load(AC)
 if m.get("schema")!="420explorer-exp-0.4.6-historical-contradiction-reconciliation-v1": errors.append("schema drift")
 if m.get("milestone")!="EXP-0.4.6": errors.append("milestone drift")
 recs=m.get("records",[])
 if len(recs)!=12: errors.append(f"record count drift: {len(recs)}")
 ids=[r.get("id") for r in recs]
 if len(ids)!=len(set(ids)): errors.append("duplicate record ID")
 if any(r.get("classification") not in VOCAB for r in recs): errors.append("invalid classification")
 by={r["id"]:r for r in recs}
 stale_rule="Governance remains outside this exclusion set and stays scope_decision_required/genesis-blocking until explicitly resolved."
 if stale_rule not in gov35.get("rules",[]): errors.append("expected retained pre-resolution governance statement not found")
 if gov38.get("decision")!="EXP-SCOPE-RESOLUTION-B" or gov38.get("outcome")!="not_required_as_dedicated_view": errors.append("current governance authority drift")
 if by.get("EXP-CONTRA-001",{}).get("classification")!="superseded_by": errors.append("stale governance claim not superseded")
 deployment_status=idx.get("backend",{}).get("deployment_status")
 if idx.get("backend",{}).get("url")!="REPLACE" or deployment_status not in {"PENDING_TESTNET_DEPLOYMENT","DEPLOYABLE_RUNTIME_QUALIFIED_LIVE_TESTNET_PENDING"}:
  errors.append("Indexer placeholder/deployment state drift")
 if deployment_status=="DEPLOYABLE_RUNTIME_QUALIFIED_LIVE_TESTNET_PENDING" and idx.get("backend",{}).get("live_deployment",{}).get("qualified") is not False:
  errors.append("Indexer live deployment overpromotion")
 if exp.get("backend",{}).get("url")!="REPLACE" or exp.get("frontend",{}).get("url")!="REPLACE": errors.append("Explorer placeholder state drift")
 if idx.get("consumer_gates",{}).get("420Explorer") not in {"QUALIFIED_INDEXER_API_CONSUMER","QUALIFIED_INDEXER_API_CONSUMER_EXACT_HEAD"}: errors.append("consumer gate drift")
 if "Qualified, read-only visibility" not in UI.read_text(encoding="utf-8"): errors.append("broad UI qualified copy no longer present; reconcile record")
 if sysa!=csysa: errors.append("frozen system-address maps differ")
 assigns={x["name"]:x["address"] for x in sysa.get("assignments",[])}
 if assigns.get("ProtocolRegistry")!="0x0000000000000000000000000000000000000434": errors.append("ProtocolRegistry address drift")
 if assigns.get("ConsensusSystemCall420")!="0x000000000000000000000000000000000000043c": errors.append("ConsensusSystemCall420 address drift")
 if hist.get("summary",{}).get("current_executed_live_explorer_closeouts")!=0: errors.append("historical ledger now has live closeout; contradiction ledger needs refresh")
 ps=prov.get("summary",{})
 for k in ("runtime_qualified_events","deployment_qualified_events","live_network_qualified_events","genesis_qualified_events"):
  if ps.get(k)!=0: errors.append(f"provenance promotion drift: {k}")
 if ac.get("summary",{}).get("unverified")!=10 or ac.get("summary",{}).get("current_genesis_blockers")!=10: errors.append("current AC/blocker state drift")
 s=m.get("summary",{})
 expected={"records":12,"superseded_by":1,"historical_only":3,"still_applicable":6,"requires_requalification":2,"stale_governance_claims_promoted":0,"placeholder_deployments_promoted":0,"historical_qualified_claims_promoted_to_genesis":0,"current_genesis_blockers":10,"current_unverified_acceptance_criteria":10}
 # classification counts overlap requires_requalification flag, not classification; recompute classification counts exactly.
 counts={v:sum(1 for r in recs if r.get("classification")==v) for v in VOCAB}
 expected["superseded_by"]=counts["superseded_by"]; expected["historical_only"]=counts["historical_only"]; expected["still_applicable"]=counts["still_applicable"]; expected["requires_requalification"]=counts["requires_requalification"]
 for k,v in expected.items():
  if s.get(k)!=v: errors.append(f"summary drift: {k}")
 for r in recs:
  for p in r.get("sources",[]):
   if not (ROOT/p).exists(): errors.append(f"{r['id']}: missing source {p}")
  for p in r.get("current_authority",[]):
   if "/" in p and not p.startswith("EXP-") and not (ROOT/p).exists(): errors.append(f"{r['id']}: missing authority {p}")
 EVIDENCE.mkdir(exist_ok=True)
 out={"schema":"exp-0.4.6-evidence-v1","milestone":"EXP-0.4.6","records":len(recs),"classifications":counts,"stale_governance_promoted":0,"placeholder_deployments_promoted":0,"genesis_blockers":10,"unverified_acceptance_criteria":10,"errors":errors,"pass":not errors}
 (EVIDENCE/"summary.json").write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
 (EVIDENCE/"contradictions.json").write_text(json.dumps({"records":[{"id":r["id"],"subject":r["subject"],"classification":r["classification"],"current_interpretation":r["current_interpretation"]} for r in recs]},indent=2)+"\n",encoding="utf-8")
 print(json.dumps(out,indent=2))
 if errors: raise SystemExit(1)
if __name__=="__main__": main()
