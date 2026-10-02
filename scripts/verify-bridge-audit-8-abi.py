#!/usr/bin/env python3
from pathlib import Path
import json
import sys

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / "420-indexer/descriptors/bridge420-v1.json").read_text())
errors = []

expected_contracts = {
    "BridgeChainRegistry420",
    "BridgeAssetRegistry",
    "BridgeRouteRegistry",
    "BridgeRiskManager",
    "BridgeTransferRegistry",
    "BridgeAccountingRegistry",
    "GatewayRouter420",
    "VerifiedGateway420",
    "CADCBridgeIntegration",
}
actual_contracts = {c.get("contractName") for c in manifest.get("contracts", [])}
if actual_contracts != expected_contracts:
    errors.append(f"Bridge ABI descriptor contract set mismatch: {sorted(actual_contracts)}")

def abi_events(contract):
    source_name = Path(contract["sourcePath"]).name
    artifact = root / "contracts/out" / source_name / f'{contract["contractName"]}.json'
    if not artifact.exists():
        errors.append(f"compiled Bridge artifact missing: {artifact.relative_to(root)}")
        return []
    payload = json.loads(artifact.read_text())
    return [item for item in payload.get("abi", []) if item.get("type") == "event"]

for contract in manifest.get("contracts", []):
    name = contract["contractName"]
    compiled = abi_events(contract)
    compiled_map = {}
    for event in compiled:
        sig = event["name"] + "(" + ",".join(i["type"] for i in event.get("inputs", [])) + ")"
        compiled_map[sig] = event
    declared = contract.get("events", [])
    if len(compiled_map) != len(declared):
        errors.append(f"{name} event count mismatch: compiled={len(compiled_map)} descriptor={len(declared)}")
    for event in declared:
        sig = event["signature"]
        built = compiled_map.get(sig)
        if built is None:
            errors.append(f"{name} descriptor event missing from generated ABI: {sig}")
            continue
        got_inputs = [
            {"name": i.get("name", ""), "type": i["type"], "indexed": bool(i.get("indexed", False))}
            for i in built.get("inputs", [])
        ]
        if built["name"] != event["name"]:
            errors.append(f"{name} descriptor event name drift: {sig}")
        if got_inputs != event.get("inputs", []):
            errors.append(f"{name} descriptor input/indexing drift: {sig}")

print(json.dumps({
    "pass": not errors,
    "errors": errors,
    "step": "BRIDGE-AUDIT-8",
    "artifact_contracts": sorted(expected_contracts),
    "descriptor_events": sum(len(c.get("events", [])) for c in manifest.get("contracts", [])),
}, indent=2))
sys.exit(0 if not errors else 2)
