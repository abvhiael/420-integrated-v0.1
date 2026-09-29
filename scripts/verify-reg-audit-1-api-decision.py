#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,sys

ROOT=Path(__file__).resolve().parents[1]
errors=[]

decision_path=ROOT/"docs/audit/REG-AUDIT-1-AUTHORITATIVE-REGISTRY-API-DECISION.json"
roadmap_path=ROOT/"docs/audit/420REGISTRY-COMPLETE-AUDIT-20260928.md"
iface_path=ROOT/"contracts/src/interfaces/genesis/IProtocolRegistry420.sol"
registry_path=ROOT/"contracts/src/apps/ProtocolRegistry.sol"
resident_path=ROOT/"contracts/src/system/GenesisResidentAccess420.sol"
dapp_map_path=ROOT/"contracts/config/genesis-dapp-contract-map.json"
freeze_path=ROOT/"contracts/config/interfaces/interface-layer-v1-freeze.json"
layer_path=ROOT/"contracts/config/interfaces/genesis-interface-layer.json"

for p in [decision_path,roadmap_path,iface_path,registry_path,resident_path,dapp_map_path,freeze_path,layer_path]:
    if not p.exists(): errors.append(f"missing {p.relative_to(ROOT)}")

if errors:
    print("\n".join("ERROR: "+e for e in errors)); sys.exit(1)

d=json.loads(decision_path.read_text())
freeze=json.loads(freeze_path.read_text())
layer=json.loads(layer_path.read_text())
dapp=json.loads(dapp_map_path.read_text())
roadmap=roadmap_path.read_text()
iface=iface_path.read_text()
registry=registry_path.read_text()
resident=resident_path.read_text()

if d.get("step")!="REG-AUDIT-1": errors.append("wrong step")
if d.get("title")!="authoritative Registry API decision": errors.append("wrong title")
if d.get("decision",{}).get("option")!="A": errors.append("option A not selected")
if d.get("decision",{}).get("canonicalAuthorityContract")!="contracts/src/apps/ProtocolRegistry.sol":
    errors.append("ProtocolRegistry not sole canonical authority")
if d.get("decision",{}).get("canonicalAdapter") is not None:
    errors.append("canonical adapter must be absent")
if d.get("decision",{}).get("interfaceMigration") is not None:
    errors.append("v2 migration must be absent")
if d.get("decision",{}).get("implementationOwnerStep")!="REG-AUDIT-2":
    errors.append("implementation ownership drift")

expected_hash=d.get("decision",{}).get("frozenInterfaceSha256")
actual_hash=hashlib.sha256(iface_path.read_bytes()).hexdigest()
if actual_hash!=expected_hash:
    errors.append(f"frozen IProtocolRegistry420 hash mismatch {actual_hash} != {expected_hash}")
if actual_hash!="ba08070073f1237ebae0daf7a22dafcd0b9b9f2da68e63bb52cb58301f564224":
    errors.append("frozen interface differs from audited v1 baseline")

if freeze.get("status")!="FROZEN" or freeze.get("version")!="1.0.0":
    errors.append("interface freeze is not FROZEN v1.0.0")
if layer.get("status")!="FROZEN_V1_0" or layer.get("version")!="1.0.0":
    errors.append("interface layer is not FROZEN_V1_0")
if "IProtocolRegistry420" not in freeze.get("shared_interfaces",[]):
    errors.append("IProtocolRegistry420 missing from freeze manifest")
if "IProtocolRegistry420" not in layer.get("shared_interfaces",[]):
    errors.append("IProtocolRegistry420 missing from interface layer")

required_iface=[
    "function component(bytes32 componentId)",
    "function isActive(bytes32 componentId)",
    "function resolve(bytes32 componentId)",
    "function runtimeCodeHash(bytes32 componentId)",
    "function supportsVersion(bytes32 componentId,Types420.Version calldata version)",
    "event ComponentRegistered(",
    "event ComponentLifecycleChanged("
]
for token in required_iface:
    if token not in iface: errors.append("frozen interface missing "+token)

if "IProtocolRegistry420(registry).component(componentId())" not in resident:
    errors.append("GenesisResidentAccess no longer consumes frozen component()")
if "IProtocolRegistry420(registry).supportsVersion(componentId(), v)" not in resident:
    errors.append("GenesisResidentAccess no longer consumes frozen supportsVersion()")

registry_apps=[x for x in dapp.get("apps",[]) if x.get("dapp")=="420 Registry"]
if len(registry_apps)!=1 or registry_apps[0].get("contracts")!=["ProtocolRegistry.sol"]:
    errors.append("Genesis dApp map no longer identifies ProtocolRegistry.sol as sole Registry contract")

identity=d.get("identityModel",{})
if identity.get("implicitConversionAllowed") is not False:
    errors.append("service/component implicit conversion must be forbidden")
version=d.get("versionModel",{})
if version.get("implicitConversionAllowed") is not False:
    errors.append("revision/SemVer implicit conversion must be forbidden")
compat=version.get("supportsVersion",{})
for key in ["requiresActive","sameMajor"]:
    if compat.get(key) is not True: errors.append("supportsVersion policy missing "+key)
if d.get("lifecycleModel",{}).get("resolveInactive")!="fail_closed":
    errors.append("inactive resolve must fail closed")
if d.get("authority",{}).get("mutationAuthority")!="GovernanceTimelock":
    errors.append("mutation authority drift")

if "### REG-AUDIT-1 — freeze the authoritative Registry API decision" not in roadmap:
    errors.append("canonical REG-AUDIT-1 roadmap definition missing")
if "### REG-AUDIT-2 — implement and test the API reconciliation" not in roadmap:
    errors.append("canonical next step missing")

# Post-decision guard: later implementation may satisfy REG-AUDIT-2, but it must
# preserve the frozen REG-AUDIT-1 choice: direct ProtocolRegistry implementation,
# no adapter, no v2 migration, and unchanged frozen interface semantics.
if "contract ProtocolRegistry is SystemAccess, I420System, IProtocolRegistry420" not in registry:
    if "contract ProtocolRegistry is SystemAccess, I420System" not in registry:
        errors.append("ProtocolRegistry no longer matches the frozen direct-implementation decision")
if "IProtocolRegistry420" in registry and "function isServiceActive(bytes32 serviceId)" not in registry:
    errors.append("REG-AUDIT-2 implementation conflates service and component activity selectors")

summary={
    "step":"REG-AUDIT-1",
    "status":"PASS" if not errors else "FAIL",
    "decision":"A_DIRECT_PROTOCOL_REGISTRY_IMPLEMENTATION",
    "frozenInterfaceSha256":actual_hash,
    "canonicalAuthority":"ProtocolRegistry.sol",
    "adapter":None,
    "implementationOwnerStep":"REG-AUDIT-2",
    "errors":errors
}
out=ROOT/"reg-audit-1-evidence"
out.mkdir(exist_ok=True)
(out/"summary.json").write_text(json.dumps(summary,indent=2)+"\n")
print(json.dumps(summary,indent=2))
sys.exit(0 if not errors else 1)
