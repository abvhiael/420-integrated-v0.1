#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DESCRIPTOR = ROOT / "420-indexer/descriptors/treasury420-v1.json"
OUT = ROOT / "contracts/out"

descriptor = json.loads(DESCRIPTOR.read_text(encoding="utf-8"))
errors = []

def fail(message):
    errors.append(message)

if descriptor.get("schema") != "420-treasury-artifact-descriptor-v1":
    fail("descriptor schema drift")
if descriptor.get("descriptorVersion") != 1:
    fail("descriptor version drift")
if descriptor.get("protocol") != "420Treasury":
    fail("descriptor protocol drift")
if descriptor.get("authority") != "artifact_events_only_addresses_resolved_by_deployment":
    fail("descriptor authority drift")

expected_contracts = {
    "TreasuryPolicyRegistry420",
    "TreasuryBudgetRegistry420",
    "TreasuryDisbursementRegistry420",
}
contracts = descriptor.get("contracts", [])
if {item.get("contractName") for item in contracts} != expected_contracts:
    fail("descriptor contract inventory drift")

for item in contracts:
    name = item.get("contractName")
    artifact_path = OUT / f"{name}.sol" / f"{name}.json"
    if not artifact_path.exists():
        fail(f"compiled artifact missing: {artifact_path.relative_to(ROOT)}")
        continue
    artifact = json.loads(artifact_path.read_text(encoding="utf-8"))
    abi_events = [entry for entry in artifact.get("abi", []) if entry.get("type") == "event"]
    actual = {}
    for event in abi_events:
        signature = event["name"] + "(" + ",".join(inp["type"] for inp in event.get("inputs", [])) + ")"
        actual[signature] = {
            "name": event["name"],
            "inputs": [
                {
                    "name": inp.get("name"),
                    "type": inp.get("type"),
                    "indexed": bool(inp.get("indexed")),
                }
                for inp in event.get("inputs", [])
            ],
        }
    declared = {
        event.get("signature"): {
            "name": event.get("name"),
            "inputs": event.get("inputs"),
        }
        for event in item.get("events", [])
    }
    if set(actual) != set(declared):
        fail(f"{name} event signature set drift: actual={sorted(actual)} declared={sorted(declared)}")
        continue
    for signature in sorted(actual):
        if actual[signature] != declared[signature]:
            fail(f"{name} event ABI/indexing drift: {signature}")

required_fields = {
    ("TreasuryBudgetRegistry420", "BudgetCreated(bytes32,bytes32,bytes32,address,uint128,uint64,uint64,bytes32,bytes32)"): "metadataHash",
    ("TreasuryDisbursementRegistry420", "DisbursementScheduled(bytes32,bytes32,address,address,uint128,uint64,uint64,bytes32,bytes32)"): "purposeHash",
}
for (contract, signature), field in required_fields.items():
    item = next((x for x in contracts if x.get("contractName") == contract), None)
    event = next((x for x in (item or {}).get("events", []) if x.get("signature") == signature), None)
    if event is None or field not in [x.get("name") for x in event.get("inputs", [])]:
        fail(f"reconstruction field missing: {contract}.{field}")

if errors:
    print("TREASURY-AUDIT-5 descriptor verification FAILED")
    for error in errors:
        print(" - " + error)
    raise SystemExit(1)

print("TREASURY_AUDIT_5_DESCRIPTOR=PASS")
print("contracts=3")
print("events=" + str(sum(len(x.get("events", [])) for x in contracts)))
print("deploymentAddresses=DEFERRED_TO_TREASURY_AUDIT_6")
