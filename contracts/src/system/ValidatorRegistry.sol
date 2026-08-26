// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ConsensusSystemAccess420.sol";
import "../interfaces/I420System.sol";

/// @notice Execution-layer mirror for finalized validator state.
/// @dev fourtwentyd remains authoritative for committee selection, proposer scheduling,
/// finality, randomness and slash adjudication. This contract validates and records finalized outcomes.
contract ValidatorRegistry is ConsensusSystemAccess420, I420System {
    uint256 public constant EFFECTIVE_BOND = 42_000 ether;
    uint256 public constant MAX_PROTOCOL_CREDIT = 21_000 ether;
    uint256 public constant MIN_OWNED_BOND = 21_000 ether;

    uint64 public constant EPOCH_BLOCKS = 420;
    uint64 public constant ROTATION_EPOCHS = 42;
    uint64 public constant ROTATION_BLOCKS = 17_640;
    uint64 public constant ACTIVE_TERM_ROTATIONS = 3;
    uint64 public constant COOLDOWN_ROTATIONS = 3;
    uint64 public constant ACTIVATION_DELAY_BLOCKS = ROTATION_BLOCKS;
    uint64 public constant EXIT_NOTICE_ROTATIONS = 1;
    uint64 public constant WITHDRAWAL_DELAY_BLOCKS = ROTATION_BLOCKS * 6;
    uint64 public constant EARLIEST_BONDED_HANDOFF_BLOCK = 4_200;

    uint16 public constant MIN_BONDED_ELIGIBLE = 60;
    uint16 public constant MIN_ACTIVE = 15;
    uint16 public constant MAX_ACTIVE = 30;
    uint8 public constant HYSTERESIS_SNAPSHOTS = 3;

    uint256 public constant ALLOCATION_SCALE = 1_000_000_000_000;
    uint256 public constant MIN_SECURITY_ALLOCATION = 283_446_712_018;
    uint256 public constant MAX_SECURITY_ALLOCATION = 500_000_000_000;
    uint16 public constant BPS_SCALE = 10_000;

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
    event ExitNoticeApplied(bytes32 indexed validatorId, uint64 noticeRotation, uint64 exitEligibleRotation);
    event BondCompositionApplied(bytes32 indexed validatorId, uint256 ownedBond, uint256 protocolCredit);
    event SlashApplied(bytes32 indexed validatorId, SlashOffense offense, uint8 correlationTier, uint256 ownedSlashed, uint256 creditSlashed, bytes32 evidenceHash);
    event RotationSnapshotApplied(uint64 indexed rotation, uint256 eligibleCount, uint16 candidateTarget, uint16 activeTarget);
    event ActiveTargetChanged(uint16 previousTarget, uint16 newTarget, uint64 indexed rotation, bool safetyOverride);

    error InvalidValidatorId();
    error ValidatorExists();
    error UnknownValidator();
    error InvalidAddress();
    error InvalidBLSPubkey();
    error DuplicateOwner();
    error DuplicateBLSPubkey();
    error InvalidBondComposition();
    error InvalidTransition();
    error InvalidRotation();
    error InvalidEligibleSnapshot();
    error InvalidEvidence();
    error InvalidActiveCount();
    error ActivationDelayActive();
    error ExitNoticeMissing();
    error ExitNoticeActive();
    error WithdrawalDelayActive();
    error InvalidSlash();
    error InvalidCorrelationTier();

    constructor(address timelock_) ConsensusSystemAccess420(timelock_) {}

    function systemName() external pure returns (string memory) { return "ValidatorRegistry"; }
    function protocolVersion() external pure returns (uint32) { return 2; }

    /// @notice Registration is an administrative/genesis onboarding action, not a committee-selection action.
    function register(
        bytes32 validatorId,
        bytes calldata blsPubkey,
        address owner,
        address withdrawal,
        uint256 ownedBond,
        uint256 protocolCredit
    ) external onlyGovernance {
        if (validatorId == bytes32(0)) revert InvalidValidatorId();
        if (_validators[validatorId].status != Status.NONE) revert ValidatorExists();
        if (owner == address(0) || withdrawal == address(0)) revert InvalidAddress();
        if (blsPubkey.length != 48) revert InvalidBLSPubkey();
        if (ownerValidatorId[owner] != bytes32(0)) revert DuplicateOwner();
        bytes32 pubkeyHash = keccak256(blsPubkey);
        if (blsPubkeyHashUsed[pubkeyHash]) revert DuplicateBLSPubkey();
        _validateBondComposition(ownedBond, protocolCredit, true);

        _validators[validatorId] = Validator({
            validatorId: validatorId,
            blsPubkey: blsPubkey,
            owner: owner,
            withdrawal: withdrawal,
            ownedBond: ownedBond,
            protocolCredit: protocolCredit,
            status: Status.REGISTERED,
            registrationBlock: uint64(block.number),
            effectiveSlot: 0,
            activationRotation: 0,
            scheduledExitRotation: 0,
            cooldownUntilRotation: 0,
            exitNoticeRotation: 0,
            exitEligibleRotation: 0,
            withdrawalHoldStartBlock: 0,
            withdrawableBlock: 0,
            totalSlashed: 0,
            metadataCommitment: bytes32(0)
        });
        ownerValidatorId[owner] = validatorId;
        blsPubkeyHashUsed[pubkeyHash] = true;
        emit ValidatorRegistered(validatorId, owner, withdrawal);
    }

    /// @notice Records a finalized voluntary-exit notice. Active validators still finish their scheduled term.
    function applyExitNotice(bytes32 validatorId, uint64 noticeRotation) external onlyConsensusSystem {
        Validator storage v = _requireValidator(validatorId);
        if (v.status == Status.EXITED || v.status == Status.WITHDRAWABLE || v.status == Status.WITHDRAWAL_HOLD) revert InvalidTransition();
        if (noticeRotation < lastRotationSnapshot) revert InvalidRotation();
        v.exitNoticeRotation = noticeRotation;
        v.exitEligibleRotation = noticeRotation + EXIT_NOTICE_ROTATIONS;
        emit ExitNoticeApplied(validatorId, noticeRotation, v.exitEligibleRotation);
    }

    function applyConsensusState(
        bytes32 validatorId,
        Status newStatus,
        uint64 effectiveSlot,
        uint64 activationRotation,
        uint64 scheduledExitRotation,
        uint64 cooldownUntilRotation
    ) external onlyConsensusSystem {
        Validator storage v = _requireValidator(validatorId);
        Status previous = v.status;
        if (!_validTransition(previous, newStatus)) revert InvalidTransition();

        _validateLifecycleTransition(v, previous, newStatus, activationRotation, scheduledExitRotation, cooldownUntilRotation);

        bool wasEligible = _countsAsEligible(previous);
        bool nowEligible = _countsAsEligible(newStatus);
        if (wasEligible != nowEligible) {
            if (nowEligible) ++eligibleValidatorCount;
            else --eligibleValidatorCount;
        }

        v.status = newStatus;
        v.effectiveSlot = effectiveSlot;
        v.activationRotation = activationRotation;
        v.scheduledExitRotation = scheduledExitRotation;
        v.cooldownUntilRotation = cooldownUntilRotation;

        if (newStatus == Status.WITHDRAWAL_HOLD && previous != Status.WITHDRAWAL_HOLD) {
            v.withdrawalHoldStartBlock = uint64(block.number);
            v.withdrawableBlock = uint64(block.number) + WITHDRAWAL_DELAY_BLOCKS;
        }

        emit ConsensusStateApplied(
            validatorId,
            previous,
            newStatus,
            effectiveSlot,
            activationRotation,
            scheduledExitRotation,
            cooldownUntilRotation
        );
    }

    /// @notice Mirrors finalized bond composition after deposits, credit replacement, slash or withdrawal.
    function applyBondComposition(bytes32 validatorId, uint256 ownedBond, uint256 protocolCredit) external onlyConsensusSystem {
        Validator storage v = _requireValidator(validatorId);
        _validateBondComposition(ownedBond, protocolCredit, false);
        v.ownedBond = ownedBond;
        v.protocolCredit = protocolCredit;
        emit BondCompositionApplied(validatorId, ownedBond, protocolCredit);
    }

    /// @notice Records a consensus-adjudicated slash within constitutional offense caps.
    /// Ordinary slash is proportional across owned stake and protocol credit. Finality equivocation confiscates both fully.
    function applySlash(
        bytes32 validatorId,
        SlashOffense offense,
        uint8 correlationTier,
        uint256 ownedSlashed,
        uint256 creditSlashed,
        bytes32 evidenceHash,
        Status resultingStatus
    ) external onlyConsensusSystem {
        if (evidenceHash == bytes32(0)) revert InvalidEvidence();
        Validator storage v = _requireValidator(validatorId);
        if (resultingStatus != v.status && !_validTransition(v.status, resultingStatus)) revert InvalidTransition();

        uint256 totalPenalty = ownedSlashed + creditSlashed;
        uint256 effectiveBefore = v.ownedBond + v.protocolCredit;
        uint16 maxBps = maxSlashBps(offense, correlationTier);

        if (offense == SlashOffense.INACTIVITY) {
            if (totalPenalty != 0) revert InvalidSlash();
        } else if (offense == SlashOffense.FINALITY_EQUIVOCATION) {
            if (ownedSlashed != v.ownedBond || creditSlashed != v.protocolCredit) revert InvalidSlash();
            if (resultingStatus != Status.SUSPENDED && resultingStatus != Status.WITHDRAWAL_HOLD) revert InvalidSlash();
        } else {
            if (totalPenalty == 0 || totalPenalty > (effectiveBefore * maxBps) / BPS_SCALE) revert InvalidSlash();
            if (ownedSlashed > v.ownedBond || creditSlashed > v.protocolCredit) revert InvalidBondComposition();
            uint256 expectedOwned = (totalPenalty * v.ownedBond) / effectiveBefore;
            uint256 expectedCredit = totalPenalty - expectedOwned;
            if (ownedSlashed != expectedOwned || creditSlashed != expectedCredit) revert InvalidSlash();
        }

        if (ownedSlashed > v.ownedBond || creditSlashed > v.protocolCredit) revert InvalidBondComposition();
        bool wasEligible = _countsAsEligible(v.status);
        v.ownedBond -= ownedSlashed;
        v.protocolCredit -= creditSlashed;
        v.totalSlashed += totalPenalty;
        v.status = resultingStatus;
        bool nowEligible = _countsAsEligible(v.status);
        if (wasEligible != nowEligible) {
            if (nowEligible) ++eligibleValidatorCount;
            else --eligibleValidatorCount;
        }
        emit SlashApplied(validatorId, offense, correlationTier, ownedSlashed, creditSlashed, evidenceHash);
    }

    function applyRotationSnapshot(uint64 rotation, uint256 eligibleSnapshot) external onlyConsensusSystem {
        if (rotation <= lastRotationSnapshot) revert InvalidRotation();
        if (eligibleSnapshot != eligibleValidatorCount) revert InvalidEligibleSnapshot();
        lastRotationSnapshot = rotation;

        uint16 candidate = targetActiveCount(eligibleSnapshot);
        uint16 previous = activeTarget;
        bool safetyOverride;

        if (activeTarget != 0 && eligibleSnapshot < activeTarget) {
            activeTarget = largestFillableCommittee(eligibleSnapshot);
            pendingActiveTarget = 0;
            pendingTargetSnapshots = 0;
            safetyOverride = true;
        } else if (candidate == activeTarget) {
            pendingActiveTarget = 0;
            pendingTargetSnapshots = 0;
        } else {
            if (pendingActiveTarget == candidate) ++pendingTargetSnapshots;
            else {
                pendingActiveTarget = candidate;
                pendingTargetSnapshots = 1;
            }
            if (pendingTargetSnapshots >= HYSTERESIS_SNAPSHOTS) {
                activeTarget = candidate;
                pendingActiveTarget = 0;
                pendingTargetSnapshots = 0;
            }
        }

        if (previous != activeTarget) emit ActiveTargetChanged(previous, activeTarget, rotation, safetyOverride);
        emit RotationSnapshotApplied(rotation, eligibleSnapshot, candidate, activeTarget);
    }

    function getValidator(bytes32 validatorId) external view returns (Validator memory) { return _validators[validatorId]; }

    function maxSlashBps(SlashOffense offense, uint8 correlationTier) public pure returns (uint16) {
        if (correlationTier > 2) revert InvalidCorrelationTier();
        uint16 base;
        if (offense == SlashOffense.NONE || offense == SlashOffense.INACTIVITY) return 0;
        if (offense == SlashOffense.INVALID_CONSENSUS_MESSAGE) base = 250;
        else if (offense == SlashOffense.DOUBLE_PROPOSAL) base = 500;
        else if (offense == SlashOffense.DOUBLE_VOTE || offense == SlashOffense.SURROUND_VOTE) base = 1_000;
        else if (offense == SlashOffense.FINALITY_EQUIVOCATION) return BPS_SCALE;
        else revert InvalidSlash();

        uint16 multiplier = correlationTier + 1;
        uint16 capped = base * multiplier;
        return capped > BPS_SCALE ? BPS_SCALE : capped;
    }

    function targetActiveCount(uint256 n) public pure returns (uint16) {
        if (n < 60) return 0;
        if (n < 72) return 15;
        if (n < 84) return 18;
        if (n < 96) return 21;
        if (n < 108) return 24;
        if (n < 120) return 27;
        return 30;
    }

    function rotationTurnover(uint16 n) public pure returns (uint16) {
        if (!_validActiveCount(n)) revert InvalidActiveCount();
        return n / 3;
    }

    function rewardAllocation(uint16 n) public pure returns (uint256 security, uint256 attention, uint256 development) {
        if (!_validActiveCount(n)) revert InvalidActiveCount();
        security = MIN_SECURITY_ALLOCATION
            + ((MAX_SECURITY_ALLOCATION - MIN_SECURITY_ALLOCATION) * (n - MIN_ACTIVE)) / (MAX_ACTIVE - MIN_ACTIVE);
        uint256 remainder = ALLOCATION_SCALE - security;
        attention = remainder / 2;
        development = remainder - attention;
    }

    function largestFillableCommittee(uint256 n) public pure returns (uint16) {
        if (n >= 30) return 30;
        if (n >= 27) return 27;
        if (n >= 24) return 24;
        if (n >= 21) return 21;
        if (n >= 18) return 18;
        if (n >= 15) return 15;
        return 0;
    }

    function _validateLifecycleTransition(
        Validator storage v,
        Status previous,
        Status next,
        uint64 activationRotation,
        uint64 scheduledExitRotation,
        uint64 cooldownUntilRotation
    ) private view {
        if (previous == Status.PROBATION && next == Status.ELIGIBLE) {
            if (block.number < uint256(v.registrationBlock) + ACTIVATION_DELAY_BLOCKS) revert ActivationDelayActive();
        }
        if (next == Status.ACTIVE) {
            if (scheduledExitRotation != activationRotation + ACTIVE_TERM_ROTATIONS) revert InvalidRotation();
        }
        if (previous == Status.ACTIVE && next == Status.NORMAL_COOLDOWN) {
            if (lastRotationSnapshot < v.scheduledExitRotation) revert InvalidRotation();
            if (cooldownUntilRotation != lastRotationSnapshot + COOLDOWN_ROTATIONS) revert InvalidRotation();
        }
        if (previous == Status.NORMAL_COOLDOWN && next == Status.ELIGIBLE) {
            if (lastRotationSnapshot < v.cooldownUntilRotation) revert InvalidRotation();
        }
        if (next == Status.WITHDRAWAL_HOLD) {
            if (v.exitNoticeRotation == 0) revert ExitNoticeMissing();
            if (lastRotationSnapshot < v.exitEligibleRotation) revert ExitNoticeActive();
            if (previous == Status.ACTIVE && lastRotationSnapshot < v.scheduledExitRotation) revert InvalidRotation();
        }
        if (previous == Status.WITHDRAWAL_HOLD && next == Status.WITHDRAWABLE) {
            if (v.withdrawableBlock == 0 || block.number < v.withdrawableBlock) revert WithdrawalDelayActive();
        }
    }

    function _requireValidator(bytes32 id) private view returns (Validator storage v) {
        v = _validators[id];
        if (v.status == Status.NONE) revert UnknownValidator();
    }

    function _validateBondComposition(uint256 ownedBond, uint256 protocolCredit, bool requireEffective) private pure {
        if (protocolCredit > MAX_PROTOCOL_CREDIT || ownedBond < MIN_OWNED_BOND) revert InvalidBondComposition();
        uint256 effective = ownedBond + protocolCredit;
        if (effective > EFFECTIVE_BOND || (requireEffective && effective != EFFECTIVE_BOND)) revert InvalidBondComposition();
    }

    function _countsAsEligible(Status s) private pure returns (bool) {
        return s == Status.ELIGIBLE || s == Status.ACTIVE || s == Status.NORMAL_COOLDOWN;
    }

    function _validTransition(Status a, Status b) private pure returns (bool) {
        if (a == b) return true;
        if (a == Status.REGISTERED) return b == Status.PROBATION || b == Status.SUSPENDED;
        if (a == Status.PROBATION) return b == Status.ELIGIBLE || b == Status.SUSPENDED || b == Status.WITHDRAWAL_HOLD;
        if (a == Status.ELIGIBLE) return b == Status.ACTIVE || b == Status.SUSPENDED || b == Status.WITHDRAWAL_HOLD;
        if (a == Status.ACTIVE) return b == Status.NORMAL_COOLDOWN || b == Status.SUSPENDED || b == Status.WITHDRAWAL_HOLD;
        if (a == Status.NORMAL_COOLDOWN) return b == Status.ELIGIBLE || b == Status.SUSPENDED || b == Status.WITHDRAWAL_HOLD;
        if (a == Status.SUSPENDED) return b == Status.PROBATION || b == Status.WITHDRAWAL_HOLD;
        if (a == Status.WITHDRAWAL_HOLD) return b == Status.WITHDRAWABLE || b == Status.SUSPENDED;
        if (a == Status.WITHDRAWABLE) return b == Status.EXITED;
        return false;
    }

    function _validActiveCount(uint16 n) private pure returns (bool) {
        return n == 15 || n == 18 || n == 21 || n == 24 || n == 27 || n == 30;
    }
}
