// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ConsensusSystemAccess420.sol";
import "../interfaces/I420System.sol";

/// @notice Execution receiver/accounting contract for native consensus issuance.
/// @dev Reward arithmetic is computed by fourtwentyd. Only the bound native system-call path may apply it.
contract RewardController is ConsensusSystemAccess420, I420System {
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

    constructor(address timelock_) ConsensusSystemAccess420(timelock_) {}

    function systemName() external pure returns (string memory) { return "RewardController"; }
    function protocolVersion() external pure returns (uint32) { return 2; }

    function applyConsensusReward(
        uint64 blockNumber,
        address proposer,
        address[] calldata participants,
        uint256 proposerAmount,
        uint256 perParticipantAmount,
        uint256 attentionAmount,
        uint256 developmentAmount
    ) external onlyConsensusSystem {
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
            blockNumber,
            proposer,
            proposerAmount,
            participantsIssued,
            attentionAmount,
            developmentAmount
        );
    }
}
