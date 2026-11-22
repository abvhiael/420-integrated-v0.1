#!/usr/bin/env python3
"""GOV-PRE-08: materialize actual vesting constructor runtime and storage for local Genesis.

Two completely ephemeral Anvil nodes: an earlier-time constructor simulator, and
the 31337 42m source-funded local Genesis. The helper deploys the real Solidity
constructor, copies its exact EVM runtime and declared static storage into the
funded frozen 0x0427 account using *Anvil dev-only RPC*. No network keys, live
beneficiaries, contract signatures, release approvals or on-chain claim proofs.
"""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import json
import re
import subprocess
import urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
SPEC=importlib.util.spec_from_file_location("gov_pre_08_local_funding",
                                           Path(__file__).with_name("materialize-local-funding.py"))
funding=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(funding)
plan=funding.plan
VEST="0x0000000000000000000000000000000000000427"
TIMELOCK="0x0000000000000000000000000000000000000429"

def encoded_uint(value):
    return int(value).to_bytes(32,"big").hex()

def encoded_address(value):
    plan.require(plan.ADDRESS.fullmatch(value),"invalid constructor address")
    return encoded_uint(int(value,16))

class Rpc:
    def __init__(self,url):
        plan.require(re.fullmatch(r"http://127[.]0[.]0[.]1:[0-9]{3,5}",url),
                     "local vesting fixture must never touch a remote or production RPC")
        self.url=url
        self.id=0
    def call(self,method,params):
        self.id+=1
        request=urllib.request.Request(self.url,
             data=json.dumps({"jsonrpc":"2.0","id":self.id,"method":method,"params":params}).encode(),
             headers={"Content-Type":"application/json"})
        with urllib.request.urlopen(request,timeout=20) as response:
            result=json.loads(response.read())
        plan.require("error" not in result,method+" failed: "+str(result.get("error")))
        return result["result"]

def signature(sig):
    return subprocess.check_output(["cast","sig",sig],text=True).strip()

def assert_call(rpc,contract,sig,args,expected):
    data=signature(sig)+ "".join(encoded_uint(arg) for arg in args)
    result=rpc.call("eth_call",[{"to":contract,"data":data},"latest"])
    plan.require(isinstance(result,str) and result.startswith("0x"),"invalid EVM call "+sig)
    plan.require(int(result,16)==expected,"constructor storage/immutable mismatch: "+sig)

def materialize(constructor_rpc_url,genesis_rpc_url,root=ROOT):
    root=Path(root)
    candidate=plan.make_candidate(root,with_artifacts=False)
    genesis,evidence=funding.make_local(root)
    helper=Rpc(constructor_rpc_url)
    target=Rpc(genesis_rpc_url)
    plan.require(int(helper.call("eth_chainId",[]),16)==31337
                 and int(target.call("eth_chainId",[]),16)==31337,
                 "wrong local Anvil chain or network")
    timestamp=funding.LOCAL_TIMESTAMP
    block=helper.call("eth_getBlockByNumber",["latest",False])
    plan.require(int(block["timestamp"],16)<timestamp,
                 "constructor simulator must run before synthetic Genesis vesting epoch")
    beneficiaries=[x["address"].lower() for x in evidence["localWallets"]]
    artifact_path=root/"contracts/out/FounderVestingRegistry.sol/FounderVestingRegistry.json"
    plan.require(artifact_path.is_file(),"compile real FounderVestingRegistry artifact first")
    a=json.loads(artifact_path.read_text())
    abi=a["abi"]
    constructors=[x for x in abi if x["type"]=="constructor"]
    plan.require(len(constructors)==1 and
                 [x["type"] for x in constructors[0]["inputs"]]==
                 ["address","address[3]","uint64"],
                 "FounderVestingRegistry actual constructor ABI drift")
    layout=a.get("storageLayout",{})
    plan.require(isinstance(layout.get("storage"),list) and
                 {x.get("label") for x in layout["storage"]}=={"grants","totalLockedClaimed"},
                 "vesting constructor layout drift")
    code=a["bytecode"]["object"]
    plan.require(re.fullmatch(r"0x[0-9a-fA-F]+",code) and len(code)>4,
                 "missing linked constructor bytecode")
    args=encoded_address(TIMELOCK)+"".join(encoded_address(x) for x in beneficiaries)+encoded_uint(timestamp)
    sender=helper.call("eth_accounts",[])[0]
    plan.require(plan.ADDRESS.fullmatch(sender),"missing local unlocked Anvil deployer")
    # Fresh disposable constructor fixture only. No private keys or credentials stored.
    helper.call("anvil_setBalance",[sender,hex(100*10**18)])
    tx=helper.call("eth_sendTransaction",[{
        "from":sender,"data":code+args,"gas":hex(12_000_000),
    }])
    receipt=helper.call("eth_getTransactionReceipt",[tx])
    plan.require(receipt and int(receipt["status"],16)==1,
                 "real constructor EVM deployment failed")
    deployed=receipt["contractAddress"]
    plan.require(plan.ADDRESS.fullmatch(deployed),"missing real local constructor receipt")
    runtime=helper.call("eth_getCode",[deployed,"latest"])
    plan.require(re.fullmatch(r"0x[0-9a-fA-F]+",runtime) and len(runtime)>4,
                 "constructor did not produce executable runtime")
    plan.require(len(runtime[2:])//2<=24576,"constructor runtime violates EIP-170")
    plan.require(target.call("eth_getCode",[VEST,"latest"])=="0x",
                 "Genesis predeploy already contains unexpected code")
    balanceBefore=int(target.call("eth_getBalance",[VEST,"latest"]),16)
    plan.require(balanceBefore==500000*plan.KIEF,
                 "vesting Genesis balance does not match revised 500k funding")
    # Constructor's compiled static layout is explicitly checked above; copy 16
    # declared/adjacent static slots (including zero defaults) from actual EVM.
    storage={}
    target.call("anvil_setCode",[VEST,runtime])
    for index in range(16):
        slot="0x"+format(index,"064x")
        value=helper.call("eth_getStorageAt",[deployed,slot,"latest"])
        plan.require(re.fullmatch(r"0x[0-9a-fA-F]{64}",value),
                     "invalid actual EVM storage word")
        target.call("anvil_setStorageAt",[VEST,slot,value])
        storage[slot]=value
    plan.require(target.call("eth_getCode",[VEST,"latest"]).lower()==runtime.lower(),
                 "Genesis code differ from constructor-deployed runtime")
    for slot,value in storage.items():
        plan.require(target.call("eth_getStorageAt",[VEST,slot,"latest"]).lower()==value.lower(),
                     "Genesis constructor slot mismatch: "+slot)
    for idx,address in enumerate(beneficiaries):
        calldata=signature("grants(uint256)")+encoded_uint(idx)
        out=target.call("eth_call",[{"to":VEST,"data":calldata},"latest"])
        words=[int(out[2+i*64:2+(i+1)*64],16) for i in range(3)]
        plan.require(words==[int(address,16),timestamp,0],
                     "invalid claimant/genesis start/claimed constructor state")
        assert_call(target,VEST,"lockedAllocation(uint256)",[idx],
                    ([250000,125000,125000][idx])*plan.KIEF)
    assert_call(target,VEST,"governanceTimelock()",[],int(TIMELOCK,16))
    assert_call(target,VEST,"protocolVersion()",[],2)
    assert_call(target,VEST,"totalLockedClaimed()",[],0)
    assert_call(target,VEST,"FOUNDER_COUNT()",[],3)
    assert_call(target,VEST,"TOTAL_LOCKED_ALLOCATION()",[],500000*plan.KIEF)
    plan.require(int(target.call("eth_getBalance",[VEST,"latest"]),16)==balanceBefore,
                 "constructor materialization changed funded Genesis balance")
    runtime_hash=subprocess.check_output(["cast","keccak",runtime],text=True).strip().lower()
    return {
        "schema":"420-gov-pre-08-local-vesting-materialization-v1",
        "status":"SYNTHETIC_SOURCE_CONSTRUCTOR_AND_FUNDED_PREDEPLOY_QUALIFIED_LOCAL_ONLY",
        "exactSourceCommit":candidate["exactSourceCommit"],
        "unsignedV4CandidateHash":candidate["proposedV4"]["genesisConfigHash"],
        "realConstructorExecutedOnDisposableLocalChain":True,
        "constructorTransactionHashLocal":tx,
        "constructorReceiptAddressLocal":deployed,
        "fixedLocalGenesisPredeploy":VEST,
        "fixedGovernanceTimelockImmutable":TIMELOCK,
        "syntheticFounderWallets":beneficiaries,
        "syntheticGenesisTimestamp":timestamp,
        "runtimeCodeHashKeccak256":runtime_hash,
        "runtimeCodeBytes":(len(runtime)-2)//2,
        "abiSha256":plan.digest(abi),
        "storageLayoutSha256":plan.digest(layout),
        "storageWords":storage,
        "storageWordsSha256":plan.digest(storage),
        "nativeVestingBalanceWei":str(balanceBefore),
        "sourceGenerationOnly":True,
        "signedV4Approved":False,
        "founderWalletOwnershipVerified":False,
        "mainnetOrTestnetRuntimeVerified":False,
        "foundingTreasuryVaultsFunded":False,
    }

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--constructor-rpc",default="http://127.0.0.1:18546")
    p.add_argument("--genesis-rpc",default="http://127.0.0.1:18545")
    p.add_argument("--output",type=Path,required=True)
    args=p.parse_args()
    try:
        plan.require(not args.output.exists(),"refusing to replace retained runtime evidence")
        result=materialize(args.constructor_rpc,args.genesis_rpc)
        args.output.parent.mkdir(parents=True,exist_ok=True)
        args.output.write_text(json.dumps(result,indent=2,sort_keys=True)+"\n")
        print("GOV-PRE-08 LOCAL VESTING CONSTRUCTOR + FUNDED 0x0427=PASS; LIVE V4=NOT APPROVED")
    except (ValueError,KeyError,IndexError,TypeError,OSError,subprocess.CalledProcessError) as exc:
        p.exit(1,"GOV-PRE-08 LOCAL VESTING FAIL-CLOSED: "+str(exc)+"\n")

if __name__=="__main__":
    main()
