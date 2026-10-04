#!/usr/bin/env python3
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
errors=[]
def need(cond,msg):
    if not cond: errors.append(msg)
def read(p): return (ROOT/p).read_text(encoding="utf-8")

cfg=json.loads(read("contracts/config/420rights-genesis.json"))
ns=json.loads(read("contracts/config/genesis-address-namespace.json"))
desc=json.loads(read("420-indexer/descriptors/rights420-v1.json"))
life=read("420-indexer/src/lifecycle-reducer.ts")
exports=read("420-indexer/src/index.ts")
abi=read("420-indexer/src/abi-manifest.ts")
service=read("contracts/src/libraries/ServiceIds420.sol")
arch=read("docs/architecture/protocols/rights-verify.md")

expected_contracts=[
 "RightsIds420.sol","RightsAuthorization420.sol","RightsPolicyRegistry420.sol",
 "RightsAssetRegistry420.sol","RightsClaimRegistry420.sol","RightsLicenseRegistry420.sol","RightsRouter420.sol"
]
need(cfg.get("schema")=="420rights-genesis-v1","Rights config schema drift")
need(cfg.get("contracts")==expected_contracts,"Rights canonical contract inventory drift")
need(cfg.get("new_frozen_predeploy_required") is False,"Rights unexpectedly requires fixed predeploy")
inv=cfg.get("genesis_invariants",[])
for n in range(1,13):
    need(any(x.startswith(f"RIGHTS-INV-{n:03d}:") for x in inv),f"missing RIGHTS-INV-{n:03d}")
resolved={x.get("id"):x for x in ns.get("registryResolved",[])}
rr=resolved.get("rights-router")
need(rr is not None,"rights-router missing from registry-resolved namespace")
if rr:
    need(rr.get("contract")=="RightsRouter420.sol","rights-router contract drift")
    need(rr.get("status")=="REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS","rights-router address-authority drift")
fixed={x.get("name") for x in ns.get("fixedAssignments",[])}
need("RightsRouter420" not in fixed,"RightsRouter incorrectly fixed as predeploy")

need(desc.get("schema")=="420-rights-artifact-descriptor-v1","Rights descriptor schema drift")
need(desc.get("protocol")=="420Rights","Rights descriptor protocol drift")
need(desc.get("authority")=="artifact_events_only_addresses_resolved_by_registry","Rights descriptor authority drift")
expected_events={
 "RightsPolicyRegistry420":{"RightClassPolicyConfigured"},
 "RightsAssetRegistry420":{"SubjectRegistered","SubjectMetadataUpdated"},
 "RightsClaimRegistry420":{"ClaimDeclared","ClaimSuperseded","RightHolderTransferred"},
 "RightsLicenseRegistry420":{"LicenseGranted","LicenseRevoked","LicenseRenounced"},
}
actual={c.get("contractName"):{e.get("name") for e in c.get("events",[])} for c in desc.get("contracts",[])}
need(actual==expected_events,"Rights descriptor contract/event set drift")

for name in expected_events:
    artifact=ROOT/"contracts/out"/f"{name}.sol"/f"{name}.json"
    need(artifact.exists(),f"compiled Rights artifact missing: {name}")
    if artifact.exists():
        compiled=json.loads(artifact.read_text())
        ev=[x for x in compiled.get("abi",[]) if x.get("type")=="event"]
        sigs={x["name"]+"("+",".join(i["type"] for i in x.get("inputs",[]))+")":x for x in ev}
        declared=next(c for c in desc["contracts"] if c["contractName"]==name)
        need(len(sigs)==len(declared["events"]),f"compiled Rights event count drift: {name}")
        for expected in declared["events"]:
            got=sigs.get(expected["signature"])
            need(got is not None,f"compiled Rights event missing: {expected['signature']}")
            if got:
                fields=[{"name":i.get("name"),"type":i.get("type"),"indexed":bool(i.get("indexed"))} for i in got.get("inputs",[])]
                need(fields==expected["inputs"],f"compiled Rights ABI input/indexing drift: {expected['signature']}")

for event in ["SubjectRegistered","SubjectMetadataUpdated","ClaimDeclared","ClaimSuperseded","RightHolderTransferred","LicenseGranted","LicenseRevoked","LicenseRenounced"]:
    need(event in life,f"canonical Rights lifecycle event missing: {event}")
for stale in ["RightRegistered","LicenseIssued","RightRevoked","LicenseExpired"]:
    need(stale not in life,f"stale synthetic Rights lifecycle event retained: {stale}")
need("ClaimSuperseded" in life and "oldRightId" in life and "rightId:" in life,"Rights supersession object-key normalization missing")
need("export * from './rights-descriptors.js';" in exports,"Rights descriptor export missing")
need("RightsPolicyRegistry420: '420Rights'" in abi,"Rights policy ABI classification missing")
need('RIGHTS = keccak256("420/service/rights/v1")' in service,"canonical Rights service ID missing")
need("does not" in arch and "legal" in arch.lower(),"Rights non-adjudication boundary missing from architecture")

for path in [
 "contracts/test/RightsGenesis420.t.sol",
 "contracts/test/RightsFocusedHardening420.t.sol",
 "420-indexer/test/rights420-descriptors.test.ts",
]:
    need((ROOT/path).exists(),f"required Rights test missing: {path}")

if errors:
    print(json.dumps({"pass":False,"errors":errors},indent=2))
    raise SystemExit(1)
print(json.dumps({
 "pass":True,"suite":"420Rights","contracts":expected_contracts,
 "invariants":len(inv),"descriptorEvents":sum(len(v) for v in expected_events.values()),
 "rightsRouter":rr,"authority":"registry_resolved_no_fixed_genesis_address"
},indent=2))
