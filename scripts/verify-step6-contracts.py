#!/usr/bin/env python3
import json, pathlib, re, sys
root=pathlib.Path(__file__).resolve().parents[1]
errors=[]

sysaddr=json.loads((root/"config/system-addresses.json").read_text())
assign=sysaddr["assignments"]
addresses=[x["address"].lower() for x in assign]
names=[x["name"] for x in assign]
if len(set(addresses))!=len(addresses): errors.append("duplicate system address")
if len(set(names))!=len(names): errors.append("duplicate system name")
if not addresses or addresses[0]!="0x0000000000000000000000000000000000000420": errors.append("range start wrong")
if not addresses or addresses[-1]!="0x000000000000000000000000000000000000043c": errors.append("range end wrong")
expected=[f"0x{i:040x}" for i in range(0x420,0x43d)]
if addresses!=expected: errors.append("system address map must be contiguous and ordered through 0x043c")
if sysaddr.get("frozen_through","").lower()!=expected[-1]: errors.append("frozen_through mismatch")
if sysaddr.get("native_system_origin",{}).get("address","").lower()!="0xfffffffffffffffffffffffffffffffffffffffe":
    errors.append("native system origin must equal go-ethereum params.SystemAddress")

required=[
 "contracts/src/system/RewardController.sol",
 "contracts/src/system/AttentionTreasury.sol",
 "contracts/src/system/DevelopmentTreasury.sol",
 "contracts/src/system/ValidatorRegistry.sol",
 "contracts/src/system/CommunityValidatorReserve.sol",
 "contracts/src/system/FounderVestingRegistry.sol",
 "contracts/src/system/ConsensusSystemCall420.sol",
 "contracts/src/ai/AIProviderRegistry.sol",
 "contracts/src/ai/AIModelRegistry.sol",
 "contracts/src/ai/AIJobManager.sol",
 "contracts/src/ai/AIJobEscrow.sol",
 "contracts/src/ai/AIReputationRegistry.sol",
]
for rel in required:
    if not (root/rel).exists(): errors.append(f"missing {rel}")

app=json.loads((root/"config/application-domains.json").read_text())
if not all(d.startswith("420/APP/") for d in app["domains"]):
    errors.append("application domain prefix violation")
protocol=json.loads((root/"config/protocol.json").read_text())
for d in protocol.get("cryptography",{}).get("domains",[]):
    if str(d).startswith("420/APP/"):
        errors.append("application domain leaked into consensus cryptography namespace")

vr=(root/"contracts/src/system/ValidatorRegistry.sol").read_text()
if "42_000 ether" not in vr or "21_000 ether" not in vr:
    errors.append("validator bond constants missing")
cv=(root/"contracts/src/system/CommunityValidatorReserve.sol").read_text()
if "6_300_000 ether" not in cv:
    errors.append("community validator reserve constant missing")
fv=(root/"contracts/src/system/FounderVestingRegistry.sol").read_text()
for token in ["FOUNDER_COUNT = 10","LOCKED_PER_FOUNDER = 50_000 ether","RELEASES = 13","INTERVAL = 14 days"]:
    if token not in fv: errors.append("founder vesting invariant missing: "+token)

sc=(root/"contracts/src/system/ConsensusSystemCall420.sol").read_text()
for token in [
    "0xfffffffffffffffffffffffffffffffffffffffe",
    "0x0000000000000000000000000000000000000420",
    "0x0000000000000000000000000000000000000423",
    "420/CONSENSUS_SYSTEM_CALL/V1"
]:
    if token not in sc: errors.append("consensus system-call invariant missing: "+token)

out={"pass":not errors,"errors":errors,"system_address_count":len(assign),"application_domain_count":len(app["domains"])}
(root/"contracts/config/verification.json").write_text(json.dumps(out,indent=2)+"\n")
print(json.dumps(out,indent=2))
sys.exit(0 if not errors else 2)
