// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./IValidator420.sol";
import "../stake/IStake420.sol";
import "../system/GenesisResidentAccess420.sol";

/// @notice Genesis validator registry and economic lifecycle bridge.
/// @dev Committee selection/scheduling stays in consensus; this contract owns registration,
/// eligibility, economic state transitions, auditable rotation targets and reward/slash routing.
contract Validator420 is IValidator420, GenesisResidentAccess420 {
    uint256 public constant VALIDATOR_BOND = 42_000 ether;
    uint64 public constant EPOCH_BLOCKS = 420;
    uint64 public constant ROTATION_EPOCHS = 42;
    uint64 public constant ROTATION_BLOCKS = 17_640;
    uint64 public constant ACTIVE_TERM_ROTATIONS = 3;
    uint64 public constant EARLIEST_BONDED_HANDOFF_BLOCK = 4_200;
    uint16 public constant MIN_ACTIVE = 15;
    uint16 public constant MAX_ACTIVE = 30;
    uint16 public constant MIN_BONDED_ELIGIBLE = 60;
    uint8 public constant HYSTERESIS_SNAPSHOTS = 3;
    uint256 public constant ALLOCATION_SCALE = 1_000_000_000_000;
    uint256 public constant MIN_SECURITY_ALLOCATION = 283_446_712_018;
    uint256 public constant MAX_SECURITY_ALLOCATION = 500_000_000_000;

    bytes32 public constant ACTION_SET_PARAMETERS = keccak256("420/VALIDATOR/SET_PARAMETERS");
    bytes32 public constant ACTION_FREEZE_PARAMETERS = keccak256("420/VALIDATOR/FREEZE_PARAMETERS");

    IStake420 public immutable stake420;
    address public immutable consensusSystemCaller;
    address public immutable slashReceiver;

    uint64 public activationDelayBlocks = ROTATION_BLOCKS;
    uint64 public withdrawalDelayBlocks = ROTATION_BLOCKS * 6;
    uint64 public cooldownRotations = 3;
    bool public lifecycleParametersFrozen;

    uint64 public nextValidatorId = 1;
    uint64 public lastRotationSnapshot;
    uint16 public override currentActiveTarget;
    uint16 public pendingActiveTarget;
    uint8 public pendingTargetSnapshots;
    uint256 public override eligibleValidatorCount;

    mapping(uint64 => ValidatorRecord) private _validators;
    mapping(address => uint64) public validatorIdByOwner;
    mapping(bytes32 => uint64) public validatorIdByConsensusKeyHash;
    mapping(uint16 => uint64) public seatOccupant;

    event ValidatorRegistered(
        uint64 indexed validatorId,
        address indexed owner,
        bytes32 indexed consensusKeyHash,
        address withdrawalAddress,
        uint64 activationEligibleBlock
    );
    event ValidatorReadinessChanged(uint64 indexed validatorId, bool ready, bytes32 evidenceHash);
    event ValidatorEligible(uint64 indexed validatorId);
    event ValidatorActivated(uint64 indexed validatorId, uint16 indexed seatId, uint64 activationRotation, uint64 exitRotation);
    event ValidatorCooldown(uint64 indexed validatorId, uint64 cooldownUntilRotation);
    event ValidatorExitRequested(uint64 indexed validatorId);
    event ValidatorExitPending(uint64 indexed validatorId, uint64 withdrawalBlock);
    event ValidatorExited(uint64 indexed validatorId);
    event ValidatorSuspended(uint64 indexed validatorId, bytes32 reasonHash);
    event ValidatorSlashed(uint64 indexed validatorId, uint256 amount, bytes32 evidenceHash, bool severe);
    event ValidatorRewardCredited(uint64 indexed validatorId, uint256 amount, bytes32 rewardReference);
    event RotationSnapshotRecorded(uint64 indexed rotation, uint256 eligibleCount, uint16 candidateTarget, uint16 effectiveTarget);
    event ActiveTargetChanged(uint16 previousTarget, uint16 newTarget, uint64 indexed rotation, bool safetyOverride);
    event LifecycleParametersChanged(uint64 activationDelayBlocks, uint64 withdrawalDelayBlocks, uint64 cooldownRotations);
    event LifecycleParametersFrozen();

    error NotConsensusSystem();
    error InvalidConsensusKey();
    error DuplicateValidator();
    error DuplicateConsensusKey();
    error UnknownValidator();
    error InvalidStatus();
    error NotValidatorOwner();
    error NotReady();
    error ActivationDelayActive();
    error SeatOccupied();
    error InvalidSeat();
    error RotationNotReady();
    error InvalidRotationSnapshot();
    error ParametersFrozen();
    error InvalidParameter();
    error InvalidEvidence();
    error BondInsufficient();

    constructor(
        address timelock_,
        address registry_,
        bytes32 genesisConfigHash_,
        address stake420_,
        address consensusSystemCaller_,
        address slashReceiver_
    ) GenesisResidentAccess420(timelock_, registry_, genesisConfigHash_) {
        if (stake420_ == address(0) || consensusSystemCaller_ == address(0) || slashReceiver_ == address(0)) {
            revert ZeroAddress();
        }
        stake420 = IStake420(stake420_);
        consensusSystemCaller = consensusSystemCaller_;
        slashReceiver = slashReceiver_;
    }

    function componentId() public pure override returns (bytes32) {
        return keccak256("420/APP/VALIDATOR_REGISTRY");
    }

    modifier onlyConsensusSystem() {
        if (msg.sender != consensusSystemCaller) revert NotConsensusSystem();
        _;
    }

    function validator(uint64 validatorId) external view override returns (ValidatorRecord memory) {
        return _validators[validatorId];
    }

    function setLifecycleParameters(uint64 activationDelayBlocks_, uint64 withdrawalDelayBlocks_, uint64 cooldownRotations_)
        external
    {
        _requireGenesisGovernance(ACTION_SET_PARAMETERS);
        if (lifecycleParametersFrozen) revert ParametersFrozen();
        if (
            activationDelayBlocks_ < ROTATION_BLOCKS || activationDelayBlocks_ > ROTATION_BLOCKS * 3
                || withdrawalDelayBlocks_ < ROTATION_BLOCKS * 3 || withdrawalDelayBlocks_ > ROTATION_BLOCKS * 12
                || cooldownRotations_ < 3 || cooldownRotations_ > 6
        ) revert InvalidParameter();
        activationDelayBlocks = activationDelayBlocks_;
        withdrawalDelayBlocks = withdrawalDelayBlocks_;
        cooldownRotations = cooldownRotations_;
        emit LifecycleParametersChanged(activationDelayBlocks_, withdrawalDelayBlocks_, cooldownRotations_);
    }

    function freezeLifecycleParameters() external {
        _requireGenesisGovernance(ACTION_FREEZE_PARAMETERS);
        lifecycleParametersFrozen = true;
        emit LifecycleParametersFrozen();
    }

    function registerValidator(bytes calldata consensusPubkey, address withdrawalAddress, bytes32 metadataCommitment)
        external
        payable
        returns (uint64 validatorId)
    {
        _requireResidentActive();
        if (consensusPubkey.length != 48) revert InvalidConsensusKey();
        if (withdrawalAddress == address(0)) revert ZeroAddress();
        if (msg.value != VALIDATOR_BOND) revert BondInsufficient();
        if (validatorIdByOwner[msg.sender] != 0) revert DuplicateValidator();

        bytes32 keyHash = keccak256(consensusPubkey);
        if (validatorIdByConsensusKeyHash[keyHash] != 0) revert DuplicateConsensusKey();

        validatorId = nextValidatorId++;
        uint64 activationBlock = uint64(block.number) + activationDelayBlocks;
        _validators[validatorId] = ValidatorRecord({
            owner: msg.sender,
            withdrawalAddress: withdrawalAddress,
            consensusKeyHash: keyHash,
            metadataCommitment: metadataCommitment,
            status: Status.PROBATION,
            registeredBlock: uint64(block.number),
            activationEligibleBlock: activationBlock,
            activationRotation: 0,
            scheduledExitRotation: 0,
            cooldownUntilRotation: 0,
            seatId: type(uint16).max,
            operationalReady: false,
            exitRequested: false,
            eligibleForPool: false,
            totalSlashed: 0
        });
        validatorIdByOwner[msg.sender] = validatorId;
        validatorIdByConsensusKeyHash[keyHash] = validatorId;

        stake420.lockValidatorBond{value: msg.value}(validatorId, msg.sender);
        emit ValidatorRegistered(validatorId, msg.sender, keyHash, withdrawalAddress, activationBlock);
    }

    function setOperationalReady(uint64 validatorId, bool ready, bytes32 evidenceHash) external onlyConsensusSystem {
        _requireResidentActive();
        ValidatorRecord storage v = _requireValidator(validatorId);
        if (v.status == Status.EXITED) revert InvalidStatus();
        v.operationalReady = ready;
        emit ValidatorReadinessChanged(validatorId, ready, evidenceHash);
    }

    function promoteEligible(uint64 validatorId) external {
        _requireResidentActive();
        ValidatorRecord storage v = _requireValidator(validatorId);
        if (v.status != Status.PROBATION) revert InvalidStatus();
        if (!v.operationalReady) revert NotReady();
        if (block.number < v.activationEligibleBlock) revert ActivationDelayActive();
        if (!stake420.isFullyBonded(validatorId)) revert BondInsufficient();
        v.status = Status.ELIGIBLE;
        _setEligibleForPool(v, true);
        emit ValidatorEligible(validatorId);
    }

    function activateValidator(uint64 validatorId, uint16 seatId, uint64 rotation) external onlyConsensusSystem {
        _requireResidentActive();
        ValidatorRecord storage v = _requireValidator(validatorId);
        if (v.status != Status.ELIGIBLE) revert InvalidStatus();
        if (!v.operationalReady || !v.eligibleForPool || !stake420.isFullyBonded(validatorId)) revert NotReady();
        if (currentActiveTarget == 0 || seatId >= currentActiveTarget) revert InvalidSeat();
        if (seatOccupant[seatId] != 0) revert SeatOccupied();
        if (rotation < lastRotationSnapshot) revert InvalidRotationSnapshot();

        v.status = Status.ACTIVE;
        v.seatId = seatId;
        v.activationRotation = rotation;
        v.scheduledExitRotation = rotation + ACTIVE_TERM_ROTATIONS;
        seatOccupant[seatId] = validatorId;
        emit ValidatorActivated(validatorId, seatId, rotation, v.scheduledExitRotation);
    }

    function completeActiveTerm(uint64 validatorId, uint64 rotation) external onlyConsensusSystem {
        _requireResidentActive();
        ValidatorRecord storage v = _requireValidator(validatorId);
        if (v.status != Status.ACTIVE) revert InvalidStatus();
        if (rotation < v.scheduledExitRotation) revert RotationNotReady();

        seatOccupant[v.seatId] = 0;
        v.seatId = type(uint16).max;
        if (v.exitRequested) {
            _beginExit(v, validatorId);
        } else {
            v.status = Status.COOLDOWN;
            v.cooldownUntilRotation = rotation + cooldownRotations;
            emit ValidatorCooldown(validatorId, v.cooldownUntilRotation);
        }
    }

    function completeCooldown(uint64 validatorId, uint64 rotation) external {
        _requireResidentActive();
        ValidatorRecord storage v = _requireValidator(validatorId);
        if (v.status != Status.COOLDOWN) revert InvalidStatus();
        if (rotation < v.cooldownUntilRotation) revert RotationNotReady();
        if (!v.operationalReady || !stake420.isFullyBonded(validatorId)) revert NotReady();
        v.status = Status.ELIGIBLE;
        emit ValidatorEligible(validatorId);
    }

    function requestExit(uint64 validatorId) external {
        _requireResidentActive();
        ValidatorRecord storage v = _requireValidator(validatorId);
        if (msg.sender != v.owner) revert NotValidatorOwner();
        if (v.status == Status.EXITED || v.status == Status.EXIT_PENDING) revert InvalidStatus();
        v.exitRequested = true;
        emit ValidatorExitRequested(validatorId);
        if (v.status != Status.ACTIVE) _beginExit(v, validatorId);
    }

    function markExited(uint64 validatorId) external {
        _requireResidentActive();
        ValidatorRecord storage v = _requireValidator(validatorId);
        if (msg.sender != v.owner) revert NotValidatorOwner();
        if (v.status != Status.EXIT_PENDING) revert InvalidStatus();
        IStake420.ValidatorBond memory b = stake420.bond(validatorId);
        if (b.bonded != 0 || b.pendingWithdrawal != 0) revert BondInsufficient();
        v.status = Status.EXITED;
        emit ValidatorExited(validatorId);
    }

    function slashValidator(uint64 validatorId, uint256 amount, bytes32 evidenceHash, bool severe)
        external
        onlyConsensusSystem
        returns (uint256 slashed)
    {
        _requireResidentActive();
        if (evidenceHash == bytes32(0)) revert InvalidEvidence();
        ValidatorRecord storage v = _requireValidator(validatorId);
        if (v.status == Status.EXITED) revert InvalidStatus();
        slashed = stake420.slashValidatorBond(validatorId, amount, slashReceiver);
        v.totalSlashed += slashed;

        if (severe || !stake420.isFullyBonded(validatorId)) {
            if (v.status == Status.ACTIVE && v.seatId != type(uint16).max) {
                seatOccupant[v.seatId] = 0;
                v.seatId = type(uint16).max;
            }
            v.status = Status.SUSPENDED;
            _setEligibleForPool(v, false);
            emit ValidatorSuspended(validatorId, evidenceHash);
        }
        emit ValidatorSlashed(validatorId, slashed, evidenceHash, severe);
    }

    function creditValidatorReward(uint64 validatorId, bytes32 rewardReference) external payable onlyConsensusSystem {
        _requireResidentActive();
        ValidatorRecord storage v = _requireValidator(validatorId);
        if (v.status != Status.ACTIVE) revert InvalidStatus();
        if (msg.value == 0) revert InvalidParameter();
        stake420.creditValidatorReward{value: msg.value}(validatorId);
        emit ValidatorRewardCredited(validatorId, msg.value, rewardReference);
    }

    function recordRotationSnapshot(uint64 rotation, uint256 eligibleSnapshot) external onlyConsensusSystem {
        _requireResidentActive();
        if (rotation <= lastRotationSnapshot) revert InvalidRotationSnapshot();
        if (eligibleSnapshot != eligibleValidatorCount) revert InvalidRotationSnapshot();
        lastRotationSnapshot = rotation;

        uint16 candidate = targetActiveCount(eligibleSnapshot);
        uint16 previous = currentActiveTarget;
        bool safetyOverride;

        if (currentActiveTarget != 0 && eligibleSnapshot < currentActiveTarget) {
            uint16 safeTarget = _largestFillableCommittee(eligibleSnapshot);
            if (safeTarget != currentActiveTarget) {
                currentActiveTarget = safeTarget;
                pendingActiveTarget = 0;
                pendingTargetSnapshots = 0;
                safetyOverride = true;
            }
        } else if (candidate == currentActiveTarget) {
            pendingActiveTarget = 0;
            pendingTargetSnapshots = 0;
        } else {
            if (pendingActiveTarget == candidate) {
                ++pendingTargetSnapshots;
            } else {
                pendingActiveTarget = candidate;
                pendingTargetSnapshots = 1;
            }
            if (pendingTargetSnapshots >= HYSTERESIS_SNAPSHOTS) {
                currentActiveTarget = candidate;
                pendingActiveTarget = 0;
                pendingTargetSnapshots = 0;
            }
        }

        if (currentActiveTarget != previous) {
            emit ActiveTargetChanged(previous, currentActiveTarget, rotation, safetyOverride);
        }
        emit RotationSnapshotRecorded(rotation, eligibleSnapshot, candidate, currentActiveTarget);
    }

    function targetActiveCount(uint256 eligibleCount) public pure override returns (uint16) {
        if (eligibleCount < 60) return 0;
        if (eligibleCount < 72) return 15;
        if (eligibleCount < 84) return 18;
        if (eligibleCount < 96) return 21;
        if (eligibleCount < 108) return 24;
        if (eligibleCount < 120) return 27;
        return 30;
    }

    function rotationTurnover(uint16 activeCount) public pure override returns (uint16) {
        if (!_validActiveCount(activeCount)) revert InvalidParameter();
        return activeCount / 3;
    }

    function allocation(uint16 activeCount)
        public
        pure
        override
        returns (uint256 security, uint256 attention, uint256 development)
    {
        if (!_validActiveCount(activeCount)) revert InvalidParameter();
        security = MIN_SECURITY_ALLOCATION
            + ((MAX_SECURITY_ALLOCATION - MIN_SECURITY_ALLOCATION) * (activeCount - MIN_ACTIVE)) / (MAX_ACTIVE - MIN_ACTIVE);
        uint256 remainder = ALLOCATION_SCALE - security;
        attention = remainder / 2;
        development = remainder - attention;
    }

    function _beginExit(ValidatorRecord storage v, uint64 validatorId) internal {
        if (v.status == Status.EXITED || v.status == Status.EXIT_PENDING) revert InvalidStatus();
        v.status = Status.EXIT_PENDING;
        _setEligibleForPool(v, false);
        uint64 withdrawalBlock = uint64(block.number) + withdrawalDelayBlocks;
        stake420.beginValidatorUnbond(validatorId, withdrawalBlock);
        emit ValidatorExitPending(validatorId, withdrawalBlock);
    }

    function _setEligibleForPool(ValidatorRecord storage v, bool eligible) internal {
        if (v.eligibleForPool == eligible) return;
        v.eligibleForPool = eligible;
        if (eligible) ++eligibleValidatorCount;
        else --eligibleValidatorCount;
    }

    function _requireValidator(uint64 validatorId) internal view returns (ValidatorRecord storage v) {
        v = _validators[validatorId];
        if (v.owner == address(0)) revert UnknownValidator();
    }

    function _validActiveCount(uint16 activeCount) internal pure returns (bool) {
        return activeCount == 15 || activeCount == 18 || activeCount == 21 || activeCount == 24 || activeCount == 27
            || activeCount == 30;
    }

    function _largestFillableCommittee(uint256 eligibleCount) internal pure returns (uint16) {
        if (eligibleCount >= 30) return 30;
        if (eligibleCount >= 27) return 27;
        if (eligibleCount >= 24) return 24;
        if (eligibleCount >= 21) return 21;
        if (eligibleCount >= 18) return 18;
        if (eligibleCount >= 15) return 15;
        return 0;
    }
}
