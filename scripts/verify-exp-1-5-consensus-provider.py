#!/usr/bin/env python3
import json, subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
REC=ROOT/"docs/audit/EXP-1.5-consensus-provider.json"
READY=ROOT/"testnet/public-services/indexer/readiness.json"
CFG=ROOT/"config/420indexer-v1.json"
MAIN=ROOT/"indexer/cmd/indexer420/main.go"
MAIN_TEST=ROOT/"indexer/cmd/indexer420/main_test.go"
PROVIDER=ROOT/"indexer/consensusview/provider.go"
PROVIDER_TEST=ROOT/"indexer/consensusview/provider_test.go"
DOCKER=ROOT/"docker/Dockerfile.420indexer"
COMPOSE=ROOT/"deployments/indexer/docker-compose.yml"
ENV=ROOT/"deployments/indexer/indexer.env.example"
EVIDENCE=ROOT/"exp-1-5-evidence"

def git(*args):
    return subprocess.check_output(["git",*args],cwd=ROOT,text=True).strip()

def main():
    errors=[]
    for p in [REC,READY,CFG,MAIN,MAIN_TEST,PROVIDER,PROVIDER_TEST,DOCKER,COMPOSE,ENV]:
        if not p.exists(): errors.append(f"missing {p.relative_to(ROOT)}")
    if errors:
        print(json.dumps({"pass":False,"errors":errors},indent=2)); raise SystemExit(1)

    rec=json.loads(REC.read_text())
    ready=json.loads(READY.read_text())
    cfg=json.loads(CFG.read_text())
    main_src=MAIN.read_text()
    main_test=MAIN_TEST.read_text()
    provider=PROVIDER.read_text()
    provider_test=PROVIDER_TEST.read_text()
    docker=DOCKER.read_text()
    compose=COMPOSE.read_text()
    env=ENV.read_text()

    if rec.get("schema")!="420explorer-exp-1.5-consensus-provider-v1": errors.append("schema drift")
    if rec.get("milestone")!="EXP-1.5": errors.append("milestone drift")
    if rec.get("summary",{}).get("next_step")!="EXP-1.6": errors.append("handoff drift")

    for token in ["INDEXER_CONSENSUS_STATUS_PATH","newConsensusProvider","consensusview.New","provider.Consensus()","WithConsensusProvider(consensusProvider)"]:
        if token not in main_src: errors.append(f"runtime wiring token missing: {token}")

    provider_tokens=[
        "finalized <= safe <= head violated",
        "duplicate active seat",
        "fewer than three active seats",
        "proposer seat outside active committee",
        "proposer/fallback collision",
        "latest QC signer count",
        "quorum := (2*len(st.ActiveSeats))/3 + 1",
    ]
    for token in provider_tokens:
        if token not in provider: errors.append(f"provider invariant missing: {token}")

    expected_tests=[
        "TestConsensusProjection",
        "TestConsensusProjectionRejectsBadQC",
        "TestConsensusProjectionRejectsImpossibleFinality",
        "TestConsensusProjectionRejectsProposerOutsideCommittee",
        "TestConsensusProjectionUnavailableWhenStateMissing",
        "TestNewConsensusProviderRejectsMissingPath",
        "TestNewConsensusProviderRejectsUnavailableState",
        "TestNewConsensusProviderAcceptsQualifiedState",
    ]
    combined=main_test+"\n"+provider_test
    for name in expected_tests:
        if name not in combined: errors.append(f"qualification test missing: {name}")

    cq=cfg.get("consensusQualification",{})
    if cq.get("authority")!="consensus-owned; Indexer projection only": errors.append("consensus authority drift")
    if cq.get("requiredChainId")!=420: errors.append("consensus chain id drift")
    if cq.get("requireStatusAtStartup") is not True: errors.append("startup qualification disabled")
    if cq.get("providerUnavailableBehavior")!="FAIL_CLOSED_AT_STARTUP_AND_503_AT_READ_BOUNDARY": errors.append("provider unavailable behavior drift")

    if ready.get("status") not in {"EXP_1_5_CONSENSUS_PROVIDER_QUALIFICATION","EXP_1_6_HISTORICAL_PRODUCER_ATTRIBUTION_QUALIFICATION"}: errors.append("readiness milestone drift")
    runtime=ready.get("backend",{}).get("runtime",{})
    if runtime.get("consensus_provider")!="indexer/consensusview.Provider": errors.append("runtime provider drift")
    if runtime.get("consensus_startup_qualification") is not True: errors.append("runtime startup qualification drift")
    if runtime.get("consensus_live_binding_qualified") is not False: errors.append("live consensus binding overpromoted")
    if ready.get("backend",{}).get("live_deployment",{}).get("qualified") is not False: errors.append("live deployment overpromoted")

    for token in ["INDEXER_CONSENSUS_STATUS_PATH", "/var/lib/420consensus/status.json"]:
        if token not in docker: errors.append(f"container consensus token missing: {token}")
    for token in ["INDEXER_CONSENSUS_STATUS_PATH", "INDEXER_CONSENSUS_STATUS_DIR", "/var/lib/420consensus:ro"]:
        if token not in compose: errors.append(f"compose consensus token missing: {token}")
    if "INDEXER_CONSENSUS_STATUS_DIR" not in env: errors.append("deployment env consensus source missing")

    acceptance=rec.get("acceptance",{})
    if acceptance.get("production_wiring_complete") is not True: errors.append("production wiring acceptance missing")
    if acceptance.get("deterministic_provider_validation_complete") is not True: errors.append("provider validation acceptance missing")
    if acceptance.get("deployment_contract_complete") is not True: errors.append("deployment contract acceptance missing")
    if acceptance.get("live_consensus_binding_complete") is not False: errors.append("live consensus binding overpromoted")

    EVIDENCE.mkdir(exist_ok=True)
    out={
        "schema":"420explorer-exp-1.5-evidence-v1",
        "milestone":"EXP-1.5",
        "head_sha":git("rev-parse","HEAD"),
        "runtime_provider_wired":True,
        "startup_fail_closed":True,
        "consensus_projection_authoritative":False,
        "live_consensus_binding_qualified":False,
        "tests":expected_tests,
        "errors":errors,
        "pass":not errors,
    }
    (EVIDENCE/"summary.json").write_text(json.dumps(out,indent=2)+"\n")
    print(json.dumps(out,indent=2))
    if errors: raise SystemExit(1)

if __name__=="__main__":
    main()
