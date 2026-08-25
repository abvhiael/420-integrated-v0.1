
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./SystemAccess.sol";
import "../interfaces/I420System.sol";

/// @notice Execution-layer registry/mirror for validator public state.
/// Consensus authority remains in fourtwentyd. This contract must not independently
/// decide committee membership, fork choice, QC validity, or finality.
contract ValidatorRegistry is SystemAccess, I420System {
    uint256 public constant EFFECTIVE_BOND = 42_000 ether;
    uint256 public constant MAX_PROTOCOL_CREDIT = 21_000 ether;
    uint256 public constant MIN_OWNED_BOND = 21_000 ether;

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

    struct Validator {
        bytes32 validatorId;
        bytes blsPubkey;
        address owner;
        address withdrawal;
        uint256 ownedBond;
        uint256 protocolCredit;
        Status status;
        uint64 effectiveSlot;
        uint64 scheduledExitRotation;
    }

    mapping(bytes32 => Validator) private _validators;
    mapping(address => bytes32) public ownerValidatorId;

    event ValidatorRegistered(bytes32 indexed validatorId, address indexed owner, address indexed withdrawal);
    event ConsensusStateApplied(bytes32 indexed validatorId, Status status, uint64 effectiveSlot, uint64 scheduledExitRotation);
    event BondCompositionApplied(bytes32 indexed validatorId, uint256 ownedBond, uint256 protocolCredit);

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) { return "ValidatorRegistry"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function register(
        bytes32 validatorId,
        bytes calldata blsPubkey,
        address owner,
        address withdrawal,
        uint256 ownedBond,
        uint256 protocolCredit
    ) external onlyGovernance {
        require(validatorId != bytes32(0), "validator id");
        require(_validators[validatorId].status == Status.NONE, "exists");
        require(owner != address(0) && withdrawal != address(0), "zero address");
        require(blsPubkey.length == 48, "BLS pubkey");
        require(ownerValidatorId[owner] == bytes32(0), "owner used");
        require(protocolCredit <= MAX_PROTOCOL_CREDIT, "credit cap");
        require(ownedBond >= MIN_OWNED_BOND, "owned minimum");
        require(ownedBond + protocolCredit >= EFFECTIVE_BOND, "underbonded");

        _validators[validatorId] = Validator({
            validatorId: validatorId,
            blsPubkey: blsPubkey,
            owner: owner,
            withdrawal: withdrawal,
            ownedBond: ownedBond,
            protocolCredit: protocolCredit,
            status: Status.REGISTERED,
            effectiveSlot: 0,
            scheduledExitRotation: 0
        });
        ownerValidatorId[owner] = validatorId;
        emit ValidatorRegistered(validatorId, owner, withdrawal);
    }

    /// @dev Called only by the governance/system execution path after finalized consensus state.
    function applyConsensusState(
        bytes32 validatorId,
        Status status,
        uint64 effectiveSlot,
        uint64 scheduledExitRotation
    ) external onlyGovernance {
        require(_validators[validatorId].status != Status.NONE, "unknown validator");
        Validator storage v = _validators[validatorId];
        v.status = status;
        v.effectiveSlot = effectiveSlot;
        v.scheduledExitRotation = scheduledExitRotation;
        emit ConsensusStateApplied(validatorId, status, effectiveSlot, scheduledExitRotation);
    }

    function applyBondComposition(bytes32 validatorId, uint256 ownedBond, uint256 protocolCredit)
        external
        onlyGovernance
    {
        require(_validators[validatorId].status != Status.NONE, "unknown validator");
        require(protocolCredit <= MAX_PROTOCOL_CREDIT, "credit cap");
        require(ownedBond + protocolCredit <= EFFECTIVE_BOND, "effective cap");
        Validator storage v = _validators[validatorId];
        v.ownedBond = ownedBond;
        v.protocolCredit = protocolCredit;
        emit BondCompositionApplied(validatorId, ownedBond, protocolCredit);
    }

    function getValidator(bytes32 validatorId) external view returns (Validator memory) {
        return _validators[validatorId];
    }
}
