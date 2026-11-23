#!/usr/bin/env python3
"""One local chain-420: imported real V4-shaped runtime + patched node420 +
 certified fourtwentyd + production Go Indexer/Explorer. No signing ceremony.

The EVM Genesis is derived from the actual independent funded Anvil fixture;
all contracts, wallets and services now read the SAME node420 execution state.
Local-only BLS keys enter only independent protected signer processes.
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
import ssl
import subprocess
import threading
import time
import urllib.error
import urllib.request

from protected_committee import Committee

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
        # All native quorum shares originate in independent mTLS-protected
        # validator and remote signer processes, never a fixture QC producer.
        daemon=ROOT/"bin/fourtwentyd"
        indexer=ROOT/"bin/indexer420"
        explorer=ROOT/"bin/explorer420"
        for name,path in (("consensus",daemon),("indexer",indexer),("explorer",explorer),
                          ("producer",ROOT/"bin/certified-producer"),
                          ("signer",ROOT/"bin/stake-signer"),
                          ("provisioner",ROOT/"bin/settlement-fixture")):
            require(path.is_file(),"missing keyless production runtime or local-only provisioner: "+name)
        committee=Committee(ROOT,args.workdir,genesisblock["hash"],genesisblock["timestamp"],launch)
        trustfile=committee.trust
        pin=committee.pin
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
        def produce(parent,previous,slot,expected_transactions=()):
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
            batch=committee.batch(planfile)
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
            if expected_transactions:
                # getPayload resolves the builder and can stop it before its
                # first full transaction-bearing payload is ready.
                time.sleep(1)
            payload=rpc("engine_getPayloadV3",[fcu["payloadId"]],auth=True)["executionPayload"]
            require(payload["extraData"]==batch["batchRoot"] and
                    payload["parentHash"]==parenthash and
                    int(payload["blockNumber"],16)==slot,
                    "certified batch root/parent/block number not in execution header")
            require(len(payload["transactions"])==len(expected_transactions),
                    "candidate payload transaction count differs from signed submissions")
            if expected_transactions:
                hash_command=["node","--input-type=module","--eval",
                              "import {keccak256} from 'ethers'; "
                              "let input=''; for await(const chunk of process.stdin)input+=chunk; "
                              "console.log(JSON.stringify(JSON.parse(input).map(keccak256)))"]
                payload_hashes=json.loads(subprocess.check_output(hash_command,cwd=ROOT/"420-indexer",
                    input=json.dumps(payload["transactions"]),text=True,timeout=8))
                require(set(payload_hashes)==set(expected_transactions),
                        "candidate payload does not commit the exact signed submissions")
            plan["Payload"]=payload
            # Local-only explicit state witness anchored to actual Geth state;
            # its derivation is not a frozen production consensus state policy.
            parentConsensus=(parent["Certificate"]["BlockRoot"] if parent
                             else committee.trustdata["Genesis"]["Root"])
            commitment=hashlib.sha256(json.dumps({
                "schema":"GOV_PRE_08_LOCAL_CONSENSUS_STATE_WITNESS_V1",
                "parent":parentConsensus,"slot":slot,
                "committee":committee.trustdata["CommitteeRoot"],
                "executionState":payload["stateRoot"]
            },sort_keys=True,separators=(",",":")).encode()).digest()
            plan["ConsensusStateRoot"]=list(commitment)
            planfile.write_text(json.dumps(plan))
            def preserve_authority_during_quorum_loss():
                require(rpc("eth_getBlockByNumber",["latest",False])["hash"]==parenthash
                        and int(call(GW,"lastSequence()"),16)==previous,
                        "quorum loss advanced native execution or settlement sequence")
                checkpoint=json.loads((args.workdir/"consensus"/"checkpoint.json").read_text())
                require(checkpoint["Settlement"]["ExecutionBlock"]==slot-1,
                        "quorum loss advanced the durable consensus checkpoint")
            record=committee.certify(planfile,slot,args.workdir,preserve_authority_during_quorum_loss)
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
                wallet["wrongChainSignedTransactionRejected"] and
                wallet["wrongChainIdentityAndStaleRegistryAndTamperedCodeRejected"],
                "real locally signed wallet did not pass source-bound user path")
        # Keep the previous single-Wallet-transaction canonical block 2
        # invariant and its independently qualified SQL replay unchanged.
        second,latest,batch,archived=produce(first,2,2,[wallet["txHash"]])
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
        # GOV-PRE-08 Step 3: full shared-chain hard-stop and recovery, not
        # just a warm Indexer/Explorer restart while consensus and Geth survive.
        # Persisted Geth block state, signed Wallet receipt, BLS-certified
        # settlement checkpoint, native-log archive and PostgreSQL projections
        # must all agree again after *both* authority processes were killed.
        #
        # This is a disposable local rehearsal, never a testnet recovery claim.
        # node420 supervises a real separate Geth child. Waiting for the wrapper
        # after SIGKILL is insufficient: Geth may still own the datadir lock.
        # Capture the actual kernel child pid while the wrapper is still alive
        # and wait until it has exited or become a zombie (no open descriptors).
        childlist=Path("/proc")/str(node.pid)/"task"/str(node.pid)/"children"
        geth_children=[int(pid) for pid in childlist.read_text().split()]
        require(len(geth_children)==1 and geth_children[0]!=node.pid,
                "native cold recovery did not identify exactly one real Geth child")
        for process in (exp,idx,consensus,node):
            require(process.poll() is None,"recovery cannot test an already dead component")
            os.killpg(process.pid,signal.SIGKILL)
            process.wait(timeout=20)
        for child in geth_children:
            deadline=time.monotonic()+12
            while time.monotonic()<deadline:
                try:
                    state=(Path("/proc")/str(child)/"stat").read_text().split(") ",1)
                except FileNotFoundError:
                    break
                require(len(state)==2,"malformed actual Geth child process status")
                if state[1].startswith("Z"):
                    break
                time.sleep(.05)
            else:
                raise RuntimeError("actual Geth child did not release its datadir after SIGKILL")
        node=launch("node420-cold-recovered",[str(execution),"--geth",str(geth),
             "--datadir",str(execdir),"--jwt-secret",str(args.workdir/"jwt.hex"),
             "--authrpc.port","18781","--http.port","18780","--port","0",
             "--","--ipcdisable","--nodiscover","--maxpeers","0"])
        ready(lambda:rpc("eth_chainId")==hex(420),node,timeout=60)
        # Geth intentionally may rewind a state trie on abrupt SIGKILL, even
        # though the durable certified consensus history contains block 2.
        # Never trust the un-reconciled Geth head. Production fourtwentyd
        # recovery.Reconcile() verifies the independently pinned Genesis,
        # the independently sourced BLS certificates, their ancestry and the derived
        # authentic Stake batches before rebuilding missing Geth payload
        # state and forkchoice. We must run it BEFORE asserting recovery.
        events=queue.Queue()
        consensus=launch("fourtwentyd-cold-recovered",[str(daemon),
                      "--certified-settlement","--engine","http://127.0.0.1:18781",
                      "--jwt-secret",str(args.workdir/"jwt.hex"),
                      "--settlement-dir",str(args.workdir/"consensus"),
                      "--settlement-trust",str(trustfile),
                      "--settlement-trust-sha256",pin],input_stream=True)
        threading.Thread(target=collect,args=(consensus.stdout,),daemon=True).start()
        wait_event("settled",2,timeout=60)
        restored=rpc("eth_getBlockByNumber",["latest",False])
        require(restored["number"]=="0x2" and
                restored["hash"].lower()==latest["hash"].lower() and
                restored["extraData"]==batch["batchRoot"],
                "recovered Geth did not preserve the actual certified canonical head")
        recoveredReceipt=rpc("eth_getTransactionReceipt",[wallet["txHash"]])
        require(recoveredReceipt and recoveredReceipt["status"]=="0x1" and
                recoveredReceipt["blockHash"].lower()==latest["hash"].lower(),
                "cold Geth recovery lost signed Wallet transaction/receipt")
        require(int(call(GW,"lastSequence()"),16)==4,
                "cold Geth recovery rewound or replayed native system calls")
        require(verifyCustody("after cold Geth restart")==unifiedCustody,
                "cold Geth restart changed funded Vault or reserve custody")
        # No untrusted caller may bypass JWT to submit native batches on the
        # reconstituted Engine endpoint. The protected trusted transport is
        # tested separately by the exact-head node420 Release Gate.
        unauthorizedBody=json.dumps({"jsonrpc":"2.0","id":1,
            "method":"engine420_submitSystemCallsV1","params":[batch]}).encode()
        try:
            http_json("http://127.0.0.1:18781",{"content-type":"application/json"},
                      unauthorizedBody,5)
        except urllib.error.HTTPError as error:
            require(error.code in (401,403),"wrong unauthenticated Engine rejection")
        else:
            raise AssertionError("unauthenticated native Engine mutation accepted")

        recoveredCheckpoint=json.loads((args.workdir/"consensus"/"checkpoint.json").read_text())
        require(recoveredCheckpoint["Settlement"]["ExecutionBlock"]==2,
                "certified settlement lost its persisted checkpoint")
        idx=launch("indexer420-cold-recovered",[str(indexer)],env=env)
        ready(lambda:getter("http://127.0.0.1:18782","/v1/health")[1]["health"]["indexedHeight"]==2,
              idx,timeout=60)
        afterCrash=attestGoPostgres("execution-recovered")
        require(afterCrash["canonicalBlockHash"].lower()==latest["hash"].lower()
                and afterCrash["realGoIndexerPostgresDurable"]
                and afterCrash["authenticNativeLogCount"]==indexed["authenticNativeLogCount"],
                "Indexer's PostgreSQL/native-log state diverged after Geth and consensus hard-stop")
        exp=launch("explorer420-cold-recovered",[str(explorer)],env=xenv)
        ready(lambda:getter("http://127.0.0.1:18783","/v1/ready")[1]["ready"],
              exp,timeout=45)
        code,crashView=getter("http://127.0.0.1:18783","/v1/blocks/2")
        require(code==200 and crashView["block"]["hash"].lower()==latest["hash"].lower()
                and crashView["trace"]["certified"],
                "Explorer lost certified block after whole-stack cold recovery")
        code,crashTx=getter("http://127.0.0.1:18783","/v1/transactions/"+wallet["txHash"])
        require(code==200 and crashTx["receipt"]["blockHash"].lower()==latest["hash"].lower(),
                "Explorer failed to rejoin signed Wallet receipt after whole-stack recovery")
        wallet_cold=args.workdir/"wallet-cold-recovered.json"
        subprocess.run(wallet_cmd+["--mode","verify","--tx-hash",wallet["txHash"],
                               "--output",str(wallet_cold)],cwd=ROOT,check=True)
        require(verifyCustody("after full shared-chain cold recovery")==unifiedCustody,
                "cold recovery did not conserve treasury and community reserves")
        # AFTER the pre-existing block-2 Indexer/PostgreSQL and hard-stop
        # regressions, Chromium signs the Civic proposal at nonce 1. Certify
        # actual proposal block 3 and an empty block 4 (the voteStart), then
        # its independently signed ballot is included in certified block 5.
        # This preserves exact previous block-2 transaction cardinality.
        ts_worker_cmd=["node",str(ROOT/"scripts/gov-pre-08/qualify-unified-local-postgres.mjs"),
                       "--serve","--rpc","http://127.0.0.1:18780",
                       "--graph",str(args.graph.resolve()),"--genesis",str(args.genesis.resolve()),
                       "--expected-block-hash",latest["hash"],"--expected-tx-hash",wallet["txHash"]]
        ts_origin="http://127.0.0.1:18784"
        def await_ts_block(height,expected):
            return ready(lambda:getter(ts_origin,f"/v1/blocks/{height}?chainId=420")[1]
                         ["data"]["hash"].lower()==expected.lower(),ts_idx,timeout=60)
        ts_idx=launch("typescript-indexer420",ts_worker_cmd)
        await_ts_block(2,latest["hash"])
        identity_binary=Path(os.environ["GOVPRE08_BROWSER_IDENTITY_BIN"]).resolve()
        require(identity_binary.is_file(),"source-compiled local 420ID gateway harness required")
        browser_runtime=args.workdir/"wallet-browser-runtime.json"
        civic_graph=graph["walletCivicModuleAddresses"]
        browser_runtime.write_text(json.dumps({
            "schema":"420-wallet-runtime-config-v1",
            "network":{"name":"GOV-PRE-08 local chain420","chainId":"0x1a4","rpcUrl":"http://127.0.0.1:18780"},
            "identitySession":{"app":"420wallet","enabled":True,"gatewayPath":"/420id-api",
                               "authority":"confidential-app-gateway-only"},
            "governance":{"indexerUrl":"https://wallet.420integrated.org",
                "discovery":{"source":"protocol-registry","serviceId":"420/service/governance/v1",
                             "revision":1,"registryAddress":REGISTRY,"modules":civic_graph,
                             "componentIds":{key:graph["walletCanonicalComponentIds"][key]
                                             for key in civic_graph}}},
        }))
        identity=launch("wallet-420id",
                        [str(identity_binary),"-test.run=^TestServeGOVPRE08WalletIdentity$","-test.timeout=15m"],
                        env=dict(os.environ,GOVPRE08_WALLET_WEB_ROOT=str(ROOT/"wallet/web"),
                                 GOVPRE08_WALLET_CONFIG=str(browser_runtime.resolve())))
        def identity_ready():
            request=urllib.request.Request("https://127.0.0.1:18785/420id-api/healthz",
                                           headers={"Host":"wallet.420integrated.org"})
            transport=urllib.request.build_opener(urllib.request.ProxyHandler({}),
                urllib.request.HTTPSHandler(context=ssl._create_unverified_context()))
            with transport.open(request,timeout=5) as response:
                return json.load(response)["ready"]
        ready(identity_ready,identity,timeout=60)
        browser_cmd=["node",str(ROOT/"wallet/web/scripts/qualify-gov-pre08-browser.mjs"),
                     "--graph",str(args.graph.resolve()),"--rpc","http://127.0.0.1:18780"]
        browser_proposal_path=args.workdir/"browser-proposal.json"
        subprocess.run(browser_cmd+["--mode","propose","--output",str(browser_proposal_path)],
                       cwd=ROOT,check=True,timeout=65)
        browser_proposal=json.loads(browser_proposal_path.read_text())
        require(browser_proposal["realNativeWalletSignedCivicProposal"]
                and browser_proposal["accountChangedInvalidatesMountedGovernance"]
                and browser_proposal["appSSORevocationInvalidatesMountedGovernance"]
                and browser_proposal["chainChangeAndDisconnectInvalidateMountedGovernance"],
                "real browser could not independently propose and revoke on chain 420")
        third,block3,batch3,archive3=produce(second,4,3,[browser_proposal["proposalTxHash"]])
        browser_proposal_receipt=rpc("eth_getTransactionReceipt",[browser_proposal["proposalTxHash"]])
        require(browser_proposal_receipt and browser_proposal_receipt["status"]=="0x1"
                and browser_proposal_receipt["blockHash"]==block3["hash"]
                and browser_proposal_receipt["to"].lower()==graph["walletCivicModuleAddresses"]["governor"].lower()
                and browser_proposal_receipt["logs"],
                "real injected Wallet Civic proposal not mined in native certified block 3")
        fourth,block4,batch4,archive4=produce(third,6,4)
        await_ts_block(4,block4["hash"])
        vote_pending=args.workdir/"browser-vote-pending.json"
        vote_output=args.workdir/"browser-vote-confirmed.json"
        vote_proc=launch("browser-vote",browser_cmd+["--mode","vote",
            "--proposal-tx",browser_proposal["proposalTxHash"],
            "--pending-output",str(vote_pending),"--output",str(vote_output)])
        ready(lambda:vote_pending.exists(),vote_proc,timeout=60)
        ballot_intent=json.loads(vote_pending.read_text())
        require(ballot_intent["proposalId"] and ballot_intent["txHash"],
                "Chromium signed no actual Civic ballot in native Geth mempool")
        fifth,block5,batch5,archive5=produce(fourth,8,5,[ballot_intent["txHash"]])
        vote_proc.wait(timeout=65)
        require(vote_proc.returncode==0 and vote_output.exists(),
                "Chromium Wallet Civic vote was not confirmed by the native chain")
        browser_vote=json.loads(vote_output.read_text())
        receipt=rpc("eth_getTransactionReceipt",[ballot_intent["txHash"]])
        require(browser_vote["actualSourceCompiledCivicVote"]
                and browser_vote["realOnchainEvent"]
                and browser_vote["real420IDCentralConsentAndPKCE"]
                and browser_vote["realVoteReceiptHash"]==ballot_intent["txHash"]
                and receipt and receipt["status"]=="0x1"
                and receipt["blockHash"]==block5["hash"]
                and receipt["from"].lower()==graph["localBrowserSigner"].lower()
                and receipt["to"].lower()==graph["walletCivicModuleAddresses"]["voting"].lower(),
                "real injected Chromium ballot was not authenticated and settled")
        require(int(call(GW,"lastSequence()"),16)==10,
                "browser-certified native reward/gateway sequence changed unexpectedly")
        require(verifyCustody("after native browser Civic vote")==unifiedCustody,
                "browser ballot diverted funded Genesis reserves")
        ready(lambda:getter("http://127.0.0.1:18782","/v1/health")[1]["health"]["indexedHeight"]>=5,
              idx,timeout=60)
        code,view=getter("http://127.0.0.1:18783","/v1/blocks/5")
        require(code==200 and view["block"]["hash"].lower()==block5["hash"].lower()
                and view["trace"]["certified"],
                "Go Indexer and Explorer missed the real signed Civic vote block")
        # Reconcile the ACTUAL browser ballot through another complete hard
        # stop of patched Geth, certified settlement, Indexer and Explorer.
        # Never replace block 5 from an unauthenticated RPC head or replay the
        # UI vote: recover only pinned BLS-certified history and Geth receipts.
        checkpoint5=json.loads((args.workdir/"consensus"/"checkpoint.json").read_text())
        require(checkpoint5["Settlement"]["ExecutionBlock"]==5,
                "browser's certified vote is not in the durable consensus high water")
        childlist=Path("/proc")/str(node.pid)/"task"/str(node.pid)/"children"
        geth_children=[int(pid) for pid in childlist.read_text().split()]
        require(len(geth_children)==1 and geth_children[0]!=node.pid,
                "second cold recovery did not identify the real Geth child")
        await_ts_block(5,block5["hash"])
        for process in (exp,idx,ts_idx,consensus,node):
            require(process.poll() is None,"native browser recovery requires live service")
            os.killpg(process.pid,signal.SIGKILL)
            process.wait(timeout=20)
        for child in geth_children:
            until=time.monotonic()+12
            while time.monotonic()<until:
                try: state=(Path("/proc")/str(child)/"stat").read_text().split(") ",1)
                except FileNotFoundError: break
                if len(state)==2 and state[1].startswith("Z"):break
                time.sleep(.05)
            else:raise RuntimeError("browser-recovery Geth process retained locked datadir")
        node=launch("node420-browser-vote-cold-recovered",
            [str(execution),"--geth",str(geth),"--datadir",str(execdir),
             "--jwt-secret",str(args.workdir/"jwt.hex"),"--authrpc.port","18781",
             "--http.port","18780","--port","0","--","--ipcdisable","--nodiscover","--maxpeers","0"])
        ready(lambda:rpc("eth_chainId")==hex(420),node,timeout=60)
        events=queue.Queue()
        consensus=launch("fourtwentyd-browser-vote-cold-recovered",
            [str(daemon),"--certified-settlement","--engine","http://127.0.0.1:18781",
             "--jwt-secret",str(args.workdir/"jwt.hex"),"--settlement-dir",str(args.workdir/"consensus"),
             "--settlement-trust",str(trustfile),"--settlement-trust-sha256",pin],
             input_stream=True)
        threading.Thread(target=collect,args=(consensus.stdout,),daemon=True).start()
        wait_event("settled",5,timeout=60)
        require(rpc("eth_getBlockByNumber",["latest",False])["hash"].lower()==block5["hash"].lower(),
                "recovered Geth did not restore the BLS-certified browser vote block")
        replayReceipt=rpc("eth_getTransactionReceipt",[ballot_intent["txHash"]])
        require(replayReceipt and replayReceipt["status"]=="0x1"
                and replayReceipt["blockHash"].lower()==block5["hash"].lower(),
                "Geth+consensus cold restart lost actual Chromium vote receipt")
        require(int(call(GW,"lastSequence()"),16)==10,
                "actual native reward/Gateway sequence drifted after browser vote recovery")
        require(verifyCustody("after recovered browser ballot")==unifiedCustody,
                "native browser ballot recovery modified funded Genesis custody")
        idx=launch("indexer420-browser-vote-cold-recovered",[str(indexer)],env=env)
        ready(lambda:getter("http://127.0.0.1:18782","/v1/health")[1]["health"]["indexedHeight"]>=5,
              idx,timeout=60)
        exp=launch("explorer420-browser-vote-cold-recovered",[str(explorer)],env=xenv)
        ready(lambda:getter("http://127.0.0.1:18783","/v1/ready")[1]["ready"],exp,timeout=60)
        code,recoveredBallot=getter("http://127.0.0.1:18783","/v1/blocks/5")
        require(code==200 and recoveredBallot["block"]["hash"].lower()==block5["hash"].lower()
                and recoveredBallot["trace"]["certified"],
                "Explorer lost browser vote after full stack cold recovery")
        ts_idx=launch("typescript-indexer420-browser-vote-cold-recovered",ts_worker_cmd)
        await_ts_block(5,block5["hash"])
        browser_recovered=args.workdir/"browser-recovered-vote.json"
        subprocess.run(browser_cmd+["--mode","recovered",
                       "--proposal-tx",browser_proposal["proposalTxHash"],
                       "--output",str(browser_recovered)],cwd=ROOT,check=True,timeout=65)
        recoveredBrowser=json.loads(browser_recovered.read_text())
        require(recoveredBrowser["canonicalCivicBallotRecoveredAfterHardStop"]
                and recoveredBrowser["real420IDCentralConsentAndPKCE"],
                "new real Chromium session failed to read recovered on-chain ballot")
        # Exercise authorized scheduling and on-chain denial while the
        # immutable delay is running. The pinned single-rotation settlement
        # trust expires before the production G1 delay can elapse.
        civic_cmd=["node",str(ROOT/"scripts/gov-pre-08/qualify-native-civic.mjs"),
                   "http://127.0.0.1:18780",str(args.graph.resolve()),str(browser_proposal_path)]
        def civic(stage):
            result=subprocess.check_output([*civic_cmd,stage],cwd=ROOT,text=True,timeout=30)
            return json.loads(result)
        civic_receipts={}
        record=fifth
        for height,stage in enumerate(("validator-ballot","cancel","activate","finalize","queue"),6):
            submission=civic(stage)
            record,civic_block,_,_=produce(record,(height-1)*2,height,submission["hashes"])
            receipts=[rpc("eth_getTransactionReceipt",[tx]) for tx in submission["hashes"]]
            require(receipts and all(receipt and receipt["status"]=="0x1" and
                    receipt["blockHash"]==civic_block["hash"] and receipt["logs"] for receipt in receipts),
                    "missing canonical successful signed Civic receipt(s): "+stage)
            civic_receipts[stage]=receipts
        operation=civic("delay")
        require(operation["executeAfter"]-int(civic_block["timestamp"],16)==7*86400,
                "Civic queued operation did not preserve the frozen G1 delay")
        _,denial_block,_,_=produce(record,20,11,operation["hashes"])
        denied=rpc("eth_getTransactionReceipt",[operation["hashes"][0]])
        require(denied and denied["status"]=="0x0" and denied["blockHash"]==denial_block["hash"]
                and not denied["logs"],"early Timelock attempt was not a canonical revert")
        require(civic("verify-delay")["proposalId"]==operation["proposalId"],
                "failed execution changed the queued Civic operation")
        require(verifyCustody("after native Civic Timelock denial")==unifiedCustody,
                "Civic activation or denied execution diverted funded native reserves")
        await_ts_block(11,denial_block["hash"])
        _,governance_events=getter(ts_origin,"/v1/protocols/events?chainId=420&protocol=420Governance")
        require(any(row["eventName"]=="CivicProposalStateChanged"
                    and row["fields"].get("proposalId","").lower()==operation["proposalId"].lower()
                    and str(row["fields"].get("newState"))=="4"
                    for row in governance_events["data"]["items"]),
                "TypeScript Indexer omitted the queued Civic proposal transition")
        ready(lambda:getter("http://127.0.0.1:18782","/v1/health")[1]["health"]["indexedHeight"]>=11,
              idx,timeout=60)
        code,civic_view=getter("http://127.0.0.1:18783","/v1/transactions/"+denied["transactionHash"])
        require(code==200 and civic_view["receipt"]["blockHash"].lower()==denial_block["hash"].lower(),
                "Go Explorer missed the canonical rejected Civic execution")
        (args.workdir/"native-civic-lifecycle.json").write_text(json.dumps({
            "proposalId":operation["proposalId"],"executeAfter":operation["executeAfter"],
            "canonicalReceipts":civic_receipts,"typescriptGovernanceEvents":governance_events,
            "preDelayDeniedReceipt":denied,"goExplorerDeniedExecution":civic_view,
            "nativePostDelayExecutionQualified":False,
        },indent=2,sort_keys=True)+"\n")
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
             "fifteenProtectedValidatorProcesses":True,
             "fifteenIndependentRemoteBLSSignerProcesses":True,
             "noFixtureProducedCertificates":True,
             "verifiedSignedProposalAndQuorumReceipts":committee.signing_evidence,
             "walletRealSignedEip1559ReceiptVerified":True,
             "goIndexerAndExplorerProcessRestartQualified":True,
              "nativeGethAndCertifiedSettlementHardStopRecoveryQualified":True,
              "allConsumersRejoinedPersistedCanonicalPostgresAfterHardStop":True,
              "unauthenticatedEngineMutationRejectedAfterRecovery":True,
             "singleCanonicalLedger":True,"walletBrowserTransactionQualified":True,
             "browserReal420IDCentralAndWalletGateway":True,
             "browserActualGethProposalTx":browser_proposal["proposalTxHash"],
             "browserActualGethVoteTx":ballot_intent["txHash"],
             "browserNativeCivicVoteBlockHash":block5["hash"],
             "browserCivicVoteAfterSecondGethHardStopRecovered":True,
             "browserNativeConsensusCheckpointAfterRecovery":5,
             "browserCivicVoteCanonicalExplorerPostgresRecovered":True,
             "browserFinalNativeCertifiedExecutionBlock":5,
             "civicTimelockDeniedEarlyExecutionBlock":11,
             "civicTimelockNativePostDelayExecutionQualified":False,
             "browserRealEIP1193SignedGovernanceVote":True,
             "browserAccountSwitchAndRevocationRejected":True,
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
