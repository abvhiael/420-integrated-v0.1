#!/usr/bin/env python3
"""GOV-PRE-08: generate an explicitly synthetic, NON-RELEASABLE local Genesis.

The historical V3 execution genesis has 1m at 0x0427. The approved *working*
three-founder ledger instead allocates 500k to 0x0427 and 500k to three verified
personal wallets, which are currently unknown. This local-only funding rehearsal
uses hard-coded UNOWNED test identities, never a claim of approved beneficiaries.
It does not execute constructors or deploy Treasury Vaults.
"""
from __future__ import annotations
import argparse
import copy
import importlib.util
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
MODULE=Path(__file__).with_name("plan.py")
spec=importlib.util.spec_from_file_location("gov_pre_08_plan",MODULE)
plan=importlib.util.module_from_spec(spec)
spec.loader.exec_module(plan)

LOCAL_CHAIN_ID=31337
LOCAL_TIMESTAMP=1900000000
ALLOCS={
    "0x0000000000000000000000000000000000000421":4200000,
    "0x0000000000000000000000000000000000000422":4200000,
    "0x0000000000000000000000000000000000000424":8600000,
    "0x0000000000000000000000000000000000000425":6300000,
    "0x0000000000000000000000000000000000000426":2100000,
    "0x0000000000000000000000000000000000000427":1000000,
    "0x000000000000000000000000000000000000042a":12600000,
    "0x000000000000000000000000000000000000042e":3000000,
}

def make_local(root=ROOT):
    root=Path(root)
    source=plan.make_candidate(root,with_artifacts=False)
    fixture=plan.read(root,"contracts/test/fixtures/gov-pre-08-local-wallets.json")
    plan.require(fixture["schema"]=="420-gov-pre-08-synthetic-wallets-v1" and
                 fixture["network"]=="UNOWNED_LOCAL_REHEARSAL_ONLY" and
                 fixture["chainId"]==LOCAL_CHAIN_ID,
                 "local founder wallets must never masquerade as actual claimable identities")
    founders=fixture["wallets"]
    plan.require(isinstance(founders,list) and len(founders)==3,
                 "local fixture must have exactly three founder slots")
    slots=[x["address"].lower() for x in founders]
    plan.require([x["role"] for x in founders]==
                 ["FOUNDING_ADMINISTRATOR","ANDREW","JANET"],
                 "fixture founder role order changed")
    plan.require(len(set(slots))==3 and all(
        plan.ADDRESS.fullmatch(a) and a!=plan.ZERO and
        not 0x41f<=int(a,16)<=0x4ff for a in slots),
        "synthetic beneficiaries collide, overlap frozen addresses or are malformed")
    # Never use fixtures to fill the actual founder-wallet reservation or to sign V4.
    plan.require(all(x["destination"] is None for x in source["founderFunding"]) and
                 not source["proposedV4"]["independentlyApproved"],
                 "local fixture requested after live identities/approval have been entered")
    base=plan.read(root,"execution/genesis/execution-genesis.json")
    original={key.lower():int(x["balance"])//plan.KIEF for key,x in base["alloc"].items()}
    plan.require(original==ALLOCS and all(
        int(x["balance"])==ALLOCS[key.lower()]*plan.KIEF
        for key,x in base["alloc"].items()),
        "historical V3 Genesis source unexpectedly changed")
    genesis=copy.deepcopy(base)
    genesis["config"]["chainId"]=LOCAL_CHAIN_ID
    genesis["timestamp"]=hex(LOCAL_TIMESTAMP)
    genesis["alloc"]={key.lower():{"balance":str(value*plan.KIEF)}
                      for key,value in ALLOCS.items()}
    # The 500k change at the vesting predeploy is NOT a new mint.
    vest="0x0000000000000000000000000000000000000427"
    genesis["alloc"][vest]["balance"]=str(500000*plan.KIEF)
    for i,wallet in enumerate(slots):
        plan.require(wallet not in genesis["alloc"],"synthetic wallet collides with funding account")
        genesis["alloc"][wallet]={"balance":str(plan.ROLE_AMOUNTS[i]*plan.KIEF)}
    plan.require(sum(int(a["balance"]) for a in genesis["alloc"].values())==
                 42000000*plan.KIEF,"synthetic local Genesis supply mismatch")
    plan.require(int(genesis["alloc"][vest]["balance"])==500000*plan.KIEF,
                 "synthetic founder vesting did not reduce to 500k")
    provenance={
        "schema":"420-gov-pre-08-local-genesis-funding-fixture-v1",
        "status":"SYNTHETIC_UNOWNED_ADDRESSES_NOT_A_RELEASE",
        "sourceCommit":source["exactSourceCommit"],
        "proposedUnsignedV4Hash":source["proposedV4"]["genesisConfigHash"],
        "localChainId":LOCAL_CHAIN_ID,
        "localGenesisTimestamp":LOCAL_TIMESTAMP,
        "localWallets":founders,
        "genesisFundingBalancesVerifiedOnChain":False,
        "vestingRuntimeAndConstructorStoragePresent":False,
        "postGenesisOperationsVaultFunded":False,
        "postGenesisContingencyVaultFunded":False,
        "communityRetirementSweepExecuted":False,
        "ledgerTotal420":42000000,
        "genesisVesting420":500000,
        "genesisFounderLiquid420":500000,
        "protocolReserve420":8600000,
        "nonAdditiveOperationsEarmark420":4200000,
        "nonAdditiveContingencyEarmark420":840000,
        "unearmarkedProtocolReserve420":3560000,
    }
    return genesis,provenance

def dump(x):
    return json.dumps(x,sort_keys=True,indent=2)+"\n"

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--output",type=Path,required=True)
    p.add_argument("--provenance",type=Path,required=True)
    args=p.parse_args()
    try:
        g,proof=make_local()
        for path in (args.output,args.provenance):
            plan.require(not path.exists(),"refusing to overwrite a previous Genesis candidate")
            path.parent.mkdir(parents=True,exist_ok=True)
        args.output.write_text(dump(g))
        args.provenance.write_text(dump(proof))
        print("GOV-PRE-08 LOCAL FUNDING=PASS: 42m conserved, "
              "500k locked + 250k/125k/125k synthetic; NOT LIVE DEPLOYED")
    except (KeyError,ValueError,TypeError,OSError) as exc:
        p.exit(1,"GOV-PRE-08 LOCAL FUNDING FAIL-CLOSED: "+str(exc)+"\n")

if __name__=="__main__":
    main()
