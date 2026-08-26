// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ConsensusSystemAccess420.sol";
import "../interfaces/I420System.sol";

interface ICommunityValidatorReserve420 {
    function returnCredit(bytes32 validatorId) external payable;
}

/// @notice Canonical execution-layer validator registry and native 420 bond vault.
/// @dev fourtwentyd remains authoritative for committee selection, proposer scheduling,
/// finality, randomness and slash adjudication. Economic balances here are backed by native 420 custody.
contract ValidatorRegistry is ConsensusSystemAccess420, I420System {
    uint256 public constant EFFECTIVE_BOND = 42_000 ether;
    uint256 public constant MAX_PROTOCOL_CREDIT = 21_000 ether;
    uint256 public constant MIN_OWNED_BOND = 21_000 ether;
    address public constant PROTOCOL_RESERVE = 0x0000000000000000000000000000000000000424;

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

    mapping(bytes32 => uint256) public pendingProtocolCredit;
    mapping(bytes32 => address) public pendingCreditBeneficiary;

    address public communityValidatorReserve;
    bool public communityValidatorReserveBound;

    uint256 public totalOwnedCustody;
    uint256 public totalProtocolCreditCustody;
    uint256 public totalPendingProtocolCredit;
    uint256 public totalOwnedSlashed;
    uint256 public totalProtocolCreditRecycled;
    uint256 public totalOwnedWithdrawn;

    uint256 public eligibleValidatorCount;
    uint16 public activeTarget;
    uint16 public pendingActiveTarget;
    uint8 public pendingTargetSnapshots;
    uint64 public lastRotationSnapshot;

    event CommunityValidatorReserveBound(address indexed reserve);
    event ProtocolCreditReceived(bytes32 indexed validatorId, address indexed beneficiary, uint256 amount);
    event PendingProtocolCreditReturned(bytes32 indexed validatorId, uint256 amount);
    event ValidatorRegistered(bytes32 indexed validatorId, address indexed owner, address indexed withdrawal, uint256 ownedBond, uint256 protocolCredit);
    event OwnedBondToppedUp(bytes32 indexed validatorId, uint256 amount, uint256 ownedBond);
    event ProtocolCreditReplaced(bytes32 indexed validatorId, uint256 amount, uint256 ownedBond, uint256 protocolCredit);
    event ValidatorBondWithdrawn(bytes32 indexed validatorId, address indexed withdrawal, uint256 ownedAmount, uint256 recycledCredit);
    event ConsensusStateApplied(bytes32 indexed validatorId, Status previousStatus, Status newStatus, uint64 effectiveSlot, uint64 activationRotation, uint64 scheduledExitRotation, uint64 cooldownUntilRotation);
    event ExitNoticeApplied(bytes32 indexed validatorId, uint64 noticeRotation, uint64 exitEligibleRotation);
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
    error NotCommunityValidatorReserve();
    error AlreadyBound();
    error InvalidCreditBeneficiary();
    error TransferFailed();
    error NotValidatorOwner();
    error NotWithdrawalAddress();
    error BondAlreadyFull();

    constructor(address timelock_) ConsensusSystemAccess420(timelock_) {}

    function systemName() external pure returns (string memory) { return "ValidatorRegistry"; }
    function protocolVersion() external pure returns (uint32) { return 3; }

    receive() external payable {}

    function bindCommunityValidatorReserve(address reserve) external onlyGovernance {
        if (communityValidatorReserveBound) revert AlreadyBound();
        if (reserve == address(0)) revert InvalidAddress();
        communityValidatorReserve = reserve;
        communityValidatorReserveBound = true;
        emit CommunityValidatorReserveBound(reserve);
    }

    /// @notice Receives real protocol-owned 420 from CommunityValidatorReserve before matched registration.
    function receiveProtocolCredit(bytes32 validatorId, address beneficiary) external payable {
        if (!communityValidatorReserveBound || msg.sender != communityValidatorReserve) revert NotCommunityValidatorReserve();
        if (validatorId == bytes32(0) || beneficiary == address(0) || msg.value == 0) revert InvalidBondComposition();
        if (_validators[validatorId].status != Status.NONE) revert ValidatorExists();
        if (pendingProtocolCredit[validatorId] != 0) revert InvalidBondComposition();
        if (msg.value > MAX_PROTOCOL_CREDIT) revert InvalidBondComposition();

        pendingProtocolCredit[validatorId] = msg.value;
        pendingCreditBeneficiary[validatorId] = beneficiary;
        totalProtocolCreditCustody += msg.value;
        totalPendingProtocolCredit += msg.value;
        emit ProtocolCreditReceived(validatorId, beneficiary, msg.value);
    }

    /// @notice Lets the reserve recover funded credit if the qualified beneficiary never registers.
    function returnPendingProtocolCredit(bytes32 validatorId) external {
        if (!communityValidatorReserveBound || msg.sender != communityValidatorReserve) revert NotCommunityValidatorReserve();
        if (_validators[validatorId].status != Status.NONE) revert ValidatorExists();
        uint256 amount = pendingProtocolCredit[validatorId];
        if (amount == 0) revert InvalidBondComposition();

        pendingProtocolCredit[validatorId] = 0;
        pendingCreditBeneficiary[validatorId] = address(0);
        totalProtocolCreditCustody -= amount;
        totalPendingProtocolCredit -= amount;
        _returnProtocolCredit(validatorId, amount);
        emit PendingProtocolCreditReturned(validatorId, amount);
    }

    /// @notice Operator-funded registration. Matched protocol credit, if any, must already be physically deposited.
    function register(bytes32 validatorId, bytes calldata blsPubkey, address withdrawal, bytes32 metadataCommitment)
        external
        payable
    {
        if (validatorId == bytes32(0)) revert InvalidValidatorId();
        if (_validators[validatorId].status != Status.NONE) revert ValidatorExists();
        if (withdrawal == address(0)) revert InvalidAddress();
        if (blsPubkey.length != 48) revert InvalidBLSPubkey();
        if (ownerValidatorId[msg.sender] != bytes32(0)) revert DuplicateOwner();

        bytes32 pubkeyHash = keccak256(blsPubkey);
        if (blsPubkeyHashUsed[pubkeyHash]) revert DuplicateBLSPubkey();

        uint256 credit = pendingProtocolCredit[validatorId];
        if (credit != 0 && pendingCreditBeneficiary[validatorId] != msg.sender) revert InvalidCreditBeneficiary();
        _validateBondComposition(msg.value, credit, true);

        _validators[validatorId] = Validator({
            validatorId: validatorId,
            blsPubkey: blsPubkey,
            owner: msg.sender,
            withdrawal: withdrawal,
            ownedBond: msg.value,
            protocolCredit: credit,
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
            metadataCommitment: metadataCommitment
        });
        ownerValidatorId[msg.sender] = validatorId;
        blsPubkeyHashUsed[pubkeyHash] = true;
        totalOwnedCustody += msg.value;

        if (credit != 0) {
            pendingProtocolCredit[validatorId] = 0;
            pendingCreditBeneficiary[validatorId] = address(0);
            totalPendingProtocolCredit -= credit;
        }

        emit ValidatorRegistered(validatorId, msg.sender, withdrawal, msg.value, credit);
    }

    /// @notice Restores owned collateral after a slash without increasing effective bond above 42,000 420.
    function topUpOwnedBond(bytes32 validatorId) external payable {
        Validator storage v = _requireValidator(validatorId);
        if (msg.sender != v.owner) revert NotValidatorOwner();
        if (v.status == Status.EXITED || v.status == Status.WITHDRAWABLE) revert InvalidTransition();
        if (msg.value == 0) revert InvalidBondComposition();
        if (v.ownedBond + v.protocolCredit >= EFFECTIVE_BOND) revert BondAlreadyFull();
        if (v.ownedBond + v.protocolCredit + msg.value > EFFECTIVE_BOND) revert InvalidBondComposition();

        v.ownedBond += msg.value;
        totalOwnedCustody += msg.value;
        emit OwnedBondToppedUp(validatorId, msg.value, v.ownedBond);
    }

    /// @notice Replaces protocol-owned credit with operator-owned 420; effective bond is unchanged.
    function replaceProtocolCredit(bytes32 validatorId) external payable {
        Validator storage v = _requireValidator(validatorId);
        if (msg.sender != v.owner) revert NotValidatorOwner();
        if (v.status == Status.EXITED || v.status == Status.WITHDRAWABLE) revert InvalidTransition();
        if (msg.value == 0 || msg.value > v.protocolCredit) revert InvalidBondComposition();

        v.ownedBond += msg.value;
        v.protocolCredit -= msg.value;
        totalOwnedCustody += msg.value;
        totalProtocolCreditCustody -= msg.value;
        totalProtocolCreditRecycled += msg.value;
        _returnProtocolCredit(validatorId, msg.value);
        emit ProtocolCreditReplaced(validatorId, msg.value, v.ownedBond, v.protocolCredit);
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

        emit ConsensusStateApplied(validatorId, previous, newStatus, effectiveSlot, activationRotation, scheduledExitRotation, cooldownUntilRotation);
    }

    /// @notice Records a consensus-adjudicated slash and moves the actual collateral.
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
            if (effectiveBefore == 0 || totalPenalty == 0 || totalPenalty > (effectiveBefore * maxBps) / BPS_SCALE) revert InvalidSlash();
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

        if (ownedSlashed != 0) {
            totalOwnedCustody -= ownedSlashed;
            totalOwnedSlashed += ownedSlashed;
            (bool ok,) = payable(PROTOCOL_RESERVE).call{value: ownedSlashed}("");
            if (!ok) revert TransferFailed();
        }
        if (creditSlashed != 0) {
            totalProtocolCreditCustody -= creditSlashed;
            totalProtocolCreditRecycled += creditSlashed;
            _returnProtocolCredit(validatorId, creditSlashed);
        }

        emit SlashApplied(validatorId, offense, correlationTier, ownedSlashed, creditSlashed, evidenceHash);
    }

    /// @notice Withdraws operator-owned collateral and recycles all remaining protocol credit after consensus hold expires.
    function withdrawBond(bytes32 validatorId) external returns (uint256 ownedAmount, uint256 recycledCredit) {
        Validator storage v = _requireValidator(validatorId);
        if (msg.sender != v.withdrawal) revert NotWithdrawalAddress();
        if (v.status != Status.WITHDRAWABLE) revert InvalidTransition();

        ownedAmount = v.ownedBond;
        recycledCredit = v.protocolCredit;
        address withdrawal = v.withdrawal;
        address owner = v.owner;

        v.ownedBond = 0;
        v.protocolCredit = 0;
        v.status = Status.EXITED;
        ownerValidatorId[owner] = bytes32(0);

        if (ownedAmount != 0) {
            totalOwnedCustody -= ownedAmount;
            totalOwnedWithdrawn += ownedAmount;
        }
        if (recycledCredit != 0) {
            totalProtocolCreditCustody -= recycledCredit;
            totalProtocolCreditRecycled += recycledCredit;
            _returnProtocolCredit(validatorId, recycledCredit);
        }
        if (ownedAmount != 0) {
            (bool ok,) = payable(withdrawal).call{value: ownedAmount}("");
            if (!ok) revert TransferFailed();
        }

        emit ValidatorBondWithdrawn(validatorId, withdrawal, ownedAmount, recycledCredit);
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

    function custodyInvariant() external view returns (bool) {
        return address(this).balance >= totalOwnedCustody + totalProtocolCreditCustody;
    }

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
        if (previous == Status.REGISTERED && next == Status.PROBATION) {
            if (v.ownedBond + v.protocolCredit != EFFECTIVE_BOND) revert InvalidBondComposition();
        }
        if (previous == Status.PROBATION && next == Status.ELIGIBLE) {
            if (block.number < uint256(v.registrationBlock) + ACTIVATION_DELAY_BLOCKS) revert ActivationDelayActive();
            if (v.ownedBond + v.protocolCredit != EFFECTIVE_BOND) revert InvalidBondComposition();
        }
        if (next == Status.ACTIVE) {
            if (v.ownedBond + v.protocolCredit != EFFECTIVE_BOND) revert InvalidBondComposition();
            if (scheduledExitRotation != activationRotation + ACTIVE_TERM_ROTATIONS) revert InvalidRotation();
        }
        if (previous == Status.ACTIVE && next == Status.NORMAL_COOLDOWN) {
            if (lastRotationSnapshot < v.scheduledExitRotation) revert InvalidRotation();
            if (cooldownUntilRotation != lastRotationSnapshot + COOLDOWN_ROTATIONS) revert InvalidRotation();
        }
        if (previous == Status.NORMAL_COOLDOWN && next == Status.ELIGIBLE) {
            if (lastRotationSnapshot < v.cooldownUntilRotation) revert InvalidRotation();
            if (v.ownedBond + v.protocolCredit != EFFECTIVE_BOND) revert InvalidBondComposition();
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

    function _returnProtocolCredit(bytes32 validatorId, uint256 amount) private {
        if (!communityValidatorReserveBound) revert NotCommunityValidatorReserve();
        ICommunityValidatorReserve420(communityValidatorReserve).returnCredit{value: amount}(validatorId);
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
        return false;
    }

    function _validActiveCount(uint16 n) private pure returns (bool) {
        return n == 15 || n == 18 || n == 21 || n == 24 || n == 27 || n == 30;
    }
}
