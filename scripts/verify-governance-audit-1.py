#!/usr/bin/env python3
from pathlib import Path
import json
import sys

root = Path(__file__).resolve().parents[1]
errors = []

layer = json.loads((root / "contracts/config/interfaces/genesis-interface-layer.json").read_text())
matrix = json.loads((root / "contracts/config/interfaces/dependency-matrix.json").read_text())
model = json.loads((root / "contracts/config/interfaces/governance-dependency-model.json").read_text())
addresses = json.loads((root / "contracts/config/system-addresses.json").read_text())

gov_dir = root / "contracts/src/governance"
governor = (gov_dir / "CivicGovernor420.sol").read_text()
constitution = (gov_dir / "CivicConstitution420.sol").read_text()
proposals = (gov_dir / "CivicProposalRegistry420.sol").read_text()
electorates = (gov_dir / "CivicElectorateRegistry420.sol").read_text()
voting = (gov_dir / "CivicVoting420.sol").read_text()
timelock = (gov_dir / "GovernanceTimelock.sol").read_text()
compat = (gov_dir / "Governance420.sol").read_text()
adr = (root / "docs/architecture/decisions/GOV-AUDIT-1-AUTHORITY-DEPENDENCY-CANCELLATION.md").read_text()
architecture = (root / "docs/apps/governance/architecture.md").read_text()
security = (root / "docs/apps/governance/security.md").read_text()
faq = (root / "docs/apps/governance/faq.md").read_text()
concepts = (root / "docs/apps/governance/concepts.md").read_text()
lifecycle = (root / "420-indexer/src/lifecycle-reducer.ts").read_text()

shared = layer.get("shared_interfaces", [])
decisions = model.get("shared_interface_decisions", [])
by_interface = {d.get("interface"): d for d in decisions}

if len(shared) != 25:
    errors.append(f"expected 25 frozen shared interfaces, got {len(shared)}")
if set(by_interface) != set(shared) or len(decisions) != len(shared):
    errors.append("governance dependency model must classify every frozen shared interface exactly once")

allowed = {
    "REQUIRED_DIRECT",
    "REQUIRED_INDIRECT",
    "CONSUMER_LAYER",
    "OPTIONAL_INTEGRATION",
    "LOCAL_MECHANISM",
    "NOT_APPLICABLE",
}
for item in decisions:
    if item.get("classification") not in allowed:
        errors.append(f"invalid classification for {item.get('interface')}: {item.get('classification')}")
    if not item.get("basis"):
        errors.append(f"missing basis for {item.get('interface')}")

if matrix.get("dependencies", {}).get("420Governance") != []:
    errors.append("420Governance shared runtime dependency matrix must be empty")
if model.get("normative_shared_runtime_dependencies") != []:
    errors.append("governance dependency model runtime dependency set must match empty matrix")

expected_special = {
    "IProtocolRegistry420": "OPTIONAL_INTEGRATION",
    "IGovernanceAuthority420": "NOT_APPLICABLE",
    "IGenesisInitializable420": "REQUIRED_INDIRECT",
    "IMigration420": "REQUIRED_INDIRECT",
    "IReplayProtection420": "LOCAL_MECHANISM",
    "IMetadataCommitment420": "LOCAL_MECHANISM",
    "IChainContext420": "CONSUMER_LAYER",
}
for name, classification in expected_special.items():
    if by_interface.get(name, {}).get("classification") != classification:
        errors.append(f"{name} must be {classification}")

if model.get("execution_authority") != "GovernanceTimelock":
    errors.append("GovernanceTimelock must remain canonical execution authority")
if model.get("public_compatibility_contract") != "Governance420":
    errors.append("Governance420 compatibility identity drift")

graph = model.get("canonical_internal_runtime_graph", {})
expected_graph_nodes = {
    "GovernanceTimelock",
    "CivicConstitution420",
    "CivicProposalRegistry420",
    "CivicElectorateRegistry420",
    "CivicVoting420",
    "CivicGovernor420",
    "Governance420",
}
if set(graph) != expected_graph_nodes:
    errors.append("canonical Civic internal runtime graph node set drift")

# The canonical Civic contracts use explicit module bindings, not the shared Genesis interfaces.
for name, source in {
    "CivicGovernor420": governor,
    "CivicConstitution420": constitution,
    "CivicProposalRegistry420": proposals,
    "CivicElectorateRegistry420": electorates,
    "CivicVoting420": voting,
    "Governance420": compat,
}.items():
    if "interfaces/genesis/" in source:
        errors.append(f"{name} unexpectedly imports a shared Genesis runtime interface")

for name, source in {
    "CivicConstitution420": constitution,
    "CivicProposalRegistry420": proposals,
    "CivicElectorateRegistry420": electorates,
    "Governance420": compat,
}.items():
    if "SystemAccess" not in source:
        errors.append(f"{name} must retain GovernanceTimelock-bound SystemAccess")

# Cancellation is intentionally unsupported for canonical Civic v1 proposals.
cancel = model.get("cancellation", {})
if cancel.get("civic_proposal_cancellation_supported") is not False:
    errors.append("Civic v1 proposal cancellation must remain unsupported")
for state in ("active", "passed", "queued"):
    if cancel.get(state) != "NOT_CANCELLABLE":
        errors.append(f"{state} must remain NOT_CANCELLABLE")

if "ProposalState.CANCELLED" in proposals:
    errors.append("CivicProposalRegistry420 still exposes a legal CANCELLED transition")
if "function cancel(bytes32 id) external onlyBootstrapGovernor" not in timelock:
    errors.append("GovernanceTimelock.cancel must be bootstrap-governor-only")
if 'require(!civicAuthorityActivated, "civic active")' not in timelock:
    errors.append("GovernanceTimelock.cancel must fail after Civic activation")
if "function cancel" in governor or "CivicProposalCancelled" in governor:
    errors.append("CivicGovernor420 must not expose a v1 proposal cancellation path/event")
if "CivicProposalCancelled" in lifecycle or "ProposalCancelled" in lifecycle[lifecycle.find("protocol: '420Governance'"):lifecycle.find("protocol: '420Pay'")]:
    errors.append("420Indexer must not synthesize a canonical Governance cancellation lifecycle")

for selector in ("createProposal", "applyVote", "applyResult"):
    if f"function {selector}" not in compat:
        errors.append(f"Governance420 missing retained compatibility selector {selector}")
if compat.count("revert LegacySurfaceRetired();") < 3:
    errors.append("Governance420 legacy mutation selectors are not all retired")

assignments = {item.get("name"): item.get("address", "").lower() for item in addresses.get("assignments", [])}
if assignments.get("GovernanceTimelock") != "0x0000000000000000000000000000000000000429":
    errors.append("GovernanceTimelock frozen address drift")
if assignments.get("Governance420") != "0x0000000000000000000000000000000000000437":
    errors.append("Governance420 frozen address drift")

for label, doc in {
    "ADR": adr,
    "architecture": architecture,
    "security": security,
    "FAQ": faq,
    "concepts": concepts,
}.items():
    if "not cancellable" not in doc.lower() and "cancellation is unsupported" not in doc.lower():
        errors.append(f"{label} does not state canonical no-cancellation semantics")

for required in (
    "GovernanceTimelock",
    "Governance420",
    "OPTIONAL_INTEGRATION",
    "REQUIRED_INDIRECT",
    "LOCAL_MECHANISM",
    "CONSUMER_LAYER",
):
    if required not in adr:
        errors.append(f"ADR missing required authority/dependency term: {required}")

out = {
    "pass": not errors,
    "errors": errors,
    "step": "GOV-AUDIT-1",
    "shared_interfaces_classified": len(decisions),
    "normative_shared_runtime_dependencies": matrix.get("dependencies", {}).get("420Governance"),
    "civic_proposal_cancellation_supported": cancel.get("civic_proposal_cancellation_supported"),
    "execution_authority": model.get("execution_authority"),
    "compatibility_contract": model.get("public_compatibility_contract"),
}
print(json.dumps(out, indent=2))
sys.exit(0 if not errors else 2)
