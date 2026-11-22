#!/usr/bin/env python3
"""GOV-PRE-05: binding-only, fail-closed three-founder Genesis/revenue deployment intent.

Never writes wallet identities, signs a transaction, deploys contracts, or changes
the frozen FROZEN_V3 Genesis. Requires independently checked founder EIP-191 or
code-bound EIP-1271 proofs and an approved FROZEN_V4 financial/genesis ledger.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODULE = ROOT / "scripts/verify-founder-wallet-reservations.py"
spec = importlib.util.spec_from_file_location("gov_pre_05_founder_wallets", MODULE)
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)

def blob(data: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()

def manifest(root=ROOT, rpc_url=None):
    root = Path(root)
    # The cryptographic founder verifier enforces distinct real identities,
    # signatures, Genesis/chain/role binding and V4 authority input identity.
    if verifier.validate(strict=True, root=root, rpc_url=rpc_url) != 3:
        raise ValueError("three verified founders required")
    wallets = verifier.load(root, "contracts/config/founder-wallet-reservations.json")
    ledger = verifier.load(root, "config/genesis-allocations.json")
    frozen = verifier.load(root, "contracts/config/genesis-config-commitment.json")
    integration = verifier.load(root, "contracts/config/founding-genesis-integration-v1.json")
    init = verifier.load(root, "contracts/config/predeploy/storage-init.json")
    founders = wallets["founders"]
    addresses = [f["wallet_address"] for f in founders]
    if frozen["status"] != "FROZEN_V4":
        raise ValueError("new, independently approved FROZEN_V4 Genesis is mandatory")
    if init.get("founder_beneficiaries") != addresses:
        raise ValueError("immutable vesting beneficiaries do not match actual founder proofs")
    if integration["genesis"]["approvedGenesisHash"].lower() != wallets["planned_genesis_hash"].lower():
        raise ValueError("founder approvals do not bind this network genesis")
    allocation = {x["id"]:x for x in ledger["allocations"]}
    vest = allocation["founder-vesting"]
    if vest["destination"] != "0x0000000000000000000000000000000000000427" or vest["amount_420"]!=500000:
        raise ValueError("wrong locked founder predeploy or amount")
    for i, suffix in enumerate(("admin","andrew","janet")):
        entry=allocation["founder-"+suffix+"-liquid"]
        if entry["destination"] != addresses[i] or entry["amount_420"] != [250000,125000,125000][i]:
            raise ValueError("liquid founder wallet funding not bound")
    if sum(x["amount_420"] for x in ledger["allocations"]) != 42_000_000:
        raise ValueError("genesis native supply changed")
    for f in founders:
        if f["claim_tx"] is not None or f["ownership_status"] != "PREGENESIS_SIGNATURE_VERIFIED":
            raise ValueError("expected valid pregenesis proof without fabricated post-genesis claims")
    if wallets["developer_compensation_splitter"]["address"] is not None:
        raise ValueError("developer splitter already has a deployed address")
    # Do not treat constructor arguments as successful funding or deployment.
    sources = [
        "contracts/src/system/FounderVestingRegistry.sol",
        "contracts/src/revenue/FoundingDeveloperCompensationSplitter420.sol",
        "contracts/src/revenue/DevelopmentCompensationVault420.sol",
    ]
    source_ids = {p:blob((root/p).read_bytes()) for p in sources}
    return {
        "schema":"420-gov-pre-05-verified-deployment-intent-v1",
        "status":"SIGNED_V4_CONSTRUCTOR_INTENT_ONLY_NOT_DEPLOYED",
        "chainId":wallets["modeled_chain_id"],
        "targetNetwork":wallets["target_network"],
        "signedGenesisHash":wallets["planned_genesis_hash"],
        "sourceGitBlobSha1":source_ids,
        "founderCount":3,
        "founders": [{"role":f["role"],"wallet":f["wallet_address"]} for f in founders],
        "genesis": {
            "vesting":{"address":"0x0000000000000000000000000000000000000427",
                "source":sources[0],"constructorTypes":["address","address[3]","uint64"],
                "constructorArgs":["approved_governance_timelock",addresses,"exact_network_genesis_timestamp"],
                "locked420":500000,"releases":13,"intervalDays":14,"completionDays":182},
            "liquidDirectFunding420":[250000,125000,125000],
            "liquidRecipients":addresses,
            "totalFounderAllocation420":1000000,
            "totalGenesisSupply420":42000000,
        },
        "developmentCompensation":{
            "sourceSplitter":sources[1],
            "sourceVault":sources[2],
            "sequence":[
                {"op":"deploy_splitter","constructorTypes":["address","address","address"],
                 "constructorArgs":addresses},
                {"op":"deploy_DevelopmentCompensationVault420",
                 "constructorTypes":["address","address"],
                 "constructorArgs":["approved_CapabilityRegistry420_address","deployed_splitter_address"],
                 "immutableBeneficiaryMustEqual":"deployed_splitter_address"},
                {"op":"call_splitter_bindCompensationVault",
                 "method":"bindCompensationVault(address)",
                 "arguments":["deployed_DevelopmentCompensationVault420_address"],
                 "requires":"same authorized splitter deploymentAuthority; exactly once"},
                {"op":"verify_vault_and_splitter_codehash_and_immutables",
                 "verify":"actual canonical finalized deployment receipt, source/runtime and granted fee route"},
            ],
            "sharesBps":[5000,2500,2500],
            "assets":["native420","ERC20"],
            "fundingSource":"authorized_application_revenue_only_NOT_GENESIS",
        },
        "onChainDeploymentPerformed":False,
        "founderClaimReceiptsVerified":False,
        "nativeOrTokenCompensationActuallyPaid":False,
    }

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--root",type=Path,default=ROOT)
    parser.add_argument("--rpc-url")
    parser.add_argument("--output",type=Path)
    args=parser.parse_args()
    try:
        data=manifest(args.root,args.rpc_url)
        serialized=json.dumps(data,indent=2)+"\n"
        if args.output:
            if args.output.exists():raise ValueError("will not overwrite signed deployment intent")
            args.output.write_text(serialized)
        else:print(serialized,end="")
    except (KeyError,ValueError,OSError,TypeError,AttributeError) as exc:
        parser.exit(1,"GOV-PRE-05 deployment: FAIL-CLOSED: "+str(exc)+"\n")
if __name__=="__main__":main()
