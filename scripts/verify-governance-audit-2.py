#!/usr/bin/env python3
from pathlib import Path
import json
import re
import sys

root = Path(__file__).resolve().parents[1]
errors = []

proposal = (root / "contracts/src/governance/CivicProposalRegistry420.sol").read_text()
electorate = (root / "contracts/src/governance/CivicElectorateRegistry420.sol").read_text()
governor = (root / "contracts/src/governance/CivicGovernor420.sol").read_text()
timelock = (root / "contracts/src/governance/GovernanceTimelock.sol").read_text()
legacy = (root / "contracts/src/governance/Governance420.sol").read_text()
security = (root / "docs/apps/governance/security.md").read_text()
hardening = (root / "contracts/test/GovernanceAudit2Hardening420.t.sol").read_text()
execution = (root / "contracts/test/CivicTimelockExecution420.t.sol").read_text()

required_proposal = [
    "_isCanonicalProposalAuthority",
    'abi.encodeWithSignature("proposalRegistry()")',
    'abi.encodeWithSignature("timelock()")',
    "authority.code.length == 0",
]
for needle in required_proposal:
    if needle not in proposal:
        errors.append(f"proposal authority hardening missing: {needle}")

required_electorate = [
    "_isCanonicalSnapshotAuthority",
    'abi.encodeWithSignature("electorateRegistry()")',
    'abi.encodeWithSignature("timelock()")',
    "authority.code.length == 0",
]
for needle in required_electorate:
    if needle not in electorate:
        errors.append(f"snapshot authority hardening missing: {needle}")

if "function cancel" in governor or "CivicProposalCancelled" in governor:
    errors.append("canonical Civic Governor must remain non-cancellable")
if "ProposalState.CANCELLED" in proposal:
    errors.append("proposal registry exposes CANCELLED transition")

if "_isCanonicalCivicGovernor" not in timelock or 'abi.encodeWithSignature("timelock()")' not in timelock:
    errors.append("timelock activation does not validate canonical governor binding")
if "_isCanonicalCivicGovernor" not in legacy or 'abi.encodeWithSignature("timelock()")' not in legacy:
    errors.append("compatibility governor binding does not validate timelock identity")

for needle in [
    "testAuthorityBindingsRejectEOAAndForeignGraphs",
    "testTimelockRejectsForeignGovernorAndActivationIsOneTime",
    "testFuzzLifecycleTransitionMatrix",
    "testFuzzQuorumCeilingArithmetic",
    "testFuzzApprovalCeilingArithmetic",
]:
    if needle not in hardening:
        errors.append(f"missing GOV-AUDIT-2 property test: {needle}")

for needle in [
    "testQueueRejectsEmptyBatchAndZeroTarget",
    "testExecuteQueuedBatchRejectsValueMismatch",
    "testReentrantTargetCannotReplayTimelockOperation",
    "testAtomicBatchFailureRollsBackPriorActionsAndKeepsProposalQueued",
]:
    if needle not in execution:
        errors.append(f"missing execution boundary test: {needle}")

for phrase in [
    "governance-authorized arbitrary target calls",
    "does not add an undocumented global reentrancy lock",
    "target contracts remain responsible for their own reentrancy safety",
]:
    if phrase.lower() not in security.lower():
        errors.append(f"security docs missing accepted-risk statement: {phrase}")

# Constructor graph hardening retained from complete audit.
for needle in [
    "constitution.governanceTimelock() != timelock_",
    "electorateRegistry.governanceTimelock() != timelock_",
    "address(voting.proposalRegistry()) != proposalRegistry_",
    "address(voting.electorateRegistry()) != electorateRegistry_",
]:
    if needle not in governor:
        errors.append(f"Governor module graph hardening missing: {needle}")

print(json.dumps({
    "pass": not errors,
    "errors": errors,
    "step": "GOV-AUDIT-2",
    "cancellation_supported": False,
    "property_tests": 5,
    "execution_boundary_tests": 4,
}, indent=2))

sys.exit(0 if not errors else 2)
