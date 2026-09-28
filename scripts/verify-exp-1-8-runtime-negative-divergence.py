#!/usr/bin/env python3
import json, subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
REC=ROOT/"docs/audit/EXP-1.8-runtime-negative-divergence.json"
READY=ROOT/"testnet/public-services/indexer/readiness.json"
CFG=ROOT/"config/420indexer-v1.json"
MODEL=ROOT/"indexer/model/model.go"
BACKEND=ROOT/"indexer/api/backend.go"
BACKEND_TEST=ROOT/"indexer/api/backend_test.go"
INDEXER_API_TEST=ROOT/"indexer/api/server_test.go"
MAIN=ROOT/"indexer/cmd/indexer420/main.go"
MAIN_TEST=ROOT/"indexer/cmd/indexer420/main_test.go"
RPC_SOURCE=ROOT/"indexer/rpc/source.go"
RPC_TEST=ROOT/"indexer/rpc/source_test.go"
QUAL_SOURCE=ROOT/"indexer/rpc/qualification_source.go"
QUAL_TEST=ROOT/"indexer/rpc/qualification_source_test.go"
CONS_TEST=ROOT/"indexer/consensusview/provider_test.go"
INGEST_TEST=ROOT/"indexer/ingest/producer_attribution_test.go"
REORG_TEST=ROOT/"indexer/reorg/engine_test.go"
EXP_SERVICE_TEST=ROOT/"explorer/service/service_test.go"
EXP_BLOCK_TEST=ROOT/"explorer/service/blockviews_test.go"
EXP_API_TEST=ROOT/"explorer/api/server_test.go"
COMPOSE=ROOT/"deployments/indexer/docker-compose.yml"
ENV=ROOT/"deployments/indexer/indexer.env.example"
DOCKER=ROOT/"docker/Dockerfile.420indexer"
EVIDENCE=ROOT/"exp-1-8-evidence"

def git(*args):
    return subprocess.check_output(["git",*args],cwd=ROOT,text=True).strip()

def main():
    errors=[]
    required=[REC,READY,CFG,MODEL,BACKEND,BACKEND_TEST,INDEXER_API_TEST,MAIN,MAIN_TEST,RPC_SOURCE,RPC_TEST,QUAL_SOURCE,QUAL_TEST,CONS_TEST,INGEST_TEST,REORG_TEST,EXP_SERVICE_TEST,EXP_BLOCK_TEST,EXP_API_TEST,COMPOSE,ENV,DOCKER]
    for p in required:
        if not p.exists(): errors.append(f"missing {p.relative_to(ROOT)}")
    if errors:
        print(json.dumps({"pass":False,"errors":errors},indent=2)); raise SystemExit(1)

    rec=json.loads(REC.read_text())
    ready=json.loads(READY.read_text())
    cfg=json.loads(CFG.read_text())
    model=MODEL.read_text()
    backend=BACKEND.read_text()
    main_src=MAIN.read_text()
    qual_source=QUAL_SOURCE.read_text()
    compose=COMPOSE.read_text()
    env=ENV.read_text()
    docker=DOCKER.read_text()
    tests="\n".join(p.read_text() for p in [BACKEND_TEST,INDEXER_API_TEST,MAIN_TEST,RPC_TEST,QUAL_TEST,CONS_TEST,INGEST_TEST,REORG_TEST,EXP_SERVICE_TEST,EXP_BLOCK_TEST,EXP_API_TEST])

    if rec.get("schema")!="420explorer-exp-1.8-runtime-negative-divergence-v1": errors.append("schema drift")
    if rec.get("milestone")!="EXP-1.8": errors.append("milestone drift")
    if rec.get("predecessor",{}).get("exp_1_7_qualified_head")!="ab74f3fd85941b17399e819893f72e2fcba93e59": errors.append("EXP-1.7 predecessor drift")
    if rec.get("summary",{}).get("next_step")!="EXP-1.9": errors.append("handoff drift")

    for token in ["RuntimeIssue","RuntimeIssueAt"]:
        if token not in model: errors.append(f"health runtime evidence missing: {token}")
    for token in ["type RuntimeHealth struct","MarkHealthy","MarkFailure(issue string)","WithRuntimeHealth",'State="DEGRADED"']:
        if token not in backend: errors.append(f"runtime health latch missing: {token}")

    for token in [
        "INDEXER_MAX_HEAD_AGE",
        "INDEXER_EXPECTED_GENESIS_HASH",
        "NewQualificationSource",
        "indexerrpc.Validate",
        "runtimeRPCIssue",
        'runtimeHealth.MarkFailure("CONSENSUS_PROVIDER_UNAVAILABLE")',
        'runtimeHealth.MarkFailure("INGEST_CATCHUP_FAILED")',
        "runtimeHealth.MarkHealthy()",
    ]:
        if token not in main_src: errors.append(f"runtime continuous qualification token missing: {token}")
    if main_src.count("indexerrpc.Validate(") < 2:
        errors.append("runtime RPC qualification is not enforced at startup and poll")

    for token in ["type QualificationSource struct","BlockByNumber","Head()","Safe()","Finalized()"]:
        if token not in qual_source: errors.append(f"production qualification adapter missing: {token}")

    expected_fault_codes=[
        "RPC_WRONG_CHAIN","RPC_GENESIS_MISMATCH","RPC_FINALITY_DIVERGENCE",
        "RPC_SOURCE_STALE","RPC_SOURCE_INVALID","CONSENSUS_PROVIDER_UNAVAILABLE","INGEST_CATCHUP_FAILED"
    ]
    for code in expected_fault_codes:
        if code not in main_src and code not in rec.get("runtime_fault_codes",[]):
            errors.append(f"runtime fault code missing: {code}")

    expected_tests=rec.get("tests",[])
    for name in expected_tests:
        if name not in tests: errors.append(f"qualification test missing: {name}")

    nq=cfg.get("runtimeNegativeQualification",{})
    if nq.get("continuousRpcSourceValidation") is not True: errors.append("continuous RPC source validation disabled")
    if nq.get("startupFailClosed") is not True: errors.append("startup fail-closed disabled")
    if nq.get("requiredChainId")!=420: errors.append("runtime negative chain id drift")
    if nq.get("defaultMaxHeadAge")!="2m": errors.append("max head age default drift")
    if nq.get("publicFaultDetailPolicy")!="categorical only; raw upstream errors remain server-side": errors.append("public fault-detail policy drift")

    if ready.get("status") not in {"EXP_1_8_RUNTIME_NEGATIVE_DIVERGENCE_QUALIFICATION","EXP_1_9_CI_QUALIFICATION_AUTOMATION","EXP_1_10_PHASE_CLOSEOUT_QUALIFICATION"}: errors.append("readiness milestone drift")
    backend_ready=ready.get("backend",{})
    runtime=backend_ready.get("runtime",{})
    if runtime.get("continuous_rpc_source_validation") is not True: errors.append("runtime readiness missing continuous source validation")
    if runtime.get("runtime_health_fault_latch") is not True: errors.append("runtime health fault latch readiness missing")
    if runtime.get("runtime_fault_detail_public")!="categorical only": errors.append("runtime public fault detail drift")
    if runtime.get("live_fault_injection_qualified") is not False: errors.append("live fault injection overpromoted")
    if backend_ready.get("live_deployment",{}).get("qualified") is not False: errors.append("live deployment overpromoted")

    evidence=backend_ready.get("qualification_evidence",{})
    required_evidence=[
        "continuous_rpc_source_validation","runtime_poll_fault_health_latch","runtime_poll_recovery_clear",
        "runtime_fault_codes_secret_safe","explorer_wrong_chain_fail_closed","explorer_stale_fail_closed",
        "explorer_degraded_fail_closed","explorer_inconsistent_finality_fail_closed",
        "consensus_provider_unavailable_fail_closed_runtime","reorg_finalized_conflict_no_mutation",
        "reorg_missing_producer_no_mutation"
    ]
    for key in required_evidence:
        if not str(evidence.get(key,"")).startswith("IMPLEMENTED"): errors.append(f"qualification evidence missing: {key}")

    for token in ["INDEXER_MAX_HEAD_AGE","INDEXER_EXPECTED_GENESIS_HASH"]:
        if token not in env or token not in compose: errors.append(f"deployment runtime qualification control missing: {token}")
    if "INDEXER_MAX_HEAD_AGE=2m" not in docker: errors.append("container max-head-age default missing")

    acc=rec.get("acceptance",{})
    for key in [
        "continuous_runtime_source_validation_complete","runtime_degradation_observable",
        "recovery_clear_semantics_complete","categorical_secret_safe_faults_complete",
        "wrong_chain_stale_finality_negative_matrix_complete","consensus_negative_matrix_complete",
        "reorg_no_mutation_negative_matrix_complete","explorer_fail_closed_negative_matrix_complete"
    ]:
        if acc.get(key) is not True: errors.append(f"acceptance missing: {key}")
    if acc.get("live_fault_injection_complete") is not False: errors.append("live fault injection overpromoted")

    EVIDENCE.mkdir(exist_ok=True)
    out={
        "schema":"420explorer-exp-1.8-evidence-v1",
        "milestone":"EXP-1.8",
        "head_sha":git("rev-parse","HEAD"),
        "continuous_rpc_source_validation":True,
        "runtime_health_fault_latch":True,
        "public_runtime_faults_categorical_only":True,
        "negative_case_count":len(expected_tests),
        "live_fault_injection_qualified":False,
        "tests":expected_tests,
        "errors":errors,
        "pass":not errors,
    }
    (EVIDENCE/"summary.json").write_text(json.dumps(out,indent=2)+"\n")
    print(json.dumps(out,indent=2))
    if errors: raise SystemExit(1)

if __name__=="__main__":
    main()
