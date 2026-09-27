#!/usr/bin/env python3
import csv, json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
MATRIX=ROOT/"docs/audit/EXP-0.2.4-dependency-readiness-matrix.json"
IDX=ROOT/"testnet/public-services/indexer/readiness.json"
EXP=ROOT/"testnet/public-services/explorer/readiness.json"
ADDR=ROOT/"config/system-addresses.json"
EVIDENCE=ROOT/"exp-0-2-4-evidence"

EXPECTED=[
"420Indexer /v1 read service",
"Explorer backend service",
"Explorer frontend/public URL",
"canonical chain/RPC source for 420Indexer",
"ProtocolRegistry canonical contract",
"frozen Genesis system-address authority",
"Registry ABI/descriptor provenance for Indexer decoding",
"consensus/validator projection source",
"420 Names display enrichment",
"420 Identity public-label enrichment",
"verified-source metadata / 420 Verify integration",
]

VALID_SOURCE={"implemented_and_tested","implemented_source","source_present","not_observed","not_applicable"}
VALID_DEPLOY={"deployed","pending_deployment","unverified","not_applicable"}
VALID_LIVE={"qualified","unverified","not_applicable"}

def load(p): return json.loads(p.read_text(encoding="utf-8"))

def main():
    errors=[]
    matrix=load(MATRIX); idx=load(IDX); exp=load(EXP); addr=load(ADDR)
    deps=matrix.get("dependencies",[])
    names=[d.get("name") for d in deps]
    ids=[d.get("id") for d in deps]
    if matrix.get("schema")!="420explorer-exp-0.2.4-dependency-readiness-v1": errors.append("unexpected schema")
    if matrix.get("milestone")!="EXP-0.2.4": errors.append("unexpected milestone")
    if names!=EXPECTED: errors.append(f"dependency list/order mismatch: {names}")
    if len(ids)!=len(set(ids)): errors.append("duplicate dependency id")

    for d in deps:
        n=d.get("name","<unnamed>")
        if d.get("source_status") not in VALID_SOURCE: errors.append(f"{n}: invalid source_status")
        if d.get("deployment_status") not in VALID_DEPLOY: errors.append(f"{n}: invalid deployment_status")
        if d.get("live_qualification") not in VALID_LIVE: errors.append(f"{n}: invalid live_qualification")
        if not isinstance(d.get("required_for_genesis"),bool): errors.append(f"{n}: required_for_genesis must be bool")
        for f in ("evidence","readiness_basis","remaining_gates"):
            if not isinstance(d.get(f),list) or not d.get(f): errors.append(f"{n}: missing {f}")
        for rel in d.get("evidence",[]):
            if not (ROOT/rel).exists(): errors.append(f"{n}: evidence path missing: {rel}")

    by={d["name"]:d for d in deps}
    idxdep=by["420Indexer /v1 read service"]
    if idx["backend"].get("url")=="REPLACE":
        if idxdep["deployment_status"]!="pending_deployment" or idxdep["live_qualification"]!="unverified":
            errors.append("Indexer placeholder URL must remain pending/unverified")
    if idx["backend"].get("deployment_status")=="PENDING_TESTNET_DEPLOYMENT" and idxdep["deployment_status"]!="pending_deployment":
        errors.append("Indexer readiness fixture deployment state misrepresented")

    exb=by["Explorer backend service"]; exf=by["Explorer frontend/public URL"]
    if exp["backend"].get("url")=="REPLACE" and exb["deployment_status"]!="pending_deployment":
        errors.append("Explorer backend placeholder URL not reflected")
    if exp["frontend"].get("url")=="REPLACE" and exf["deployment_status"]!="pending_deployment":
        errors.append("Explorer frontend placeholder URL not reflected")

    assignments={x["name"]:x["address"] for x in addr.get("assignments",[])}
    if assignments.get("ProtocolRegistry")!="0x0000000000000000000000000000000000000434":
        errors.append("ProtocolRegistry frozen address changed")
    preg=by["ProtocolRegistry canonical contract"]
    if preg["deployment_status"]=="deployed" or preg["live_qualification"]=="qualified":
        errors.append("ProtocolRegistry cannot be promoted without live evidence")

    optional={"420 Names display enrichment","420 Identity public-label enrichment","verified-source metadata / 420 Verify integration"}
    for n in optional:
        if by[n]["required_for_genesis"] is not False:
            errors.append(f"{n}: optional dependency became Genesis blocker")

    for d in deps:
        if d["required_for_genesis"] and d["live_qualification"]=="qualified":
            errors.append(f"{d['name']}: EXP-0.2.4 must not invent live qualification")

    if "solely from source" not in matrix.get("no_promotion_rule","").lower():
        errors.append("no-promotion rule missing")

    EVIDENCE.mkdir(exist_ok=True)
    summary={
      "schema":"exp-0.2.4-evidence-v1",
      "milestone":"EXP-0.2.4",
      "dependencies":len(deps),
      "required":sum(d["required_for_genesis"] for d in deps),
      "optional":sum(not d["required_for_genesis"] for d in deps),
      "pending_deployment":sum(d["deployment_status"]=="pending_deployment" for d in deps),
      "deployment_unverified":sum(d["deployment_status"]=="unverified" for d in deps),
      "live_qualified":sum(d["live_qualification"]=="qualified" for d in deps),
      "errors":errors,
      "pass":not errors
    }
    (EVIDENCE/"summary.json").write_text(json.dumps(summary,indent=2)+"\n",encoding="utf-8")
    with (EVIDENCE/"dependencies.tsv").open("w",encoding="utf-8",newline="") as fh:
        w=csv.writer(fh,delimiter="\t")
        w.writerow(["id","name","required","class","source_status","deployment_status","live_qualification"])
        for d in deps:
            w.writerow([d["id"],d["name"],d["required_for_genesis"],d["dependency_class"],d["source_status"],d["deployment_status"],d["live_qualification"]])
    print(json.dumps(summary,indent=2))
    if errors: raise SystemExit(1)

if __name__=="__main__": main()
