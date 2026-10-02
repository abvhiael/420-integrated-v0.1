#!/usr/bin/env python3
"""PAY-AUDIT-6 deterministic deployment/runtime materialization.

420Pay residents are Registry-resolved and MUST NOT be assigned invented fixed
addresses. Their runtime identities are nevertheless deterministic because the
only inherited immutables are the frozen GovernanceTimelock, ProtocolRegistry,
and canonical global genesisConfigHash. This tool materializes compiler-reported
immutable references from exact Foundry artifacts and either prints the derived
runtime identities or checks them against the retained PAY-AUDIT-6 package.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
CONTRACTS = ROOT / "contracts"
OUT = CONTRACTS / "out"
PACKAGE = CONTRACTS / "config/pay/pay-audit-6-deployment-package.json"
GENESIS_COMMITMENT = CONTRACTS / "config/genesis-config-commitment.json"
FOUNDRY = CONTRACTS / "foundry.toml"
TOOLCHAIN = CONTRACTS / "config/security/toolchain.json"

TIMELOCK = "0x0000000000000000000000000000000000000429"
REGISTRY = "0x0000000000000000000000000000000000000434"

RESIDENTS = {
    "MerchantRegistry420": ("pay/MerchantRegistry420.sol", "420/APP/420PAY/MERCHANT_REGISTRY"),
    "InvoiceRegistry420": ("pay/InvoiceRegistry420.sol", "420/APP/420PAY/INVOICE_REGISTRY"),
    "PaymentRegistry420": ("pay/PaymentRegistry420.sol", "420/APP/420PAY/PAYMENT_REGISTRY"),
    "PaymentRouter420": ("pay/PaymentRouter420.sol", "420/APP/420PAY/PAYMENT_ROUTER"),
    "SettlementRouter420": ("pay/SettlementRouter420.sol", "420/APP/420PAY/SETTLEMENT_ROUTER"),
    "RefundManager420": ("pay/RefundManager420.sol", "420/APP/420PAY/REFUND_MANAGER"),
    "GasSponsor420": ("pay/GasSponsor420.sol", "420/APP/420PAY/GAS_SPONSOR"),
    "CanonicalSettlementAdapter420": ("pay/adapters/CanonicalSettlementAdapter420.sol", "420/APP/420PAY/SETTLEMENT_ADAPTER"),
    "CanonicalSwapHealthAdapter420": ("pay/adapters/CanonicalSwapHealthAdapter420.sol", "420/APP/420PAY/SWAP_HEALTH_ADAPTER"),
}

def fail(msg: str) -> None:
    raise ValueError(msg)

def run(*args: str, cwd: pathlib.Path | None = None) -> str:
    return subprocess.check_output(args, cwd=cwd or ROOT, text=True).strip()

def git_blob(path: pathlib.Path) -> str:
    return run("git", "hash-object", str(path.relative_to(ROOT)))

def keccak(hex_value: str) -> str:
    return run("cast", "keccak", hex_value).lower()

def normalize_hex(value: object) -> str:
    if not isinstance(value, str) or not value.startswith("0x"):
        fail("expected 0x hex")
    body=value[2:]
    if len(body)%2 or any(c not in "0123456789abcdefABCDEF" for c in body):
        fail("invalid hex")
    return "0x"+body.lower()

def artifact_path(name: str) -> pathlib.Path:
    return OUT / f"{name}.sol" / f"{name}.json"

def immutables(name: str, raw: dict) -> dict[str,list[dict]]:
    deployed=raw.get("deployedBytecode",{})
    refs=deployed.get("immutableReferences",{})
    if not isinstance(refs,dict) or len(refs)!=3:
        fail(f"{name} immutable count mismatch")
    ids=sorted(refs,key=lambda x:int(x))
    names=["registry","genesisConfigHash","governanceTimelock"]
    return {names[i]:refs[k] for i,k in enumerate(ids)}

def encoded(name: str, genesis_hash: str) -> bytes:
    if name=="governanceTimelock":
        return bytes.fromhex("00"*12+TIMELOCK[2:])
    if name=="registry":
        return bytes.fromhex("00"*12+REGISTRY[2:])
    if name=="genesisConfigHash":
        return bytes.fromhex(genesis_hash[2:])
    fail("unknown immutable "+name)

def materialize(name: str, raw: dict, genesis_hash: str) -> tuple[str,list[dict]]:
    template=normalize_hex(raw.get("deployedBytecode",{}).get("object"))
    code=bytearray.fromhex(template[2:])
    refs=immutables(name,raw)
    patched=[]
    for var,locations in refs.items():
        value=encoded(var,genesis_hash)
        for loc in locations:
            start=loc.get("start"); length=loc.get("length")
            if not isinstance(start,int) or length!=32 or start<0 or start+32>len(code):
                fail(f"{name} malformed immutable reference")
            code[start:start+32]=value
            patched.append({
                "variable":var,
                "start":start,
                "length":32,
                "value": genesis_hash if var=="genesisConfigHash" else (TIMELOCK if var=="governanceTimelock" else REGISTRY)
            })
    return "0x"+code.hex(),patched

def compiler_record() -> dict:
    cfg=FOUNDRY.read_text()
    for token in ['solc_version = "0.8.24"','evm_version = "cancun"',"optimizer = true","optimizer_runs = 200","via_ir = true"]:
        if token not in cfg: fail("foundry setting drift "+token)
    tc=json.loads(TOOLCHAIN.read_text())
    for key,value in {"solidity_version":"0.8.24","evm_version":"cancun","optimizer":True,"optimizer_runs":200}.items():
        if tc.get(key)!=value: fail("toolchain drift "+key)
    return {
        "solidity":"0.8.24","evmVersion":"cancun","optimizer":True,"optimizerRuns":200,"viaIR":True,
        "foundryConfigBlobSha1":git_blob(FOUNDRY),
        "toolchainConfigBlobSha1":git_blob(TOOLCHAIN),
    }

def derive() -> dict:
    commitment=json.loads(GENESIS_COMMITMENT.read_text())
    genesis_hash=str(commitment.get("genesisConfigHash","")).lower()
    if len(genesis_hash)!=66 or not genesis_hash.startswith("0x"):
        fail("canonical genesisConfigHash missing")
    compiler=compiler_record()
    residents=[]
    for name,(source,component) in RESIDENTS.items():
        ap=artifact_path(name)
        if not ap.is_file(): fail(f"missing Foundry artifact {ap.relative_to(ROOT)}")
        raw=json.loads(ap.read_text())
        runtime,patched=materialize(name,raw,genesis_hash)
        src=CONTRACTS/"src"/source
        abi=raw.get("abi",[])
        residents.append({
            "contract":name,
            "source":str(src.relative_to(ROOT)).replace("\\","/"),
            "source_blob_sha1":git_blob(src),
            "component_id_preimage":component,
            "deployment_address":None,
            "artifact":str(ap.relative_to(ROOT)).replace("\\","/"),
            "runtime_code_hash":keccak(runtime),
            "runtime_bytes":(len(runtime)-2)//2,
            "runtime_template_hash":keccak(normalize_hex(raw.get("deployedBytecode",{}).get("object"))),
            "creation_bytecode_hash":keccak(normalize_hex(raw.get("bytecode",{}).get("object"))),
            "abi_sha256":hashlib.sha256(json.dumps(abi,sort_keys=True,separators=(",",":")).encode()).hexdigest(),
            "immutable_materialization":patched,
        })
    return {
        "compiler":compiler,
        "governance_timelock":TIMELOCK,
        "protocol_registry":REGISTRY,
        "genesis_config_hash":genesis_hash,
        "residents":residents,
    }

def verify(package: dict, derived: dict) -> None:
    if package.get("schema")!="420pay-audit-6-deployment-package-v1": fail("package schema")
    if package.get("step")!="PAY-AUDIT-6": fail("package step")
    if package.get("address_policy")!="REGISTRY_RESOLVED_NO_FIXED_PAY_ADDRESSES": fail("address policy")
    if package.get("governance_timelock","").lower()!=derived["governance_timelock"]: fail("timelock")
    if package.get("protocol_registry","").lower()!=derived["protocol_registry"]: fail("registry")
    if package.get("genesis_config_hash","").lower()!=derived["genesis_config_hash"]: fail("config hash")
    expected={x["contract"]:x for x in package.get("residents",[])}
    actual={x["contract"]:x for x in derived["residents"]}
    if set(expected)!=set(actual): fail("resident inventory")
    for name,a in actual.items():
        e=expected[name]
        for field in ("source","source_blob_sha1","component_id_preimage","runtime_code_hash","runtime_bytes","runtime_template_hash","creation_bytecode_hash","abi_sha256"):
            if e.get(field)!=a.get(field): fail(f"{name} {field} drift")
        if e.get("deployment_address") is not None: fail(f"{name} invented fixed address")
        if e.get("artifact")!=a.get("artifact"): fail(f"{name} artifact path")
        if e.get("immutable_materialization")!=a.get("immutable_materialization"): fail(f"{name} immutable materialization drift")
    if package.get("compiler")!=derived["compiler"]: fail("compiler provenance drift")

def main() -> int:
    p=argparse.ArgumentParser()
    p.add_argument("--print",action="store_true",dest="print_output")
    p.add_argument("--check",action="store_true")
    p.add_argument("--output")
    args=p.parse_args()
    try:
        d=derive()
        if args.output:
            pathlib.Path(args.output).write_text(json.dumps(d,indent=2,sort_keys=True)+"\n",encoding="utf-8")
        if args.print_output:
            print(json.dumps(d,sort_keys=True))
        if args.check:
            if not PACKAGE.is_file(): fail("retained package missing")
            verify(json.loads(PACKAGE.read_text()),d)
        print("PAY_AUDIT_6_RUNTIME_MATERIALIZATION=PASS")
        for x in d["residents"]:
            print(f"{x['contract']}={x['runtime_code_hash']} bytes={x['runtime_bytes']}")
        return 0
    except (OSError,ValueError,KeyError,subprocess.CalledProcessError,json.JSONDecodeError) as exc:
        print("PAY-AUDIT-6 materialization failed: "+str(exc),file=sys.stderr)
        return 2

if __name__=="__main__":
    raise SystemExit(main())
