#!/usr/bin/env python3
import json, pathlib, sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
def load(p): return json.loads((ROOT/p).read_text(encoding="utf-8"))
def fail(m): print("BRIDGE_AUDIT_6_FAIL:",m,file=sys.stderr); sys.exit(1)
m=load("contracts/config/bridge/deployment-v1.json")
if m.get("schema")!="420-bridge-deployment-v1" or m.get("step")!="BRIDGE-AUDIT-6": fail("deployment manifest identity")
if m.get("status")!="REPOSITORY_DEPLOYMENT_SPEC_COMPLETE_LIVE_DEPLOYMENT_PENDING_BRIDGE_AUDIT_9": fail("deployment status")
ci=m["canonicalInputs"]
if ci["governanceTimelock"]["value"].lower()!="0x0000000000000000000000000000000000000429": fail("timelock")
if ci["protocolRegistry"]["value"].lower()!="0x0000000000000000000000000000000000000434": fail("registry")
if ci["verifiedGateway"]["value"].lower()!="0x0000000000000000000000000000000000000438": fail("gateway")
if ci["genesisConfigHash"]["value"].lower()!="0x01aea63faef55d711e5f93e800b04702177874f4015375b659038ce991d20921": fail("genesis hash")
if int(ci["initialVerifiedGatewayVerifier"]["value"],16)!=0: fail("gateway must start disabled")
fixed=m["fixedPredeploys"]
if len(fixed)!=1 or fixed[0]["name"]!="VerifiedGateway420" or fixed[0]["address"].lower()!=ci["verifiedGateway"]["value"].lower(): fail("fixed gateway")
expected={
"GatewayRouter420":"420/APP/420BRIDGE/GATEWAY_ROUTER",
"BridgeRiskManager":"420/APP/420BRIDGE/RISK_MANAGER",
"BridgeTransferRegistry":"420/APP/420BRIDGE/TRANSFER_REGISTRY",
"BridgeAssetRegistry":"420/APP/420BRIDGE/ASSET_REGISTRY",
"BridgeChainRegistry420":"420/APP/420BRIDGE/CHAIN_REGISTRY",
"BridgeRouteRegistry":"420/APP/420BRIDGE/ROUTE_REGISTRY",
"BridgeAccountingRegistry":"420/APP/420BRIDGE/ACCOUNTING_REGISTRY",
"CADCBridgeIntegration":"420/APP/420BRIDGE/CADC_INTEGRATION"}
seen={}
for x in m["registryResolvedComponents"]:
    if x.get("fixedAddress") is not None: fail(x["name"]+" must be registry resolved")
    if not str(x.get("addressSource","")).startswith("DEPLOYMENT_OUTPUT:"): fail(x["name"]+" address source")
    seen[x["name"]]=x["componentId"]["preimage"]
if seen!=expected: fail("component inventory/preimages")
if m["verifiedGatewayRegistryPublication"]["componentId"]["preimage"]!="420/APP/420BRIDGE/VERIFIED_GATEWAY": fail("gateway component id")
ids=(ROOT/"contracts/src/bridge/BridgeIds420.sol").read_text()
for pre in list(expected.values())+["420/APP/420BRIDGE/VERIFIED_GATEWAY"]:
    if pre not in ids: fail("BridgeIds missing "+pre)
gateway=(ROOT/"contracts/src/bridge/VerifiedGateway420.sol").read_text()
for marker in ['if (verifier_ != address(0)) require(verifier_.code.length != 0, "verifier")','require(verifier != address(0) && verifier.code.length != 0, "verifier")']:
    if marker not in gateway: fail("gateway fail-closed verifier marker")
storage=load("contracts/config/predeploy/storage-init.json")
if storage.get("genesis_config_hash","").lower()!=ci["genesisConfigHash"]["value"].lower(): fail("storage genesis hash")
if storage.get("protocol_registry","").lower()!=ci["protocolRegistry"]["value"].lower(): fail("storage registry")
if int(storage.get("bridge_verifier","1"),16)!=0: fail("storage gateway verifier")
if storage["entries"]["VerifiedGateway420"]["constructor"]!=["governance_timelock","protocol_registry","genesis_config_hash","bridge_verifier"]: fail("gateway constructor metadata")
namespace=load("contracts/config/genesis-address-namespace.json")
fixedmap={x["name"]:x["address"].lower() for x in namespace["fixedAssignments"]}
if fixedmap.get("VerifiedGateway420")!=ci["verifiedGateway"]["value"].lower(): fail("namespace gateway")
retired={(x["former"],x["address"].lower(),x["status"]) for x in namespace["retiredClaims"]}
if ("BridgeAssetRegistry","0x000000000000000000000000000000000000043c","RETIRED_NOT_DEPLOYABLE") not in retired: fail("043c retirement")
if ("GatewayRouter420","0x0000000000000000000000000000000000000443","RETIRED_NOT_DEPLOYABLE") not in retired: fail("0443 retirement")
commit=load("contracts/config/genesis-config-commitment.json")
if commit.get("status")!="FROZEN_V1" or commit.get("genesisConfigHash","").lower()!=ci["genesisConfigHash"]["value"].lower(): fail("genesis commitment")
chains=load(m["initializationSources"]["chainIdentities"])
if chains["local_420"].get("active") is not False: fail("local 420 must remain inactive before live identity freeze")
policy=load(m["initializationSources"]["verificationPolicy"])
limits=load(m["initializationSources"]["riskLimits"])
if policy.get("status")!="LOCKED_WITH_GENESIS_RISK_LIMITS" or limits.get("status")!="FROZEN_GENESIS_LIMITS": fail("policy/limits authority")
registry=(ROOT/"contracts/src/apps/ProtocolRegistry.sol").read_text()
if "function registerComponent(" not in registry or "implementation.code.length == 0" not in registry: fail("Registry publication guard")
runbook=(ROOT/"docs/apps/bridge/deployment-operations.md").read_text()
for marker in ["0x0438","ProtocolRegistry.registerComponent","Rollback and recovery","BRIDGE-AUDIT-9"]:
    if marker not in runbook: fail("runbook "+marker)
print("BRIDGE_AUDIT_6_DEPLOYMENT=PASS")
