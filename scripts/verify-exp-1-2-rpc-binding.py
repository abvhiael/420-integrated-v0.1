#!/usr/bin/env python3
import hashlib
import json
import subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
M=ROOT/"docs/audit/EXP-1.2-rpc-binding.json"
IDX=ROOT/"config/420indexer-v1.json"
LAUNCH=ROOT/"testnet/config/launch.json"
ENDPOINTS=ROOT/"testnet/services/endpoints.json"
EXEC_GEN=ROOT/"testnet/genesis/execution-genesis.json"
CONS_GEN=ROOT/"testnet/genesis/consensus-genesis.json"
SOURCE=ROOT/"indexer/rpc/source.go"
TESTS=ROOT/"indexer/rpc/source_test.go"
EVIDENCE=ROOT/"exp-1-2-evidence"

def load(p): return json.loads(p.read_text())
def sha256(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def git(*args): return subprocess.check_output(["git",*args],cwd=ROOT,text=True).strip()

def main():
    errors=[]
    for p in (M,IDX,LAUNCH,ENDPOINTS,EXEC_GEN,CONS_GEN,SOURCE,TESTS):
        if not p.exists(): errors.append(f"missing {p.relative_to(ROOT)}")
    if errors:
        print(json.dumps({"pass":False,"errors":errors},indent=2)); raise SystemExit(1)

    m,idx,launch,endpoints=map(load,(M,IDX,LAUNCH,ENDPOINTS))
    if m.get("schema")!="420explorer-exp-1.2-rpc-binding-v1": errors.append("schema drift")
    if m.get("milestone")!="EXP-1.2": errors.append("milestone drift")
    pred=m.get("predecessor",{})
    if pred.get("qualified_head")!="8267f458c6b27108c2675958c2c698f3ece9e6fc": errors.append("EXP-1.1 qualified predecessor drift")

    if launch.get("chain_id",{}).get("value")!=420: errors.append("launch chain ID drift")
    if sha256(EXEC_GEN)!="65c8efba297009c02dc7ec424f777ba7131f5677a1e11135765ed05de3d06f7e": errors.append("execution genesis digest drift")
    if sha256(CONS_GEN)!="83da87ffbfbf0ed42a199a99b805c36fb33cd7947cb17bfad73689085531dc9d": errors.append("consensus genesis digest drift")

    sq=idx.get("sourceQualification",{})
    expected={
        "requiredChainId":420,
        "requireGenesisIdentity":True,
        "requireHeadSafeFinalized":True,
        "requireFinalityOrdering":"finalized <= safe <= head",
        "maxHeadAgeDefaultSeconds":120,
        "rejectMissingHashes":True,
        "rejectCrossChainRecords":True,
        "rejectMalformedSource":True,
        "liveBindingStatus":"BLOCKED_PENDING_PROVISIONED_APPROVED_TESTNET_RPC"
    }
    for k,v in expected.items():
        if sq.get(k)!=v: errors.append(f"source qualification drift: {k}")

    rpc=endpoints.get("rpc",[])
    if len(rpc)<3: errors.append("fewer than three public RPC slots")
    if any(x.get("status")!="PLACEHOLDER" or not str(x.get("url","")).startswith("REPLACE_") for x in rpc):
        errors.append("RPC endpoint authority changed without EXP-1.2 live evidence")

    src=SOURCE.read_text()
    tests=TESTS.read_text()
    required_source_tokens=[
        "ErrWrongChain","ErrGenesisMismatch","ErrFinalityOrdering","ErrStaleSource","ErrSourceIdentity",
        "ExpectedGenesisHash","MaxHeadAge","BlockByNumber(0)","finalized.Number <= safe.Number",
        "time.Unix(int64(head.Timestamp), 0)"
    ]
    for token in required_source_tokens:
        if token not in src: errors.append(f"source validation token missing: {token}")

    required_tests=[
        "TestValidateHealthySource",
        "TestValidateRejectsWrongChain",
        "TestValidateRejectsGenesisMismatch",
        "TestValidateRejectsImpossibleFinalityOrdering",
        "TestValidateRejectsStaleHead",
        "TestValidateRejectsMissingHeadHash",
        "TestValidatePropagatesMalformedSourceFailure",
        "TestValidateRejectsCrossChainFinalityRecord"
    ]
    for token in required_tests:
        if token not in tests: errors.append(f"required RPC binding test missing: {token}")

    current=m.get("current_binding_state",{})
    if current.get("approved_concrete_rpc") is not None: errors.append("placeholder phase may not assert approved concrete RPC")
    if current.get("live_binding_qualified") is not False: errors.append("premature live RPC binding qualification")
    if m.get("summary",{}).get("deployment_qualified") is not False: errors.append("premature deployment qualification")
    if m.get("summary",{}).get("live_network_qualified") is not False: errors.append("premature live-network qualification")
    if m.get("summary",{}).get("genesis_qualified") is not False: errors.append("premature Genesis qualification")

    EVIDENCE.mkdir(exist_ok=True)
    out={
        "schema":"420explorer-exp-1.2-evidence-v1",
        "milestone":"EXP-1.2",
        "head_sha":git("rev-parse","HEAD"),
        "chain_id":420,
        "execution_genesis_sha256":sha256(EXEC_GEN),
        "consensus_genesis_sha256":sha256(CONS_GEN),
        "rpc_binding_implementation_complete":True,
        "approved_concrete_rpc":None,
        "live_rpc_binding_complete":False,
        "deployment_qualified":False,
        "live_network_qualified":False,
        "errors":errors,
        "pass":not errors
    }
    (EVIDENCE/"summary.json").write_text(json.dumps(out,indent=2)+"\n")
    print(json.dumps(out,indent=2))
    if errors: raise SystemExit(1)

if __name__=="__main__": main()
