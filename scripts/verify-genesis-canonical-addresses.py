#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ADDRESS_FILE = ROOT / "contracts/config/genesis-canonical-addresses.json"
MAP_FILE = ROOT / "contracts/config/genesis-dapp-contract-map.json"
SYSTEM_FILE = ROOT / "contracts/config/system-addresses.json"
DEPLOYMENT_FILE = ROOT / "contracts/config/deployment-manifest.json"
PREDEPLOY_FILE = ROOT / "contracts/config/predeploy/predeploy-plan.json"
AI_GENESIS_FILE = ROOT / "config/ai-genesis.json"

errors = []
addresses = json.loads(ADDRESS_FILE.read_text())
contract_map = json.loads(MAP_FILE.read_text())
system = json.loads(SYSTEM_FILE.read_text())
deployment = json.loads(DEPLOYMENT_FILE.read_text())
predeploy = json.loads(PREDEPLOY_FILE.read_text())
ai_genesis = json.loads(AI_GENESIS_FILE.read_text())

if addresses.get("schema") != "420-genesis-canonical-addresses-v1":
    errors.append("unexpected canonical address schema")
if addresses.get("status") != "FROZEN_FOR_GENESIS":
    errors.append("canonical addresses must be frozen for genesis")
if addresses.get("authoritative_predeploy_map") != "contracts/config/system-addresses.json":
    errors.append("canonical address file must name the Step 6.2 system-address map as authoritative")

anchors = addresses.get("anchors", [])
registry_resolved = addresses.get("registry_resolved", [])
reserved = addresses.get("reserved", [])
if not anchors:
    errors.append("canonical anchor list is empty")
if not registry_resolved:
    errors.append("registry-resolved component list is empty")

def valid_address(address):
    if not isinstance(address, str) or len(address) != 42 or not address.startswith("0x"):
        return False
    try:
        int(address[2:], 16)
        return True
    except ValueError:
        return False

system_by_address = {}
system_by_contract = {}
for entry in system.get("assignments", []):
    address = entry.get("address", "").lower()
    name = entry.get("name", "")
    if not valid_address(address):
        errors.append(f"invalid system address for {name}: {address}")
        continue
    if address in system_by_address and system_by_address[address] != name:
        errors.append(f"duplicate Step 6.2 predeploy address {address}: {system_by_address[address]} vs {name}")
    system_by_address[address] = name
    system_by_contract[name] = address

deployment_by_name = {x.get("name"): x.get("address", "").lower() for x in deployment.get("contracts", [])}
predeploy_by_name = {x.get("name"): x.get("address", "").lower() for x in predeploy.get("predeploys", [])}

# The physical Genesis predeploy manifests must agree exactly.
for name, address in system_by_contract.items():
    if deployment_by_name.get(name) != address:
        errors.append(f"deployment manifest mismatch for {name}: {deployment_by_name.get(name)} != {address}")
    if predeploy_by_name.get(name) != address:
        errors.append(f"predeploy plan mismatch for {name}: {predeploy_by_name.get(name)} != {address}")

all_declared_addresses = []
for entry in anchors + reserved:
    address = entry.get("address", "")
    if not valid_address(address):
        errors.append(f"invalid address for {entry.get('id')}: {address}")
        continue
    all_declared_addresses.append(address.lower())
if len(all_declared_addresses) != len(set(all_declared_addresses)):
    errors.append("canonical/reserved address collision detected")

mapped_contracts = {
    contract
    for app in contract_map.get("apps", [])
    for contract in app.get("contracts", [])
}

# Every canonical anchor must be a real Step 6.2 predeploy at exactly the same address.
for anchor in anchors:
    contract = anchor.get("contract", "")
    name = contract[:-4] if contract.endswith(".sol") else contract
    address = anchor.get("address", "").lower()
    if contract not in mapped_contracts:
        errors.append(f"canonical anchor contract is not in genesis contract map: {contract}")
    if system_by_contract.get(name) != address:
        errors.append(
            f"canonical anchor conflicts with Step 6.2 predeploy map: {contract} {address} "
            f"!= {system_by_contract.get(name)}"
        )

# Registry-resolved implementations must never be assigned one of the frozen predeploy addresses.
for item in registry_resolved:
    contract = item.get("contract", "")
    name = contract[:-4] if contract.endswith(".sol") else contract
    if contract not in mapped_contracts:
        errors.append(f"registry-resolved contract is not in genesis contract map: {contract}")
    if name in system_by_contract:
        errors.append(
            f"registry-resolved component is also assigned a frozen Step 6.2 predeploy: "
            f"{contract} at {system_by_contract[name]}"
        )
    if item.get("address") is not None:
        errors.append(f"registry-resolved component must not carry a frozen address: {contract}")

# Native AI compatibility addresses are a cross-file freeze and must match all canonical manifests.
for name, address in ai_genesis.get("interfaces", {}).items():
    normalized = address.lower()
    if system_by_contract.get(name) != normalized:
        errors.append(f"AI genesis/system-address mismatch for {name}")
    if deployment_by_name.get(name) != normalized:
        errors.append(f"AI genesis/deployment-manifest mismatch for {name}")
    if predeploy_by_name.get(name) != normalized:
        errors.append(f"AI genesis/predeploy-plan mismatch for {name}")

entry_point = next((a for a in reserved if a.get("id") == "entry-point"), None)
if not entry_point or entry_point.get("address", "").lower() != "0x000000000000000000000000000000000000041f":
    errors.append("EntryPoint reservation missing or changed")

policy = addresses.get("policy", {})
for key in [
    "freezeOnlyDiscoveryAuthorityAnchors",
    "frontendsReceiveNoCanonicalContractAddress",
    "implementationsAdaptersTemplatesRemainRegistryResolved",
    "addressReuseForbidden",
    "codeAtFrozenAddressMustMatchGenesisManifest",
    "step62PredeployMapIsAuthoritative",
    "registryResolvedComponentsHaveNoFrozenAddress",
]:
    if policy.get(key) is not True:
        errors.append(f"canonical address policy must enforce {key}")

if errors:
    print(json.dumps({"pass": False, "errors": errors}, indent=2))
    raise SystemExit(1)

print(json.dumps({
    "pass": True,
    "schema": addresses["schema"],
    "frozenAnchors": len(anchors),
    "registryResolvedComponents": len(registry_resolved),
    "reservedAddresses": len(reserved),
    "authoritativePredeployCount": len(system_by_contract),
    "aiGenesisInterfacesCrossChecked": len(ai_genesis.get("interfaces", {})),
    "entryPointReservation": entry_point["address"],
}, indent=2))
