// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Public ABI interface for the canonical ValidatorRegistry predeploy.
/// @dev Consensus-owned mutation methods remain restricted by ValidatorRegistry itself.
interface IValidatorRegistry {
    enum Status {
        NONE,
        REGISTERED,
        PROBATION,
        ELIGIBLE,
        ACTIVE,
        NORMAL_COOLDOWN,
        SUSPENDED,
        EXITED,
        WITHDRAWAL_HOLD,
        WITHDRAWABLE
    }

    enum SlashOffense {
        NONE,
        INACTIVITY,
        INVALID_CONSENSUS_MESSAGE,
        DOUBLE_PROPOSAL,
        DOUBLE_VOTE,
        SURROUND_VOTE,
        FINALITY_EQUIVOCATION
    }

    struct Validator {
        bytes32 validatorId;
        bytes blsPubkey;
        address owner;
        address withdrawal;
        uint256 ownedBond;
        uint256 protocolCredit;
        Status status;
        uint64 registrationBlock;
        uint64 effectiveSlot;
        uint64 activationRotation;
        uint64 scheduledExitRotation;
        uint64 cooldownUntilRotation;
        uint64 exitNoticeRotation;
        uint64 exitEligibleRotation;
        uint64 withdrawalHoldStartBlock;
        uint64 withdrawableBlock;
        uint256 totalSlashed;
        bytes32 metadataCommitment;
    }

    function EFFECTIVE_BOND() external view returns (uint256);
    function MAX_PROTOCOL_CREDIT() external view returns (uint256);
    function MIN_OWNED_BOND() external view returns (uint256);
    function communityValidatorReserve() external view returns (address);
    function consensusSystemCaller() external view returns (address);
    function consensusSystemCallerBound() external view returns (bool);

    function register(bytes32 validatorId, bytes calldata blsPubkey, address withdrawal, bytes32 metadataCommitment)
        external
        payable;
    function topUpOwnedBond(bytes32 validatorId) external payable;
    function replaceProtocolCredit(bytes32 validatorId) external payable;
    function withdrawBond(bytes32 validatorId) external returns (uint256 ownedAmount, uint256 recycledCredit);

    // Consensus-owned mutations are part of the canonical ABI even though the
    // implementation restricts them to the immutable ConsensusSystemCall420 path.
    function applyExitNotice(bytes32 validatorId, uint64 noticeRotation) external;
    function applyConsensusState(
        bytes32 validatorId,
        Status newStatus,
        uint64 effectiveSlot,
        uint64 activationRotation,
        uint64 scheduledExitRotation,
        uint64 cooldownUntilRotation
    ) external;
    function applySlash(
        bytes32 validatorId,
        SlashOffense offense,
        uint8 correlationTier,
        uint256 ownedSlashed,
        uint256 creditSlashed,
        bytes32 evidenceHash,
        Status resultingStatus
    ) external;
    function applyRotationSnapshot(uint64 rotation, uint256 eligibleSnapshot) external;

    function getValidator(bytes32 validatorId) external view returns (Validator memory);
    function effectiveBond(bytes32 validatorId) external view returns (uint256);
    function custodyInvariant() external view returns (bool);
    function slashEvidenceApplied(bytes32 evidenceHash) external view returns (bool);
    function targetActiveCount(uint256 eligible) external pure returns (uint16);
    function rotationTurnover(uint16 activeCount) external pure returns (uint16);
    function rewardAllocation(uint16 activeCount)
        external
        pure
        returns (uint256 security, uint256 attention, uint256 development);
}
