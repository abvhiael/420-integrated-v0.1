#!/usr/bin/env python3
"""GOV-PRE-08 Step 3: exact-source unsigned V4 artifacts and local EVM receipt audit.

This tool deliberately NEVER publishes a production address, upgrades V3, approves
Genesis, or treats Anvil impersonation as an authentic governance transaction.
Anvil chain 31337 and synthetic founders are mandatory for local probes.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
KIEF = 10**18
ZERO = "0x" + "00"*20
V3_HASH = "0x94321abcd7016ec0494a2c616fdf55bf4e8815dcc0f92d03933b335630e25d6d"
NAMES = ("420Wallet", "420Registry", "420Indexer", "420Stake", "420Treasury",
         "420Explorer", "420Governance")

def load_module(name, filename):
    spec = importlib.util.spec_from_file_location(name, HERE / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

plan = load_module("gov_pre_08_plan_step3", "plan.py")
funding = load_module("gov_pre_08_funding_step3", "materialize-local-vault-funding.py")

def need(condition, why):
    if not condition:
        raise ValueError("GOV-PRE-08 STEP3: " + why)

def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()

def sha256(value):
    return hashlib.sha256(value).hexdigest()

def head(root=ROOT):
    return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()

def emit(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(json.dumps(value, sort_keys=True, indent=2, ensure_ascii=False).encode() + b"\n")

def read(path):
    return json.loads(path.read_text(encoding="utf-8"))

def check_artifact(data, name):
    need(isinstance(data.get("abi"), list), "missing compiled ABI " + name)
    need(isinstance(data.get("storageLayout"), dict)
         and isinstance(data["storageLayout"].get("storage"), list)
         and isinstance(data["storageLayout"].get("types"), dict),
         "missing compiler storage layout " + name)
    for key in ("bytecode", "deployedBytecode"):
        part = data[key]
        code = part["object"]
        need(isinstance(code, str) and re.fullmatch("0x[0-9a-fA-F]+", code)
             and len(code) > 4 and len(code) % 2 == 0,
             "malformed/unlinked Solidity bytecode " + name)
        need(not part.get("linkReferences"), "unresolved linked library " + name)
    return data

def build_manifest(root=ROOT):
    candidate = plan.make_candidate(root, with_artifacts=True)
    need(candidate["historicalV3"]["hash"] == V3_HASH, "frozen V3 authority changed")
    need(candidate["status"] == "UNAPPROVED_SOURCE_CANDIDATE_NOT_DEPLOYED",
         "source candidate was promoted to released state")
    need(not candidate["proposedV4"]["independentlyApproved"]
         and candidate["proposedV4"]["approvalSignatures"] is None,
         "unsigned source was falsely approved")
    need(candidate["exactSourceCommit"] == head(root), "source head changed during build")
    need(tuple(x["name"] for x in candidate["consumerIntegrations"]) == NAMES,
         "cross-protocol consumer inventory changed")
    artifacts = {}
    records = []
    for item in candidate["components"]:
        name = item["name"]
        artifact_path = root / "contracts" / "out" / (name + ".sol") / (name + ".json")
        compiled = check_artifact(read(artifact_path), name)
        # These are full compiler outputs, NOT invented deployed runtime or storage.
        artifact = {
            "schema": "GOV_PRE_08_STEP3_UNSIGNED_COMPILED_COMPONENT_V1",
            "name": name,
            "source": item["source"],
            "sourceGitBlobSha1": item["sourceGitBlobSha1"],
            "abi": compiled["abi"],
            "storageLayout": compiled["storageLayout"],
            "creationBytecode": compiled["bytecode"]["object"],
            "deployedRuntimeTemplate": compiled["deployedBytecode"]["object"],
            "immutableReferences": compiled["deployedBytecode"].get("immutableReferences", {}),
            "deploymentAddress": None,
            "deployedStorageVerified": False,
            "liveRuntimeCodeHash": None,
        }
        need(sha256(canonical(artifact["abi"])) == item["abiSha256"][2:]
             if item["abiSha256"].startswith("0x") else
             sha256(canonical(artifact["abi"])) == item["abiSha256"],
             "ABI source-digest mismatch " + name)
        need(sha256(canonical(artifact["storageLayout"])) ==
             item["storageLayoutSha256"].removeprefix("0x"),
             "storage-layout digest mismatch " + name)
        need(sha256(bytes.fromhex(artifact["creationBytecode"][2:])) ==
             item["creationTemplateSha256"], "creation template drift " + name)
        need(sha256(bytes.fromhex(artifact["deployedRuntimeTemplate"][2:])) ==
             item["runtimeTemplateSha256"], "runtime template drift " + name)
        artifacts[name] = artifact
        records.append({
            "name": name, "path": "components/" + name + ".json",
            "componentSha256": sha256(canonical(artifact)),
            "sourceGitBlobSha1": item["sourceGitBlobSha1"],
            "abiSha256": item["abiSha256"],
            "storageLayoutSha256": item["storageLayoutSha256"],
            "runtimeTemplateSha256": item["runtimeTemplateSha256"],
            "constructorTypes": item["constructorInputTypes"],
            "immutableReferences": item["immutableReferences"],
            "networkDeployedAddress": None,
            "networkRuntimeVerified": False,
        })
    need(len(records) == 14 and len(set(x["name"] for x in records)) == 14,
         "missing/duplicate founding modules")
    manifest = {
        "schema": "GOV_PRE_08_STEP3_UNSIGNED_V4_SOURCE_MATERIALIZATION_V1",
        "status": "LOCAL_SOURCE_ARTIFACTS_ONLY_NO_APPROVED_V4",
        "sourceGitHead": head(root),
        "historicalFrozenV3Hash": V3_HASH,
        "unsignedV4CandidateHash": candidate["proposedV4"]["genesisConfigHash"],
        "authorityInputs": candidate["proposedV4"]["commitmentPayload"]["authorityInputs"],
        "compilerArtifactSource": "contracts/out (generated on exact source)",
        "components": records,
        "consumerBoundaries": candidate["consumerIntegrations"],
        "syntheticLocalChainId": 31337,
        "liveChainId": None,
        "approvedFounderWallets": False,
        "genuineFounderSignatures": False,
        "independentlyApprovedV4": False,
        "productionGenesisReady": False,
        "networkMigrationAuthorized": False,
    }
    return manifest, artifacts

def write_bundle(output, root=ROOT):
    need(not output.exists(), "refusing to overwrite source materialization")
    manifest, artifacts = build_manifest(root)
    output.mkdir(parents=True)
    for name, artifact in artifacts.items():
        emit(output / "components" / (name + ".json"), artifact)
    emit(output / "manifest.json", manifest)
    verify_bundle(output, root)
    return manifest

def verify_bundle(output, root=ROOT):
    expected, artifacts = build_manifest(root)
    actual = read(output / "manifest.json")
    need(actual == expected, "manifest does not match exact canonical source")
    for row in actual["components"]:
        name = row["name"]
        item = read(output / row["path"])
        need(item == artifacts[name], "compiled artifact does not match current source " + name)
        need(sha256(canonical(item)) == row["componentSha256"],
             "compiled artifact digest mismatch " + name)
    need(all(r["networkDeployedAddress"] is None for r in actual["components"]),
         "invented network deployment detected")
    return actual

def receipt_view(rpc, evidence):
    need(evidence["schema"] == "GOV_PRE_08_STEP2_LOCAL_ANVIL_MINED_FUNDING_V1",
         "not a real Step 2 mined-receipt witness")
    need(evidence["chainId"] == 31337 and int(rpc.call("eth_chainId", []), 16) == 31337,
         "wrong network: 31337 fixture only")
    need(evidence["sourceGitHead"] == head(), "stale cross-source witness")
    need(not evidence["signedGenesisV4Approved"]
         and not evidence["authenticFounderKeysOrSignatures"]
         and not evidence["productionTimelockExecution"],
         "synthetic runtime falsely claims live authorization")
    txs = evidence["txReceipts"]
    need(len(txs) == evidence["receiptCount"] == 18, "missing or duplicated local receipts")
    need(len({x["tx"] for x in txs}) == 18, "duplicate receipt identifiers")
    tags = [x["tag"] for x in txs]
    need(tags.count("fund:OPERATIONS") == 1 and tags.count("fund:CONTINGENCY") == 1,
         "missing exactly-once funding")
    deployed = {}
    created_vaults = []
    ledger_events = []
    funding_logs = {}
    for row in txs:
        receipt = rpc.call("eth_getTransactionReceipt", [row["tx"]])
        need(receipt is not None and int(receipt["status"], 16) == 1,
             "missing/failed canonical receipt " + row["tag"])
        number = int(receipt["blockNumber"], 16)
        block = rpc.call("eth_getBlockByNumber", [hex(number), False])
        need(block is not None and block["hash"].lower() == row["blockHash"].lower()
             and receipt["blockHash"].lower() == row["blockHash"].lower()
             and number == row["blockNumber"],
             "orphaned or noncanonical mined receipt " + row["tag"])
        if row["tag"].startswith("deploy:"):
            addr = receipt.get("contractAddress")
            need(addr and funding.ADDRESS.fullmatch(addr)
                 and rpc.code(addr) != "0x", "deployment has no executable code")
            deployed[row["tag"].split(":", 1)[1]] = {
                "address": addr.lower(),
                "runtimeCodeHash": funding.cast("keccak", rpc.code(addr)).lower(),
                "codeBytes": (len(rpc.code(addr)) - 2)//2,
            }
            if row["tag"] == "deploy:AssetVault420":
                created_vaults.append(addr.lower())
        if row["tag"].startswith("fund:"):
            funding_logs[row["tag"].split(":", 1)[1]] = receipt["logs"]
            need(len(receipt["logs"]) == 3,
                 "unexpected transfer event multiplicity " + row["tag"])
            for log in receipt["logs"]:
                ledger_events.append({
                    "tx": row["tx"], "logIndex": int(log["logIndex"], 16),
                    "blockHash": receipt["blockHash"],
                    "emitter": log["address"].lower(),
                    "topic": log["topics"][0].lower() if log["topics"] else None,
                    "data": log["data"].lower(),
                })
    need(set(deployed) == {
        "ProtocolReserve", "CapabilityRegistry420", "VaultAuthorization420",
        "VaultPolicyRegistry420", "VaultRegistry420", "VaultAccounting420", "AssetVault420"
    }, "actual constructor graph missing")
    # Three AssetVault420 constructor receipts share the same tag.
    need(len(created_vaults) == 3 and len(set(created_vaults)) == 3
         and set(created_vaults) == {v.lower() for v in evidence["vaultAddresses"].values()},
         "three distinct real Vault constructor addresses do not reconcile")
    need(len(ledger_events) == 6 and len({(x["tx"], x["logIndex"]) for x in ledger_events}) == 6,
         "canonical indexer projection has missing/duplicate logs")
    for typ, amount in (("OPERATIONS", 4_200_000*KIEF),
                        ("CONTINGENCY", 840_000*KIEF),
                        ("COMMUNITY", 0)):
        addr = evidence["vaultAddresses"][typ]
        need(rpc.balance(addr) == amount, "onchain Vault custody mismatch " + typ)
        need(rpc.code(addr) != "0x", "Vault has no deployed runtime " + typ)
        reg = deployed["VaultRegistry420"]["address"]
        accounting = deployed["VaultAccounting420"]["address"]
        vault_id = evidence["vaultIds"][typ]
        need(int(rpc.read(reg, "getVault(bytes32)", vault_id)[2:66], 16) == int(addr,16),
             "independent Vault Registry resolution failed: " + typ)
        free = rpc.read(accounting, "freeBalance(bytes32,address)", vault_id, ZERO)
        need(int(free,16) == amount,
             "independently read onchain accounting mismatch: " + typ)
    for name, amount in (("OPERATIONS",4_200_000*KIEF),("CONTINGENCY",840_000*KIEF)):
        observed = {(log["address"].lower(), log["topics"][0].lower()): log
                    for log in funding_logs[name]}
        expected = (
            (funding.PROTO.lower(), funding.keccak_bytes("TreasuryTransfer(address,uint256,bytes32)")),
            (evidence["vaultAddresses"][name].lower(), funding.keccak_bytes("NativeDeposited(address,uint256)")),
            (deployed["VaultAccounting420"]["address"], funding.keccak_bytes("DepositRecorded(bytes32,address,uint256,uint256)")),
        )
        need(set(observed) == set(expected),
             "unexpected event signatures or emitters in actual "+name+" funding receipt")
        need(int(observed[expected[0]]["data"],16) == amount,
             "actual TreasuryTransfer amount changed: "+name)
        recording=observed[expected[2]]["data"][2:]
        need([int(recording[i:i+64],16) for i in (0,64)] == [amount,amount],
             "native VaultAccounting DepositRecorded mismatch: "+name)
    need(int(rpc.read(funding.PROTO, "governanceTimelock()"),16) == int(funding.TIME,16),
         "predeploy immutable Timelock address drift")
    need(rpc.balance(funding.PROTO) == 3_560_000*KIEF,
         "onchain protocol reserve remainder mismatch")
    need(evidence["initialNativeSupplyWei"] == evidence["postFundingNativeSupplyWei"] ==
         str(42_000_000*KIEF), "42m local Genesis supply conservation mismatch")
    need(evidence["fundingReceiptLogCounts"] == {"OPERATIONS": 3, "CONTINGENCY": 3},
         "Step 2 accounting evidence mismatch")
    # Idempotent rebuilding from canonical receipts is the read-model boundary;
    # never give this derived projection authority over native balances.
    distinct = {(x["tx"], x["logIndex"]): x for x in ledger_events}
    replay = {(x["tx"], x["logIndex"]): x for x in ledger_events + ledger_events}
    need(distinct == replay, "duplicate replay modified non-authoritative projection")
    view = {
        "schema": "GOV_PRE_08_STEP3_LOCAL_RPC_PROJECTION_V1",
        "sourceGitHead": head(),
        "chainId": 31337,
        "unsignedV4": True,
        "receipts": len(txs),
        "fundingEvents": len(ledger_events),
        "uniqueLogEvents": len(distinct),
        "constructorCode": deployed,
        "vaults": evidence["vaultAddresses"],
        "vaultIds": evidence["vaultIds"],
        "protocolReserveAfterWei": str(rpc.balance(funding.PROTO)),
        "vaultBalancesWei": {k: str(rpc.balance(v)) for k, v in evidence["vaultAddresses"].items()},
        "consumerQualifications": {
            "420Registry": "LOCAL_VAULT_REGISTRY_CONTRACT_ONLY",
            "420Treasury": "LOCAL_NATIVE_RECEIPT_AND_VAULT_SETTLEMENT_ONLY",
            "420Indexer": "CANONICAL_LOG_RECONSTRUCTION_ONLY",
            "420Explorer": "INDEXER_PROJECTION_ONLY_NO_RUNNING_EXPLORER",
            "420Wallet": "NOT_RUNTIME_QUALIFIED",
            "420Stake": "NOT_CONSENSUS_QUALIFIED",
            "420Governance": "LOCAL_TIMELOCK_IMPERSONATION_NOT_REAL_EXECUTION",
        },
        "liveGenesisQualified": False,
    }
    # Do not hash tx timestamps, block hashes, or transaction hashes: those are
    # independently retained per run, not guaranteed equal across fresh nodes.
    stable = {k: v for k, v in view.items() if k != "constructorCode"}
    stable["constructorCode"] = {name: {"address": meta["address"],
                                       "runtimeCodeHash": meta["runtimeCodeHash"],
                                       "codeBytes": meta["codeBytes"]}
                                 for name, meta in view["constructorCode"].items()}
    view["stateDigestSha256"] = sha256(canonical(stable))
    return view

def local_reorg_probe(rpc, evidence):
    wallets = funding.native_allocations(ROOT)
    original = [rpc.balance(wallets[0]), rpc.balance(wallets[1])]
    snapshot = rpc.call("evm_snapshot", [])
    need(snapshot is not None, "local snapshot API missing")
    rpc.call("anvil_impersonateAccount", [wallets[0]])
    try:
        tx = rpc.send(wallets[0], wallets[1], amount=1, tag="LOCAL_REORG_PROBE")
        need(rpc.balance(wallets[0]) == original[0] - 1
             and rpc.balance(wallets[1]) == original[1] + 1,
             "local pre-reorg branch did not change custody")
        need(rpc.call("evm_revert", [snapshot]) is True,
             "local reorg/snapshot rollback rejected")
        need(rpc.call("eth_getTransactionReceipt", [tx["tx"]]) is None,
             "orphaned transaction receipt survived rollback")
        need([rpc.balance(wallets[0]), rpc.balance(wallets[1])] == original,
             "orphaned state survived simulated reorg")
    finally:
        # Fixture only; no live key or network is ever used.
        rpc.call("anvil_stopImpersonatingAccount", [wallets[0]])
    return {"simulatedReorgRollback": True, "orphanedReceiptRejected": True,
            "postRollbackFounderBalancesRestored": True}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--build", type=Path)
    parser.add_argument("--verify-bundle", type=Path)
    parser.add_argument("--rpc")
    parser.add_argument("--step2-evidence", type=Path)
    parser.add_argument("--local-output", type=Path)
    parser.add_argument("--probe-reorg", action="store_true")
    args = parser.parse_args()
    try:
        need(args.build is not None or args.verify_bundle is not None,
             "require source materialization or verification")
        manifest = write_bundle(args.build) if args.build else verify_bundle(args.verify_bundle)
        if args.rpc is not None:
            need(args.step2_evidence is not None and args.local_output is not None,
                 "must supply onchain Step 2 receipt witness and output")
            need(not args.local_output.exists(), "refusing to overwrite local evidence")
            rpc = funding.Rpc(args.rpc)
            evidence = read(args.step2_evidence)
            view = receipt_view(rpc, evidence)
            if args.probe_reorg:
                view["reorgProbe"] = local_reorg_probe(rpc, evidence)
                need(receipt_view(rpc, evidence)["stateDigestSha256"] ==
                     view["stateDigestSha256"], "post-reorg projection/custody drift")
            view["sourceManifestSha256"] = sha256(canonical(manifest))
            emit(args.local_output, view)
            print("GOV_PRE_08_STEP3_LOCAL_RECEIPT_REPLAY_AND_SOURCE=PASS",
                  view["stateDigestSha256"], "PRODUCTION=NO_GO")
        else:
            need(args.step2_evidence is None and args.local_output is None,
                 "incomplete RPC argument combination")
            print("GOV_PRE_08_STEP3_UNSIGNED_V4_ARTIFACTS=PASS",
                  len(manifest["components"]), "COMPONENTS; PRODUCTION=NO_GO")
    except (ValueError, KeyError, IndexError, OSError, subprocess.CalledProcessError,
            TypeError, json.JSONDecodeError) as exc:
        parser.exit(1, str(exc) + "\n")

if __name__ == "__main__":
    main()
