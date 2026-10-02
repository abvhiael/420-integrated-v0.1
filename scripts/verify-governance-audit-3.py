#!/usr/bin/env python3
from pathlib import Path
import json
import sys

root = Path(__file__).resolve().parents[1]
errors = []

audit3 = (root / "contracts/test/GovernanceAudit3Adversarial420.t.sol").read_text()
hardening = (root / "contracts/test/GovernanceAudit2Hardening420.t.sol").read_text()
execution = (root / "contracts/test/CivicTimelockExecution420.t.sol").read_text()
voting = (root / "contracts/test/CivicVoting420.t.sol").read_text()
governor = (root / "contracts/test/CivicGovernor420.t.sol").read_text()
electorate = (root / "contracts/test/CivicElectorateRegistry420.t.sol").read_text()
retirement = (root / "contracts/test/Governance420Retirement.t.sol").read_text()
audit1 = (root / "contracts/test/GovernanceAudit420.t.sol").read_text()

required_audit3 = [
    "testQuorumExactBoundaryOneBelowAndFullParticipation",
    "testApprovalExactBoundaryAndOneBelow",
    "testAbstainOnlyMeetsQuorumButCannotApprove",
    "testDualHouseAllIndependentPassFailPermutations",
    "testMaximumElectorateWeightArithmeticDoesNotOverflow",
    "testDuplicateBallotRejectedButSameVoterCanVoteInBothRequiredHouses",
    "testMaliciousOverweightAndCumulativeAllocationFailClosed",
    "testHostileSnapshotAdapterRevertsAtomically",
    "testHostileVotingWeightAdapterFailsWithoutBallotOrTallyMutation",
    "testMalformedElectorateAdapterRejectedDuringConfiguration",
    "testVotingWindowExactStartAndEndAcceptedOutsideRejected",
    "testRepeatedQueueAttemptRejected",
    "testActionBatchReorderingRejected",
    "testUnauthorizedActivationSchedulingAndCancellationFailClosed",
    "testRepeatedBootstrapCancellationRejected",
]
for needle in required_audit3:
    if needle not in audit3:
        errors.append(f"missing GOV-AUDIT-3 adversarial test: {needle}")

retained_requirements = {
    "source replacement after snapshot": (electorate, "testSnapshotIsImmutableAcrossSourceUpgrade"),
    "duplicate ballot baseline": (voting, "testDoubleVoteRejected"),
    "repeated finalization": (governor, "testFinalizeFailsClosedBeforeVotingEndsAndCannotRunTwice"),
    "action substitution": (execution, "testQueueRejectsActionBatchDifferentFromProposalCommitment"),
    "total value mismatch": (execution, "testExecuteQueuedBatchRejectsValueMismatch"),
    "atomic failed batch rollback": (execution, "testAtomicBatchFailureRollsBackPriorActionsAndKeepsProposalQueued"),
    "reentrant replay resistance": (execution, "testReentrantTargetCannotReplayTimelockOperation"),
    "timelock early execution": (execution, "testQueueBindsExactBatchAndFrozenDelayThenExecutesOnce"),
    "timelock timestamp overflow": (hardening, "testTimelockSchedulingRejectsTimestampOverflow"),
    "Civic cancellation rejection": (audit1, "testCivicProposalCancellationIsRejectedFromEveryLiveState"),
    "post-activation cancellation retirement": (audit1, "testTimelockCancellationRetiresWhenCivicAuthorityActivates"),
    "legacy proposal selector retirement": (retirement, "testLegacyProposalCreationIsPermanentlyRetired"),
    "legacy vote/result selector retirement": (
        retirement,
        "testLegacyVoteAndResultInjectionArePermanentlyRetiredEvenForGovernance",
    ),
}
for label, (content, needle) in retained_requirements.items():
    if needle not in content:
        errors.append(f"missing retained GOV-AUDIT-3 coverage for {label}: {needle}")

print(json.dumps({
    "pass": not errors,
    "errors": errors,
    "step": "GOV-AUDIT-3",
    "new_named_adversarial_tests": len(required_audit3),
    "retained_named_regressions": len(retained_requirements),
}, indent=2))

sys.exit(0 if not errors else 2)
