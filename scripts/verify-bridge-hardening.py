#!/usr/bin/env python3
import json
import pathlib
import sys

root = pathlib.Path(__file__).resolve().parents[1]
errors = []

required = [
    "BridgeChainRegistry420.sol",
    "BridgeAssetRegistry.sol",
    "BridgeRouteRegistry.sol",
    "BridgeRiskManager.sol",
    "BridgeTransferRegistry.sol",
    "GatewayRouter420.sol",
    "BridgeAccountingRegistry.sol",
    "VerifiedGateway420.sol",
]
for filename in required:
    if not (root / "contracts/src/bridge" / filename).exists():
        errors.append("missing " + filename)

limits = json.loads((root / "contracts/config/bridge/risk-limits.json").read_text())
if limits.get("status") != "FROZEN_GENESIS_LIMITS":
    errors.append("limits not frozen")
assets = {entry["asset"]: entry for entry in limits["asset_aggregate_limits"]}
if assets["BTC"]["max_tvl"] != 0:
    errors.append("BTC exposure nonzero")
if assets["CADC"]["max_tvl"] != 2000000:
    errors.append("CADC cap")
if assets["USDC"]["max_tvl"] != 2000000:
    errors.append("USDC cap")

risk = (root / "contracts/src/bridge/BridgeRiskManager.sol").read_text()
for token in ["trustedRouter", "_requireOperational", "IRiskLimits420", "maxHourlyIn", "maxDailyOut", "maxTVL"]:
    if token not in risk:
        errors.append("risk missing " + token)
for forbidden in ["routeInboundPaused", "routeOutboundPaused", "assetPaused", "allPaused"]:
    if forbidden in risk:
        errors.append("legacy local pause state retained: " + forbidden)

transfer = (root / "contracts/src/bridge/BridgeTransferRegistry.sol").read_text()
for token in [
    "SOURCE_FINALIZED",
    "PROOF_PENDING",
    "VERIFIED",
    "COMPLETED",
    "consumedTransferId",
    "IReplayProtection420",
    "trustedRouter",
]:
    if token not in transfer:
        errors.append("transfer missing " + token)

chains = (root / "contracts/src/bridge/BridgeChainRegistry420.sol").read_text()
for token in ["chainKeyByRouteId", "networkId", "isActiveRoute", '"route id bound"']:
    if token not in chains:
        errors.append("chain registry missing " + token)

routes = (root / "contracts/src/bridge/BridgeRouteRegistry.sol").read_text()
for token in [
    "BridgeIds420.CHAIN_REGISTRY",
    "ChainBinding",
    "sourceNetworkId",
    "destinationNetworkId",
    "routeChainsCurrent",
    "requireRouteChainsCurrent",
    '"stale chain"',
]:
    if token not in routes:
        errors.append("route registry missing canonical chain binding " + token)

gateway = (root / "contracts/src/bridge/GatewayRouter420.sol").read_text()
for token in [
    "_resolveRequired(BridgeIds420.RISK_MANAGER)",
    "_resolveRequired(BridgeIds420.TRANSFER_REGISTRY)",
    "_requireRouteDirection",
    "_requireRouteHealthy",
    "configuredAdapter == adapterId_",
    "requireRouteChainsCurrent(routeId)",
]:
    if token not in gateway:
        errors.append("router missing " + token)

for test_file in [
    "BridgeGenesisIntegration420.t.sol",
    "BridgeRiskFuzz420.t.sol",
    "BridgeInvariant420.t.sol",
    "BridgeChainRegistry420.t.sol",
    "BridgeRouteChainIdentity420.t.sol",
]:
    if not (root / "contracts/test" / test_file).exists():
        errors.append("missing test " + test_file)

identity_path = root / "contracts/config/bridge/chain-identities-v1.json"
catalog_path = root / "contracts/config/bridge/launch-catalog-v12.5.1.json"
if not identity_path.exists():
    errors.append("missing chain identity bootstrap inventory")
else:
    identities = json.loads(identity_path.read_text())
    local = identities.get("local_420", {})
    if local.get("chain_key") != "420/BRIDGE/CHAIN/420":
        errors.append("local 420 chain key missing")
    if local.get("route_chain_id") != 420:
        errors.append("local 420 route chain id missing")
    if local.get("active") is not False:
        errors.append("unfrozen local testnet identity must remain inactive")
    if not local.get("network_id_source"):
        errors.append("local 420 network identity source missing")

    external = identities.get("external_identities", [])
    external_by_key = {entry.get("chain_key"): entry for entry in external}
    if len(external_by_key) != len(external):
        errors.append("duplicate canonical chain key in bootstrap inventory")

    catalog = json.loads(catalog_path.read_text())
    catalog_keys = {entry["canonical_chain_key"] for entry in catalog.get("assets", [])}
    missing = sorted(catalog_keys - set(external_by_key))
    if missing:
        errors.append("bootstrap inventory missing catalog chain keys: " + ",".join(missing))

    seen_route_ids = set()
    for key, entry in external_by_key.items():
        route_id = entry.get("route_chain_id")
        source_manifest = entry.get("source_manifest")
        if not key or not route_id or not source_manifest:
            errors.append("incomplete external chain bootstrap identity")
            continue
        if route_id in seen_route_ids:
            errors.append("duplicate route chain id in bootstrap inventory: " + str(route_id))
        seen_route_ids.add(route_id)
        if not (root / source_manifest).exists():
            errors.append("missing chain identity source manifest: " + source_manifest)

report = {
    "pass": not errors,
    "errors": errors,
    "routes": len(limits["route_limits"]),
    "assets": len(assets),
    "shared_pause_authority": True,
    "canonical_chain_identity_enforced": not errors,
}
(root / "contracts/config/bridge/hardening-verification.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
sys.exit(0 if not errors else 2)
