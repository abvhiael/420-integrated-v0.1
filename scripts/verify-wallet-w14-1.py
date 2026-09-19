#!/usr/bin/env python3
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
errors = []


def load(path):
    p = ROOT / path
    if not p.exists():
        errors.append(f"missing {path}")
        return {}
    try:
        return json.loads(p.read_text())
    except Exception as exc:
        errors.append(f"invalid json {path}: {exc}")
        return {}


inventory = load("wallet/deployment-inventory.json")
canonical = load("contracts/config/genesis-canonical-addresses.json")
system = load("config/system-addresses.json")
wallet = load("contracts/config/420wallet-genesis.json")

if inventory.get("schema") != "420-wallet-deployment-inventory-v1":
    errors.append("unexpected wallet deployment inventory schema")
if inventory.get("phase") != "W14.1":
    errors.append("wallet deployment inventory must identify W14.1")
if inventory.get("readyForLiveTestnet") is not False:
    errors.append("W14.1 must fail closed until official testnet and address gates are satisfied")

source = inventory.get("sourceOfTruth", {})
if source.get("conflictPolicy") != "FAIL_CLOSED":
    errors.append("wallet deployment conflict policy must fail closed")
if source.get("canonicalAddressRegistry") != "contracts/config/genesis-canonical-addresses.json":
    errors.append("wallet canonical address source drift")
if source.get("networkManifest") != "developer-hub/manifests/testnet.json":
    errors.append("wallet testnet manifest target drift")

network = inventory.get("network", {})
if network.get("environment") != "testnet":
    errors.append("W14.1 network inventory must target testnet")
if network.get("expectedChainId") != "420":
    errors.append("expected 420 chain id missing")
for key in ["rpcHttp", "rpcWebSocket", "explorerUrl", "faucetUrl", "ecosystemManifestUrl"]:
    if network.get(key) is not None:
        errors.append(f"{key} must remain null until an official testnet manifest exists")
if network.get("status") != "BLOCKED_OFFICIAL_TESTNET_MANIFEST":
    errors.append("network status must expose missing official testnet manifest")

official_manifest = ROOT / source.get("networkManifest", "")
if official_manifest.exists():
    errors.append("official testnet manifest now exists; W14.1 blocked inventory must be reconciled before qualification")

anchors = {item.get("id"): item for item in canonical.get("anchors", [])}
reserved = {item.get("id"): item for item in canonical.get("reserved", [])}
authority = inventory.get("walletAuthority", {})
expected = {
    "smartAccountFactory420": ("smart-account-factory", "SmartAccountFactory420.sol"),
    "capabilityRegistry420": ("capability-registry", "CapabilityRegistry420.sol"),
    "protocolRegistry": ("protocol-registry", "ProtocolRegistry.sol"),
    "names420": ("names", "Names420.sol"),
    "identity420": ("identity", "Identity420.sol"),
}
for inventory_key, (anchor_id, contract) in expected.items():
    item = authority.get(inventory_key, {})
    anchor = anchors.get(anchor_id)
    if not anchor:
        errors.append(f"canonical anchor missing: {anchor_id}")
        continue
    if anchor.get("contract") != contract:
        errors.append(f"canonical anchor contract drift: {anchor_id}")
    if item.get("address") != anchor.get("address"):
        errors.append(f"wallet deployment inventory address drift: {inventory_key}")
    if item.get("status") != "FROZEN_BUT_CONFLICTED":
        errors.append(f"{inventory_key} must remain conflicted until system-address reconciliation")

entrypoint = authority.get("entryPoint420", {})
entrypoint_source = reserved.get("entry-point", {})
if entrypoint.get("address") != entrypoint_source.get("address"):
    errors.append("EntryPoint420 reserved address drift")
if entrypoint.get("status") != "RESERVED_PENDING_PRODUCTION_IMPLEMENTATION":
    errors.append("EntryPoint420 production binding status drift")

system_by_address = {item.get("address", "").lower(): item.get("name") for item in system.get("assignments", [])}
conflicts = {item.get("address", "").lower(): item for item in inventory.get("conflicts", [])}
for inventory_key, (anchor_id, _) in expected.items():
    anchor = anchors.get(anchor_id, {})
    address = str(anchor.get("address", "")).lower()
    legacy = system_by_address.get(address)
    if not legacy:
        errors.append(f"expected frozen system-address collision not recorded for {anchor_id}")
        continue
    conflict = conflicts.get(address)
    if not conflict:
        errors.append(f"wallet deployment collision missing from inventory: {address}")
        continue
    if conflict.get("legacySystemAssignment") != legacy:
        errors.append(f"legacy system assignment drift at {address}")
    if conflict.get("canonicalWalletAssignment") != anchor.get("contract"):
        errors.append(f"canonical wallet assignment drift at {address}")
    if conflict.get("resolution") != "REQUIRED_BEFORE_LIVE_TESTNET":
        errors.append(f"collision must block live testnet at {address}")

gates = inventory.get("releaseGates", {})
for key in [
    "officialTestnetManifestPublished",
    "canonicalAddressConflictResolved",
    "entryPointProductionBytecodeBound",
    "rpcChainIdentityQualified",
    "canonicalWalletContractsHaveCode",
    "faucetAndExplorerPublished",
    "walletRuntimeConfigGenerated",
]:
    if gates.get(key) is not False:
        errors.append(f"W14.1 unresolved release gate unexpectedly true: {key}")

if wallet.get("deploymentInventory") != "wallet/deployment-inventory.json":
    errors.append("420wallet genesis profile must reference W14.1 deployment inventory")

if errors:
    print(json.dumps({"pass": False, "phase": "W14.1", "errors": errors}, indent=2))
    sys.exit(1)

print(json.dumps({
    "pass": True,
    "phase": "W14.1",
    "inventoryEstablished": True,
    "readyForLiveTestnet": False,
    "blockers": [
        "official public testnet manifest missing",
        "wallet canonical anchors collide with frozen system-address assignments",
        "EntryPoint420 production implementation binding pending"
    ]
}, indent=2))
