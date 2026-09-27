#!/usr/bin/env python3
import json, subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
REC=ROOT/"docs/audit/EXP-1.7-cross-layer-traceability.json"
READY=ROOT/"testnet/public-services/indexer/readiness.json"
CFG=ROOT/"config/420indexer-v1.json"
BLOCKVIEWS=ROOT/"explorer/service/blockviews.go"
BLOCKTEST=ROOT/"explorer/service/blockviews_test.go"
API=ROOT/"explorer/api/server.go"
APITEST=ROOT/"explorer/api/server_test.go"
UI=ROOT/"explorer/web/static/app.js"
MODEL=ROOT/"indexer/model/model.go"
CONS_MODEL=ROOT/"indexer/model/consensus.go"
EVIDENCE=ROOT/"exp-1-7-evidence"

def git(*args):
    return subprocess.check_output(["git",*args],cwd=ROOT,text=True).strip()

def main():
    errors=[]
    required=[REC,READY,CFG,BLOCKVIEWS,BLOCKTEST,API,APITEST,UI,MODEL,CONS_MODEL]
    for p in required:
        if not p.exists():
            errors.append(f"missing {p.relative_to(ROOT)}")
    if errors:
        print(json.dumps({"pass":False,"errors":errors},indent=2))
        raise SystemExit(1)

    rec=json.loads(REC.read_text())
    ready=json.loads(READY.read_text())
    cfg=json.loads(CFG.read_text())
    blockviews=BLOCKVIEWS.read_text()
    blocktest=BLOCKTEST.read_text()
    api=API.read_text()
    apitest=APITEST.read_text()
    ui=UI.read_text()
    model=MODEL.read_text()
    cons_model=CONS_MODEL.read_text()

    if rec.get("schema")!="420explorer-exp-1.7-cross-layer-traceability-v1":
        errors.append("schema drift")
    if rec.get("milestone")!="EXP-1.7":
        errors.append("milestone drift")
    pred=rec.get("predecessor",{})
    if pred.get("exp_1_6_qualified_head")!="89b4deed40e7f8857813b92fc0c39f97db88c51b":
        errors.append("EXP-1.6 predecessor drift")
    if rec.get("summary",{}).get("next_step")!="EXP-1.8":
        errors.append("handoff drift")

    for token in ["Producer      *BlockProducer","type BlockProducer struct","ConsensusSlot","ProducerSeat","ProposerRank","ConsensusBlockRoot","Certified"]:
        if token not in model+"\n"+cons_model:
            errors.append(f"producer model token missing: {token}")

    for token in [
        "Producer      *model.BlockProducer",
        "type BlockTraceView struct",
        "ExecutionBlockHash",
        "ConsensusBlockRoot",
        "ConsensusSlot",
        "ProducerSeat",
        "ProposerRank",
        "CanonicalAuthority",
        "ExecutionAuthority",
        "ConsensusAuthority",
        "ProjectionAuthority",
        "func traceFromBlock",
        "func (s *Service) BlockTrace",
        "historical producer provenance",
        "consensus block root",
        "invalid proposer rank",
    ]:
        if token not in blockviews:
            errors.append(f"Explorer trace implementation token missing: {token}")

    if 'GET /v1/blocks/{number}/trace' not in api:
        errors.append("trace API route missing")
    if '"/v1/blocks/{number}/trace"' not in api:
        errors.append("trace capability advertisement missing")

    expected_tests=[
        "TestBlockDetailPreservesCrossLayerTrace",
        "TestBlockDetailFailsClosedWithoutHistoricalProducer",
        "TestBlockTraceRejectsMalformedProducerProvenance",
        "TestGenesisBlockDetailAllowsNoProducerTrace",
        "TestBlockTraceRoute",
        "TestBlockTraceRouteFailsClosedWithoutProducer",
        "TestBlockDetailRoute",
    ]
    tests=blocktest+"\n"+apitest
    for name in expected_tests:
        if name not in tests:
            errors.append(f"qualification test missing: {name}")

    ui_tokens=[
        "Consensus provenance",
        "Consensus slot",
        "Producer seat",
        "Proposer rank",
        "Consensus block root",
        "Execution authority",
        "Consensus authority",
        "Projection authority",
        "Canonical authority",
    ]
    for token in ui_tokens:
        if token not in ui:
            errors.append(f"UI trace token missing: {token}")

    trace=cfg.get("crossLayerTraceability",{})
    if trace.get("executionIdentity")!="chainId + execution block hash":
        errors.append("execution identity drift")
    if trace.get("consensusIdentity")!="consensus slot + consensus block root":
        errors.append("consensus identity drift")
    if trace.get("explorerTraceEndpoint")!="/v1/blocks/{number}/trace":
        errors.append("trace endpoint contract drift")
    if trace.get("requireProducerForNonGenesisExplorerBlockDetail") is not True:
        errors.append("non-genesis trace requirement disabled")
    if trace.get("canonicalAuthority") is not False:
        errors.append("trace authority overpromoted")

    if ready.get("status")!="EXP_1_7_CROSS_LAYER_TRACEABILITY_QUALIFICATION":
        errors.append("readiness milestone drift")
    backend=ready.get("backend",{})
    runtime=backend.get("runtime",{})
    if runtime.get("explorer_trace_endpoint")!="/v1/blocks/{number}/trace":
        errors.append("runtime trace endpoint drift")
    if runtime.get("explorer_trace_canonical_authority") is not False:
        errors.append("runtime trace authority overpromoted")
    if runtime.get("cross_layer_live_witness_qualified") is not False:
        errors.append("live cross-layer witness overpromoted")
    if backend.get("live_deployment",{}).get("qualified") is not False:
        errors.append("live deployment overpromoted")

    evidence=backend.get("qualification_evidence",{})
    for key in [
        "explorer_block_producer_trace_projection",
        "explorer_cross_layer_trace_api",
        "explorer_missing_trace_fail_closed",
        "explorer_trace_ui_rendering",
    ]:
        if not str(evidence.get(key,"")).startswith("IMPLEMENTED"):
            errors.append(f"qualification evidence missing: {key}")

    acc=rec.get("acceptance",{})
    for key in [
        "service_trace_projection_complete",
        "api_trace_route_complete",
        "block_detail_trace_complete",
        "ui_trace_rendering_complete",
        "malformed_or_missing_trace_fail_closed",
        "authority_separation_preserved",
    ]:
        if acc.get(key) is not True:
            errors.append(f"acceptance missing: {key}")
    if acc.get("live_cross_layer_witness_complete") is not False:
        errors.append("live cross-layer witness overpromoted")

    EVIDENCE.mkdir(exist_ok=True)
    out={
        "schema":"420explorer-exp-1.7-evidence-v1",
        "milestone":"EXP-1.7",
        "head_sha":git("rev-parse","HEAD"),
        "execution_identity":"chainId + execution block hash",
        "consensus_identity":"consensus slot + consensus block root",
        "trace_endpoint":"/v1/blocks/{number}/trace",
        "explorer_canonical_authority":False,
        "live_cross_layer_witness_qualified":False,
        "tests":expected_tests,
        "errors":errors,
        "pass":not errors,
    }
    (EVIDENCE/"summary.json").write_text(json.dumps(out,indent=2)+"\n")
    print(json.dumps(out,indent=2))
    if errors:
        raise SystemExit(1)

if __name__=="__main__":
    main()
