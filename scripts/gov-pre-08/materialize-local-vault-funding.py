#!/usr/bin/env python3
"""GOV-PRE-08 Step 2: real Anvil RPC receipts for local 42m native reserve-to-Vault funding.

This augments (does not replace) the fourteen-contract Foundry deployment graph.
Runs ONLY on explicitly disposable loopback Anvil chain 31337 with the canonical
UNSIGNED synthetic local Genesis. 0x0424 executable code is a constructor-built
Anvil-only materialization; 0x0429 Timelock transactions are impersonated LOCAL
authorization fixtures.  Both are prohibited as live-chain authority evidence.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
KIEF = 10**18
TIME = "0x0000000000000000000000000000000000000429"
PROTO = "0x0000000000000000000000000000000000000424"
OPS_AMOUNT = 4_200_000*KIEF
CONT_AMOUNT = 840_000*KIEF
TOTAL = 42_000_000*KIEF
ADDRESS = re.compile(r"0x[0-9a-fA-F]{40}\Z")


def need(condition, message):
    if not condition:
        raise ValueError(message)


def cast(*args):
    return subprocess.check_output(("cast", *map(str, args)), text=True).strip()


def keccak_bytes(source):
    return cast("keccak", "0x" + source.encode("utf-8").hex()).lower()


def calldata(signature, *args):
    return cast("calldata", signature, *args)


class Rpc:
    def __init__(self, url):
        need(re.fullmatch(r"http://127[.]0[.]0[.]1:[0-9]{3,5}", url) is not None,
             "refusing all non-loopback Anvil endpoints")
        self.url = url
        self.n = 0

    def call(self, method, params):
        self.n += 1
        data=json.dumps({"jsonrpc": "2.0","id":self.n,"method":method,"params":params}).encode()
        req=urllib.request.Request(self.url,data=data,headers={"Content-Type":"application/json"})
        with urllib.request.urlopen(req,timeout=20) as response:
            x=json.loads(response.read())
        need("error" not in x, method+" failed: "+str(x.get("error")))
        return x["result"]

    def balance(self, who):
        return int(self.call("eth_getBalance",[who,"latest"]),16)

    def code(self, who):
        return self.call("eth_getCode",[who,"latest"]).lower()

    def read(self, contract,signature,*args):
        return self.call("eth_call",[{"to":contract,"data":calldata(signature,*args)},"latest"])

    def send(self, sender, to=None, data=None, amount=0, tag=None):
        payload={"from":sender,"gas":hex(12_000_000),"gasPrice":"0x0"}
        if to is not None: payload["to"]=to
        if data is not None: payload["data"]=data
        if amount: payload["value"]=hex(amount)
        tx=self.call("eth_sendTransaction",[payload])
        receipt=None
        for attempt in range(100):
            receipt=self.call("eth_getTransactionReceipt",[tx])
            if receipt is not None: break
            time.sleep(0.1)
        need(receipt is not None and int(receipt["status"],16)==1,
             "actual local transaction reverted or not mined: "+
             json.dumps({"tag":tag,"tx":tx,"receipt":receipt}))
        need(int(receipt["blockNumber"],16)>=1 and receipt["blockHash"]!="0x"+"0"*64,
             "transaction has no mined block")
        return {
            "tag":tag,"tx":tx,"blockHash":receipt["blockHash"],
            "blockNumber":int(receipt["blockNumber"],16),
            "contractAddress":receipt.get("contractAddress"),
            "gasUsed":int(receipt["gasUsed"],16),
            "logs":receipt["logs"],
        }


def artifact(root, name):
    path=root/"contracts/out"/(name+".sol")/(name+".json")
    need(path.is_file(),"actual Foundry Solidity artifact absent: "+str(path))
    data=json.loads(path.read_text())
    code=data["bytecode"]["object"]
    need(re.fullmatch(r"0x[0-9a-fA-F]+",code) is not None
         and len(code)>10, "invalid creation code: "+name)
    need(not data["bytecode"].get("linkReferences"),"unlinked libraries in "+name)
    return code


def encoded_args(signature, *args):
    return cast("abi-encode",signature,*args)[2:]


def bytecode(root, name, signature, *args):
    return artifact(root,name)+encoded_args(signature,*args)


def native_allocations(root):
    # Same on-disk generator validated separately by test_funding.py.
    genesis=json.loads((root/"contracts/test/fixtures/gov-pre-08-local-wallets.json").read_text())
    need(genesis["network"]=="UNOWNED_LOCAL_REHEARSAL_ONLY" and genesis["chainId"]==31337,
         "founder identity fixture must be unowned/local-only")
    founders=[x["address"].lower() for x in genesis["wallets"]]
    need(len(founders)==3 and len(set(founders))==3,"invalid 3-owner local identity fixture")
    return founders


def run(url,root=ROOT):
    root=Path(root)
    r=Rpc(url)
    need(int(r.call("eth_chainId",[]),16)==31337,"wrong local chain")
    founders=native_allocations(root)
    initial={
        "0x0000000000000000000000000000000000000421":4_200_000,
        "0x0000000000000000000000000000000000000422":4_200_000,
        PROTO:8_600_000,
        "0x0000000000000000000000000000000000000425":6_300_000,
        "0x0000000000000000000000000000000000000426":2_100_000,
        "0x0000000000000000000000000000000000000427":500_000,
        "0x000000000000000000000000000000000000042a":12_600_000,
        "0x000000000000000000000000000000000000042e":3_000_000,
        founders[0]:250_000,founders[1]:125_000,founders[2]:125_000,
    }
    need(len(initial)==11 and sum(initial.values())==42_000_000, "bad native V4-shaped ledger")
    for address,amount in initial.items():
        need(r.balance(address)==amount*KIEF,"unexpected Genesis custody "+address)
    need(r.code(PROTO)=="0x","unexpected preexisting protocol reserve code")
    creator=r.call("eth_accounts",[])[0]
    need(ADDRESS.fullmatch(creator) is not None and r.balance(creator)==0,
         "local account must start unfunded: avoid extra $420 supply")

    transactions=[]
    def deploy(name,signature,*args):
        tx=r.send(creator,data=bytecode(root,name,signature,*args),tag="deploy:"+name)
        address=tx["contractAddress"]
        need(address is not None and ADDRESS.fullmatch(address) and r.code(address)!="0x",
             "constructor failed to produce "+name)
        transactions.append(tx)
        return address

    # Real constructor runtime, copied solely to the existing 0x0424 namespace
    # by an Anvil-specific method, not a new/fake predeploy address.
    protoCandidate=deploy("ProtocolReserve","constructor(address)",TIME)
    runtime=r.code(protoCandidate)
    need(len(runtime)>4,"no actual protocol reserve constructor runtime")
    r.call("anvil_setCode",[PROTO,runtime])
    need(r.code(PROTO)==runtime and r.balance(PROTO)==8_600_000*KIEF,
         "predeploy runtime/funding mismatch")
    need(int(r.read(PROTO,"governanceTimelock()"),16)==int(TIME,16),
         "ProtocolReserve immutable timelock drift")

    capabilities=deploy("CapabilityRegistry420","constructor()")
    vAuth=deploy("VaultAuthorization420","constructor(address)",capabilities)
    vPolicy=deploy("VaultPolicyRegistry420","constructor(address)",TIME)
    vRegistry=deploy("VaultRegistry420","constructor(address,address)",vAuth,vPolicy)
    accounting=deploy("VaultAccounting420","constructor(address)",vRegistry)

    # Timelock authorization is local Anvil impersonation only, not a signed vote.
    r.call("anvil_impersonateAccount",[TIME])
    policyKinds=("AUTHORIZATION","ASSET","RELEASE","ACCOUNTING")
    policyIds={}
    for kind in policyKinds:
        name="GOV-PRE-08/LOCAL-ONLY/"+kind+"-POLICY"
        policyId=keccak_bytes(name)
        kindId=keccak_bytes("420/VAULT/POLICY/"+kind+"/V1")
        tx=r.send(TIME,vPolicy,calldata("setPolicy(bytes32,bytes32,bytes32,bytes32,bool)",
                          policyId,kindId,policyId,keccak_bytes("GOVPRE08/LOCAL/METADATA"),"true"),
                  tag="policy:"+kind)
        transactions.append(tx)
        need(int(r.read(vPolicy,"isActiveOfType(bytes32,bytes32)",policyId,kindId),16)==1,
             "actual Vault policy inactive")
        policyIds[kind]=policyId

    vaults={}
    vaultIds={}
    for typ,kind in (("OPERATIONS","TREASURY"),("CONTINGENCY","TREASURY"),("COMMUNITY","COMMUNITY")):
        vaultId=keccak_bytes("GOV-PRE-08/LOCAL-ONLY/"+typ+"/VAULT")
        vaultType=keccak_bytes("420/VAULT/TYPE/"+kind+"/V1")
        addr=deploy("AssetVault420","constructor(bytes32,address,address,address,address)",
                    vaultId,vRegistry,vAuth,accounting,creator)
        vaults[typ]=addr
        vaultIds[typ]=vaultId
        tx=r.send(creator,vRegistry,calldata(
            "registerVault(bytes32,address,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32)",
            vaultId,addr,vaultType,policyIds["AUTHORIZATION"],policyIds["ASSET"],
            policyIds["RELEASE"],policyIds["ACCOUNTING"],
            "0x"+"0"*64,keccak_bytes("GOVPRE08/LOCAL/METADATA"),keccak_bytes("GOVPRE08/LOCAL/UNSIGNED")),
            tag="register:"+typ)
        transactions.append(tx)
        word=r.read(vRegistry,"getVault(bytes32)",vaultId)[2:66]
        need(int(word,16)==int(addr,16),"Vault Registry pointer mismatch "+typ)

    before=r.balance(PROTO)
    need(before==8_600_000*KIEF,"incorrect pre-funding reserve")
    counts={}
    for name,amount in (("OPERATIONS",OPS_AMOUNT),("CONTINGENCY",CONT_AMOUNT)):
        tx=r.send(TIME,PROTO,calldata("treasuryTransfer(address,uint256,bytes32)",
                   vaults[name],amount,keccak_bytes("GOV/PRE08/"+name)),tag="fund:"+name)
        transactions.append(tx)
        # Three authentic events: ProtocolReserve treasuryTransfer, AssetVault native
        # deposit, VaultAccounting deposit-recorded. All in one mined receipt.
        expected=[
            (PROTO,keccak_bytes("TreasuryTransfer(address,uint256,bytes32)")),
            (vaults[name],keccak_bytes("NativeDeposited(address,uint256)")),
            (accounting,keccak_bytes("DepositRecorded(bytes32,address,uint256,uint256)")),
        ]
        matches=[]
        for address,topic in expected:
            found=[log for log in tx["logs"] if log["address"].lower()==address.lower()
                   and log["topics"] and log["topics"][0].lower()==topic]
            need(len(found)==1,"missing/duplicate actual receipt event "+name+" "+address)
            matches.append(found[0])
        word=int(matches[0]["data"],16)
        need(word==amount,"incorrect ProtocolReserve transfer event value")
        recorded=[int(matches[2]["data"][2+i*64:2+(i+1)*64],16) for i in range(2)]
        need(recorded==[amount,amount],"accounting deposit event did not match custody")
        counts[name]=len(matches)
        need(r.balance(vaults[name])==amount,"asset not really held in Vault "+name)
        payload=r.read(accounting,"getAccounting(bytes32,address)",vaultIds[name],
                       "0x0000000000000000000000000000000000000000")
        words=[int(payload[2+i*64:2+(i+1)*64],16) for i in range(4)]
        need(words==[amount,0,0,0],"actual accounting state diverges from receipt "+name)
        need(int(r.read(accounting,"freeBalance(bytes32,address)",vaultIds[name],
                          "0x0000000000000000000000000000000000000000"),16)==amount,
             "native free balance does not reconcile "+name)

    need(r.balance(PROTO)==3_560_000*KIEF,"non-additive 3.56m protocol remainder violated")
    need(r.balance(vaults["COMMUNITY"])==0,"invented Community Vault funding")
    for name in ("OPERATIONS","CONTINGENCY"):
        need(int(r.read(accounting,"nonzeroAssetCount(bytes32)",vaultIds[name]),16)==1,
             "asset inventory unexpected "+name)

    # Verify all originally issued native balances remain conserved after genuine EVM
    # transfers, without treating a developer gas tank or ERC20 as extra issuance.
    output={a:r.balance(a) for a in initial}
    tracked=output | {vaults[name]:r.balance(vaults[name]) for name in vaults}
    need(sum(tracked.values())==TOTAL,"actual on-chain sum differs from 42m Genesis")
    need(r.balance(creator)==0 and r.balance(TIME)==0,
         "test configuration introduced extra native gas or funding authority")
    # Two independent permission boundaries must continue to reject unauthorised calls.
    for source,target,calldata_ in (
        (creator,PROTO,calldata("treasuryTransfer(address,uint256,bytes32)",
                        vaults["OPERATIONS"],1,keccak_bytes("GOVPRE08/UNAUTHORIZED"))),
        (creator,vaults["OPERATIONS"],calldata("withdraw(bytes32,address,address,uint256)",
                        keccak_bytes("GOVPRE08/UNAUTHORIZED"),"0x"+"0"*40,creator,1)),
    ):
        try:
            r.call("eth_call",[{"from":source,"to":target,"data":calldata_},"latest"])
        except ValueError:
            pass
        else:
            raise ValueError("unauthorized asset movement unexpectedly permitted")

    return {
        "schema":"GOV_PRE_08_STEP2_LOCAL_ANVIL_MINED_FUNDING_V1",
        "chainId":31337,
        "sourceGitHead":subprocess.check_output(["git","rev-parse","HEAD"],cwd=root,text=True).strip(),
        "signedGenesisV4Approved":False,
        "authenticFounderKeysOrSignatures":False,
        "productionTimelockExecution":False,
        "genesisAllocsSource":"scripts/gov-pre-08/materialize-local-funding.py",
        "initialNativeSupplyWei":str(TOTAL),
        "postFundingNativeSupplyWei":str(sum(tracked.values())),
        "protocolReserveBeforeWei":str(before),
        "protocolReserveAfterWei":str(r.balance(PROTO)),
        "operationsVaultBalanceWei":str(r.balance(vaults["OPERATIONS"])),
        "contingencyVaultBalanceWei":str(r.balance(vaults["CONTINGENCY"])),
        "communityVaultBalanceWei":str(r.balance(vaults["COMMUNITY"])),
        "vaultIds":vaultIds,
        "vaultAddresses":vaults,
        "fundingReceiptLogCounts":counts,
        "txReceipts":[{"tag":x["tag"],"tx":x["tx"],"blockHash":x["blockHash"],
                       "blockNumber":x["blockNumber"],"gasUsed":x["gasUsed"]}
                      for x in transactions],
        "receiptCount":len(transactions),
        "noRealWalletOwnerProved":True,
        "devOnlyAnvilPredeployMaterialization":True,
        "localTimelockImpersonationOnly":True,
    }


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--rpc",required=True)
    p.add_argument("--output",required=True,type=Path)
    args=p.parse_args()
    need(not args.output.exists(),"will not overwrite previous receipt proof")
    proof=run(args.rpc)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(proof,sort_keys=True,indent=2)+"\n")
    print("GOV_PRE_08_STEP2_LOCAL_ANVIL_REAL_MINED_VAULT_FUNDING=PASS",
          proof["receiptCount"],"tx receipts; 42m native conserved, approved V4=false")


if __name__=="__main__":
    main()
