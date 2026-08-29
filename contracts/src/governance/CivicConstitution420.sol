// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";
import "./CivicIds420.sol";

/// @notice Canonical constitutional rules for 420Civic proposal classes.
/// @dev Threshold values are explicit governance state; this contract does not invent electorate weights.
contract CivicConstitution420 is SystemAccess, I420System {
    uint16 public constant BPS = 10_000;

    struct Rule {
        uint64 votingPeriodBlocks;
        uint64 timelockDelay;
        uint16 communityQuorumBps;
        uint16 communityApprovalBps;
        uint16 validatorQuorumBps;
        uint16 validatorApprovalBps;
        bool dualHouseRequired;
        uint32 revision;
        bool exists;
    }

    mapping(uint8 => Rule) private _rules;

    error InvalidVotingPeriod();
    error DelayBelowFloor();
    error InvalidThreshold();

    event CivicRuleSet(
        CivicIds420.ProposalClass indexed class_,
        uint64 votingPeriodBlocks,
        uint64 timelockDelay,
        uint16 communityQuorumBps,
        uint16 communityApprovalBps,
        uint16 validatorQuorumBps,
        uint16 validatorApprovalBps,
        bool dualHouseRequired,
        uint32 revision
    );

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) {
        return "CivicConstitution420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function delayFloor(CivicIds420.ProposalClass class_) public pure returns (uint64) {
        if (class_ == CivicIds420.ProposalClass.G1) return 7 days;
        if (class_ == CivicIds420.ProposalClass.G2) return 14 days;
        if (class_ == CivicIds420.ProposalClass.G3) return 14 days;
        return 42 days;
    }

    function ruleFor(CivicIds420.ProposalClass class_) external view returns (Rule memory) {
        return _rules[uint8(class_)];
    }

    /// @notice Set or revise a proposal-class rule through the Genesis governance timelock.
    /// @dev Approval must remain a strict majority; quorum must be nonzero; legacy delay floors cannot be reduced.
    function setRule(
        CivicIds420.ProposalClass class_,
        uint64 votingPeriodBlocks,
        uint64 timelockDelay,
        uint16 communityQuorumBps,
        uint16 communityApprovalBps,
        uint16 validatorQuorumBps,
        uint16 validatorApprovalBps,
        bool dualHouseRequired
    ) external onlyGovernance {
        if (votingPeriodBlocks == 0) revert InvalidVotingPeriod();
        if (timelockDelay < delayFloor(class_)) revert DelayBelowFloor();
        if (
            communityQuorumBps == 0 || communityQuorumBps > BPS || communityApprovalBps <= BPS / 2
                || communityApprovalBps > BPS || validatorQuorumBps > BPS || validatorApprovalBps > BPS
        ) revert InvalidThreshold();
        if (dualHouseRequired && (validatorQuorumBps == 0 || validatorApprovalBps <= BPS / 2)) {
            revert InvalidThreshold();
        }

        Rule storage prior = _rules[uint8(class_)];
        uint32 revision = prior.exists ? prior.revision + 1 : 1;
        _rules[uint8(class_)] = Rule({
            votingPeriodBlocks: votingPeriodBlocks,
            timelockDelay: timelockDelay,
            communityQuorumBps: communityQuorumBps,
            communityApprovalBps: communityApprovalBps,
            validatorQuorumBps: validatorQuorumBps,
            validatorApprovalBps: validatorApprovalBps,
            dualHouseRequired: dualHouseRequired,
            revision: revision,
            exists: true
        });

        emit CivicRuleSet(
            class_,
            votingPeriodBlocks,
            timelockDelay,
            communityQuorumBps,
            communityApprovalBps,
            validatorQuorumBps,
            validatorApprovalBps,
            dualHouseRequired,
            revision
        );
    }
}
