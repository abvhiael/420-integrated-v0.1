// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./SystemAccess.sol";
import "../interfaces/I420System.sol";

/// @notice Execution-layer mirror for finalized validator state.
/// @dev fourtwentyd remains authoritative for committee selection, proposer scheduling,
/// finality, randomness and slash adjudication. This contract records finalized outcomes.
contract ValidatorRegistry is SystemAccess, I420System {
    uint256 public constant EFFECTIVE_BOND = 42_000 ether;
    uint256 public constant MAX_PROTOCOL_CREDIT = 21_000 ether;
    uint256 public constant MIN_OWNED_BOND = 21_000 ether;
    uint64 public constant EPOCH_BLOCKS = 420;
    uint64 public constant ROTATION_EPOCHS = 42;
    uint64 public constant ROTATION_BLOCKS = 17_640;
    uint64 public constant ACTIVE_TERM_ROTATIONS = 3;
    uint64 public constant EARLIEST_BONDED_HANDOFF_BLOCK = 4_200;
    uint16 public constant MIN_BONDED_ELIGIBLE = 60;
    uint16 public constant MIN_ACTIVE = 15;
    uint16 public constant MAX_ACTIVE = 30;
    uint8 public constant HYSTERESIS_SNAPSHOTS = 3;
    uint256 public constant ALLOCATION_SCALE = 1_000_000_000_000;
    uint256 public constant MIN_SECURITY_ALLOCATION = 283_446_712_018;
    uint256 public constant MAX_SECURITY_ALLOCATION = 500_000_000_000;

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

    mapping(bytes32 => Validator) private _validators;
    mapping(address => bytes32) public ownerValidatorId;
    mapping(bytes32 => bool) public blsPubkeyHashUsed;

    uint256 public eligibleValidatorCount;
    uint16 public activeTarget;
    uint16 public pendingActiveTarget;
    uint8 public pendingTargetSnapshots;
    uint64 public lastRotationSnapshot;

    event ValidatorRegistered(bytes32 indexed validatorId, address indexed owner, address indexed withdrawal);
    event ConsensusStateApplied(bytes32 indexed validatorId, Status previousStatus, Status newStatus, uint64 effectiveSlot, uint64 activationRotation, uint64 scheduledExitRotation, uint64 cooldownUntilRotation);
    event BondCompositionApplied(bytes32 indexed validatorId, uint256 ownedBond, uint256 protocolCredit);
    event SlashApplied(bytes32 indexed validatorId, uint256 ownedSlashed, uint256 creditSlashed, bytes32 evidenceHash);
    event RotationSnapshotApplied(uint64 indexed rotation, uint256 eligibleCount, uint16 candidateTarget, uint16 activeTarget);
    event ActiveTargetChanged(uint16 previousTarget, uint16 newTarget, uint64 indexed rotation, bool safetyOverride);

    error InvalidValidatorId(); error ValidatorExists(); error UnknownValidator(); error InvalidAddress();
    error InvalidBLSPubkey(); error DuplicateOwner(); error DuplicateBLSPubkey(); error InvalidBondComposition();
    error InvalidTransition(); error InvalidRotation(); error InvalidEligibleSnapshot(); error InvalidEvidence(); error InvalidActiveCount();

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) { return "ValidatorRegistry"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function register(bytes32 validatorId, bytes calldata blsPubkey, address owner, address withdrawal, uint256 ownedBond, uint256 protocolCredit) external onlyGovernance {
        if (validatorId == bytes32(0)) revert InvalidValidatorId();
        if (_validators[validatorId].status != Status.NONE) revert ValidatorExists();
        if (owner == address(0) || withdrawal == address(0)) revert InvalidAddress();
        if (blsPubkey.length != 48) revert InvalidBLSPubkey();
        if (ownerValidatorId[owner] != bytes32(0)) revert DuplicateOwner();
        bytes32 pubkeyHash = keccak256(blsPubkey);
        if (blsPubkeyHashUsed[pubkeyHash]) revert DuplicateBLSPubkey();
        _validateBondComposition(ownedBond, protocolCredit, true);
        _validators[validatorId] = Validator(validatorId, blsPubkey, owner, withdrawal, ownedBond, protocolCredit, Status.REGISTERED, 0, 0, 0, 0, 0, bytes32(0));
        ownerValidatorId[owner] = validatorId;
        blsPubkeyHashUsed[pubkeyHash] = true;
        emit ValidatorRegistered(validatorId, owner, withdrawal);
    }

    function applyConsensusState(bytes32 validatorId, Status newStatus, uint64 effectiveSlot, uint64 activationRotation, uint64 scheduledExitRotation, uint64 cooldownUntilRotation) external onlyGovernance {
        Validator storage v = _requireValidator(validatorId);
        Status previous = v.status;
        if (!_validTransition(previous, newStatus)) revert InvalidTransition();
        bool wasEligible = _countsAsEligible(previous);
        bool nowEligible = _countsAsEligible(newStatus);
        if (wasEligible != nowEligible) { if (nowEligible) ++eligibleValidatorCount; else --eligibleValidatorCount; }
        v.status = newStatus; v.effectiveSlot = effectiveSlot; v.activationRotation = activationRotation;
        v.scheduledExitRotation = scheduledExitRotation; v.cooldownUntilRotation = cooldownUntilRotation;
        emit ConsensusStateApplied(validatorId, previous, newStatus, effectiveSlot, activationRotation, scheduledExitRotation, cooldownUntilRotation);
    }

    function applyBondComposition(bytes32 validatorId, uint256 ownedBond, uint256 protocolCredit) external onlyGovernance {
        Validator storage v = _requireValidator(validatorId);
        _validateBondComposition(ownedBond, protocolCredit, false);
        v.ownedBond = ownedBond; v.protocolCredit = protocolCredit;
        emit BondCompositionApplied(validatorId, ownedBond, protocolCredit);
    }

    function applySlash(bytes32 validatorId, uint256 ownedSlashed, uint256 creditSlashed, bytes32 evidenceHash, Status resultingStatus) external onlyGovernance {
        if (evidenceHash == bytes32(0)) revert InvalidEvidence();
        Validator storage v = _requireValidator(validatorId);
        if (ownedSlashed > v.ownedBond || creditSlashed > v.protocolCredit) revert InvalidBondComposition();
        if (resultingStatus != v.status && !_validTransition(v.status, resultingStatus)) revert InvalidTransition();
        bool wasEligible = _countsAsEligible(v.status);
        v.ownedBond -= ownedSlashed; v.protocolCredit -= creditSlashed; v.totalSlashed += ownedSlashed + creditSlashed; v.status = resultingStatus;
        bool nowEligible = _countsAsEligible(v.status);
        if (wasEligible != nowEligible) { if (nowEligible) ++eligibleValidatorCount; else --eligibleValidatorCount; }
        emit SlashApplied(validatorId, ownedSlashed, creditSlashed, evidenceHash);
    }

    function applyRotationSnapshot(uint64 rotation, uint256 eligibleSnapshot) external onlyGovernance {
        if (rotation <= lastRotationSnapshot) revert InvalidRotation();
        if (eligibleSnapshot != eligibleValidatorCount) revert InvalidEligibleSnapshot();
        lastRotationSnapshot = rotation;
        uint16 candidate = targetActiveCount(eligibleSnapshot); uint16 previous = activeTarget; bool safetyOverride;
        if (activeTarget != 0 && eligibleSnapshot < activeTarget) { activeTarget = largestFillableCommittee(eligibleSnapshot); pendingActiveTarget = 0; pendingTargetSnapshots = 0; safetyOverride = true; }
        else if (candidate == activeTarget) { pendingActiveTarget = 0; pendingTargetSnapshots = 0; }
        else { if (pendingActiveTarget == candidate) ++pendingTargetSnapshots; else { pendingActiveTarget = candidate; pendingTargetSnapshots = 1; } if (pendingTargetSnapshots >= HYSTERESIS_SNAPSHOTS) { activeTarget = candidate; pendingActiveTarget = 0; pendingTargetSnapshots = 0; } }
        if (previous != activeTarget) emit ActiveTargetChanged(previous, activeTarget, rotation, safetyOverride);
        emit RotationSnapshotApplied(rotation, eligibleSnapshot, candidate, activeTarget);
    }

    function getValidator(bytes32 validatorId) external view returns (Validator memory) { return _validators[validatorId]; }
    function targetActiveCount(uint256 n) public pure returns (uint16) { if (n < 60) return 0; if (n < 72) return 15; if (n < 84) return 18; if (n < 96) return 21; if (n < 108) return 24; if (n < 120) return 27; return 30; }
    function rotationTurnover(uint16 n) public pure returns (uint16) { if (!_validActiveCount(n)) revert InvalidActiveCount(); return n / 3; }
    function rewardAllocation(uint16 n) public pure returns (uint256 security, uint256 attention, uint256 development) { if (!_validActiveCount(n)) revert InvalidActiveCount(); security = MIN_SECURITY_ALLOCATION + ((MAX_SECURITY_ALLOCATION - MIN_SECURITY_ALLOCATION) * (n - MIN_ACTIVE)) / (MAX_ACTIVE - MIN_ACTIVE); uint256 remainder = ALLOCATION_SCALE - security; attention = remainder / 2; development = remainder - attention; }
    function largestFillableCommittee(uint256 n) public pure returns (uint16) { if (n >= 30) return 30; if (n >= 27) return 27; if (n >= 24) return 24; if (n >= 21) return 21; if (n >= 18) return 18; if (n >= 15) return 15; return 0; }

    function _requireValidator(bytes32 id) private view returns (Validator storage v) { v = _validators[id]; if (v.status == Status.NONE) revert UnknownValidator(); }
    function _validateBondComposition(uint256 ownedBond, uint256 protocolCredit, bool requireEffective) private pure { if (protocolCredit > MAX_PROTOCOL_CREDIT || ownedBond < MIN_OWNED_BOND) revert InvalidBondComposition(); uint256 effective = ownedBond + protocolCredit; if (effective > EFFECTIVE_BOND || (requireEffective && effective != EFFECTIVE_BOND)) revert InvalidBondComposition(); }
    function _countsAsEligible(Status s) private pure returns (bool) { return s == Status.ELIGIBLE || s == Status.ACTIVE || s == Status.NORMAL_COOLDOWN; }
    function _validTransition(Status a, Status b) private pure returns (bool) { if (a == b) return true; if (a == Status.REGISTERED) return b == Status.PROBATION || b == Status.SUSPENDED; if (a == Status.PROBATION) return b == Status.ELIGIBLE || b == Status.SUSPENDED || b == Status.WITHDRAWAL_HOLD; if (a == Status.ELIGIBLE) return b == Status.ACTIVE || b == Status.SUSPENDED || b == Status.WITHDRAWAL_HOLD; if (a == Status.ACTIVE) return b == Status.NORMAL_COOLDOWN || b == Status.SUSPENDED || b == Status.WITHDRAWAL_HOLD; if (a == Status.NORMAL_COOLDOWN) return b == Status.ELIGIBLE || b == Status.SUSPENDED || b == Status.WITHDRAWAL_HOLD; if (a == Status.SUSPENDED) return b == Status.PROBATION || b == Status.WITHDRAWAL_HOLD; if (a == Status.WITHDRAWAL_HOLD) return b == Status.WITHDRAWABLE || b == Status.SUSPENDED; if (a == Status.WITHDRAWABLE) return b == Status.EXITED; return false; }
    function _validActiveCount(uint16 n) private pure returns (bool) { return n == 15 || n == 18 || n == 21 || n == 24 || n == 27 || n == 30; }
}
