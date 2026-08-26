// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IValidatorRegistry420 {
    enum Status { NONE, REGISTERED, PROBATION, ELIGIBLE, ACTIVE, NORMAL_COOLDOWN, SUSPENDED, EXITED, WITHDRAWAL_HOLD, WITHDRAWABLE }
    struct Validator {
        bytes32 validatorId;
        bytes blsPubkey;
        address owner;
        address withdrawal;
        uint256 ownedBond;
        uint256 protocolCredit;
        Status status;
        uint64 effectiveSlot;
        uint64 activationRotation;
        uint64 scheduledExitRotation;
        uint64 cooldownUntilRotation;
        uint256 totalSlashed;
        bytes32 metadataCommitment;
    }
    function getValidator(bytes32 validatorId) external view returns (Validator memory);
    function eligibleValidatorCount() external view returns (uint256);
    function activeTarget() external view returns (uint16);
    function targetActiveCount(uint256 eligibleCount) external pure returns (uint16);
    function rotationTurnover(uint16 activeCount) external pure returns (uint16);
    function rewardAllocation(uint16 activeCount) external pure returns (uint256,uint256,uint256);
}

interface IRewardController420 {
    function validatorAccrued(address validator) external view returns (uint256);
}

/// @notice Read-oriented genesis facade for validator staking and rewards.
/// @dev Genesis has no public delegation and no stake-weighted governance. Validator economic
/// authority remains in the canonical ValidatorRegistry + RewardController system contracts.
contract Stake420 {
    uint256 public constant EFFECTIVE_BOND = 42_000 ether;
    uint256 public constant MAX_PROTOCOL_CREDIT = 21_000 ether;
    uint256 public constant MIN_OWNED_BOND = 21_000 ether;

    address public immutable validatorRegistry;
    address public immutable rewardController;

    constructor(address validatorRegistry_, address rewardController_) {
        require(validatorRegistry_ != address(0) && rewardController_ != address(0), "zero");
        validatorRegistry = validatorRegistry_;
        rewardController = rewardController_;
    }

    function effectiveBond() external pure returns (uint256) { return EFFECTIVE_BOND; }
    function delegationEnabled() external pure returns (bool) { return false; }
    function stakeWeightedVotingEnabled() external pure returns (bool) { return false; }

    function validator(bytes32 validatorId) external view returns (IValidatorRegistry420.Validator memory) {
        return IValidatorRegistry420(validatorRegistry).getValidator(validatorId);
    }

    function validatorStatus(bytes32 validatorId) external view returns (IValidatorRegistry420.Status) {
        return IValidatorRegistry420(validatorRegistry).getValidator(validatorId).status;
    }

    function validatorBondComposition(bytes32 validatorId)
        external
        view
        returns (uint256 ownedBond, uint256 protocolCredit, uint256 effective, uint256 totalSlashed)
    {
        IValidatorRegistry420.Validator memory v = IValidatorRegistry420(validatorRegistry).getValidator(validatorId);
        ownedBond = v.ownedBond;
        protocolCredit = v.protocolCredit;
        effective = ownedBond + protocolCredit;
        totalSlashed = v.totalSlashed;
    }

    function validatorRewardAccrued(bytes32 validatorId) external view returns (uint256) {
        IValidatorRegistry420.Validator memory v = IValidatorRegistry420(validatorRegistry).getValidator(validatorId);
        return IRewardController420(rewardController).validatorAccrued(v.owner);
    }

    function eligibleValidatorCount() external view returns (uint256) {
        return IValidatorRegistry420(validatorRegistry).eligibleValidatorCount();
    }

    function activeValidatorTarget() external view returns (uint16) {
        return IValidatorRegistry420(validatorRegistry).activeTarget();
    }

    function targetActiveCount(uint256 eligibleCount) external view returns (uint16) {
        return IValidatorRegistry420(validatorRegistry).targetActiveCount(eligibleCount);
    }

    function rotationTurnover(uint16 activeCount) external view returns (uint16) {
        return IValidatorRegistry420(validatorRegistry).rotationTurnover(activeCount);
    }

    function rewardAllocation(uint16 activeCount)
        external
        view
        returns (uint256 security, uint256 attention, uint256 development)
    {
        return IValidatorRegistry420(validatorRegistry).rewardAllocation(activeCount);
    }
}
