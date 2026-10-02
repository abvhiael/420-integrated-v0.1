#!/usr/bin/env python3
from pathlib import Path
import json
import sys

root = Path(__file__).resolve().parents[1]
descriptor_path = root / "420-indexer/descriptors/governance-civic-v1.json"
errors = []

manifest = json.loads(descriptor_path.read_text())
if manifest.get("schema") != "420-governance-civic-artifact-descriptor-v1":
    errors.append("Governance Civic descriptor schema mismatch")
if manifest.get("protocol") != "420Governance":
    errors.append("Governance Civic descriptor protocol mismatch")
if manifest.get("authority") != "artifact_events_only_addresses_resolved_by_deployment":
    errors.append("Governance Civic descriptor must remain address-unbound until deployment")

expected_contracts = {
    "CivicConstitution420",
    "CivicProposalRegistry420",
    "CivicElectorateRegistry420",
    "CivicVoting420",
    "CivicGovernor420",
}
actual_contracts = {c.get("contractName") for c in manifest.get("contracts", [])}
if actual_contracts != expected_contracts:
    errors.append(f"Governance Civic descriptor contract set mismatch: {sorted(actual_contracts)}")

def abi_events(contract_name: str):
    artifact = root / "contracts/out" / f"{contract_name}.sol" / f"{contract_name}.json"
    if not artifact.exists():
        errors.append(f"compiled Governance artifact missing: {artifact.relative_to(root)}")
        return []
    payload = json.loads(artifact.read_text())
    return [item for item in payload.get("abi", []) if item.get("type") == "event"]

for contract in manifest.get("contracts", []):
    name = contract["contractName"]
    compiled = abi_events(name)
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
            errors.append(f"{name} descriptor event missing from exact artifact: {sig}")
            continue
        if built["name"] != event["name"]:
            errors.append(f"{name} descriptor event name drift: {sig}")
        got_inputs = [
            {"name": i.get("name", ""), "type": i["type"], "indexed": bool(i.get("indexed", False))}
            for i in built.get("inputs", [])
        ]
        if got_inputs != event.get("inputs", []):
            errors.append(f"{name} descriptor input/indexing drift: {sig}")

lifecycle = (root / "420-indexer/src/lifecycle-reducer.ts").read_text()
sql = (root / "420-indexer/sql/005-genesis-state-views.sql").read_text()
service = (root / "420-indexer/src/protocol-object-service.ts").read_text()
tests = "\n".join(
    (root / path).read_text()
    for path in [
        "420-indexer/test/governance-descriptors.test.ts",
        "420-indexer/test/lifecycle-reducer.test.ts",
        "420-indexer/test/protocol-projections.test.ts",
        "420-indexer/test/protocol-object-service.test.ts",
        "420-indexer/test/query-service.test.ts",
        "420-indexer/test/event-stream.test.ts",
    ]
)

for forbidden in ["ProposalCreated", "ProposalQueued", "ProposalExecuted", "ProposalCancelled", "CivicProposalCancelled"]:
    if f"eventName: '{forbidden}'" in lifecycle:
        errors.append(f"non-canonical Governance lifecycle event retained: {forbidden}")

for required in ["CivicProposalRegistered", "CivicProposalStateChanged", "'proposalId'", "${key}:", "PASSED", "QUEUED", "EXECUTED"]:
    if required not in lifecycle:
        errors.append(f"Governance lifecycle reducer missing canonical token: {required}")

for required in [
    "e.protocol = '420Governance'",
    "'proposalId:'",
    "when 'CivicProposalRegistered' then 'ACTIVE'",
    "when 'CivicProposalStateChanged' then",
    "when '2' then 'PASSED'",
    "when '3' then 'FAILED'",
    "when '4' then 'QUEUED'",
    "when '5' then 'EXECUTED'",
    "create or replace view idx_governance_state",
]:
    if required not in sql:
        errors.append(f"Governance SQL projection missing reconciliation token: {required}")

if "idx_governance_state" not in service:
    errors.append("Governance protocol object service does not use canonical Governance state view")

for required in [
    "reorg",
    "idempotent",
    "CivicProposalRegistered",
    "CivicProposalStateChanged",
    "proposalId:0x",
    "authoritative",
    "unknown",
]:
    if required.lower() not in tests.lower():
        errors.append(f"GOV-AUDIT-4 retained tests missing concept: {required}")

print(json.dumps({
    "pass": not errors,
    "errors": errors,
    "step": "GOV-AUDIT-4",
    "artifact_contracts": sorted(expected_contracts),
    "descriptor_events": sum(len(c.get("events", [])) for c in manifest.get("contracts", [])),
}, indent=2))
sys.exit(0 if not errors else 2)
