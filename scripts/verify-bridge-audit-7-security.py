#!/usr/bin/env python3
import json, pathlib, re, sys

ROOT=pathlib.Path(__file__).resolve().parents[1]

def load(path):
    return json.loads((ROOT/path).read_text(encoding="utf-8"))

errors=[]
def require(cond,msg):
    if not cond: errors.append(msg)

manifest=load("contracts/config/bridge/security-hardening-v1.json")
require(manifest.get("schema")=="420-bridge-security-hardening-v1","security manifest schema")
require(manifest.get("step")=="BRIDGE-AUDIT-7","security manifest step")

launch=load("contracts/config/bridge/launch-catalog-v12.5.1.json")
roadmap_status=launch.get("roadmap_status",{})
adapters=manifest.get("canonicalProductionAdapters",[])
require(len(adapters)==12,"expected 12 canonical production adapters")

domains=[]
for entry in adapters:
    path=entry["path"]
    p=ROOT/path
    require(p.exists(),f"missing adapter {path}")
    require(entry["launchSlice"] in roadmap_status,f"launch slice missing {entry['launchSlice']}")
    domains.append(entry["domain"])
    if not p.exists(): continue
    src=p.read_text(encoding="utf-8")
    for marker in [
        "IBridgeAdapter420",
        "ADAPTER_ID",
        "onlyRouter",
        "consumedMessages",
        "setVerifier",
        ".code.length",
        "outboundNonce",
        "verifyInbound",
        "initiateOutbound",
    ]:
        require(marker in src,f"{path}: missing security marker {marker}")
    require(entry["domain"] in src,f"{path}: ADAPTER_ID domain drift")
    adapter_test=ROOT/("contracts/test/"+entry["name"]+".t.sol")
    require(adapter_test.exists(),f"{path}: missing dedicated adapter test {adapter_test.relative_to(ROOT)}")
    require("tx.origin" not in src,f"{path}: forbidden tx.origin")
    require("selfdestruct" not in src,f"{path}: forbidden selfdestruct")
    require(".delegatecall" not in src,f"{path}: forbidden delegatecall")

require(len(set(domains))==len(domains),"canonical adapter domain collision")

for path in manifest.get("productionCore",[]):
    p=ROOT/path
    require(p.exists(),f"missing production core {path}")
    if not p.exists(): continue
    src=p.read_text(encoding="utf-8")
    require("tx.origin" not in src,f"{path}: forbidden tx.origin")
    require("selfdestruct" not in src,f"{path}: forbidden selfdestruct")
    require(".delegatecall" not in src,f"{path}: forbidden delegatecall")

for entry in manifest.get("disabledLegacyScaffolds",[]):
    p=ROOT/entry["path"]
    require(p.exists(),f"missing disabled scaffold {entry['path']}")
    if not p.exists(): continue
    src=p.read_text(encoding="utf-8")
    require('revert("production verifier not wired")' in src,f"{entry['path']}: inbound scaffold not fail-closed")
    require('revert("production outbound path not wired")' in src,f"{entry['path']}: outbound scaffold not fail-closed")

for path in manifest.get("retainedSecuritySuites",[]):
    require((ROOT/path).exists(),f"missing retained security suite {path}")

# Explicit A7 property anchors.
tests=(ROOT/"contracts/test/BridgeGenesisIntegration420.t.sol").read_text(encoding="utf-8")
require("testOutboundAdapterFailureRollsBackRiskAndTransferRegistration" in tests,"missing external-call risk rollback test")
acct=(ROOT/"contracts/test/GovernanceAccountingRecoveryHardening420.t.sol").read_text(encoding="utf-8")
require("testFuzz_StaleOrDuplicateObservedAtCannotReplaceLatest" in acct,"missing accounting monotonicity fuzz")

risk=(ROOT/"contracts/test/BridgeRiskFuzz420.t.sol").read_text(encoding="utf-8")
require("testFuzz_InboundUsageNeverExceedsConfiguredCaps" in risk,"missing risk fuzz cap property")
inv=(ROOT/"contracts/test/BridgeInvariant420.t.sol").read_text(encoding="utf-8")
require("invariant_RouteAndAssetTVLAgreeWithModel" in inv,"missing risk/TVL invariant")
lifecycle=(ROOT/"contracts/test/BridgeTransferLifecycle420.t.sol").read_text(encoding="utf-8")
for marker in ["testAllowedTransitionMatrixMatchesFrozenGraph","COMPLETED","REFUNDED"]:
    require(marker in lifecycle,f"missing lifecycle terminality marker {marker}")

# Retained V12.6 hardening slices must still exist and be mapped to tests.
slice_tests={
    "contracts/config/bridge/cross-adapter-hardening-v12.6.1.json":"contracts/test/CrossAdapterHardening420.t.sol",
    "contracts/config/bridge/cross-adapter-hardening-v12.6.2.json":"contracts/test/NativeAdapterReplayDomainHardening420.t.sol",
    "contracts/config/bridge/cross-adapter-hardening-v12.6.4.json":"contracts/test/EmergencyControlsHardening420.t.sol",
    "contracts/config/bridge/cross-adapter-hardening-v12.6.5.json":"contracts/test/MalformedProofRecipientFuzzHardening420.t.sol",
    "contracts/config/bridge/cross-adapter-hardening-v12.6.6.json":"contracts/test/DomainNonceRouterBypassHardening420.t.sol",
    "contracts/config/bridge/cross-adapter-hardening-v12.6.7.json":"contracts/test/GovernanceAccountingRecoveryHardening420.t.sol",
}
for cfg,test in slice_tests.items():
    require((ROOT/cfg).exists(),f"missing hardening config {cfg}")
    require((ROOT/test).exists(),f"missing hardening test {test}")

rotation=ROOT/"contracts/test/VerifierRotationHardening420.t.sol"
require(rotation.exists(),"missing verifier rotation hardening suite")

# Gateway/router core admission order and rollback-sensitive boundaries.
router=(ROOT/"contracts/src/bridge/GatewayRouter420.sol").read_text(encoding="utf-8")
for marker in [
    "_requireBridgeAsset",
    "_requireRouteHealthy",
    "_requireAccountingHealthy",
    "_requireRouteDirection",
    "IBridgeRiskConsumer420",
    "initiateOutbound",
]:
    require(marker in router,f"GatewayRouter missing {marker}")

# Accepted risks must be explicit; unresolved repository defects must be empty for A7 exit.
require(len(manifest.get("acceptedDesignRisks",[]))>=3,"accepted design risks not recorded")
require(manifest.get("unresolvedRepositoryDefects")==[],"unresolved repository defects remain")

if errors:
    print("BRIDGE_AUDIT_7_SECURITY=FAIL")
    for e in errors: print("-",e)
    sys.exit(1)

print("BRIDGE_AUDIT_7_SECURITY=PASS")
print(f"production_core={len(manifest['productionCore'])}")
print(f"canonical_adapters={len(adapters)}")
print(f"disabled_legacy_scaffolds={len(manifest['disabledLegacyScaffolds'])}")
print(f"retained_security_suites={len(manifest['retainedSecuritySuites'])}")
