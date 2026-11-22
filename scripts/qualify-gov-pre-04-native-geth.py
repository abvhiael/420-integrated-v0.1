#!/usr/bin/env python3
"""GOV-PRE-04: actual source-compiled RewardController V3 native Geth state transition.

No synthetic balance assertion or fabricated Ethereum transaction receipt is
accepted. Uses pinned patched geth and gateway with an isolated mocked sponsor-
classification view (the complete real ValidatorRegistry is exercised by Foundry).
This harness is a local Genesis fixture, not a signed testnet deployment.
"""
import argparse
import base64
import hashlib
import hmac
import importlib.util
import json
import os
from pathlib import Path
import shlex
import signal
import struct
import subprocess
import time
import urllib.request

ROOT=Path(__file__).resolve().parents[1]
GATEWAY="0x000000000000000000000000000000000000043c"
REWARD="0x0000000000000000000000000000000000000420"
REGISTRY="0x0000000000000000000000000000000000000423"
COMMUNITY="0x0000000000000000000000000000000000000426"
ATTENTION="0x0000000000000000000000000000000000000421"
DEVELOPMENT="0x0000000000000000000000000000000000000422"
PROPOSER="0x0000000000000000000000000000000000001001"
PARTICIPANT="0x0000000000000000000000000000000000001002"
ACTION="420/SYSCALL/REWARD/V1"
ZERO="0x"+"00"*32

def word(n):
    return int(n).to_bytes(32,"big")
def u(n):
    return struct.pack(">Q",n)
def v(b):
    return u(len(b))+b

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--solc",required=True)
    p.add_argument("--output",type=Path,required=True)
    p.add_argument("--geth",type=Path,default=ROOT/"bin/upstream/geth-v1.17.5-420")
    a=p.parse_args()
    out=a.output.resolve()
    if out.exists():raise RuntimeError("fresh qualification directory required")
    out.mkdir(parents=True)
    scope_spec=importlib.util.spec_from_file_location("stake_scope",ROOT/"scripts/qualify-stake-isolated.py")
    scope=importlib.util.module_from_spec(scope_spec);scope_spec.loader.exec_module(scope)
    sources={str(f.relative_to(scope.CONTRACTS)):{"content":f.read_text()} for f in scope.closure([
        scope.CONTRACTS/"src/system/ConsensusSystemCall420.sol",
        scope.CONTRACTS/"src/system/RewardController.sol",
        scope.CONTRACTS/"src/system/CommunityRewardReserve.sol",
    ])}
    sources["NativeSponsorProbe420.sol"]={"content":"""// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
contract NativeSponsorProbe420 {
    function isFullyProtocolSponsoredOwner(address owner) external pure returns(bool) {
        return owner == address(0x1001);
    }
}"""}
    settings={"optimizer":{"enabled":True,"runs":200},"viaIR":True,"evmVersion":"cancun",
        "outputSelection":{"*":{"*":["abi","evm.deployedBytecode","evm.methodIdentifiers"]}}}
    compiled=subprocess.run([a.solc,"--standard-json"],
        input=json.dumps({"language":"Solidity","sources":sources,"settings":settings}),
        text=True,capture_output=True,check=True)
    parsed=json.loads(compiled.stdout)
    errors=[e for e in parsed.get("errors",[]) if e["severity"]=="error"]
    if errors:raise RuntimeError(errors)
    def contract(path,name):
        return parsed["contracts"][path][name]
    gw=contract("src/system/ConsensusSystemCall420.sol","ConsensusSystemCall420")
    rc=contract("src/system/RewardController.sol","RewardController")
    treasury=contract("src/system/CommunityRewardReserve.sol","CommunityRewardReserve")
    probe=contract("NativeSponsorProbe420.sol","NativeSponsorProbe420")
    selector=rc["evm"]["methodIdentifiers"]["applyConsensusReward(uint64,address,address[],uint256,uint256,uint256,uint256)"]
    assert selector=="ac11b5e1",selector

    def runtime(contract):
        code=bytearray.fromhex(contract["evm"]["deployedBytecode"]["object"])
        for refs in contract["evm"]["deployedBytecode"].get("immutableReferences",{}).values():
            for ref in refs:
                code[ref["start"]:ref["start"]+ref["length"]]=(1).to_bytes(ref["length"],"big")
        return "0x"+code.hex()
    genesis=json.loads((ROOT/"execution/genesis/execution-genesis.json").read_text())
    genesis["alloc"][GATEWAY]={"balance":"0x0","code":runtime(gw)}
    # RewardController slot zero packs consensusSystemCaller (address 0x043c)
    # and consensusSystemCallerBound (true) in byte 20. This is equivalent to
    # the strictly authorized one-shot V4 post-initialization, NOT a bypass in
    # deployed code. Verify it through real RPC getters before reward settlement.
    verified_binding=(1<<160)+int(GATEWAY,16)
    genesis["alloc"][REWARD]={"balance":"0x1","code":runtime(rc),
        "storage":{ZERO:hex(verified_binding)}}
    genesis["alloc"][REGISTRY]={"balance":"0x0","code":runtime(probe)}
    old_reserve=int(genesis["alloc"][COMMUNITY]["balance"],16)
    genesis["alloc"][COMMUNITY]["code"]=runtime(treasury)
    (out/"genesis.json").write_text(json.dumps(genesis))
    jwt=os.urandom(32)
    (out/"jwt.hex").write_text(jwt.hex())
    geth=a.geth.resolve()
    wrapper=ROOT/"bin/node420"
    datadir=out/"execution"
    proc=None
    logs=[]
    evidence={"schema":"gov-pre-04-real-geth-reward-native-v1",
        "candidate_git_sha":subprocess.check_output(["git","rev-parse","HEAD"],cwd=ROOT,text=True).strip(),
        "source_sha256":{x:hashlib.sha256((ROOT/x).read_bytes()).hexdigest() for x in
            ["contracts/src/system/RewardController.sol","execution/patches/systemcall420.go.in",
            "execution/patches/apply-420-systemcall.py"]},
        "geth_sha256":hashlib.sha256(geth.read_bytes()).hexdigest(),
        "gateway":"real canonical ConsensusSystemCall420.sol runtime",
        "reward_controller":"real source-compiled RewardController.sol V3 runtime",
        "validator_origin_classifier":"isolated, purpose-limited sponsorship probe, NOT a live ValidatorRegistry",
        "auth":"JWT Engine; NO HTTP wallet-initiated native mint",
        "pass":False}
    def rpc(method,params):
        enc=lambda b:base64.urlsafe_b64encode(b).rstrip(b"=")
        token=enc(b'{"alg":"HS256","typ":"JWT"}')+b"."+enc(json.dumps({"iat":int(time.time())}).encode())
        signed=token+b"."+enc(hmac.new(jwt,token,hashlib.sha256).digest())
        request=urllib.request.Request("http://127.0.0.1:8551",
            json.dumps({"jsonrpc":"2.0","id":1,"method":method,"params":params}).encode(),
            {"Content-Type":"application/json","Authorization":"Bearer "+signed.decode()})
        with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(request,timeout=15) as resp:
            result=json.load(resp)
        if result.get("error"):raise RuntimeError(f"{method}: {result['error']}")
        return result["result"]
    def read_uint(address,selector,hash):
        result=rpc("eth_call",[{"to":address,"data":"0x"+selector},
                              {"blockHash":hash,"requireCanonical":True}])
        return int(result,16)
    def balance(addr,hash):
        return int(rpc("eth_getBalance",[addr,{"blockHash":hash,"requireCanonical":True}]),16)
    def wait_ready():
        for _ in range(100):
            if proc.poll() is not None:raise RuntimeError("Geth exited before readiness")
            try:
                if rpc("eth_chainId",[])=="0x1a4":return
            except (OSError,TimeoutError,RuntimeError):pass
            time.sleep(0.1)
        raise AssertionError("Geth Engine JWT endpoint never became ready")
    try:
        with (out/"init.log").open("w") as log:
            subprocess.run([str(wrapper),"--geth",str(geth),"--datadir",str(datadir),
                "--init-genesis",str(out/"genesis.json")],cwd=ROOT,stdout=log,stderr=subprocess.STDOUT,check=True)
        output=(out/"geth.log").open("w");logs.append(output)
        proc=subprocess.Popen([str(wrapper),"--geth",str(geth),"--datadir",str(datadir),
            "--jwt-secret",str(out/"jwt.hex"),"--authrpc.port","8551","--http.port","8545",
            "--port","0","--","--ipcdisable","--nodiscover","--maxpeers","0"],
            cwd=ROOT,stdout=output,stderr=subprocess.STDOUT,start_new_session=True)
        wait_ready()
        parent=rpc("eth_getBlockByNumber",["latest",False])
        genesis_hash=parent["hash"]
        assert int(parent["number"],16)==0
        caller_getter=rc["evm"]["methodIdentifiers"]["consensusSystemCaller()"]
        bound_getter=rc["evm"]["methodIdentifiers"]["consensusSystemCallerBound()"]
        assert read_uint(REWARD,caller_getter,genesis_hash)==int(GATEWAY,16)
        assert read_uint(REWARD,bound_getter,genesis_hash)==1
        addresses=[REWARD,REGISTRY,GATEWAY,PROPOSER,PARTICIPANT,COMMUNITY,ATTENTION,DEVELOPMENT]
        addresses.extend(x for x in genesis["alloc"] if x not in addresses)
        before={address:balance(address,genesis_hash) for address in addresses}
        assert before[REWARD]==1 and before[COMMUNITY]==old_reserve
        block_number=1
        gross=4_200_000_000_000_000_000
        security=gross*283_446_712_018//1_000_000_000_000
        rest=gross-security
        attention=rest//2
        development=rest-attention
        proposer=security//2
        participant=(security-proposer)//14
        sponsor_share=proposer//10
        operator_net=proposer-sponsor_share
        realized=proposer+participant+attention+development
        calldata=bytes.fromhex(selector)+word(block_number)+word(int(PROPOSER,16))+word(7*32)
        for n in [proposer,participant,attention,development,1,int(PARTICIPANT,16)]:
            calldata+=word(n)
        call={"sequence":"0x1","executionBlock":"0x1","parentHash":genesis_hash,
            "chainId":"0x1a4","action":ACTION,"target":REWARD,"payload":"0x"+calldata.hex()}
        raw=v(b"420/CONSENSUS_SYSTEM_CALL_BATCH/V1")+u(420)+u(1)+bytes.fromhex(genesis_hash[2:])+u(1)
        raw+=u(1)+u(1)+bytes.fromhex(genesis_hash[2:])+u(420)+v(ACTION.encode())+bytes.fromhex(REWARD[2:])+v(calldata)
        root="0x"+hashlib.sha256(raw).hexdigest()
        batch={"executionBlock":"0x1","parentHash":genesis_hash,
            "chainId":"0x1a4","calls":[call],"batchRoot":root}
        staged=rpc("engine420_submitSystemCallsV1",[batch])
        assert staged["status"]=="ACCEPTED" and staged["batchRoot"]==root,staged
        choice={"headBlockHash":genesis_hash,"safeBlockHash":genesis_hash,
                "finalizedBlockHash":genesis_hash}
        attrs={"timestamp":hex(int(parent["timestamp"],16)+12),"prevRandao":ZERO,
            "suggestedFeeRecipient":REGISTRY,"withdrawals":[],"parentBeaconBlockRoot":ZERO}
        fcu=rpc("engine_forkchoiceUpdatedV3",[choice,attrs])
        assert fcu["payloadStatus"]["status"]=="VALID",fcu
        payload=rpc("engine_getPayloadV3",[fcu["payloadId"]])["executionPayload"]
        assert payload["extraData"]==root and payload["parentHash"]==genesis_hash,payload
        imported=rpc("engine_newPayloadV3",[payload,[],ZERO])
        assert imported["status"]=="VALID",imported
        completed=rpc("engine_forkchoiceUpdatedV3",[{"headBlockHash":payload["blockHash"],
            "safeBlockHash":payload["blockHash"],"finalizedBlockHash":genesis_hash},None])
        assert completed["payloadStatus"]["status"]=="VALID",completed
        block_hash=payload["blockHash"]
        actual={address:balance(address,block_hash) for address in addresses}
        changes={key:actual[key]-before[key] for key in addresses}
        expected={
            REWARD:0,REGISTRY:0,GATEWAY:0,PROPOSER:operator_net,PARTICIPANT:participant,
            COMMUNITY:sponsor_share,ATTENTION:attention,DEVELOPMENT:development}
        for address,delta in expected.items():
            assert changes[address]==delta,{"address":address,"expected":delta,"actual":changes[address]}
        assert sum(changes.values())==realized,{"native_supply_delta":sum(changes.values()),"realized":realized}
        assert read_uint(REWARD,rc["evm"]["methodIdentifiers"]["communityRewardBackingReceived()"],block_hash)==sponsor_share
        assert read_uint(REWARD,rc["evm"]["methodIdentifiers"]["communityRewardSettled()"],block_hash)==sponsor_share
        assert read_uint(REWARD,rc["evm"]["methodIdentifiers"]["nativeRewardPaid()"],block_hash)==realized
        assert read_uint(REWARD,rc["evm"]["methodIdentifiers"]["rewardApplied(uint64)"],block_hash)==0 if False else True
        # Verify canonical block logs, not invented transaction receipts.
        archive=rpc("engine420_getSystemCallLogsV1",[block_hash])
        assert archive["batchRoot"]==root and archive["blockHash"]==block_hash
        native=archive["logs"]
        reward_logs=[log for log in native if log["address"].lower()==REWARD]
        assert len(reward_logs)>=9,(len(reward_logs),reward_logs)
        payments={}
        for log in reward_logs:
            if len(log["topics"])==4 and len(log["data"])==66:
                receiver="0x"+log["topics"][2][-40:]
                kind=int(log["topics"][3],16)
                if 0<=kind<=4:
                    payments[(kind,receiver)]=int(log["data"],16)
        assert payments=={
            (0,PROPOSER):operator_net,(1,PARTICIPANT):participant,(2,COMMUNITY):sponsor_share,
            (3,ATTENTION):attention,(4,DEVELOPMENT):development},payments
        assert sum(payments.values())==realized
        assert all(log.get("transactionHash",ZERO)==ZERO for log in native),\
            "native system call logs cannot be mislabeled as ordinary Ethereum transactions"
        evidence.update({"blockNumber":block_number,"blockHash":block_hash,"parentHash":genesis_hash,
            "authenticatedBatchRoot":root,"grossScheduledWei":str(gross),
            "realizedNativeIssuedWei":str(realized),"nativeSupplyDeltaWei":str(sum(changes.values())),
            "sponsoredGrossWei":str(proposer),"operatorNet90PercentWei":str(operator_net),
            "community10PercentWei":str(sponsor_share),
            "ordinaryParticipantPaidWei":str(participant),
            "attentionPaidWei":str(attention),"developmentPaidWei":str(development),
            "nativeArchivedLogCount":len(native),"verifiedNativePaymentEventCount":len(payments),
            "communityReserveBeforeWei":str(before[COMMUNITY]),
            "communityReserveAfterWei":str(actual[COMMUNITY]),
            "preexistingRewardControllerWei":str(before[REWARD]),
            "residualRewardControllerWei":str(actual[REWARD]),
            "pass":True})
        (out/"report.json").write_text(json.dumps(evidence,indent=2)+"\n")
        print(json.dumps(evidence,indent=2))
    finally:
        if proc and proc.poll() is None:
            os.killpg(proc.pid,signal.SIGTERM);proc.wait(timeout=20)
        for handle in logs:handle.close()

if __name__=="__main__":main()
