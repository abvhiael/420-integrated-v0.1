#!/usr/bin/env python3
"""One local chain-420: imported real V4-shaped runtime + patched node420 +
 certified fourtwentyd + production Go Indexer/Explorer. No signing ceremony.

The EVM Genesis is derived from the actual independent funded Anvil fixture;
all contracts, wallets and services now read the SAME node420 execution state.
Only disposable validator BLS fixture keys enter this harness.
"""
from __future__ import annotations
import argparse
import base64
import hashlib
import hmac
import json
import os
from pathlib import Path
import queue
import signal
import subprocess
import threading
import time
import urllib.error
import urllib.request

ROOT=Path(__file__).resolve().parents[2]
ZERO="0x"+"00"*32
GW="0x000000000000000000000000000000000000043c"
REWARD="0x0000000000000000000000000000000000000420"
VALIDATORS="0x0000000000000000000000000000000000000423"
REGISTRY="0x0000000000000000000000000000000000000434"
TIMELOCK="0x0000000000000000000000000000000000000429"

def require(v, message):
    if not v: raise AssertionError("GOV-PRE-08 unified 420 local chain: "+message)

def http_json(url,headers=None,body=None,timeout=6):
    request=urllib.request.Request(url,body,headers or {})
    with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(request,timeout=timeout) as resp:
        return resp.status,json.load(resp)

def getter(url,path):
    return http_json(url+path)

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--genesis",type=Path,required=True)
    p.add_argument("--graph",type=Path,required=True)
    p.add_argument("--bindings",type=Path,required=True)
    p.add_argument("--output",type=Path,required=True)
    p.add_argument("--workdir",type=Path,required=True)
    p.add_argument("--geth",type=Path,default=ROOT/"bin/upstream/geth-v1.17.5-420")
    args=p.parse_args()
    require(not args.output.exists() and not args.workdir.exists(),"refuse existing local evidence")
    args.workdir.mkdir(parents=True)
    graph=json.loads(args.graph.read_text())
    bindings=json.loads(args.bindings.read_text())
    genesis=json.loads(args.genesis.read_text())
    require(genesis["config"]["chainId"]==420 and
            graph["chainId"]==bindings["chainId"]==31337 and
            not graph["approvedV4"] and not bindings["approvedV4"],"not isolated unapproved local source")
    source=subprocess.check_output(["git","rev-parse","HEAD"],cwd=ROOT,text=True).strip()
    require(source==graph["sourceGitHead"]==bindings["sourceGitHead"],"source identity drift")
    for n,addr in {"Gateway":GW,"RewardController":REWARD,"ValidatorRegistry":VALIDATORS,
                   "Registry":REGISTRY,"Timelock":TIMELOCK}.items():
        require(genesis["alloc"].get(addr,{}).get("code","0x")!="0x",
                "missing real compiled runtime in Geth genesis: "+n)
    require(sum(int(x.get("balance","0x0"),16) for x in genesis["alloc"].values())
            ==42_000_000*10**18,"Geth block-zero native supply not conserved")
    live=[]
    outputs=[]
    execution=ROOT/"bin/node420"
    geth=args.geth.resolve()
    require(execution.is_file() and geth.is_file(),"missing actual patched node420 binary")
    secret=os.urandom(32)
    (args.workdir/"jwt.hex").write_text(secret.hex())
    execdir=args.workdir/"execution"
    def rpc(method,params=None,auth=False):
        data=json.dumps({"jsonrpc":"2.0","id":1,"method":method,"params":params or []}).encode()
        headers={"content-type":"application/json"}
        if auth:
            b64=lambda b:base64.urlsafe_b64encode(b).rstrip(b"=")
            claims=b64(b'{"alg":"HS256","typ":"JWT"}')+b"."+b64(json.dumps({"iat":int(time.time())}).encode())
            headers["Authorization"]="Bearer "+(claims+b"."+b64(hmac.new(secret,claims,hashlib.sha256).digest())).decode()
        port=18781 if auth else 18780
        _,value=http_json(f"http://127.0.0.1:{port}",headers,data,15)
        if value.get("error"): raise RuntimeError(method+" "+str(value["error"]))
        return value["result"]
    def launch(name,command,env=None,input_stream=False):
        out=(args.workdir/(name+".log")).open("w")
        outputs.append(out)
        process=subprocess.Popen(command,cwd=ROOT,env=env,stdin=subprocess.PIPE if input_stream else subprocess.DEVNULL,
                                 stdout=subprocess.PIPE if input_stream else out,
                                 stderr=out,start_new_session=True,text=input_stream,bufsize=1 if input_stream else -1)
        live.append((name,process))
        return process
    def ready(condition,process=None,timeout=35):
        end=time.monotonic()+timeout
        last=""
        while time.monotonic()<end:
            if process is not None and process.poll() is not None:
                raise RuntimeError("process exited: "+str(process.returncode))
            try:
                result=condition()
                if result:return result
            except (OSError,ValueError,KeyError,RuntimeError,urllib.error.URLError) as e:
                last=str(e)
            time.sleep(.15)
        raise RuntimeError("local service readiness timeout "+last)
    try:
        with (args.workdir/"genesis-init.log").open("w") as log:
            subprocess.run([str(execution),"--geth",str(geth),"--datadir",str(execdir),
                            "--init-genesis",str(args.genesis.resolve())],
                           cwd=ROOT,stdout=log,stderr=subprocess.STDOUT,check=True)
        node=launch("node420",[str(execution),"--geth",str(geth),"--datadir",str(execdir),
             "--jwt-secret",str(args.workdir/"jwt.hex"),"--authrpc.port","18781",
             "--http.port","18780","--port","0","--","--ipcdisable","--nodiscover","--maxpeers","0"])
        ready(lambda:rpc("eth_chainId")==hex(420),node)
        genesisblock=rpc("eth_getBlockByNumber",["0x0",False])
        require(int(genesisblock["number"],16)==0,"invalid real Geth block zero")
        chainhead=rpc("eth_getBlockByNumber",["latest",False])
        require(chainhead["hash"]==genesisblock["hash"],"unexpected existing blocks in clean local Genesis")
        for name,address in {"gateway":GW,"RewardController":REWARD,"ValidatorRegistry":VALIDATORS,
                             "ProtocolRegistry":REGISTRY,"GovernanceTimelock":TIMELOCK,
                             **graph["actualProductionConstructorAddresses"],
                             **graph["walletCivicModuleAddresses"]}.items():
            require(rpc("eth_getCode",[address,"latest"]).lower()==
                    genesis["alloc"][address.lower()]["code"].lower(),
                    "real node420 runtime differs from exported constructor: "+name)
        for addr in genesis["alloc"]:
            require(int(rpc("eth_getBalance",[addr,"latest"]),16)==
                    int(genesis["alloc"][addr]["balance"],16),
                    "real node420 Genesis balance mismatch: "+addr)
        def call(address,signature):
            # ABI method IDs supplied by local Foundry helper, not guessed from a mock
            code={"lastSequence()":"3bc684e9","lastRotationSnapshot()":"8009ce19",
                  "consensusSystemCaller()":"4b0cf50a","budgetsInitialized()":"431342d4"}
            if signature not in code: raise AssertionError("missing ABI selector "+signature)
            return rpc("eth_call",[{"to":address,"data":"0x"+code[signature]},"latest"])
        # Exact addresses/code are checked above, not fabricated REST projections.
        require(int(call(GW,"lastSequence()"),16)==0,"nonzero native sequence at imported Genesis")
        # Build real BLS fixture/trust (11 of 15 signatures). Public consensus
        # validator keys, not synthetic founder keys, are supplied to fourtwentyd.
        producer=ROOT/"bin/settlement-fixture"
        daemon=ROOT/"bin/fourtwentyd"
        indexer=ROOT/"bin/indexer420"
        explorer=ROOT/"bin/explorer420"
        for name,path in (("producer",producer),("consensus",daemon),("indexer",indexer),("explorer",explorer)):
            require(path.is_file(),"missing running production binary: "+name)
        trust=json.loads(subprocess.check_output([str(producer),"--genesis",genesisblock["hash"],
                          "--timestamp",genesisblock["timestamp"]],text=True))
        trustfile=args.workdir/"trust.json"
        trustfile.write_text(json.dumps(trust))
        pin=hashlib.sha256(trustfile.read_bytes()).hexdigest()
        events=queue.Queue()
        def collect(stream):
            for line in stream:
                try:events.put(json.loads(line))
                except ValueError: events.put({"event":"bad-output","line":line})
        consensus=launch("fourtwentyd",[str(daemon),"--certified-settlement","--engine",
                      "http://127.0.0.1:18781","--jwt-secret",str(args.workdir/"jwt.hex"),
                      "--settlement-dir",str(args.workdir/"consensus"),
                      "--settlement-trust",str(trustfile),"--settlement-trust-sha256",pin],
                      input_stream=True)
        threading.Thread(target=collect,args=(consensus.stdout,),daemon=True).start()
        def wait_event(target,slot,timeout=45):
            end=time.monotonic()+timeout
            while time.monotonic()<end:
                require(consensus.poll() is None,"fourtwentyd stopped unexpectedly")
                try:v=events.get(timeout=.2)
                except queue.Empty: continue
                if v.get("event")=="halted" or v.get("event")=="rejected":
                    raise RuntimeError("certified settlement failed: "+json.dumps(v))
                if v.get("event")==target and v.get("status",{}).get("Settlement",{}).get("ExecutionBlock")==slot:
                    return v
            raise TimeoutError("certified settlement never reached block "+str(slot))
        wait_event("settled",0)
        plan={"Parent":None,"Previous":0,"Slot":1,
              "Outcomes":{"Rotation":{"Rotation":1,"EligibleSnapshot":0}},
              "Beacon":ZERO,
              "Payload":{"parentHash":genesisblock["hash"],"blockNumber":"0x1"}}
        planfile=args.workdir/"certified-plan.json"
        planfile.write_text(json.dumps(plan))
        batch=json.loads(subprocess.check_output([str(producer),"--batch","--record",str(planfile)],text=True))
        require(batch["chainId"]=="0x1a4" and len(batch["calls"])==1 and
                batch["calls"][0]["target"].lower()==VALIDATORS,
                "producer did not certify actual ValidatorRegistry native call")
        stage=rpc("engine420_submitSystemCallsV1",[batch],auth=True)
        require(stage["status"]=="ACCEPTED" and stage["batchRoot"]==batch["batchRoot"],
                "native batch not authenticated and staged")
        choice={"headBlockHash":genesisblock["hash"],"safeBlockHash":genesisblock["hash"],
                "finalizedBlockHash":genesisblock["hash"]}
        attrs={"timestamp":hex(int(genesisblock["timestamp"],16)+12),
               "prevRandao":batch["batchRoot"],"suggestedFeeRecipient":VALIDATORS,
               "withdrawals":[],"parentBeaconBlockRoot":ZERO}
        fcu=rpc("engine_forkchoiceUpdatedV3",[choice,attrs],auth=True)
        require(fcu["payloadStatus"]["status"]=="VALID" and fcu.get("payloadId"),
                "patched Geth rejected certified block construction")
        payload=rpc("engine_getPayloadV3",[fcu["payloadId"]],auth=True)["executionPayload"]
        require(payload["extraData"]==batch["batchRoot"] and payload["parentHash"]==genesisblock["hash"],
                "native consensus commitment mismatched execution header")
        plan["Payload"]=payload
        planfile.write_text(json.dumps(plan))
        record=json.loads(subprocess.check_output([str(producer),"--record",str(planfile)],text=True))
        consensus.stdin.write(json.dumps(record)+"\n");consensus.stdin.flush()
        wait_event("settled",1)
        latest=rpc("eth_getBlockByNumber",["latest",False])
        require(latest["hash"]==payload["blockHash"] and latest["extraData"]==batch["batchRoot"],
                "certified execution head not advanced")
        require(int(call(GW,"lastSequence()"),16)==1,
                "real native gateway did not execute certified consensus instruction")
        archived=rpc("engine420_getSystemCallLogsV1",[latest["hash"]],auth=True)
        require(archived["batchRoot"]==batch["batchRoot"] and archived["logs"],
                "native consensus logs missing or detached from canonical block")
        cp=json.loads((args.workdir/"consensus"/"checkpoint.json").read_text())
        require(cp["Settlement"]["ExecutionBlock"]==1,"consensus checkpoint not canonical")
        indexstore=args.workdir/"indexer-canonical.json"
        env=dict(os.environ,INDEXER_RPC_URL="http://127.0.0.1:18780",
                 INDEXER_ENGINE_URL="http://127.0.0.1:18781",
                 INDEXER_JWT_SECRET=str(args.workdir/"jwt.hex"),
                 INDEXER_CERTIFIED_DIR=str(args.workdir/"consensus"),
                 INDEXER_SETTLEMENT_TRUST=str(trustfile),
                 INDEXER_SETTLEMENT_TRUST_SHA256=pin,
                 INDEXER_CONSENSUS_STATUS_PATH="",
                 INDEXER_STORE_PATH=str(indexstore),
                 INDEXER_HTTP_ADDR="127.0.0.1:18782",
                 INDEXER_MAX_HEAD_AGE="1000000h",
                 INDEXER_POLL_INTERVAL="1s")
        idx=launch("indexer420",[str(indexer)],env=env)
        ready(lambda:getter("http://127.0.0.1:18782","/v1/health")[1]["health"]["indexedHeight"]>=1,
              idx,timeout=60)
        indexed=json.loads(indexstore.read_text())
        require(indexed["checkpoint"]["indexedHash"]==latest["hash"] and
                indexed["blocks"]["1"]["producer"]["certified"],
                "Go production Indexer did not consume true BLS/native 420 history")
        xenv=dict(os.environ,EXPLORER_INDEXER_URL="http://127.0.0.1:18782",
                  EXPLORER_LISTEN_ADDR="127.0.0.1:18783",
                  EXPLORER_CHAIN_ID="420",EXPLORER_STALE_AFTER="100000h")
        exp=launch("explorer420",[str(explorer)],env=xenv)
        ready(lambda:getter("http://127.0.0.1:18783","/v1/ready")[1]["ready"],exp,timeout=45)
        code,view=getter("http://127.0.0.1:18783","/v1/blocks/1")
        require(code==200 and view["block"]["hash"]==latest["hash"] and
                view["trace"]["certified"] and view["trace"]["consensusBlockRoot"],
                "running Go Explorer failed to present canonical certified block")
        code,status=getter("http://127.0.0.1:18783","/v1/status")
        require(code==200 and status["chainId"]==420,"Explorer wrong chain")
        # The production TypeScript Indexer/PostgreSQL service must ingest this
        # same node420 block; its normal EVM logs differ deliberately from the
        # native Engine archive served by the certified Go Indexer.
        pg_report=args.workdir/"postgres420.json"
        subprocess.run(["node",str(ROOT/"scripts/gov-pre-08/qualify-unified-local-postgres.mjs"),
                        "--rpc","http://127.0.0.1:18780",
                        "--graph",str(args.graph.resolve()),
                        "--expected-block-hash",latest["hash"],
                        "--output",str(pg_report)],cwd=ROOT,check=True)
        pg=json.loads(pg_report.read_text())
        require(pg["certifiedBlockHash"].lower()==latest["hash"].lower() and
                pg["durableRestartIdempotent"] and pg["sameNode420ExecutionSource"],
                "PostgreSQL Indexer not on the same canonical chain as Go Explorer")
        evidence={"schema":"GOV_PRE_08_REAL_ONE_CHAIN_NODE420_BLS_INDEXER_EXPLORER_V1",
             "sourceGitHead":source,"approvedV4":False,"realFounderSignatures":False,
             "chainId":420,"genesisHash":genesisblock["hash"],
             "blockOneHash":latest["hash"],"nativeBatchRoot":batch["batchRoot"],
             "systemCallCount":len(batch["calls"]),
             "nativeLogCount":len(archived["logs"]),"consensusExecutionBlock":1,
             "realProductionContractsAtGenesis":len(graph["actualProductionConstructorAddresses"]),
             "consensusNativeGatewayExecuted":True,
             "realCanonicalValidatorRegistryCalled":True,
             "goIndexerCertifiedProducer":True,"goExplorerCertifiedBlock":True,
             "singleCanonicalLedger":True,"walletBrowserTransactionQualified":False,
             "postgresEvmCheckpointOnSameChain":True,
             "fullPostgresSameChainQualified":False,
             "nativeRewardOnSameLedgerQualified":False,
             "liveNetworkQualified":False}
        args.output.write_text(json.dumps(evidence,indent=2,sort_keys=True)+"\n")
        print("GOV_PRE_08_REAL_NODE420_FOURTWENTYD_CANONICAL_REGISTRY_INDEXER_EXPLORER_SHARED_CHAIN=PASS",
              latest["hash"])
    finally:
        for name,proc in reversed(live):
            if proc.poll() is None:
                os.killpg(proc.pid,signal.SIGTERM)
                try:proc.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    os.killpg(proc.pid,signal.SIGKILL);proc.wait(timeout=5)
        for output in outputs:output.close()

if __name__=="__main__":
    main()
