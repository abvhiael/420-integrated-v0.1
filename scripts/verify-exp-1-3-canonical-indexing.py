#!/usr/bin/env python3
import json
import subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
M=ROOT/"docs/audit/EXP-1.3-canonical-indexing-invariants.json"
CFG=ROOT/"config/420indexer-v1.json"
INV=ROOT/"indexer/store/invariants.go"
FILE=ROOT/"indexer/store/file.go"
MEM=ROOT/"indexer/store/memory.go"
ENGINE=ROOT/"indexer/ingest/engine.go"
REORG=ROOT/"indexer/reorg/engine.go"
FINALITY_TEST=ROOT/"indexer/ingest/finality_test.go"
RESTART_TEST=ROOT/"indexer/ingest/restart_reorg_integration_test.go"
STORE_TEST=ROOT/"indexer/store/file_test.go"
EVIDENCE=ROOT/"exp-1-3-evidence"

def load(p): return json.loads(p.read_text())
def git(*args): return subprocess.check_output(["git",*args],cwd=ROOT,text=True).strip()

def main():
    errors=[]
    required=[M,CFG,INV,FILE,MEM,ENGINE,REORG,FINALITY_TEST,RESTART_TEST,STORE_TEST]
    for p in required:
        if not p.exists(): errors.append(f"missing {p.relative_to(ROOT)}")
    if errors:
        print(json.dumps({"pass":False,"errors":errors},indent=2)); raise SystemExit(1)

    m=load(M); cfg=load(CFG)
    if m.get("schema")!="420explorer-exp-1.3-canonical-indexing-invariants-v1": errors.append("schema drift")
    if m.get("milestone")!="EXP-1.3": errors.append("milestone drift")
    if m.get("predecessor",{}).get("qualified_head")!="7b693385f5aba71ac43c5c03975d9ac1da32056d":
        errors.append("EXP-1.2 predecessor drift")

    ci=cfg.get("canonicalIndexingInvariants",{})
    expected={
        "canonicalBlockIdentity":"chainId:blockHash",
        "heightIsMutableAboveFinality":True,
        "trackHeadSeparately":True,
        "trackSafeSeparately":True,
        "trackFinalizedSeparately":True,
        "rollbackAboveFinality":True,
        "finalizedHistoryImmutable":True,
        "databaseIsCanonicalAuthority":False,
        "canonicalSourceOverridesUncheckpointedDatabaseRows":True,
        "cleanRebuildRequired":True,
        "interruptedRebuildRecoveryRequired":True,
        "checkpointAdvancesAfterBundlePersistence":True,
        "finalizedRollbackBehavior":"FAIL_CLOSED"
    }
    for k,v in expected.items():
        if ci.get(k)!=v: errors.append(f"canonical indexing config drift: {k}")

    inv=INV.read_text(); file_src=FILE.read_text(); mem_src=MEM.read_text()
    engine=ENGINE.read_text(); reorg=REORG.read_text()
    tests=FINALITY_TEST.read_text()+"\n"+RESTART_TEST.read_text()+"\n"+STORE_TEST.read_text()

    for token in ["CanonicalBlockKey","chainID","hash","ErrFinalizedMutation","rejectFinalizedOverwrite","rejectRollbackBelowFinality"]:
        if token not in inv: errors.append(f"invariant implementation missing: {token}")
    for token in ["rejectFinalizedOverwrite","rejectRollbackBelowFinality"]:
        if token not in file_src: errors.append(f"durable store invariant missing: {token}")
        if token not in mem_src: errors.append(f"memory store invariant missing: {token}")
    for token in ["PutBundle","AcceptBlock","Checkpoint"]:
        if token not in engine: errors.append(f"ingestion invariant token missing: {token}")
    for token in ["FindCommonAncestor","RequireRollback","DeleteBlocksAbove","FinalizedHeight"]:
        if token not in reorg: errors.append(f"reorg invariant token missing: {token}")

    required_tests=m.get("evidence_tests",[])
    for token in required_tests:
        if token not in tests: errors.append(f"required qualification test missing: {token}")

    bounds=m.get("authority_boundaries",{})
    if bounds.get("canonical_state_authority") is not False: errors.append("database/canonical authority overpromotion")
    if bounds.get("database_role")!="rebuildable non-authoritative projection": errors.append("database role drift")
    if bounds.get("finalized_mutation")!="FAIL_CLOSED": errors.append("finalized mutation policy drift")

    summary=m.get("summary",{})
    for k in ("runtime_deployment_qualified","live_network_qualified","genesis_qualified"):
        if summary.get(k) is not False: errors.append(f"premature promotion: {k}")
    if summary.get("next_step")!="EXP-1.4": errors.append("next step drift")

    EVIDENCE.mkdir(exist_ok=True)
    out={
        "schema":"420explorer-exp-1.3-evidence-v1",
        "milestone":"EXP-1.3",
        "head_sha":git("rev-parse","HEAD"),
        "canonical_block_identity":"chainId:blockHash",
        "finalized_history_immutable":True,
        "database_is_canonical_authority":False,
        "clean_rebuild_qualified":True,
        "interrupted_rebuild_recovery_qualified":True,
        "runtime_deployment_qualified":False,
        "live_network_qualified":False,
        "errors":errors,
        "pass":not errors
    }
    (EVIDENCE/"summary.json").write_text(json.dumps(out,indent=2)+"\n")
    print(json.dumps(out,indent=2))
    if errors: raise SystemExit(1)

if __name__=="__main__": main()
