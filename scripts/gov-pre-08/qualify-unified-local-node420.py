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
    p.add_argument("--funding",type=Path,required=True)
    p.add_argument("--output",type=Path,required=True)
    p.add_argument("--workdir",type=Path,required=True)
    p.add_argument("--geth",type=Path,default=ROOT/"bin/upstream/geth-v1.17.5-420")
    args=p.parse_args()
    require(not args.output.exists() and not args.workdir.exists(),"refuse existing local evidence")
    args.workdir.mkdir(parents=True)
    graph=json.loads(args.graph.read_text())
    bindings=json.loads(args.bindings.read_text())
    funding=json.loads(args.funding.read_text())
    genesis=json.loads(args.genesis.read_text())
    require(genesis["config"]["chainId"]==420 and
            graph["chainId"]==bindings["chainId"]==31337 and
            not graph["approvedV4"] and not bindings["approvedV4"],"not isolated unapproved local source")
    source=subprocess.check_output(["git","rev-parse","HEAD"],cwd=ROOT,text=True).strip()
    require(source==graph["sourceGitHead"]==bindings["sourceGitHead"]==funding["sourceGitHead"]
            and funding["chainId"]==31337 and funding["signedGenesisV4Approved"] is False
            and funding["postFundingNativeSupplyWei"]==str(42_000_000*10**18),
            "funded Vault custody must originate from identical unapproved actual local source")
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
        # Verify actual source-funded Reserve/Vault balances and frozen custody
        # boundaries at Geth block zero, then again after native consensus,
        # certified EIP-1559 Wallet transfer, and durable Indexer recovery.
        # The Anvil source tx history was not imported into Geth, so the
        # source's block-zero custody values, not fictional Geth receipts,
        # are authoritative expectations for this local fixture.
        reserve="0x0000000000000000000000000000000000000424"
        communityValidator="0x0000000000000000000000000000000000000425"
        communityRewards="0x0000000000000000000000000000000000000426"
        fundingVaults=funding["vaultAddresses"]
        require(set(fundingVaults)=={"OPERATIONS","CONTINGENCY","COMMUNITY"}
                and len({a.lower() for a in fundingVaults.values()})==3,
                "source funding did not identify three unique real AssetVaults")
        custody={
          "ProtocolReserve":(reserve,int(funding["protocolReserveAfterWei"])),
          "OperationsVault":(fundingVaults["OPERATIONS"],int(funding["operationsVaultBalanceWei"])),
          "ContingencyVault":(fundingVaults["CONTINGENCY"],int(funding["contingencyVaultBalanceWei"])),
          "CommunityVault":(fundingVaults["COMMUNITY"],int(funding["communityVaultBalanceWei"])),
          "CommunityValidatorReserve":(communityValidator,int(genesis["alloc"][communityValidator]["balance"],16)),
          "CommunityRewardReserve":(communityRewards,int(genesis["alloc"][communityRewards]["balance"],16)),
        }
        require(custody["ProtocolReserve"][1]==3_560_000*10**18 and
                custody["OperationsVault"][1]==4_200_000*10**18 and
                custody["ContingencyVault"][1]==840_000*10**18 and
                custody["CommunityVault"][1]==0,
                "Treasury amounts no longer conserve the source's 8.6m non-additive reserve")
        def verifyCustody(phase):
            observed={}
            for label,(address,expectedBalance) in custody.items():
                actual=int(rpc("eth_getBalance",[address,"latest"]),16)
                require(actual==expectedBalance,
                        phase+" changed unspent native backing "+label+": "+str(actual))
                require(int(genesis["alloc"][address.lower()]["balance"],16)==expectedBalance,
                        "source Genesis balance disagrees with the mined funding ledger "+label)
                observed[label]={"address":address,"balanceWei":str(actual)}
            for name,address in graph["actualProductionConstructorAddresses"].items():
                require(rpc("eth_getCode",[address,"latest"]).lower()==
                        genesis["alloc"][address.lower()]["code"].lower(),
                        phase+" mutated source-compiled contract code "+name)
            return observed
        sourceCustody=verifyCustody("block zero")
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
        # Real reward issuance pays the known PUBLIC test-only EOA (key 0x01)
        # directly from authenticated native Geth settlement, allowing that
        # wallet to pay its own gas on this same chain. No Genesis faucet,
        # unfunded account impersonation or reserve balance override is used.
        proposer="0x7e5f4552091a69125d5dfcb7b8c2659029395bdf"
        initialProposer=int(rpc("eth_getBalance",[proposer,"latest"]),16)
        require(initialProposer==0,"fixture wallet already holds unearned Genesis funds")
        def produce(parent,previous,slot):
            parenthash=parent["Payload"]["blockHash"] if parent else genesisblock["hash"]
            outcomes={"Rotation":{"Rotation":slot,"EligibleSnapshot":0},
                      "Reward":{"BlockNumber":slot,
                                "Proposer":list(bytes.fromhex(proposer[2:])),
                                "Participants":[],"ActiveCount":15}}
            plan={"Parent":parent,"Previous":previous,"Slot":slot,
                  "Outcomes":outcomes,"Beacon":ZERO,
                  "Payload":{"parentHash":parenthash,"blockNumber":hex(slot)}}
            planfile=args.workdir/f"certified-plan-{slot}.json"
            planfile.write_text(json.dumps(plan))
            batch=json.loads(subprocess.check_output([str(producer),"--batch","--record",
                                                        str(planfile)],text=True))
            require(batch["chainId"]=="0x1a4" and len(batch["calls"])==2 and
                    batch["calls"][0]["target"].lower()==VALIDATORS and
                    batch["calls"][1]["target"].lower()==REWARD,
                    "certified batch not bound to actual Stake and native RewardController")
            stage=rpc("engine420_submitSystemCallsV1",[batch],auth=True)
            require(stage["status"]=="ACCEPTED" and stage["batchRoot"]==batch["batchRoot"],
                    "native Stake/reward batch not authenticated")
            finalized=rpc("eth_getBlockByNumber",["finalized",False])
            choice={"headBlockHash":parenthash,"safeBlockHash":parenthash,
                    "finalizedBlockHash":finalized["hash"] if finalized else genesisblock["hash"]}
            attrs={"timestamp":hex(int(genesisblock["timestamp"],16)+slot*12),
                   "prevRandao":batch["batchRoot"],"suggestedFeeRecipient":VALIDATORS,
                   "withdrawals":[],"parentBeaconBlockRoot":ZERO}
            fcu=rpc("engine_forkchoiceUpdatedV3",[choice,attrs],auth=True)
            require(fcu["payloadStatus"]["status"]=="VALID" and fcu.get("payloadId"),
                    "patched Geth rejected canonical certified payload build")
            payload=rpc("engine_getPayloadV3",[fcu["payloadId"]],auth=True)["executionPayload"]
            require(payload["extraData"]==batch["batchRoot"] and
                    payload["parentHash"]==parenthash and
                    int(payload["blockNumber"],16)==slot,
                    "certified batch root/parent/block number not in execution header")
            plan["Payload"]=payload
            planfile.write_text(json.dumps(plan))
            record=json.loads(subprocess.check_output([str(producer),"--record",
                                                      str(planfile)],text=True))
            consensus.stdin.write(json.dumps(record)+"\n")
            consensus.stdin.flush()
            wait_event("settled",slot)
            latest=rpc("eth_getBlockByNumber",["latest",False])
            require(latest["hash"]==payload["blockHash"] and
                    latest["extraData"]==batch["batchRoot"],
                    "real certified 420 execution head not advanced atomically")
            archived=rpc("engine420_getSystemCallLogsV1",[latest["hash"]],auth=True)
            require(archived["batchRoot"]==batch["batchRoot"] and len(archived["logs"])>=3,
                    "native 420 system call and real reward logs not archived")
            return record,latest,batch,archived

        first,block1,batch1,archived1=produce(None,0,1)
        require(int(call(GW,"lastSequence()"),16)==2,
                "real native Stake and RewardController two-call batch did not settle")
        rewardedBalance=int(rpc("eth_getBalance",[proposer,"latest"]),16)
        require(rewardedBalance>initialProposer,
                "actual native 420 reward not paid to deterministic local Wallet signer")

        # Run the real Wallet Treasury/Governance clients, sign an EIP-1559
        # transfer using the earned native reward, and submit RAW tx bytes.
        # The second BLS-certified execution payload must include that exact
        # transaction and its canonical receipt; no eth_sendTransaction shortcut.
        wallet_origin=args.workdir/"wallet-signed.json"
        wallet_cmd=["node",str(ROOT/"scripts/gov-pre-08/qualify-unified-local-wallet.mjs"),
                    "--rpc","http://127.0.0.1:18780",
                    "--graph",str(args.graph.resolve())]
        subprocess.run(wallet_cmd+["--mode","sign","--output",str(wallet_origin)],
                       cwd=ROOT,check=True)
        wallet=json.loads(wallet_origin.read_text())
        require(wallet["realWalletCoreTreasuryAndGovernanceDiscovered"] and
                wallet["rawTransactionAcceptedByPatchedGeth"] and
                wallet["wrongChainSignedTransactionRejected"],
                "real locally signed wallet did not pass source-bound user path")
        second,latest,batch,archived=produce(first,2,2)
        require(int(call(GW,"lastSequence()"),16)==4,
                "real gateway did not advance exactly four certified native calls")
        unifiedCustody=verifyCustody("after certified Stake and Wallet settlement")
        signedReceipt=rpc("eth_getTransactionReceipt",[wallet["txHash"]])
        require(signedReceipt and signedReceipt["status"]=="0x1" and
                signedReceipt["blockHash"]==latest["hash"],
                "actual signed Wallet EOA tx missing from certified block two")
        wallet_final=args.workdir/"wallet-confirmed.json"
        subprocess.run(wallet_cmd+["--mode","verify","--tx-hash",wallet["txHash"],
                                "--output",str(wallet_final)],cwd=ROOT,check=True)
        cp=json.loads((args.workdir/"consensus"/"checkpoint.json").read_text())
        require(cp["Settlement"]["ExecutionBlock"]==2,
                "certified settlement checkpoint did not reach signed Wallet block")

        require(os.environ.get("INDEXER_PG_URL","").startswith(
                    "postgres://postgres:postgres@127.0.0.1:5432/"),
                "shared Go Indexer requires disposable local PostgreSQL 16")
        nativePgDsn=os.environ["INDEXER_PG_URL"]+"?sslmode=disable"
        env=dict(os.environ,INDEXER_RPC_URL="http://127.0.0.1:18780",
                 INDEXER_ENGINE_URL="http://127.0.0.1:18781",
                 INDEXER_JWT_SECRET=str(args.workdir/"jwt.hex"),
                 INDEXER_CERTIFIED_DIR=str(args.workdir/"consensus"),
                 INDEXER_SETTLEMENT_TRUST=str(trustfile),
                 INDEXER_SETTLEMENT_TRUST_SHA256=pin,
                 INDEXER_CONSENSUS_STATUS_PATH="",
                 INDEXER_PG_DSN=nativePgDsn,
                 INDEXER_HTTP_ADDR="127.0.0.1:18782",
                 INDEXER_MAX_HEAD_AGE="1000000h",
                 INDEXER_POLL_INTERVAL="1s")
        idx=launch("indexer420",[str(indexer)],env=env)
        ready(lambda:getter("http://127.0.0.1:18782","/v1/health")[1]["health"]["indexedHeight"]>=2,
              idx,timeout=60)
        # Verify the actual Go Indexer's atomic PostgreSQL canonical store.
        # Its BLS-native log archive and ordinary signed EOA receipt are both
        # persisted in SQL, and the running Go Explorer reads this same Indexer.
        def attestGoPostgres(phase):
            output=args.workdir/("go-postgres-"+phase+".json")
            subprocess.run(["node",str(ROOT/"scripts/gov-pre-08/qualify-unified-go-postgres.mjs"),
                            "--expected-block-hash",latest["hash"],
                            "--expected-tx-hash",wallet["txHash"],
                            "--output",str(output)],cwd=ROOT,check=True)
            return json.loads(output.read_text())
        indexed=attestGoPostgres("initial")
        require(indexed["realNativeBLSEngineLogsInPostgres"] and
                indexed["realWalletReceiptDurable"] and indexed["canonicalProducerBlock2"],
                "PostgreSQL-backed Go Indexer lost native BLS or signed EVM provenance")
        xenv=dict(os.environ,EXPLORER_INDEXER_URL="http://127.0.0.1:18782",
                  EXPLORER_LISTEN_ADDR="127.0.0.1:18783",
                  EXPLORER_CHAIN_ID="420",EXPLORER_STALE_AFTER="100000h")
        exp=launch("explorer420",[str(explorer)],env=xenv)
        ready(lambda:getter("http://127.0.0.1:18783","/v1/ready")[1]["ready"],exp,timeout=45)
        code,view=getter("http://127.0.0.1:18783","/v1/blocks/2")
        require(code==200 and view["block"]["hash"]==latest["hash"] and
                view["trace"]["certified"] and view["trace"]["consensusBlockRoot"],
                "running Go Explorer failed to present canonical certified block")
        code,status=getter("http://127.0.0.1:18783","/v1/status")
        require(code==200 and status["chainId"]==420,"Explorer wrong chain")
        # An Explorer consumer may never fabricate a transaction or settle
        # native rewards: it must read both facts from the identical Go Indexer
        # that observed the certified system-call archive and signed EVM receipt.
        code,tx_view=getter("http://127.0.0.1:18783","/v1/transactions/"+wallet["txHash"])
        require(code==200 and tx_view["transaction"]["hash"].lower()==wallet["txHash"].lower()
                and tx_view["receipt"]["blockHash"].lower()==latest["hash"].lower(),
                "real Go Explorer did not join signed Wallet to canonical block")
        code,receipt_view=getter("http://127.0.0.1:18783","/v1/receipts/"+wallet["txHash"])
        require(code==200 and receipt_view["receipt"]["transactionHash"].lower()==wallet["txHash"].lower(),
                "real Go Explorer missing authenticated Wallet receipt")

        # Prove Go Indexer/Explorer process restart on this actual BLS-certified
        # execution ledger without resetting, bypassing, or reindexing from an
        # alternate source. Native Geth and fourtwentyd stay running.
        for process in (exp,idx):
            os.killpg(process.pid,signal.SIGTERM)
            process.wait(timeout=15)
        idx=launch("indexer420-recovered",[str(indexer)],env=env)
        ready(lambda:getter("http://127.0.0.1:18782","/v1/health")[1]["health"]["indexedHeight"]==2,
              idx,timeout=60)
        stored=attestGoPostgres("recovered")
        require(stored["canonicalBlockHash"].lower()==latest["hash"].lower()
                and stored["realGoIndexerPostgresDurable"] and
                stored["authenticNativeLogCount"]==indexed["authenticNativeLogCount"]
                and int(stored["mutations"])>=int(indexed["mutations"]),
                "Go Indexer PostgreSQL restart changed native archive or certified head")
        exp=launch("explorer420-recovered",[str(explorer)],env=xenv)
        ready(lambda:getter("http://127.0.0.1:18783","/v1/ready")[1]["ready"],
              exp,timeout=45)
        code,recovered=getter("http://127.0.0.1:18783","/v1/blocks/2")
        require(code==200 and recovered["block"]["hash"].lower()==latest["hash"].lower()
                and recovered["trace"]["certified"],
                "Go Explorer replay/restart lost canonical BLS producer")
        # The production TypeScript Indexer/PostgreSQL service must ingest this
        # same node420 block; its normal EVM logs differ deliberately from the
        # native Engine archive served by the certified Go Indexer.
        pg_report=args.workdir/"postgres420.json"
        subprocess.run(["node",str(ROOT/"scripts/gov-pre-08/qualify-unified-local-postgres.mjs"),
                        "--rpc","http://127.0.0.1:18780",
                        "--graph",str(args.graph.resolve()),
                        "--expected-block-hash",latest["hash"],
                        "--expected-tx-hash",wallet["txHash"],
                        "--output",str(pg_report)],cwd=ROOT,check=True)
        pg=json.loads(pg_report.read_text())
        require(verifyCustody("after persistent Go/TypeScript Indexer and Explorer restart")==unifiedCustody,
                "cross-service restart mutated shared EVM custody")
        require(pg["certifiedBlockHash"].lower()==latest["hash"].lower() and
                pg["durableRestartIdempotent"] and pg["sameNode420ExecutionSource"],
                "PostgreSQL Indexer not on the same canonical chain as Go Explorer")
        evidence={"schema":"GOV_PRE_08_REAL_ONE_CHAIN_NODE420_BLS_INDEXER_EXPLORER_V1",
             "sourceGitHead":source,"approvedV4":False,"realFounderSignatures":False,
             "chainId":420,"genesisHash":genesisblock["hash"],
             "blockOneHash":block1["hash"],"blockTwoHash":latest["hash"],
             "signedWalletTxHash":wallet["txHash"],
             "nativeBatchRoot":batch["batchRoot"],
             "systemCallCount":len(batch1["calls"])+len(batch["calls"]),
             "nativeLogCount":len(archived1["logs"])+len(archived["logs"]),
             "consensusExecutionBlock":2,
             "realProductionContractsAtGenesis":len(graph["actualProductionConstructorAddresses"]),
             "consensusNativeGatewayExecuted":True,
             "realCanonicalValidatorRegistryCalled":True,
             "goIndexerCertifiedProducer":True,"goExplorerCertifiedBlock":True,
             "walletRealSignedEip1559ReceiptVerified":True,
             "goIndexerAndExplorerProcessRestartQualified":True,
             "singleCanonicalLedger":True,"walletBrowserTransactionQualified":False,
             "fundedNativeCustodyPreservedAfterConsensusAndSignedWalletTx":True,
             "sameChainFundedReserveAndVaultReadbacks":unifiedCustody,
             "sameChainSourceCustodyAtGenesis":sourceCustody,
             "postgresEvmCheckpointOnSameChain":True,
             "goIndexerNativeLogPostgresBacking":True,
             "nativeUnspoofedRewardPaidToEOAWallet":True,
             "fullPostgresSameChainQualified":True,
             "nativeRewardOnSameLedgerQualified":True,
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
