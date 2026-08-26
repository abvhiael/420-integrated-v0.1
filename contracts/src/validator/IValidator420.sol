// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IValidator420 {
    enum Status {
        NONE,
        PROBATION,
        ELIGIBLE,
        ACTIVE,
        COOLDOWN,
        EXIT_PENDING,
        EXITED,
        SUSPENDED
    }

    struct ValidatorRecord {
        address owner;
        address withdrawalAddress;
        bytes32 consensusKeyHash;
        bytes32 metadataCommitment;
        Status status;
        uint64 registeredBlock;
        uint64 activationEligibleBlock;
        uint64 activationRotation;
        uint64 scheduledExitRotation;
        uint64 cooldownUntilRotation;
        uint16 seatId;
        bool operationalReady;
        bool exitRequested;
        bool eligibleForPool;
        uint256 totalSlashed;
    }

    function validator(uint64 validatorId) external view returns (ValidatorRecord memory);
    function eligibleValidatorCount() external view returns (uint256);
    function currentActiveTarget() external view returns (uint16);
    function targetActiveCount(uint256 eligibleCount) external pure returns (uint16);
    function rotationTurnover(uint16 activeCount) external pure returns (uint16);
    function allocation(uint16 activeCount) external pure returns (uint256 security, uint256 attention, uint256 development);
}
