#!/usr/bin/env python3
"""STAKE-AUDIT-7 deterministic frozen predeploy materialization.

Compiles the four canonical Stake predeploys with the pinned Foundry toolchain,
uses a local Anvil fixture only to execute Solidity constructor immutable
materialization and the documented one-time genesis post-init bindings, then
retains exact deployed runtime, storage words/root, ABI/layout and provenance.

This script never claims live deployment. STAKE-AUDIT-8 owns live-chain proof.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
import pathlib
import re
import subprocess
import sys
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
CONTRACTS = ROOT / "contracts"
PLAN = CONTRACTS / "config/predeploy/predeploy-plan.json"
MANIFEST = CONTRACTS / "config/deployment-manifest.json"
STORAGE_INIT = CONTRACTS / "config/predeploy/storage-init.json"
STAKE_CONFIG = CONTRACTS / "config/predeploy/stake-genesis-config-v1.json"
ALLOCATIONS = ROOT / "config/genesis-allocations.json"
FOUNDRY_CONFIG = CONTRACTS / "foundry.toml"
TOOLCHAIN = CONTRACTS / "config/security/toolchain.json"

RPC_URL = "http://127.0.0.1:8547"
ADDRESS_RE = re.compile(r"^0x[0-9a-fA-F]{40}$")
WORD_RE = re.compile(r"^0x[0-9a-fA-F]{64}$")

SPECS = {
    "RewardController": {
        "source": "src/system/RewardController.sol",
        "planSource": "system/RewardController.sol",
        "address": "0x0000000000000000000000000000000000000420",
        "constructorTypes": ["address"],
        "constructorKeys": ["governanceTimelock"],
        "postInit": [("bindConsensusSystemCaller(address)", ["consensusSystemCall420"])],
        "requiredStorageLabels": ["consensusSystemCaller", "consensusSystemCallerBound"],
        "schema": "420-stake-reward-controller-predeploy-v1",
    },
    "ValidatorRegistry": {
        "source": "src/system/ValidatorRegistry.sol",
        "planSource": "system/ValidatorRegistry.sol",
        "address": "0x0000000000000000000000000000000000000423",
        "constructorTypes": ["address", "address", "bytes32"],
        "constructorKeys": ["governanceTimelock", "protocolRegistry", "genesisConfigHash"],
        "postInit": [
            ("bindConsensusSystemCaller(address)", ["consensusSystemCall420"]),
            ("bindCommunityValidatorReserve(address)", ["communityValidatorReserve"]),
        ],
        "requiredStorageLabels": [
            "consensusSystemCaller", "consensusSystemCallerBound",
            "communityValidatorReserve", "communityValidatorReserveBound",
        ],
        "schema": "420-stake-validator-registry-predeploy-v1",
    },
    "CommunityValidatorReserve": {
        "source": "src/system/CommunityValidatorReserve.sol",
        "planSource": "system/CommunityValidatorReserve.sol",
        "address": "0x0000000000000000000000000000000000000425",
        "constructorTypes": ["address"],
        "constructorKeys": ["governanceTimelock"],
        "postInit": [("bindValidatorRegistry(address)", ["validatorRegistry"])],
        "requiredStorageLabels": ["validatorRegistry", "validatorRegistryBound"],
        "schema": "420-stake-community-validator-reserve-predeploy-v1",
    },
    "Stake420": {
        "source": "src/apps/Stake420.sol",
        "planSource": "apps/Stake420.sol",
        "address": "0x000000000000000000000000000000000000043a",
        "constructorTypes": ["address", "address"],
        "constructorKeys": ["validatorRegistry", "rewardController"],
        "postInit": [],
        "requiredStorageLabels": [],
        "schema": "420-stake-facade-predeploy-v1",
    },
}

def fail(message: str):
    raise ValueError(message)

def run(*args: str, cwd: pathlib.Path = ROOT) -> str:
    return subprocess.check_output(args, cwd=cwd, text=True, stderr=subprocess.STDOUT).strip()

def git_blob(path: pathlib.Path) -> str:
    return run("git", "hash-object", str(path.relative_to(ROOT)))

def canonical_json(value) -> str:
    return json.dumps(value, indent=2, sort_keys=True) + "\n"

def canonical_compact(value) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()

def cast_keccak_bytes(data: bytes) -> str:
    return run("cast", "keccak", "0x" + data.hex()).lower()

def cast_keccak_hex(value: str) -> str:
    return run("cast", "keccak", value).lower()

def rpc(method: str, params: list):
    payload = json.dumps({"jsonrpc":"2.0","id":1,"method":method,"params":params}).encode()
    req = urllib.request.Request(RPC_URL, data=payload, headers={"content-type":"application/json"})
    with urllib.request.urlopen(req, timeout=10) as response:
        result = json.loads(response.read())
    if result.get("error"):
        fail("RPC %s failed: %s" % (method, result["error"]))
    return result.get("result")

def wait_rpc():
    for _ in range(100):
        try:
            if rpc("eth_chainId", []) == "0x1a4":
                return
        except Exception:
            pass
        time.sleep(0.1)
    fail("Anvil did not become ready")

def wait_receipt(tx_hash: str):
    for _ in range(200):
        receipt = rpc("eth_getTransactionReceipt", [tx_hash])
        if receipt:
            if receipt.get("status") != "0x1":
                fail("transaction reverted: " + tx_hash)
            return receipt
        time.sleep(0.05)
    fail("transaction receipt timeout: " + tx_hash)

def encode_args(types: list[str], values: list[str]) -> str:
    if not types:
        return "0x"
    signature = "f(" + ",".join(types) + ")"
    return run("cast", "abi-encode", signature, *values)

def calldata(signature: str, values: list[str]) -> str:
    return run("cast", "calldata", signature, *values)

def normalize_hex(value: str) -> str:
    if not isinstance(value, str) or not value.startswith("0x"):
        fail("expected hex value")
    body=value[2:]
    if len(body)%2 or any(c not in "0123456789abcdefABCDEF" for c in body):
        fail("invalid hex value")
    return "0x"+body.lower()

def find_artifact(name: str) -> pathlib.Path:
    matches=list((CONTRACTS/"out").glob("**/%s.json" % name))
    exact=[p for p in matches if p.parent.name.endswith(".sol") and p.name=="%s.json"%name]
    if len(exact)!=1:
        fail("expected one Foundry artifact for %s, got %d" % (name,len(exact)))
    return exact[0]

def artifact_layout(raw: dict, spec: dict) -> dict:
    layout=raw.get("storageLayout")
    if isinstance(layout,dict) and isinstance(layout.get("storage"),list):
        return layout
    inspected=run("forge","inspect",spec["source"]+":"+pathlib.Path(spec["source"]).stem,"storage-layout","--json",cwd=CONTRACTS)
    layout=json.loads(inspected)
    if not isinstance(layout,dict) or not isinstance(layout.get("storage"),list):
        fail("storage layout unavailable")
    return layout

def immutable_refs(raw: dict) -> dict:
    deployed=raw.get("deployedBytecode")
    if not isinstance(deployed,dict):
        fail("Foundry artifact missing deployedBytecode object")
    refs=deployed.get("immutableReferences")
    if refs is None:
        refs={}
    if not isinstance(refs,dict):
        fail("immutableReferences malformed")
    return refs

def verify_runtime_diff(template: str, materialized: str, refs: dict):
    a=bytes.fromhex(normalize_hex(template)[2:])
    b=bytes.fromhex(normalize_hex(materialized)[2:])
    if len(a)!=len(b):
        fail("materialized runtime length differs from compiler runtime")
    allowed=set()
    for locations in refs.values():
        if not isinstance(locations,list):
            fail("immutable reference locations malformed")
        for loc in locations:
            start,length=loc.get("start"),loc.get("length")
            if not isinstance(start,int) or not isinstance(length,int) or start<0 or length<=0 or start+length>len(a):
                fail("immutable reference outside runtime")
            allowed.update(range(start,start+length))
    diff={i for i,(x,y) in enumerate(zip(a,b)) if x!=y}
    if not diff.issubset(allowed):
        fail("runtime changed outside compiler immutableReferences")
    if refs and not diff:
        fail("compiler declared immutables but deployment changed no bytes")
    if not refs and diff:
        fail("runtime changed despite no compiler immutables")

def storage_layout_roots(layout: dict) -> dict:
    roots={}
    for entry in layout.get("storage",[]):
        if not isinstance(entry,dict):
            continue
        label=entry.get("label")
        slot=entry.get("slot")
        offset=entry.get("offset")
        typ=entry.get("type")
        if isinstance(label,str) and isinstance(slot,str):
            roots[label]={"slot":slot,"offset":offset,"type":typ}
    return roots

def query_declared_storage(address: str, layout: dict) -> dict:
    slots=sorted({int(e["slot"]) for e in layout.get("storage",[]) if isinstance(e,dict) and str(e.get("slot","")).isdigit()})
    out={}
    for slot in slots:
        word=rpc("eth_getStorageAt",[address,hex(slot),"latest"])
        if not WORD_RE.match(word or ""):
            fail("malformed eth_getStorageAt result")
        if int(word,16)!=0:
            out["0x"+slot.to_bytes(32,"big").hex()]=word.lower()
    return out

def storage_root(address: str) -> str:
    proof=rpc("eth_getProof",[address,[],"latest"])
    root=(proof or {}).get("storageHash")
    if not WORD_RE.match(root or ""):
        fail("eth_getProof did not return storageHash")
    return root.lower()

def start_anvil():
    proc=subprocess.Popen(
        ["anvil","--silent","--port","8547","--chain-id","420"],
        cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,text=True
    )
    try:
        wait_rpc()
    except Exception:
        proc.terminate()
        raise
    return proc

def deploy(raw: dict, types: list[str], values: list[str]) -> tuple[str,str]:
    bytecode=raw.get("bytecode")
    if not isinstance(bytecode,dict):
        fail("Foundry artifact missing creation bytecode")
    creation=normalize_hex(bytecode.get("object"))
    args=encode_args(types,values)
    data=creation+args[2:]
    accounts=rpc("eth_accounts",[])
    if not accounts:
        fail("Anvil has no unlocked account")
    tx=rpc("eth_sendTransaction",[{"from":accounts[0],"data":data,"gas":"0x1c9c380"}])
    receipt=wait_receipt(tx)
    address=receipt.get("contractAddress")
    if not ADDRESS_RE.match(address or ""):
        fail("deployment returned malformed contractAddress")
    code=normalize_hex(rpc("eth_getCode",[address,"latest"]))
    if code=="0x":
        fail("deployed runtime missing")
    return address.lower(),code

def post_init(address: str, calls: list[tuple[str,list[str]]], values: dict):
    if not calls:
        return
    gov=values["governanceTimelock"]
    rpc("anvil_impersonateAccount",[gov])
    rpc("anvil_setBalance",[gov,"0x3635c9adc5dea00000"])
    for signature,keys in calls:
        data=calldata(signature,[values[k] for k in keys])
        tx=rpc("eth_sendTransaction",[{"from":gov,"to":address,"data":data,"gas":"0x989680"}])
        wait_receipt(tx)

def validate_toolchain():
    cfg=FOUNDRY_CONFIG.read_text(encoding="utf-8")
    for token in ['solc_version = "0.8.24"','evm_version = "cancun"',"optimizer = true","optimizer_runs = 200","via_ir = true"]:
        if token not in cfg:
            fail("Foundry pin missing: "+token)
    tool=json.loads(TOOLCHAIN.read_text(encoding="utf-8"))
    for key,value in {"solidity_version":"0.8.24","evm_version":"cancun","optimizer":True,"optimizer_runs":200}.items():
        if tool.get(key)!=value:
            fail("security toolchain drift: "+key)

def load_values():
    config=json.loads(STAKE_CONFIG.read_text(encoding="utf-8"))
    if config.get("schema")!="420-stake-genesis-config-v1" or config.get("authority")!="offline_genesis_configuration_not_live_deployment_evidence":
        fail("Stake genesis config identity/authority mismatch")
    a=config.get("addresses",{})
    values={
        "rewardController":a.get("rewardController"),
        "validatorRegistry":a.get("validatorRegistry"),
        "communityValidatorReserve":a.get("communityValidatorReserve"),
        "governanceTimelock":a.get("governanceTimelock"),
        "protocolRegistry":a.get("protocolRegistry"),
        "consensusSystemCall420":a.get("consensusSystemCall420"),
    }
    for key,value in values.items():
        if not ADDRESS_RE.match(value or ""):
            fail("invalid Stake genesis address: "+key)
    values["genesisConfigHash"]=cast_keccak_bytes(canonical_compact(config))
    return config,values

def verify_allocation(values: dict):
    alloc=json.loads(ALLOCATIONS.read_text(encoding="utf-8"))
    matches=[x for x in alloc.get("allocations",[]) if str(x.get("destination","")).lower()==values["communityValidatorReserve"].lower()]
    if len(matches)!=1 or str(matches[0].get("amount_kief"))!="6300000000000000000000000":
        fail("CommunityValidatorReserve genesis allocation drift")
    return str(matches[0]["amount_kief"])

def compile_contracts():
    run(
        "forge","build",
        "src/system/RewardController.sol",
        "src/system/ValidatorRegistry.sol",
        "src/system/CommunityValidatorReserve.sol",
        "src/apps/Stake420.sol",
        cwd=CONTRACTS,
    )

def build_records():
    validate_toolchain()
    config,values=load_values()
    reserve_balance=verify_allocation(values)
    compile_contracts()
    proc=start_anvil()
    records={}
    try:
        for name,spec in SPECS.items():
            raw=json.loads(find_artifact(name).read_text(encoding="utf-8"))
            metadata=raw.get("metadata")
            if isinstance(metadata,str):
                metadata=json.loads(metadata)
            if not isinstance(metadata,dict) or not str(metadata.get("compiler",{}).get("version","")).startswith("0.8.24"):
                fail(name+" compiler metadata mismatch")
            layout=artifact_layout(raw,spec)
            roots=storage_layout_roots(layout)
            for label in spec["requiredStorageLabels"]:
                if label not in roots:
                    fail(name+" required storage label missing: "+label)
            for immutable_label in ("governanceTimelock","stakeProtocolRegistry","genesisConfigHash","validatorRegistry","rewardController"):
                if immutable_label in roots:
                    fail(name+" immutable unexpectedly occupies mutable storage: "+immutable_label)

            args=[values[k] for k in spec["constructorKeys"]]
            deployed_addr,runtime=deploy(raw,spec["constructorTypes"],args)
            deployed=raw.get("deployedBytecode",{})
            template=normalize_hex(deployed.get("object"))
            refs=immutable_refs(raw)
            verify_runtime_diff(template,runtime,refs)
            post_init(deployed_addr,spec["postInit"],values)
            storage=query_declared_storage(deployed_addr,layout)
            root=storage_root(deployed_addr)
            source_path=CONTRACTS/spec["source"]
            source_blob=git_blob(source_path)
            runtime_hash=cast_keccak_hex(runtime)
            artifact={
                "schema":"420-stake-predeploy-artifact-v1",
                "status":"STAKE_AUDIT_7_ARTIFACT_READY",
                "contractSchema":spec["schema"],
                "contractName":name,
                "source":"contracts/"+spec["source"],
                "sourceBlobSha1":source_blob,
                "canonicalAddress":spec["address"],
                "compiler":{
                    "solidity":"0.8.24","evmVersion":"cancun","optimizer":True,"optimizerRuns":200,"viaIR":True,
                    "foundryConfigBlobSha1":git_blob(FOUNDRY_CONFIG),
                    "toolchainConfigBlobSha1":git_blob(TOOLCHAIN),
                },
                "constructor":{
                    "types":spec["constructorTypes"],
                    "values":args,
                    "strategy":"DIRECT_GENESIS_RUNTIME_AND_STORAGE_MATERIALIZATION",
                },
                "postInit":[{"signature":sig,"values":[values[k] for k in keys]} for sig,keys in spec["postInit"]],
                "compilerDeployedBytecodeTemplate":template,
                "deployedBytecode":runtime,
                "runtimeCodeHash":runtime_hash,
                "runtimeCodeBytes":(len(runtime)-2)//2,
                "immutableReferences":refs,
                "abi":raw.get("abi",[]),
                "storageLayout":layout,
                "genesisConfigHash":values["genesisConfigHash"] if name=="ValidatorRegistry" else None,
                "authority":"offline_materialized_predeploy_not_live_deployment_evidence",
            }
            state={
                "schema":"420-stake-predeploy-state-v1",
                "status":"STAKE_AUDIT_7_FINAL_PREDEPLOY_STATE",
                "contractName":name,
                "address":spec["address"],
                "sourceBlobSha1":source_blob,
                "runtimeArtifact":"contracts/artifacts/"+name+".json",
                "runtimeCodeHash":runtime_hash,
                "runtimeCodeBytes":artifact["runtimeCodeBytes"],
                "constructorArguments":dict(zip(spec["constructorKeys"],args)),
                "postInit":artifact["postInit"],
                "storageLayoutRoots":roots,
                "storage":storage,
                "storageSlotCount":len(storage),
                "storageRoot":root,
                "genesisBalanceWei":reserve_balance if name=="CommunityValidatorReserve" else "0",
                "genesisConfigHash":values["genesisConfigHash"] if name=="ValidatorRegistry" else None,
                "invariants":[
                    "genesis alloc.code uses exact materialized deployed runtime bytecode, never creation bytecode",
                    "runtimeCodeHash equals keccak256(materialized deployed runtime bytecode)",
                    "runtime differs from compiler template only at compiler-reported immutable references",
                    "mutable storage is read from compiler-declared root slots after documented genesis post-init calls",
                    "storageRoot is the eth_getProof storageHash of that exact local materialized storage state",
                ],
                "limitations":[
                    "Anvil is used only as a deterministic constructor/post-init materialization fixture.",
                    "This record is offline Genesis evidence and is not live-chain deployment evidence.",
                    "STAKE-AUDIT-8 remains responsible for production-equivalent testnet code/storage/binding verification.",
                ],
            }
            if name=="CommunityValidatorReserve":
                state["invariants"].append("genesis balance is bound to canonical genesis allocation 6,300,000 420")
            records[name]=(artifact,state)
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
    return config,values,records

def update_bindings(values: dict, records: dict):
    plan=json.loads(PLAN.read_text(encoding="utf-8"))
    manifest=json.loads(MANIFEST.read_text(encoding="utf-8"))
    storage_init=json.loads(STORAGE_INIT.read_text(encoding="utf-8"))
    for name,spec in SPECS.items():
        art,state=records[name]
        entries=[x for x in plan.get("predeploys",[]) if x.get("name")==name]
        if len(entries)!=1:
            fail("predeploy plan entry count drift for "+name)
        entry=entries[0]
        if entry.get("address","").lower()!=spec["address"] or entry.get("source")!=spec["planSource"]:
            fail("predeploy plan identity drift for "+name)
        entry.update({
            "artifact":"contracts/artifacts/"+name+".json",
            "status":"ARTIFACT_READY",
            "constructor_strategy":"DIRECT_GENESIS_RUNTIME_AND_STORAGE_MATERIALIZATION",
            "runtime_code_hash":state["runtimeCodeHash"],
            "predeploy_state":"contracts/config/predeploy/"+name+"-predeploy-state.json",
            "source_blob_sha1":state["sourceBlobSha1"],
            "artifact_status":"STAKE_AUDIT_7_ARTIFACT_READY",
            "notes":"STAKE-AUDIT-7 deterministic offline Genesis runtime/storage materialization; live deployment verification remains STAKE-AUDIT-8.",
        })
        d=[x for x in manifest.get("contracts",[]) if x.get("name")==name]
        if len(d)!=1:
            fail("deployment manifest entry count drift for "+name)
        d[0].update({
            "runtime_artifact":"contracts/artifacts/"+name+".json",
            "runtime_code_hash":state["runtimeCodeHash"],
            "predeploy_state":"contracts/config/predeploy/"+name+"-predeploy-state.json",
            "source_blob_sha1":state["sourceBlobSha1"],
            "artifact_status":"STAKE_AUDIT_7_ARTIFACT_READY",
        })
        if name=="CommunityValidatorReserve":
            d[0]["genesis_balance_wei"]=state["genesisBalanceWei"]
    storage_init["stake_genesis_config_hash"]=values["genesisConfigHash"]
    return plan,manifest,storage_init

def expected_files():
    config,values,records=build_records()
    plan,manifest,storage_init=update_bindings(values,records)
    files={}
    for name,(artifact,state) in records.items():
        files[CONTRACTS/("artifacts/"+name+".json")]=canonical_json(artifact)
        files[CONTRACTS/("config/predeploy/"+name+"-predeploy-state.json")]=canonical_json(state)
    files[PLAN]=canonical_json(plan)
    files[MANIFEST]=canonical_json(manifest)
    files[STORAGE_INIT]=canonical_json(storage_init)
    summary={
        "schema":"420-stake-audit-7-materialization-v1",
        "status":"STAKE_AUDIT_7_OFFLINE_PREDEPLOY_READY",
        "stakeGenesisConfig":"contracts/config/predeploy/stake-genesis-config-v1.json",
        "stakeGenesisConfigHash":values["genesisConfigHash"],
        "contracts":{name:{
            "address":SPECS[name]["address"],
            "runtimeCodeHash":records[name][1]["runtimeCodeHash"],
            "storageRoot":records[name][1]["storageRoot"],
            "storageSlotCount":records[name][1]["storageSlotCount"],
            "sourceBlobSha1":records[name][1]["sourceBlobSha1"],
            "genesisBalanceWei":records[name][1]["genesisBalanceWei"],
        } for name in SPECS},
        "liveDeploymentVerified":False,
        "next":"STAKE-AUDIT-8",
    }
    files[CONTRACTS/"config/predeploy/Stake420-materialization.json"]=canonical_json(summary)
    return files,summary

def main(argv=None):
    parser=argparse.ArgumentParser()
    parser.add_argument("--write",action="store_true")
    parser.add_argument("--check",action="store_true")
    parser.add_argument("--print",action="store_true",dest="print_output")
    args=parser.parse_args(argv)
    try:
        files,summary=expected_files()
        if args.write:
            for path,text in files.items():
                path.parent.mkdir(parents=True,exist_ok=True)
                path.write_text(text,encoding="utf-8")
        if args.check:
            for path,text in files.items():
                if not path.is_file():
                    fail("committed Audit7 file missing: "+str(path.relative_to(ROOT)))
                if path.read_text(encoding="utf-8")!=text:
                    fail("Audit7 materialization is not reproducible: "+str(path.relative_to(ROOT)))
        if args.print_output:
            print(canonical_json(summary),end="")
        print("STAKE_AUDIT_7_MATERIALIZATION=PASS")
        print("stakeGenesisConfigHash="+summary["stakeGenesisConfigHash"])
        for name,item in summary["contracts"].items():
            print("%s.runtimeCodeHash=%s"%(name,item["runtimeCodeHash"]))
            print("%s.storageRoot=%s"%(name,item["storageRoot"]))
        return 0
    except (OSError,ValueError,KeyError,json.JSONDecodeError,subprocess.CalledProcessError,urllib.error.URLError) as exc:
        print("STAKE-AUDIT-7 blocked: %s"%exc,file=sys.stderr)
        return 2

if __name__=="__main__":
    sys.exit(main())
