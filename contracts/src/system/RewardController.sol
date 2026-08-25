
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./SystemAccess.sol";
import "../interfaces/I420System.sol";

/// @notice Execution receiver/accounting contract for native consensus issuance.
/// Reward arithmetic is computed by fourtwentyd under frozen Decision 12.
/// This contract records and routes amounts supplied by the privileged system-call path.
contract RewardController is SystemAccess, I420System {
    address public constant ATTENTION_TREASURY = 0x0000000000000000000000000000000000000421;
    address public constant DEVELOPMENT_TREASURY = 0x0000000000000000000000000000000000000422;

    uint256 public grossSecurityIssued;
    uint256 public grossAttentionIssued;
    uint256 public grossDevelopmentIssued;

    mapping(address => uint256) public validatorAccrued;

    event RewardApplied(
        uint64 indexed blockNumber,
        address indexed proposer,
        uint256 proposerAmount,
        uint256 participantAmount,
        uint256 attentionAmount,
        uint256 developmentAmount
    );

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) { return "RewardController"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    /// @notice Test/deployment scaffold for consensus-system application.
    /// Production must restrict caller to the native system-call origin/path, not ordinary governance.
    function applyConsensusReward(
        uint64 blockNumber,
        address proposer,
        address[] calldata participants,
        uint256 proposerAmount,
        uint256 perParticipantAmount,
        uint256 attentionAmount,
        uint256 developmentAmount
    ) external onlyGovernance {
        validatorAccrued[proposer] += proposerAmount;
        uint256 participantsIssued;
        for (uint256 i; i < participants.length; ++i) {
            validatorAccrued[participants[i]] += perParticipantAmount;
            participantsIssued += perParticipantAmount;
        }
        grossSecurityIssued += proposerAmount + participantsIssued;
        grossAttentionIssued += attentionAmount;
        grossDevelopmentIssued += developmentAmount;

        emit RewardApplied(
            blockNumber, proposer, proposerAmount, participantsIssued, attentionAmount, developmentAmount
        );
    }
}
