#!/usr/bin/env python3
import csv,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
INV=ROOT/"docs/audit/EXP-0.4.2-historical-closeout-inventory.json"
GAPS=ROOT/"docs/audit/EXP-0.2.5-genesis-gap-register.json"
FREEZE=ROOT/"docs/audit/EXP-0.3.4-qualification-status-freeze.json"
ACS=ROOT/"docs/audit/EXP-0.2.6-genesis-acceptance-criteria.json"
EVIDENCE=ROOT/"exp-0-4-2-evidence"
ALLOWED={"current_and_applicable","historical_supporting_evidence","superseded","scope_changed","runtime_evidence_expired","cannot_reproduce","insufficient_provenance"}

def load(p): return json.loads(p.read_text(encoding="utf-8"))
def main():
 errors=[]
 if not INV.exists(): errors.append("missing historical inventory")
 if errors:
  print(json.dumps({"pass":False,"errors":errors},indent=2)); raise SystemExit(1)
 inv=load(INV); gaps=load(GAPS); freeze=load(FREEZE); acs=load(ACS)
 if inv.get("schema")!="420explorer-exp-0.4.2-historical-closeout-inventory-v1": errors.append("schema drift")
 if inv.get("milestone")!="EXP-0.4.2": errors.append("milestone drift")
 records=inv.get("records",[])
 if len(records)!=14: errors.append(f"record count drift: {len(records)}")
 ids=[r.get("id") for r in records]
 if any(not x for x in ids) or len(ids)!=len(set(ids)): errors.append("record IDs missing/duplicate")
 for r in records:
  rid=r.get("id","<missing>")
  if r.get("classification") not in ALLOWED: errors.append(f"{rid}: invalid classification")
  for field in ("kind","claim","sources","original_scope","current_scope","provenance","does_not_prove","superseded_by","applicable_to"):
   if field not in r: errors.append(f"{rid}: missing field {field}")
  for src in r.get("sources",[]):
   if src.startswith("PR #"): continue
   if not (ROOT/src).exists(): errors.append(f"{rid}: missing source {src}")
 # Required historical/narrow claim surfaces must be represented.
 joined="\n".join(" ".join(r.get("sources",[])) for r in records)
 for src in ["indexer/STATUS.md","testnet/public-services/indexer/readiness.json","docs/architecture/infrastructure/420indexer.md","explorer/api/server.go","explorer/cmd/explorer420/main.go","explorer/web/static/index.html","explorer/cmd/explorersmoke/main.go","explorer/cmd/explorerlivevalidate/main.go","testnet/public-services/explorer/readiness.json","docs/420EXPLORER.md"]:
  if src not in joined: errors.append(f"unreconciled historical claim surface: {src}")
 # Current source must retain the narrow labels and pending deployment truth.
 source_checks={
  "indexer/STATUS.md":["QUALIFIED_INDEXER_API_CONSUMER","Testnet deployment URL/service probes remain deployment-stage work"],
  "testnet/public-services/indexer/readiness.json":["QUALIFIED_INDEXER_API_CONSUMER","PENDING_TESTNET_DEPLOYMENT","REPLACE"],
  "explorer/api/server.go":["QUALIFIED_INDEXER_API_CONSUMER"],
  "explorer/cmd/explorer420/main.go":["EXP-6.2","QUALIFIED_INDEXER_API_CONSUMER"],
  "explorer/cmd/explorersmoke/main.go":["EXP-7.1","QUALIFIED"],
  "explorer/cmd/explorerlivevalidate/main.go":["EXP-7.2"],
  "testnet/public-services/explorer/readiness.json":["INDEXER_CONSUMER_IMPLEMENTED_PENDING_DEPLOYMENT","\"status\": \"PENDING\"","REPLACE"],
 }
 for p,needles in source_checks.items():
  txt=(ROOT/p).read_text(encoding="utf-8")
  for n in needles:
   if n not in txt: errors.append(f"{p}: expected historical/current marker missing: {n}")
 # Current authoritative status discipline.
 blockers=[f for f in gaps.get("findings",[]) if f.get("genesis_blocking")]
 if len(blockers)!=10: errors.append(f"expected 10 current Genesis blockers, got {len(blockers)}")
 entries=freeze.get("entries",[])
 if any(e.get("genesis_qualified") is not False for e in entries): errors.append("status freeze contains Genesis-qualified requirement")
 criteria=acs.get("criteria",[])
 if any(c.get("current_status")!="unverified" for c in criteria): errors.append("acceptance criterion promoted before later phases")
 # Summary must exactly match classifications and cannot accept broad/live claims.
 counts={k:sum(1 for r in records if r.get("classification")==k) for k in ALLOWED}
 s=inv.get("summary",{})
 if s.get("record_count")!=len(records): errors.append("summary record count drift")
 for k,v in counts.items():
  if s.get(k)!=v: errors.append(f"summary classification count drift: {k}")
 if s.get("broad_genesis_qualification_claims_accepted")!=0: errors.append("broad Genesis qualification claim accepted")
 if s.get("current_executed_live_explorer_closeouts")!=0: errors.append("live Explorer closeout invented")
 if s.get("remaining_genesis_blockers")!=len(blockers): errors.append("blocker summary drift")
 # Smoke/live mechanisms must not be classified as current executed closeouts.
 by={r["id"]:r for r in records}
 for rid in ("EXP-HIST-005","EXP-HIST-006"):
  if by[rid]["classification"]!="insufficient_provenance": errors.append(f"{rid}: test mechanism improperly promoted")
 if by["EXP-HIST-004"]["classification"]!="scope_changed": errors.append("user-facing broad qualified copy not scope-changed")
 EVIDENCE.mkdir(exist_ok=True)
 out={"schema":"exp-0.4.2-evidence-v1","milestone":"EXP-0.4.2","records":len(records),"classifications":counts,"current_genesis_blockers":len(blockers),"genesis_qualified_requirements":sum(1 for e in entries if e.get("genesis_qualified")),"acceptance_criteria_unverified":sum(1 for c in criteria if c.get("current_status")=="unverified"),"errors":errors,"pass":not errors}
 (EVIDENCE/"summary.json").write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
 with (EVIDENCE/"historical-closeouts.tsv").open("w",encoding="utf-8",newline="") as fh:
  w=csv.writer(fh,delimiter="\t"); w.writerow(["id","kind","classification","current_scope","claim"])
  for r in records: w.writerow([r["id"],r["kind"],r["classification"],r["current_scope"],r["claim"]])
 print(json.dumps(out,indent=2))
 if errors: raise SystemExit(1)
if __name__=="__main__": main()
