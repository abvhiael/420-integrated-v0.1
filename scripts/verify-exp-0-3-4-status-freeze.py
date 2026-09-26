#!/usr/bin/env python3
import csv,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
LEDGER=ROOT/"docs/audit/EXP-0.3.4-qualification-status-freeze.json"
REQS=ROOT/"docs/audit/EXP-0.3.1-authoritative-genesis-requirements.json"
PATHS=ROOT/"docs/audit/EXP-0.3.2-mandatory-capability-paths.json"
TESTS=ROOT/"docs/audit/EXP-0.3.3-mandatory-acceptance-tests.json"
DEPS=ROOT/"docs/audit/EXP-0.2.4-dependency-readiness-matrix.json"
ACS=ROOT/"docs/audit/EXP-0.2.6-genesis-acceptance-criteria.json"
IDX=ROOT/"testnet/public-services/indexer/readiness.json"
PROFILE=ROOT/"contracts/config/420explorer-genesis.json"
APPS=ROOT/"config/genesis-applications.json"
EVIDENCE=ROOT/"exp-0-3-4-evidence"
def load(p): return json.loads(p.read_text())
def main():
  errors=[]
  l=load(LEDGER); req=load(REQS); paths=load(PATHS); tests=load(TESTS); deps=load(DEPS); acs=load(ACS); idx=load(IDX); profile=load(PROFILE); apps=load(APPS)
  if l.get("schema")!="420explorer-exp-0.3.4-qualification-status-freeze-v1": errors.append("schema drift")
  if l.get("milestone")!="EXP-0.3.4": errors.append("milestone drift")
  entries=l.get("entries",[])
  if len(entries)!=65: errors.append(f"expected 65 entries, found {len(entries)}")
  by={e["requirement_id"]:e for e in entries}
  if len(by)!=len(entries): errors.append("duplicate requirement in freeze")
  req_by={r["id"]:r for r in req.get("requirements",[])}
  if set(by)!=set(req_by): errors.append("freeze/requirement ID set mismatch")
  for rid,r in req_by.items():
    e=by.get(rid,{})
    if e.get("frozen_status")!=r.get("current_status"): errors.append(f"{rid}: frozen status drift")
    if e.get("classification")!=r.get("classification"): errors.append(f"{rid}: classification drift")
    if e.get("genesis_qualified") is not False: errors.append(f"{rid}: unexpectedly Genesis-qualified")
    if not e.get("promotion_gate"): errors.append(f"{rid}: promotion gate missing")
    for rel in e.get("evidence_refs",[]):
      if not (ROOT/rel).exists(): errors.append(f"{rid}: missing evidence ref {rel}")
  expected={"source_qualified":47,"implemented_source":6,"partial_source":4,"deployment_pending":1,"runtime_unverified":2,"optional_unimplemented":2,"post_genesis":2,"scope_decision_required":1}
  counts={}
  for e in entries: counts[e["frozen_status"]]=counts.get(e["frozen_status"],0)+1
  if counts!=expected: errors.append(f"status counts drift: {counts}")
  if l.get("frozen_status_counts")!=expected: errors.append("ledger count summary drift")
  path_by={p["requirement_id"]:p for p in paths.get("paths",[])}
  test_by={t["requirement_id"]:t for t in tests.get("entries",[])}
  for rid,p in path_by.items():
    if by[rid]["frozen_status"]!=p.get("capability_status"): errors.append(f"{rid}: path status mismatch")
    if by[rid]["frozen_status"]!=test_by[rid].get("capability_status"): errors.append(f"{rid}: test status mismatch")
  if idx.get("backend",{}).get("url")=="REPLACE" and by["EXP-REQ-SRC-001"]["frozen_status"]!="deployment_pending":
    errors.append("Indexer placeholder no longer forces deployment_pending")
  for rid in ("EXP-REQ-SRC-003","EXP-REQ-SRC-004"):
    if by[rid]["frozen_status"]!="runtime_unverified": errors.append(f"{rid}: must remain runtime_unverified")
  for rid in ("EXP-REQ-SRC-005","EXP-REQ-SRC-006"):
    if by[rid]["frozen_status"]!="optional_unimplemented": errors.append(f"{rid}: optional status drift")
  for rid in ("EXP-REQ-POST-001","EXP-REQ-POST-002"):
    if by[rid]["frozen_status"]!="post_genesis": errors.append(f"{rid}: post-Genesis status drift")
  explorer=next(a for a in apps["apps"] if a["name"]=="420 Explorer")
  conflict="governance" in explorer.get("purpose","").lower() and "governance" not in [str(x).lower() for x in profile.get("requiredViews",[])]
  if conflict and by["EXP-REQ-SCOPE-001"]["frozen_status"]!="scope_decision_required": errors.append("governance conflict not frozen")
  if any(c.get("current_status")!="unverified" for c in acs.get("criteria",[])): errors.append("an acceptance criterion is no longer unverified")
  rules=" ".join(l.get("freeze_rules",[])).lower()
  for token in ("source_qualified","deployment_pending","runtime_unverified","genesis-qualified"):
    if token not in rules: errors.append(f"freeze rule token missing: {token}")
  EVIDENCE.mkdir(exist_ok=True)
  out={"schema":"exp-0.3.4-evidence-v1","milestone":"EXP-0.3.4","requirements":len(entries),"status_counts":counts,"genesis_qualified":sum(bool(e.get("genesis_qualified")) for e in entries),"acceptance_criteria_unverified":sum(c.get("current_status")=="unverified" for c in acs.get("criteria",[])),"errors":errors,"pass":not errors}
  (EVIDENCE/"summary.json").write_text(json.dumps(out,indent=2)+"\n")
  with (EVIDENCE/"status-freeze.tsv").open("w",newline="") as fh:
    w=csv.writer(fh,delimiter="\t"); w.writerow(["requirement_id","name","classification","frozen_status","owners","acceptance_criteria"])
    for e in entries: w.writerow([e["requirement_id"],e["name"],e["classification"],e["frozen_status"],",".join(e["later_qualification_owners"]),",".join(e["acceptance_criteria"])])
  print(json.dumps(out,indent=2))
  if errors: raise SystemExit(1)
if __name__=="__main__": main()
