#!/usr/bin/env python3
"""Install real native gateway and reward runtime on a disposable funded GOV-PRE-08 Anvil graph.

This creates real source-compiled constructors and binds the actual canonical
ValidatorRegistry + RewardController to frozen 0x043c using local-only Timelock
impersonation. It NEVER proves founder signatures or a production migration.
"""
from __future__ import annotations
import argparse
import importlib.util
import json
from pathlib import Path

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location("gov_pre08_graph_native",HERE/"materialize-local-v4-contract-graph.py")
graph=importlib.util.module_from_spec(spec)
spec.loader.exec_module(graph)
funding=graph.funding
GW="0x000000000000000000000000000000000000043c"
REWARD="0x0000000000000000000000000000000000000420"

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--rpc",required=True)
    ap.add_argument("--graph",type=Path,required=True)
    ap.add_argument("--output",type=Path,required=True)
    a=ap.parse_args()
    graph.need(not a.output.exists(),"refuse overwrite native-gateway witness")
    proof=json.loads(a.graph.read_text())
    rpc=funding.Rpc(a.rpc)
    graph.verify(rpc,proof)
    graph.need(rpc.code(GW)=="0x" and rpc.code(REWARD)=="0x",
               "local genesis already has native system runtime")
    graph.need(int(rpc.call("eth_chainId",[]),16)==31337,
               "native binder cannot execute outside disposable chain 31337")
    sender=rpc.call("eth_accounts",[])[0]
    graph.need(rpc.balance(sender)==0,"native constructor signer introduced supply")
    receipts=[]
    for name,dest in (("ConsensusSystemCall420",GW),("RewardController",REWARD),
                       ("CommunityRewardReserve","0x0000000000000000000000000000000000000426")):
        deployed=graph.deploy(rpc,sender,name,"constructor(address)",[graph.TIME],receipts)
        actual=rpc.code(deployed)
        graph.need(actual!="0x" and rpc.code(dest)=="0x",
                   "constructor produced missing/frozen duplicate code for "+name)
        graph.need(rpc.call("anvil_setCode",[dest,actual]) is None or rpc.code(dest)==actual,
                   "local gateway runtime not materialized")
        graph.need(rpc.code(dest)==actual,
                   "native runtime differs from true source constructor "+name)
    rpc.call("anvil_impersonateAccount",[graph.TIME])
    for to in (graph.VALIDATORS,REWARD):
        graph.call_send(rpc,graph.TIME,to,"bindConsensusSystemCaller(address)",GW,
                        tag="local-only-native-caller-binding:"+to,receipts=receipts)
        graph.need(graph.read_address(rpc,to,"consensusSystemCaller()")==GW
                   and int(rpc.read(to,"consensusSystemCallerBound()"),16)==1,
                   "real native caller not bound to canonical 0x043c "+to)
    graph.fail_call(rpc,proof["sourceFoundersFixtureOnly"][0],graph.VALIDATORS,
                    "applyRotationSnapshot(uint64,uint256)","1","0")
    graph.need(int(rpc.read(graph.VALIDATORS,"eligibleValidatorCount()"),16)==0,
               "local graph has eligible validators despite fixture-only state")
    graph.need(rpc.balance(GW)==0 and rpc.balance(REWARD)==0 and rpc.balance(sender)==0,
               "synthetic gateway introduced unfunded native issuance")
    witness={
      "schema":"GOV_PRE_08_LOCAL_NODE420_NATIVE_BINDINGS_V1",
      "sourceGitHead":graph.stage.head(),"chainId":31337,
      "localOnly":True,"approvedV4":False,"syntheticFoundersOnly":True,
      "gateway":GW,"rewardController":REWARD,"validatorRegistry":graph.VALIDATORS,
      "gatewayRuntimeCodeHash":graph.hcode(rpc,GW),
      "rewardRuntimeCodeHash":graph.hcode(rpc,REWARD),
      "validatorRuntimeCodeHash":graph.hcode(rpc,graph.VALIDATORS),
      "actualConstructorReceipts":[{"hash":r["tx"],"blockHash":r["blockHash"],"tag":r["tag"]} for r in receipts],
      "realConsensusCallerBound":True,"forgedNativeEOAOperationRejected":True,
      "initialEligibleValidatorCount":0
    }
    a.output.write_text(json.dumps(witness,sort_keys=True,indent=2)+"\n")
    print("GOV_PRE_08_REAL_LOCAL_NATIVE_GATEWAY_AND_VALIDATOR_REWARD_BINDINGS=PASS",
          witness["gatewayRuntimeCodeHash"])

if __name__=="__main__":
    main()
