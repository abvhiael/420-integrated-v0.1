#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,sys

ROOT=Path(__file__).resolve().parents[1]
errors=[]
iface=ROOT/"contracts/src/interfaces/genesis/IProtocolRegistry420.sol"
registry=ROOT/"contracts/src/apps/ProtocolRegistry.sol"
resident=ROOT/"contracts/src/system/GenesisResidentAccess420.sol"
test=ROOT/"contracts/test/RegistryApiReconciliation420.t.sol"
decision=ROOT/"docs/audit/REG-AUDIT-1-AUTHORITATIVE-REGISTRY-API-DECISION.json"
architecture=ROOT/"docs/apps/registry/architecture.md"
contracts_doc=ROOT/"docs/apps/registry/developer/contracts.md"

for p in [iface,registry,resident,test,decision,architecture,contracts_doc]:
    if not p.exists(): errors.append("missing "+str(p.relative_to(ROOT)))
if errors:
    print(json.dumps({"pass":False,"errors":errors},indent=2)); sys.exit(1)

d=json.loads(decision.read_text())
src=registry.read_text()
tests=test.read_text()
arch=architecture.read_text()
dev=contracts_doc.read_text()
iface_hash=hashlib.sha256(iface.read_bytes()).hexdigest()

if iface_hash!="ba08070073f1237ebae0daf7a22dafcd0b9b9f2da68e63bb52cb58301f564224":
    errors.append("frozen IProtocolRegistry420 v1 hash changed")
if d.get("decision",{}).get("option")!="A":
    errors.append("REG-AUDIT-1 option A no longer selected")
if d.get("decision",{}).get("canonicalAdapter") is not None:
    errors.append("canonical adapter introduced")
if "contract ProtocolRegistry is SystemAccess, I420System, IProtocolRegistry420" not in src:
    errors.append("ProtocolRegistry does not directly implement frozen interface")

required_src=[
    "function registerComponent(",
    "function setComponentLifecycle(",
    "function component(bytes32 componentId)",
    "function isActive(bytes32 componentId)",
    "function resolve(bytes32 componentId)",
    "function runtimeCodeHash(bytes32 componentId)",
    "function supportsVersion(bytes32 componentId",
    "function isServiceActive(bytes32 serviceId)",
    "function currentComponentRevision(bytes32 componentId)",
    "function getComponentRevision(bytes32 componentId, uint32 revision)",
    "implementation.codehash",
    "Types420.Lifecycle.ACTIVE",
    "_componentHistory"
]
for token in required_src:
    if token not in src: errors.append("ProtocolRegistry missing "+token)

if "function isActive(bytes32 serviceId)" in src:
    errors.append("ambiguous service isActive selector still present")
if "ServiceIds420" not in src:
    errors.append("service catalogue removed")
if "function getServiceVersion(bytes32 serviceId, uint32 version)" not in src:
    errors.append("service history API removed")

required_tests=[
    "testProtocolRegistryImplementsFrozenInterfaceDirectly",
    "testServiceAndComponentNamespacesNeverImplicitlyAlias",
    "testSemanticVersionCompatibilityBoundaries",
    "testUnknownAndDeprecatedComponentsFailClosed",
    "testComponentRegistrationRejectsEOAAndUnauthorizedMutation",
    "testComponentRevisionHistoryAndServiceHistoryBothSurvive",
    "testRealGenesisResidentResolvesThroughProtocolRegistryAndFailsClosedWhenDeprecated",
    "testRealGenesisResidentRejectsRuntimeCodeHashDrift"
]
for token in required_tests:
    if token not in tests: errors.append("missing focused test "+token)

if "isServiceActive" not in arch or "isServiceActive" not in dev:
    errors.append("service/component selector split undocumented")
if "IProtocolRegistry420" not in arch or "IProtocolRegistry420" not in dev:
    errors.append("frozen interface reconciliation undocumented")

summary={
  "step":"REG-AUDIT-2",
  "pass":not errors,
  "frozenInterfaceSha256":iface_hash,
  "canonicalAuthority":"ProtocolRegistry.sol",
  "componentInterface":"IProtocolRegistry420 v1.0",
  "serviceActivityRead":"isServiceActive(bytes32)",
  "focusedTestFile":"contracts/test/RegistryApiReconciliation420.t.sol",
  "errors":errors
}
out=ROOT/"reg-audit-2-evidence"
out.mkdir(exist_ok=True)
(out/"summary.json").write_text(json.dumps(summary,indent=2)+"\n")
print(json.dumps(summary,indent=2))
sys.exit(0 if not errors else 1)
