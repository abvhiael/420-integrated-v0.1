#!/usr/bin/env python3
from __future__ import annotations
import json
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/"contracts/artifacts/Identity420.json"
CLIENT=ROOT/"wallet/web/core/identity-management.js"
UI=ROOT/"wallet/web/identity-management-ui.js"
INDEX=ROOT/"wallet/web/index.html"
CHECK=ROOT/"wallet/web/scripts/check.mjs"
USER_GUIDE=ROOT/"docs/apps/identity/user-guide.md"

errors=[]
def fail(msg): errors.append(msg)
def read(path):
    try: return path.read_text(encoding="utf-8")
    except Exception as exc:
        fail(f"{path.relative_to(ROOT)} unreadable: {exc}")
        return ""

try:
    artifact=json.loads(read(ART))
except Exception as exc:
    artifact={}
    fail(f"Identity artifact invalid: {exc}")

if artifact.get("contractName")!="Identity420": fail("Identity artifact contract drift")
if artifact.get("canonicalAddress","").lower()!="0x0000000000000000000000000000000000000436": fail("Identity frozen address drift")

functions={}
for entry in artifact.get("abi",[]):
    if isinstance(entry,dict) and entry.get("type")=="function":
        functions[entry.get("name")]=entry

required={
 "createProfile":["bytes32","bytes32"],
 "updateProfile":["bytes32","bytes32","bool"],
 "setPrimaryName":["bytes32","bytes32"],
 "transferProfileController":["bytes32","address"],
 "acceptProfileController":["bytes32"],
 "profiles":["bytes32"],
 "credentials":["bytes32"],
 "issuers":["bytes32"],
 "credentialValid":["bytes32"],
 "rejectCredential":["bytes32"],
 "systemName":[],
 "protocolVersion":[],
}
for name,types in required.items():
    entry=functions.get(name)
    if not entry:
        fail("artifact missing Wallet-required function "+name)
        continue
    actual=[x.get("type") for x in entry.get("inputs",[]) if isinstance(x,dict)]
    if actual!=types: fail(f"{name} input mismatch: {actual}")

client=read(CLIENT)
for token in [
 "Identity420","Names420","eth_chainId","eth_getCode","eth_accounts",
 "eth_call","eth_estimateGas","eth_sendTransaction","eth_getTransactionReceipt",
 "createProfile(bytes32,bytes32)","updateProfile(bytes32,bytes32,bool)",
 "setPrimaryName(bytes32,bytes32)","transferProfileController(bytes32,address)",
 "acceptProfileController(bytes32)","rejectCredential(bytes32)",
 "nameClaimsProfile(bytes32,bytes32)","credentialValid(bytes32)",
 "Names420 does not currently claim this profile","not profile controller",
 "not pending controller","not credential subject"
]:
    if token not in client: fail("Identity client missing guard: "+token)
for forbidden in ["privateKey","mnemonic","seedPhrase","localStorage","sessionStorage"]:
    if forbidden in client: fail("Identity client contains forbidden secret/persistence pattern: "+forbidden)

ui=read(UI)
for token in [
 "Create profile","Update metadata/activity","Nominate controller","Accept controller transfer",
 "Validate bilateral binding","Set / change primary","Unlink primary",
 "Inspect credential","Reject credential","role=\"status\"","role=\"alert\"",
 "does not prove legal identity or wallet ownership",
 "Trust class describes issuer policy only",
 "Rejection is irreversible"
]:
    if token not in ui: fail("Identity UI missing requirement: "+token)

index=read(INDEX)
for token in ['data-scroll-target="#identity-management-panel"','src="./identity-management-ui.js"']:
    if token not in index: fail("Wallet shell missing Identity binding: "+token)

check=read(CHECK)
for token in ["core/identity-management.js","identity-management-ui.js","test/identity-management.test.js","test/identity-management-ui.test.js"]:
    if token not in check: fail("Wallet static qualification missing Identity artifact: "+token)

guide=read(USER_GUIDE).lower()
for token in ["controller","primary","credential","reject"]:
    if token not in guide: fail("Identity user guide missing "+token)

if errors:
    print("ID-AUDIT-7 qualification FAILED",file=sys.stderr)
    for e in errors: print(" - "+e,file=sys.stderr)
    raise SystemExit(1)

print("ID-AUDIT-7 mechanical qualification PASS")
print("Wallet Identity contract:",artifact.get("canonicalAddress"))
print("Required contract functions:",len(required))
print("Bilateral Names validation: PASS")
print("Legal identity/wallet ownership overclaim guard: PASS")
