#!/usr/bin/env python3
import json, pathlib, subprocess, sys

ROOT=pathlib.Path(__file__).resolve().parents[1]
errors=[]

def require(path,token,label):
    text=(ROOT/path).read_text(encoding="utf-8")
    if token not in text:
        errors.append(f"{label}: missing {token!r} in {path}")

def main():
    audit=json.loads((ROOT/"docs/audit/EXP-2.4-consensus-producer.json").read_text(encoding="utf-8"))
    if audit.get("milestone")!="EXP-2.4":
        errors.append("audit milestone mismatch")
    if audit.get("baseline",{}).get("exp_2_3_qualified_head")!="5898aa8666ec4ed78cd1e97a3eb4e978318f7ac5":
        errors.append("EXP-2.3 baseline mismatch")

    checks=[
      ("explorer/service/consensusviews.go","inconsistent current/next slot","slot continuity"),
      ("explorer/service/consensusviews.go","inconsistent epoch position","epoch arithmetic"),
      ("explorer/service/consensusviews.go","inconsistent rotation position","rotation arithmetic"),
      ("explorer/service/consensusviews.go","inconsistent consensus rotation dimensions","rotation dimensions"),
      ("explorer/service/consensusviews.go","consensus checkpoint without root","checkpoint provenance"),
      ("explorer/service/consensusviews.go","certified QC without block provenance","QC provenance"),
      ("explorer/service/consensusviews.go","QC beyond consensus head","QC head bound"),
      ("explorer/service/consensusviews.go","fewer than three active validators","committee minimum"),
      ("explorer/service/exp_2_4_consensus_test.go","TestEXP24ConsensusRejectsSlotAndDimensionDrift","consensus negative vectors"),
      ("explorer/service/exp_2_4_consensus_test.go","TestEXP24HistoricalProducerTracePreservesAuthorityBoundary","producer trace vector"),
      ("explorer/api/exp_2_4_consensus_test.go","TestEXP24ConsensusRouteSerializesQualifiedView","HTTP consensus vector"),
      ("explorer/indexerclient/exp_2_4_consensus_test.go","TestEXP24ConsensusClientRejectsAuthorityClaim","client authority vector"),
    ]
    for p,t,l in checks: require(p,t,l)

    scope=audit.get("scope_boundary",{})
    for key in ["deployed_ui_qualified","live_target_network_qualified","live_consensus_source_qualified","live_producer_witness_qualified","canonical_authority","genesis_ready_claim"]:
        if scope.get(key) is not False:
            errors.append(f"scope boundary must keep {key}=false")

    head=subprocess.check_output(["git","rev-parse","HEAD"],cwd=ROOT,text=True).strip()
    out=ROOT/"exp-2-4-evidence"; out.mkdir(exist_ok=True)
    summary={
      "schema":"420explorer-exp-2.4-evidence-v1",
      "milestone":"EXP-2.4",
      "head":head,
      "status":"qualified_repository_scope" if not errors else "failed",
      "errors":errors,
      "scope_boundary":scope,
    }
    (out/"summary.json").write_text(json.dumps(summary,indent=2)+"\n",encoding="utf-8")
    if errors:
        for e in errors: print("ERROR:",e,file=sys.stderr)
        return 1
    print(json.dumps(summary,indent=2))
    return 0

if __name__=="__main__":
    raise SystemExit(main())
