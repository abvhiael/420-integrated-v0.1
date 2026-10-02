#!/usr/bin/env python3
"""Verify the frozen global Genesis resident-contract configuration commitment."""
from __future__ import annotations
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
COMMITMENT = ROOT / "contracts/config/genesis-config-commitment.json"
STORAGE_INIT = ROOT / "contracts/config/predeploy/storage-init.json"
EXPECTED_SCHEMA = "420-genesis-configuration-commitment-v1"
EXPECTED_STATUS = "FROZEN_V1"
EXPECTED_DOMAIN = "420/GENESIS/CONFIG/V1"
EXPECTED_SCOPE = "GENESIS_RESIDENT_CONTRACT_CONFIGURATION"
EXPECTED_TIMELOCK = "0x0000000000000000000000000000000000000429"
EXPECTED_REGISTRY = "0x0000000000000000000000000000000000000434"
EXPECTED_HASH = "0xd5121ed76a785afb903129f8677323477e3cfded1126bc2320ac881a7e68fb38"

errors=[]

def fail(msg: str) -> None:
    errors.append(msg)

def load(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        fail(f"{path.relative_to(ROOT)} unreadable: {exc}")
        return {}

def git_blob(path: Path) -> str:
    try:
        return subprocess.check_output(
            ["git","hash-object",str(path.relative_to(ROOT))],
            cwd=ROOT,text=True
        ).strip()
    except Exception as exc:
        fail(f"git hash-object failed for {path.relative_to(ROOT)}: {exc}")
        return ""

def cast_keccak(data: bytes) -> str:
    try:
        return subprocess.check_output(
            ["cast","keccak","0x"+data.hex()],
            cwd=ROOT,text=True
        ).strip().lower()
    except Exception as exc:
        fail(f"cast keccak failed: {exc}")
        return ""

record=load(COMMITMENT)
storage=load(STORAGE_INIT)

if record.get("schema") != EXPECTED_SCHEMA: fail("commitment schema drift")
if record.get("status") != EXPECTED_STATUS: fail("commitment status drift")
if record.get("commitmentAlgorithm") != "keccak256": fail("commitment algorithm drift")

payload=record.get("commitmentPayload")
if not isinstance(payload,dict):
    fail("commitmentPayload missing")
    payload={}

if payload.get("domain") != EXPECTED_DOMAIN: fail("commitment domain drift")
if payload.get("scope") != EXPECTED_SCOPE: fail("commitment scope drift")
if payload.get("initializationVersion") != 1: fail("initialization version drift")
if str(payload.get("governanceTimelock","")).lower() != EXPECTED_TIMELOCK: fail("GovernanceTimelock drift")
if str(payload.get("protocolRegistry","")).lower() != EXPECTED_REGISTRY: fail("ProtocolRegistry drift")

inputs=payload.get("authorityInputs")
if not isinstance(inputs,list) or not inputs:
    fail("authorityInputs missing")
else:
    seen=set()
    for item in inputs:
        path=item.get("path") if isinstance(item,dict) else None
        expected=item.get("gitBlobSha1") if isinstance(item,dict) else None
        if not isinstance(path,str) or not isinstance(expected,str):
            fail("malformed authority input")
            continue
        if path in seen: fail("duplicate authority input: "+path)
        seen.add(path)
        p=ROOT/path
        if not p.is_file():
            fail("authority input missing: "+path)
            continue
        actual=git_blob(p)
        if actual != expected:
            fail(f"FROZEN_V1 authority input drift: {path}: expected {expected}, got {actual}")

canonical=json.dumps(payload,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode("utf-8")
actual_hash=cast_keccak(canonical)
if actual_hash != EXPECTED_HASH: fail(f"derived genesisConfigHash drift: {actual_hash}")
if str(record.get("genesisConfigHash","")).lower() != EXPECTED_HASH: fail("recorded genesisConfigHash drift")
if str(storage.get("genesis_config_hash","")).lower() != EXPECTED_HASH: fail("storage-init genesis_config_hash drift")
if storage.get("genesis_config_commitment") != "contracts/config/genesis-config-commitment.json":
    fail("storage-init commitment path drift")

if errors:
    print("GENESIS_CONFIG_COMMITMENT=FAIL",file=sys.stderr)
    for e in errors: print(" - "+e,file=sys.stderr)
    raise SystemExit(1)

print("GENESIS_CONFIG_COMMITMENT=PASS")
print("status="+EXPECTED_STATUS)
print("domain="+EXPECTED_DOMAIN)
print("genesisConfigHash="+EXPECTED_HASH)
print("authorityInputs="+str(len(inputs)))
