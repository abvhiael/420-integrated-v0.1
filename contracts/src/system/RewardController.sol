// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ConsensusSystemAccess420.sol";
import "../interfaces/I420System.sol";

interface IFullSponsoredValidator420 {
    function isFullyProtocolSponsoredOwner(address owner) external view returns (bool);
}

/// @notice Execution receiver/accounting contract for native consensus issuance.
/// @dev Reward arithmetic is computed by fourtwentyd. Only the bound native system-call path may apply it.
contract RewardController is ConsensusSystemAccess420, I420System {
    address public constant ATTENTION_TREASURY = 0x0000000000000000000000000000000000000421;
    address public constant VALIDATOR_REGISTRY = 0x0000000000000000000000000000000000000423;
    address public constant COMMUNITY_REWARD_RESERVE = 0x0000000000000000000000000000000000000426;
    uint256 public constant FULL_SPONSOR_COMMUNITY_BPS = 1000;
    uint256 public communityRewardAccrued;
    event SponsoredValidatorRewardAllocated(address indexed owner, address indexed communityFund, uint256 gross, uint256 communityShare);
    address public constant DEVELOPMENT_TREASURY = 0x0000000000000000000000000000000000000422;
    uint256 public constant MAX_ACTIVE_VALIDATORS = 30;

    uint256 public grossSecurityIssued;
    uint256 public grossAttentionIssued;
    uint256 public grossDevelopmentIssued;

    mapping(address => uint256) public validatorAccrued;
    mapping(uint64 => bool) public rewardApplied;

    error InvalidRewardBlock();
    error RewardAlreadyApplied();
    error InvalidProposer();
    error InvalidParticipantSet();

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
        if (blockNumber != uint64(block.number)) revert InvalidRewardBlock();
        if (rewardApplied[blockNumber]) revert RewardAlreadyApplied();
        if (proposer == address(0)) revert InvalidProposer();
        if (participants.length + 1 > MAX_ACTIVE_VALIDATORS) revert InvalidParticipantSet();
        for (uint256 i; i < participants.length; ++i) {
            address participant = participants[i];
            if (participant == address(0) || participant == proposer) revert InvalidParticipantSet();
            for (uint256 j; j < i; ++j) {
                if (participants[j] == participant) revert InvalidParticipantSet();
            }
        }

        rewardApplied[blockNumber] = true;
        _accrueSecurityReward(proposer, proposerAmount);
        uint256 participantsIssued;
        for (uint256 i; i < participants.length; ++i) {
            _accrueSecurityReward(participants[i], perParticipantAmount);
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
    /// @notice Accrual split, never an after-the-fact operator deduction. Actual native
    /// issuance/settlement into CommunityRewardReserve requires consensus reconciliation.
    function _accrueSecurityReward(address owner, uint256 gross) private {
        if (VALIDATOR_REGISTRY.code.length > 0
            && IFullSponsoredValidator420(VALIDATOR_REGISTRY).isFullyProtocolSponsoredOwner(owner)) {
            uint256 share = gross * FULL_SPONSOR_COMMUNITY_BPS / 10_000;
            validatorAccrued[owner] += gross - share;
            communityRewardAccrued += share;
            emit SponsoredValidatorRewardAllocated(owner, COMMUNITY_REWARD_RESERVE, gross, share);
        } else {
            validatorAccrued[owner] += gross;
        }
    }
}
