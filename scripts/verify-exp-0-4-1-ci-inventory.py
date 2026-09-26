#!/usr/bin/env python3
import csv, json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
INV=ROOT/"docs/audit/EXP-0.4.1-ci-qualification-inventory.json"
EVIDENCE=ROOT/"exp-0-4-1-evidence"

def load_json(p): return json.loads(p.read_text(encoding="utf-8"))

def require_text(text, needles, label, errors):
    for n in needles:
        if n not in text: errors.append(f"{label}: missing expected text: {n}")

def main():
    errors=[]
    if not INV.exists():
        print(json.dumps({"pass":False,"errors":["missing inventory"]},indent=2)); raise SystemExit(1)
    inv=load_json(INV)
    if inv.get("schema")!="420explorer-exp-0.4.1-ci-qualification-inventory-v1": errors.append("schema drift")
    if inv.get("milestone")!="EXP-0.4.1": errors.append("milestone drift")
    wfs=inv.get("workflows",[]); mechs=inv.get("mechanisms",[])
    if len(wfs)!=6: errors.append(f"workflow count drift: {len(wfs)}")
    if len(mechs)!=20: errors.append(f"mechanism count drift: {len(mechs)}")
    for key,rows in (("workflow",wfs),("mechanism",mechs)):
        ids=[x.get("id") for x in rows]
        if any(not x for x in ids) or len(ids)!=len(set(ids)): errors.append(f"{key} IDs missing/duplicate")
    by={x.get("id"):x for x in wfs}
    expected={
      "EXP-CI-001":".github/workflows/420indexer.yml",
      "EXP-CI-002":".github/workflows/explorer-live-testnet.yml",
      "EXP-CI-003":".github/workflows/qualification.yml",
      "EXP-CI-004":".github/workflows/docs-qualify.yml",
      "EXP-CI-005":".github/workflows/genesis-address-authority.yml",
      "EXP-CI-006":".github/workflows/testnet-rc.yml",
    }
    if set(by)!=set(expected): errors.append("workflow ID set drift")
    texts={}
    for wid,p in expected.items():
        fp=ROOT/p
        if not fp.exists(): errors.append(f"{wid}: missing workflow {p}"); continue
        texts[wid]=fp.read_text(encoding="utf-8")
        if by[wid].get("path")!=p: errors.append(f"{wid}: path drift")
        for field in ("role","authority","triggers","commands","evidence","qualification_scope","exclusions","finding_refs","acceptance_refs"):
            if field not in by[wid]: errors.append(f"{wid}: missing field {field}")
    if "EXP-CI-001" in texts:
        require_text(texts["EXP-CI-001"],[
          "name: 420Indexer","go test ./indexer/...","go vet ./indexer/...","working-directory: 420-indexer","npm test",
          "go test ./explorer/...","go vet ./explorer/...","verify-420indexer.py","verify-explorer-indexer-consumer.py",
          "verify-exp-0-1-2-indexer-dependencies.py","verify-exp-0-1-3-contract-dependencies.py",
          "verify-exp-0-2-1-capability-matrix.py","verify-exp-0-2-6-genesis-acceptance.py",
          "verify-exp-0-3-1-authoritative-requirements.py","verify-exp-0-3-8-scope-resolution.py",
          "exp-0-1-1-inventory.py --commit 95a83a961286701b6e8c064de1deccad10f41fd7"
        ],"EXP-CI-001",errors)
    if "EXP-CI-002" in texts:
        require_text(texts["EXP-CI-002"],[
          "name: 420Explorer Live Testnet Validation","workflow_dispatch:","go test ./explorer/cmd/explorerlivevalidate",
          "go run ./explorer/cmd/explorerlivevalidate | tee explorer-live-evidence.json","name: explorer-live-testnet-evidence"
        ],"EXP-CI-002",errors)
    if "EXP-CI-003" in texts:
        require_text(texts["EXP-CI-003"],[
          "name: 420 Integrated Qualification","go test ./...","bash ./scripts/install-production-deps.sh",
          "bash ./scripts/build-node420-upstream.sh","bash ./scripts/live-engine-smoke.sh",
          "python3 scripts/run-fault-matrix.py","python3 scripts/run-soak.py --slots 120 --slot-ms 35"
        ],"EXP-CI-003",errors)
    if "EXP-CI-004" in texts:
        require_text(texts["EXP-CI-004"],["name: 420Docs Qualification","python scripts/qualify-documentation.py"],"EXP-CI-004",errors)
    if "EXP-CI-005" in texts:
        require_text(texts["EXP-CI-005"],[
          "name: Genesis Address Authority","python scripts/verify-genesis-canonical-addresses.py",
          "python scripts/verify-genesis-predeploy-authority.py","bash scripts/qualify-foundry-shard.sh"
        ],"EXP-CI-005",errors)
    if "EXP-CI-006" in texts:
        require_text(texts["EXP-CI-006"],[
          "name: 420 Integrated Testnet RC","workflow_dispatch:","python3 scripts/run-real-devnet15.py --seconds 90 --consensus-transport devnet-tcp",
          "python3 scripts/run-soak.py --slots 420 --slot-ms 35","python3 scripts/build-testnet-rc.py","python3 scripts/check-release-evidence.py"
        ],"EXP-CI-006",errors)

    if by.get("EXP-CI-001",{}).get("authority")!="authoritative_for_repository_source_scope": errors.append("primary source authority drift")
    if by.get("EXP-CI-002",{}).get("authority")!="authoritative_for_executed_live_witness_scope": errors.append("live authority drift")
    for wid in ("EXP-CI-003","EXP-CI-004","EXP-CI-005","EXP-CI-006"):
        if by.get(wid,{}).get("authority")=="authoritative_for_executed_live_witness_scope": errors.append(f"{wid}: supporting workflow mislabeled live authority")
    summary=inv.get("summary",{})
    if summary.get("workflow_count")!=6 or summary.get("mechanism_count")!=20: errors.append("summary count drift")
    if summary.get("primary_source_gate")!="EXP-CI-001" or summary.get("live_gate")!="EXP-CI-002": errors.append("summary gate identity drift")

    EVIDENCE.mkdir(exist_ok=True)
    out={"schema":"exp-0.4.1-evidence-v1","milestone":"EXP-0.4.1","workflow_count":len(wfs),"mechanism_count":len(mechs),"errors":errors,"pass":not errors}
    (EVIDENCE/"summary.json").write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    with (EVIDENCE/"workflows.tsv").open("w",encoding="utf-8",newline="") as fh:
        w=csv.writer(fh,delimiter="\t"); w.writerow(["id","name","path","status","role","authority"])
        for x in wfs: w.writerow([x["id"],x["name"],x["path"],x["status"],x["role"],x["authority"]])
    print(json.dumps(out,indent=2))
    if errors: raise SystemExit(1)

if __name__=="__main__": main()
