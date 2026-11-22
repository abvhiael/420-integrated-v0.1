// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ConsensusSystemAccess420.sol";
import "../interfaces/I420System.sol";

interface IFullSponsoredValidator420 {
    function isFullyProtocolSponsoredOwner(address owner) external view returns (bool);
}

/// @notice Native $420 reward settlement from consensus-verified node420 issuance.
/// @dev The node420 Geth state transition credits ONLY the exact validated realized
/// reward into this contract before the authenticated consensus system call. This
/// contract distributes all of that value atomically; no virtual-only accrual and
/// no post hoc deduction from the validator's wallet are authorized.
contract RewardController is ConsensusSystemAccess420, I420System {
    address public constant ATTENTION_TREASURY = 0x0000000000000000000000000000000000000421;
    address public constant DEVELOPMENT_TREASURY = 0x0000000000000000000000000000000000000422;
    address public constant VALIDATOR_REGISTRY = 0x0000000000000000000000000000000000000423;
    address public constant COMMUNITY_REWARD_RESERVE = 0x0000000000000000000000000000000000000426;
    uint256 public constant FULL_SPONSOR_COMMUNITY_BPS = 1000;
    uint256 public constant MAX_ACTIVE_VALIDATORS = 30;

    uint256 public grossSecurityIssued;
    uint256 public grossAttentionIssued;
    uint256 public grossDevelopmentIssued;
    uint256 public communityRewardAccrued;
    uint256 public communityRewardBackingReceived;
    uint256 public communityRewardSettled;
    uint256 public nativeRewardPaid;
    uint256 private _entered;

    mapping(address => uint256) public validatorAccrued;
    mapping(uint64 => bool) public rewardApplied;

    error InvalidRewardBlock();
    error RewardAlreadyApplied();
    error InvalidProposer();
    error InvalidParticipantSet();
    error InvalidNativeBacking();
    error InvalidNativeRecipient();
    error NativeRewardTransferFailed();
    error ReentrantExecution();
    error LegacyFundingDisabled();

    event SponsoredValidatorRewardAllocated(
        address indexed owner, address indexed communityFund, uint256 gross, uint256 communityShare
    );
    event CommunityRewardBackingReceived(address indexed source, uint256 amount, uint256 backedTotal);
    event CommunityRewardSettled(address indexed reserve, uint256 amount, uint256 settledTotal);
    /// @notice Native value movement, not an unbacked reward-accrual assertion.
    /// @param kind 0=proposer, 1=participant, 2=community, 3=attention, 4=development
    event NativeRewardPaid(
        uint64 indexed blockNumber, address indexed recipient, uint8 indexed kind, uint256 amount
    );
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
    function protocolVersion() external pure returns (uint32) { return 3; }

    /// @notice A single, native-420-backed consensus settlement in the current execution block.
    /// Geth validates the original canonical staking emission schedule and credits precisely
    /// proposer + actual participants + attention + development BEFORE this authenticated call.
    /// A missing, surplus, stale or forged backing makes this entire block invalid.
    function applyConsensusReward(
        uint64 blockNumber,
        address proposer,
        address[] calldata participants,
        uint256 proposerAmount,
        uint256 perParticipantAmount,
        uint256 attentionAmount,
        uint256 developmentAmount
    ) external onlyConsensusSystem {
        if (_entered != 0) revert ReentrantExecution();
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
        uint256 participantsIssued = perParticipantAmount * participants.length;
        uint256 securityIssued = proposerAmount + participantsIssued;
        uint256 realized = securityIssued + attentionAmount + developmentAmount;
        // There is no externally callable mint, allowance, fallback or trusted
        // externally submitted transaction. Credit is done by the imported-block
        // Geth processor and then consumed by this call, in the same state transition.
        if (realized == 0 || address(this).balance < realized) revert InvalidNativeBacking();
        _entered = 1;
        rewardApplied[blockNumber] = true;

        _settleValidator(proposer, proposerAmount, 0, blockNumber);
        for (uint256 i; i < participants.length; ++i) {
            _settleValidator(participants[i], perParticipantAmount, 1, blockNumber);
        }
        _sendNative(ATTENTION_TREASURY, attentionAmount, 3, blockNumber);
        _sendNative(DEVELOPMENT_TREASURY, developmentAmount, 4, blockNumber);
        grossSecurityIssued += securityIssued;
        grossAttentionIssued += attentionAmount;
        grossDevelopmentIssued += developmentAmount;
        // Geth independently preserves the exact pre-existing account balance.
        // The mandatory realized payout is never allowed to consume stray funds.
        nativeRewardPaid += realized;
        _entered = 0;
        emit RewardApplied(
            blockNumber, proposer, proposerAmount, participantsIssued, attentionAmount, developmentAmount
        );
    }

    /// @notice Legacy manual funding cannot substitute for authenticated native Geth issuance.
    /// Retains ABI for compatibility but is unconditionally disabled in release V3.
    function fundCommunityRewardBacking() external payable onlyConsensusSystem {
        revert LegacyFundingDisabled();
    }

    /// @notice The release V3 path pays community funds atomically in applyConsensusReward.
    /// A second independent settlement would enable double counting and is forbidden.
    function settleCommunityRewards(uint256) external pure {
        revert LegacyFundingDisabled();
    }

    function _settleValidator(address owner, uint256 gross, uint8 kind, uint64 blockNumber) private {
        uint256 community;
        if (VALIDATOR_REGISTRY.code.length > 0 &&
            IFullSponsoredValidator420(VALIDATOR_REGISTRY).isFullyProtocolSponsoredOwner(owner)) {
            community = gross * FULL_SPONSOR_COMMUNITY_BPS / 10_000;
            if (community != 0) {
                // The community reserve must exist as approved immutable predeploy
                // before any split reward can leave the reward controller.
                if (COMMUNITY_REWARD_RESERVE.code.length == 0) revert InvalidNativeRecipient();
                communityRewardAccrued += community;
                communityRewardBackingReceived += community;
                communityRewardSettled += community;
                validatorAccrued[COMMUNITY_REWARD_RESERVE] += community;
                emit SponsoredValidatorRewardAllocated(owner, COMMUNITY_REWARD_RESERVE, gross, community);
                emit CommunityRewardBackingReceived(address(this), community, communityRewardBackingReceived);
                _sendNative(COMMUNITY_REWARD_RESERVE, community, 2, blockNumber);
                emit CommunityRewardSettled(COMMUNITY_REWARD_RESERVE, community, communityRewardSettled);
            }
        }
        uint256 net = gross - community;
        validatorAccrued[owner] += net;
        _sendNative(owner, net, kind, blockNumber);
    }

    function _sendNative(address recipient, uint256 amount, uint8 kind, uint64 blockNumber) private {
        if (amount == 0) return;
        if (recipient == address(0) || recipient == address(this)) revert InvalidNativeRecipient();
        (bool ok,) = payable(recipient).call{value: amount}("");
        if (!ok) revert NativeRewardTransferFailed();
        emit NativeRewardPaid(blockNumber, recipient, kind, amount);
    }
}
