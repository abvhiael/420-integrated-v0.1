#!/usr/bin/env python3
import json, subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
REC=ROOT/"docs/audit/EXP-1.6-historical-producer-attribution.json"
READY=ROOT/"testnet/public-services/indexer/readiness.json"
CFG=ROOT/"config/420indexer-v1.json"
CONS_STORE=ROOT/"consensus/storage/store.go"
PROVIDER=ROOT/"indexer/consensusview/provider.go"
MODEL=ROOT/"indexer/model/model.go"
CONS_MODEL=ROOT/"indexer/model/consensus.go"
INGEST=ROOT/"indexer/ingest/engine.go"
REORG=ROOT/"indexer/reorg/engine.go"
MAIN=ROOT/"indexer/cmd/indexer420/main.go"
PROVIDER_TEST=ROOT/"indexer/consensusview/provider_test.go"
INGEST_TEST=ROOT/"indexer/ingest/producer_attribution_test.go"
REORG_TEST=ROOT/"indexer/reorg/engine_test.go"
STORE_TEST=ROOT/"indexer/store/file_test.go"
EVIDENCE=ROOT/"exp-1-6-evidence"

def git(*args):
    return subprocess.check_output(["git",*args],cwd=ROOT,text=True).strip()

def main():
    errors=[]
    required=[REC,READY,CFG,CONS_STORE,PROVIDER,MODEL,CONS_MODEL,INGEST,REORG,MAIN,PROVIDER_TEST,INGEST_TEST,REORG_TEST,STORE_TEST]
    for p in required:
        if not p.exists(): errors.append(f"missing {p.relative_to(ROOT)}")
    if errors:
        print(json.dumps({"pass":False,"errors":errors},indent=2)); raise SystemExit(1)

    rec=json.loads(REC.read_text())
    ready=json.loads(READY.read_text())
    cfg=json.loads(CFG.read_text())
    cons_store=CONS_STORE.read_text()
    provider=PROVIDER.read_text()
    model=MODEL.read_text()
    cons_model=CONS_MODEL.read_text()
    ingest=INGEST.read_text()
    reorg=REORG.read_text()
    runtime=MAIN.read_text()
    tests="\n".join(p.read_text() for p in [PROVIDER_TEST,INGEST_TEST,REORG_TEST,STORE_TEST])

    if rec.get("schema")!="420explorer-exp-1.6-historical-producer-attribution-v1": errors.append("schema drift")
    if rec.get("milestone")!="EXP-1.6": errors.append("milestone drift")
    pred=rec.get("predecessor",{})
    if pred.get("qualified_head")!="5589fe360a606b05211c53cf5162d1c4cbbd76b2": errors.append("EXP-1.5 predecessor drift")
    if rec.get("summary",{}).get("next_step")!="EXP-1.7": errors.append("handoff drift")

    for token in ["type ProducedBlockStatus struct","ProducedBlocks   []ProducedBlockStatus","execution_block_hash","consensus_block_root","producer_seat","proposer_rank"]:
        if token not in cons_store: errors.append(f"consensus history token missing: {token}")

    for token in ["type BlockProducer struct","ConsensusSlot","ProducerSeat","ProposerRank","ConsensusBlockRoot","Certified"]:
        if token not in cons_model: errors.append(f"producer model token missing: {token}")
    if 'Producer      *BlockProducer' not in model: errors.append("BlockRecord producer projection missing")

    for token in ["ProducerForBlock","duplicate producer attribution","duplicate canonical produced-block slot","historical execution block hash missing","proposer rank","consensus block root missing"]:
        if token not in provider: errors.append(f"historical provider invariant missing: {token}")

    for token in ["WithProducerAttributor","attributeProducer(&bundle.Block)","historical producer attribution missing"]:
        if token not in ingest: errors.append(f"ingest attribution token missing: {token}")
    if "WithProducerAttributor(consensusProvider)" not in runtime: errors.append("production ingest does not wire producer provider")

    preflight_marker="Validate the complete replacement branch before mutating local state."
    rollback_marker="DeleteBlocksAbove(ancestor)"
    attribution_marker="e.attributeProducer(&bundle.Block)"
    if preflight_marker not in reorg: errors.append("reorg producer preflight marker missing")
    if attribution_marker not in reorg: errors.append("reorg producer attribution missing")
    if preflight_marker in reorg and rollback_marker in reorg and reorg.index(preflight_marker)>reorg.index(rollback_marker):
        errors.append("reorg rollback occurs before producer preflight")

    expected_tests=[
        "TestProducerForBlockReturnsHistoricalAttribution",
        "TestProducerForBlockRejectsDuplicateAttribution",
        "TestProducerForBlockRejectsInvalidRank",
        "TestCatchUpAttachesHistoricalProducerAttribution",
        "TestCatchUpFailsClosedWhenHistoricalProducerMissing",
        "TestRepairReplacesProducerAttributionWithCanonicalFork",
        "TestRepairFailsClosedWhenCanonicalForkProducerMissing",
        "TestFileStorePersistsBlockProducerAttributionAcrossRestart",
    ]
    for name in expected_tests:
        if name not in tests: errors.append(f"qualification test missing: {name}")

    hp=cfg.get("historicalProducerAttribution",{})
    if hp.get("authority")!="consensus-owned produced-block history; Indexer projection only": errors.append("producer authority drift")
    if hp.get("lookupKey")!="execution block hash": errors.append("producer join-key drift")
    if hp.get("requireForNonGenesisBlocksWhenProviderConfigured") is not True: errors.append("producer requirement disabled")
    if hp.get("reorgPolicy","").startswith("preflight complete replacement branch") is not True: errors.append("reorg producer policy drift")

    if ready.get("status") not in {"EXP_1_6_HISTORICAL_PRODUCER_ATTRIBUTION_QUALIFICATION","EXP_1_7_CROSS_LAYER_TRACEABILITY_QUALIFICATION"}: errors.append("readiness milestone drift")
    br=ready.get("backend",{})
    rr=br.get("runtime",{})
    if rr.get("historical_producer_source")!="consensus/storage.Status.produced_blocks": errors.append("runtime historical source drift")
    if rr.get("historical_producer_required_in_production") is not True: errors.append("production producer requirement drift")
    if rr.get("historical_producer_live_binding_qualified") is not False: errors.append("live producer history overpromoted")
    if br.get("live_deployment",{}).get("qualified") is not False: errors.append("live deployment overpromoted")

    acc=rec.get("acceptance",{})
    for key in ["consensus_owned_historical_source_implemented","canonical_block_projection_implemented","production_ingest_wiring_implemented","missing_history_fail_closed","reorg_preflight_and_replacement_implemented","durable_restart_provenance_implemented"]:
        if acc.get(key) is not True: errors.append(f"acceptance missing: {key}")
    if acc.get("live_history_binding_complete") is not False: errors.append("live history binding overpromoted")

    EVIDENCE.mkdir(exist_ok=True)
    out={
        "schema":"420explorer-exp-1.6-evidence-v1",
        "milestone":"EXP-1.6",
        "head_sha":git("rev-parse","HEAD"),
        "historical_source":"consensus/storage.Status.produced_blocks",
        "join_key":"execution block hash",
        "producer_projection_authoritative":False,
        "reorg_preflight_before_mutation":True,
        "live_history_binding_qualified":False,
        "tests":expected_tests,
        "errors":errors,
        "pass":not errors,
    }
    (EVIDENCE/"summary.json").write_text(json.dumps(out,indent=2)+"\n")
    print(json.dumps(out,indent=2))
    if errors: raise SystemExit(1)

if __name__=="__main__":
    main()
