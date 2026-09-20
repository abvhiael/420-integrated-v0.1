#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ADDRESS_FILE = ROOT / "contracts/config/genesis-canonical-addresses.json"
MAP_FILE = ROOT / "contracts/config/genesis-dapp-contract-map.json"
SYSTEM_FILE = ROOT / "config/system-addresses.json"
BRIDGE_FILE = ROOT / "config/swap-bridge-extension-addresses.json"
WALLET_INVENTORY_FILE = ROOT / "wallet/deployment-inventory.json"

errors = []
addresses = json.loads(ADDRESS_FILE.read_text())
contract_map = json.loads(MAP_FILE.read_text())

if addresses.get("schema") != "420-genesis-canonical-addresses-v1":
    errors.append("unexpected canonical address schema")
if addresses.get("status") != "FROZEN_FOR_GENESIS":
    errors.append("canonical addresses must be frozen for genesis")

anchors = addresses.get("anchors", [])
reserved = addresses.get("reserved", [])
if not anchors:
    errors.append("canonical anchor list is empty")

all_addresses = []
for entry in anchors + reserved:
    address = entry.get("address", "")
    if not isinstance(address, str) or len(address) != 42 or not address.startswith("0x"):
        errors.append(f"invalid address for {entry.get('id')}: {address}")
        continue
    try:
        int(address[2:], 16)
    except ValueError:
        errors.append(f"non-hex address for {entry.get('id')}: {address}")
    all_addresses.append(address.lower())

if len(all_addresses) != len(set(all_addresses)):
    errors.append("canonical/reserved address collision detected")

factory = next((a for a in anchors if a.get("id") == "smart-account-factory"), None)
if not factory or factory.get("address", "").lower() != "0x0000000000000000000000000000000000000420":
    errors.append("SmartAccountFactory420 canonical address must be 0x0000000000000000000000000000000000000420")

entry_point = next((a for a in reserved if a.get("id") == "entry-point"), None)
if not entry_point or entry_point.get("address", "").lower() != "0x000000000000000000000000000000000000041f":
    errors.append("EntryPoint reservation missing or changed")

mapped_contracts = {
    contract
    for app in contract_map.get("apps", [])
    for contract in app.get("contracts", [])
}
for anchor in anchors:
    contract = anchor.get("contract")
    if contract not in mapped_contracts:
        errors.append(f"canonical anchor contract is not in genesis contract map: {contract}")

policy = addresses.get("policy", {})
for key in [
    "freezeOnlyDiscoveryAuthorityAnchors",
    "frontendsReceiveNoCanonicalContractAddress",
    "implementationsAdaptersTemplatesRemainRegistryResolved",
    "addressReuseForbidden",
    "codeAtFrozenAddressMustMatchGenesisManifest",
]:
    if policy.get(key) is not True:
        errors.append(f"canonical address policy must enforce {key}")

# W14.6: the Names reservation must not collide with either historical system
# allocations or the proposed bridge extension, even when neither appears in
# the canonical anchors list. A reservation is NOT proof of on-chain deployment.
names = next((a for a in anchors if a.get("id") == "names"), None)
legacy_system = json.loads(SYSTEM_FILE.read_text())
bridge_extension = json.loads(BRIDGE_FILE.read_text())
wallet_inventory = json.loads(WALLET_INVENTORY_FILE.read_text())
if not names or names.get("contract") != "Names420.sol":
    errors.append("canonical Names420 anchor is missing")
else:
    names_address = names.get("address", "").lower()
    occupied = {
        entry.get("address", "").lower(): entry.get("name")
        for registry in (legacy_system, bridge_extension)
        for entry in registry.get("assignments", [])
    }
    if names_address in occupied:
        errors.append(f"Names420 reservation collides with {occupied[names_address]} at {names_address}")
    if occupied and names_address <= max(occupied):
        errors.append("Names420 reservation must follow recorded system and bridge allocations")
    lower = int(legacy_system.get("reserved_range", {}).get("start", "0x0"), 16)
    upper = int(legacy_system.get("reserved_range", {}).get("end", "0x0"), 16)
    if not 0 <= lower <= int(names_address, 16) <= upper:
        errors.append("Names420 reservation falls outside the system reserved range")
    inventory_names = wallet_inventory.get("walletAuthority", {}).get("names420", {})
    if inventory_names.get("address", "").lower() != names_address:
        errors.append("Wallet Names420 inventory does not match canonical address reservation")
    if wallet_inventory.get("readyForLiveTestnet") is True and "PENDING" in inventory_names.get("status", ""):
        errors.append("Names420 reservation cannot be promoted to live runtime before deployment qualification")

if errors:
    print(json.dumps({"pass": False, "errors": errors}, indent=2))
    raise SystemExit(1)

print(json.dumps({
    "pass": True,
    "schema": addresses["schema"],
    "frozenAnchors": len(anchors),
    "reservedAddresses": len(reserved),
    "smartAccountFactory": factory["address"],
    "entryPointReservation": entry_point["address"],
    "namesReservation": names["address"],
}, indent=2))
