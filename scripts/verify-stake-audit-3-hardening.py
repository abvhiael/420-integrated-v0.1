#!/usr/bin/env python3
"""Verify canonical STAKE-AUDIT-3 replay, ABI and lifecycle hardening."""

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]

def fail(message: str) -> None:
    print(f"STAKE-AUDIT-3 verifier FAILED: {message}", file=sys.stderr)
    raise SystemExit(1)

def require(path: str, tokens: list[str]) -> str:
    p = ROOT / path
    if not p.is_file():
        fail(f"missing {path}")
    text = p.read_text(encoding="utf-8")
    for token in tokens:
        if token not in text:
            fail(f"{path} missing required token: {token}")
    return text

def main() -> int:
    registry = require("contracts/src/system/ValidatorRegistry.sol", [
        "mapping(bytes32 => bool) public slashEvidenceApplied;",
        "if (evidenceHash == bytes32(0)) revert InvalidEvidence();",
        "if (slashEvidenceApplied[evidenceHash]) revert EvidenceAlreadyApplied();",
        "slashEvidenceApplied[evidenceHash] = true;",
        "Status resultingStatus",
        "emit SlashApplied(",
    ])
    if registry.index("slashEvidenceApplied[evidenceHash] = true;") > registry.index("v.ownedBond -= ownedSlashed;"):
        fail("slash evidence is not marked before collateral mutation")

    require("contracts/src/system/RewardController.sol", [
        "mapping(uint64 => bool) public rewardApplied;",
        "if (blockNumber != uint64(block.number)) revert InvalidRewardBlock();",
        "if (rewardApplied[blockNumber]) revert RewardAlreadyApplied();",
        "if (proposer == address(0)) revert InvalidProposer();",
        "if (participants.length + 1 > MAX_ACTIVE_VALIDATORS) revert InvalidParticipantSet();",
        "participant == address(0) || participant == proposer",
        "participants[j] == participant",
        "rewardApplied[blockNumber] = true;",
    ])

    require("contracts/src/IValidatorRegistry.sol", [
        "function slashEvidenceApplied(bytes32 evidenceHash) external view returns (bool);",
        "function applyExitNotice(bytes32 validatorId, uint64 noticeRotation) external;",
        "function applyConsensusState(",
        "function applySlash(",
        "bytes32 evidenceHash,",
        "Status resultingStatus",
        "function applyRotationSnapshot(uint64 rotation, uint256 eligibleSnapshot) external;",
    ])
    require("contracts/src/IRewardController.sol", [
        "function rewardApplied(uint64 blockNumber) external view returns (bool);",
        "function applyConsensusReward(",
        "address[] calldata participants,",
        "uint256 perParticipantAmount,",
    ])

    tests = require("contracts/test/StakeValidatorGenesis420.t.sol", [
        "testDuplicateSlashEvidenceCannotChargeTwice",
        "testZeroSlashEvidenceRejectedWithoutMutation",
        "testConsensusRewardAppliesOncePerExecutionBlock",
        "testConsensusRewardRejectsWrongBlockAndDuplicateParticipants",
        "testConsensusRewardRejectsZeroProposerZeroParticipantProposerParticipantAndOversizedSet",
    ])
    for invariant in [
        '"replay changed collateral"',
        '"replay changed slash accounting"',
        '"invalid reward marked applied"',
        '"invalid reward changed security issuance"',
    ]:
        if invariant not in tests:
            fail(f"missing no-mutation assertion {invariant}")

    reducer = require("420-indexer/src/lifecycle-reducer.ts", [
        "eventName: 'ValidatorRegistered'",
        "eventName: 'ConsensusStateApplied'",
        "stateField: 'newStatus'",
        "eventName: 'ExitNoticeApplied'",
        "eventName: 'SlashApplied'",
        "stateField: 'resultingStatus'",
        "eventName: 'ValidatorBondWithdrawn'",
    ])
    for stale in ["StakeCreated", "StakeActivated", "UnstakeRequested", "StakeWithdrawn", "StakeSlashed"]:
        stake_section = reducer[reducer.index("{ protocol: '420Stake'"):reducer.index("{ protocol: '420Governance'")]
        if stale in stake_section:
            fail(f"obsolete synthetic Stake lifecycle event still active: {stale}")

    require("420-indexer/test/lifecycle-reducer.test.ts", [
        "420Stake lifecycle uses canonical ValidatorRegistry events and status fields",
        "420Stake slash status remains reconstructable without inventing terminality",
        "obsolete synthetic Stake events do not fabricate validator lifecycle state",
    ])
    require("docs/apps/stake/developer/events.md", [
        "SlashApplied(validatorId, offense, correlationTier, ownedSlashed, creditSlashed, evidenceHash, resultingStatus)",
        "A reward block is single-use",
    ])
    require("docs/apps/stake/developer/errors.md", [
        "Slash application rejects zero evidence and evidence that has already been applied.",
        "Reward application rejects the wrong execution block, duplicate reward application for a block, a zero proposer",
    ])

    print("STAKE-AUDIT-3 verifier PASS: replay guards, canonical ABI surfaces and Indexer lifecycle rules are reconciled")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
