// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";

interface IMediaCapabilityRegistry420 {
    function isActive(bytes32 capabilityId) external view returns (bool);
}

contract MediaOperatorRegistry420 is SystemAccess, I420System {
    enum OperatorState { NONE, REGISTERED, ACTIVE, SUSPENDED, RETIRED }

    struct Operator {
        address operatorAccount;
        address settlementAccount;
        bytes32 metadataHash;
        bytes32 computeProviderRef;
        bytes32 stakeRef;
        uint64 createdAt;
        uint32 revision;
        OperatorState state;
        bool exists;
    }

    mapping(bytes32 => Operator) public operators;
    mapping(bytes32 => mapping(bytes32 => bool)) public operatorCapabilities;

    address public capabilityRegistry;
    bool public capabilityRegistryBound;

    error InvalidOperatorId();
    error OperatorExists();
    error OperatorNotFound();
    error NotOperator();
    error InvalidStateTransition();
    error MissingStake();
    error InvalidCapability();
    error CapabilityAlreadySet();
    error CapabilityNotSet();
    error RegistryAlreadyBound();

    event CapabilityRegistryBound(address indexed registry);
    event OperatorRegistered(bytes32 indexed operatorId, address indexed operatorAccount, address indexed settlementAccount, bytes32 computeProviderRef, bytes32 stakeRef);
    event OperatorMetadataUpdated(bytes32 indexed operatorId, bytes32 metadataHash, uint32 revision);
    event OperatorSettlementUpdated(bytes32 indexed operatorId, address indexed settlementAccount, uint32 revision);
    event OperatorStateChanged(bytes32 indexed operatorId, OperatorState previousState, OperatorState newState, uint32 revision);
    event OperatorCapabilityChanged(bytes32 indexed operatorId, bytes32 indexed capabilityId, bool enabled, uint32 revision);

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) { return "MediaOperatorRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function bindCapabilityRegistry(address registry_) external onlyGovernance {
        if (capabilityRegistryBound) revert RegistryAlreadyBound();
        if (registry_ == address(0)) revert ZeroAddress();
        capabilityRegistry = registry_;
        capabilityRegistryBound = true;
        emit CapabilityRegistryBound(registry_);
    }

    function registerOperator(
        bytes32 operatorId,
        address operatorAccount,
        address settlementAccount,
        bytes32 metadataHash,
        bytes32 computeProviderRef,
        bytes32 stakeRef
    ) external {
        if (operatorId == bytes32(0)) revert InvalidOperatorId();
        if (operatorAccount == address(0) || settlementAccount == address(0)) revert ZeroAddress();
        if (operators[operatorId].exists) revert OperatorExists();
        if (msg.sender != operatorAccount) revert NotOperator();
        operators[operatorId] = Operator({
            operatorAccount: operatorAccount,
            settlementAccount: settlementAccount,
            metadataHash: metadataHash,
            computeProviderRef: computeProviderRef,
            stakeRef: stakeRef,
            createdAt: uint64(block.timestamp),
            revision: 1,
            state: OperatorState.REGISTERED,
            exists: true
        });
        emit OperatorRegistered(operatorId, operatorAccount, settlementAccount, computeProviderRef, stakeRef);
    }

    function setCapability(bytes32 operatorId, bytes32 capabilityId, bool enabled) external {
        Operator storage op = _operator(operatorId);
        if (op.state == OperatorState.RETIRED) revert InvalidStateTransition();
        if (!capabilityRegistryBound || !IMediaCapabilityRegistry420(capabilityRegistry).isActive(capabilityId)) revert InvalidCapability();
        bool current = operatorCapabilities[operatorId][capabilityId];
        if (enabled && current) revert CapabilityAlreadySet();
        if (!enabled && !current) revert CapabilityNotSet();
        operatorCapabilities[operatorId][capabilityId] = enabled;
        op.revision += 1;
        emit OperatorCapabilityChanged(operatorId, capabilityId, enabled, op.revision);
    }

    function updateMetadata(bytes32 operatorId, bytes32 metadataHash) external {
        Operator storage op = _operator(operatorId);
        if (op.state == OperatorState.RETIRED) revert InvalidStateTransition();
        op.metadataHash = metadataHash;
        op.revision += 1;
        emit OperatorMetadataUpdated(operatorId, metadataHash, op.revision);
    }

    function updateSettlementAccount(bytes32 operatorId, address settlementAccount) external {
        if (settlementAccount == address(0)) revert ZeroAddress();
        Operator storage op = _operator(operatorId);
        if (op.state == OperatorState.RETIRED) revert InvalidStateTransition();
        op.settlementAccount = settlementAccount;
        op.revision += 1;
        emit OperatorSettlementUpdated(operatorId, settlementAccount, op.revision);
    }

    function activate(bytes32 operatorId) external {
        Operator storage op = _operator(operatorId);
        if (op.state != OperatorState.REGISTERED && op.state != OperatorState.SUSPENDED) revert InvalidStateTransition();
        if (op.stakeRef == bytes32(0)) revert MissingStake();
        _setState(operatorId, op, OperatorState.ACTIVE);
    }

    function retire(bytes32 operatorId) external {
        Operator storage op = _operator(operatorId);
        if (op.state == OperatorState.RETIRED) revert InvalidStateTransition();
        _setState(operatorId, op, OperatorState.RETIRED);
    }

    function setSuspended(bytes32 operatorId, bool suspended) external onlyGovernance {
        Operator storage op = _get(operatorId);
        if (op.state == OperatorState.RETIRED) revert InvalidStateTransition();
        if (suspended) {
            if (op.state != OperatorState.ACTIVE) revert InvalidStateTransition();
            _setState(operatorId, op, OperatorState.SUSPENDED);
        } else {
            if (op.state != OperatorState.SUSPENDED || op.stakeRef == bytes32(0)) revert InvalidStateTransition();
            _setState(operatorId, op, OperatorState.ACTIVE);
        }
    }

    function isOperationalFor(bytes32 operatorId, bytes32 capabilityId) external view returns (bool) {
        Operator storage op = operators[operatorId];
        if (!op.exists || op.state != OperatorState.ACTIVE || !operatorCapabilities[operatorId][capabilityId]) return false;
        if (!capabilityRegistryBound) return false;
        return IMediaCapabilityRegistry420(capabilityRegistry).isActive(capabilityId);
    }

    function operatorAccountOf(bytes32 operatorId) external view returns (address) {
        return _get(operatorId).operatorAccount;
    }

    function settlementAccountOf(bytes32 operatorId) external view returns (address) {
        return _get(operatorId).settlementAccount;
    }

    function _operator(bytes32 operatorId) private view returns (Operator storage op) {
        op = _get(operatorId);
        if (msg.sender != op.operatorAccount) revert NotOperator();
    }

    function _get(bytes32 operatorId) private view returns (Operator storage op) {
        op = operators[operatorId];
        if (!op.exists) revert OperatorNotFound();
    }

    function _setState(bytes32 operatorId, Operator storage op, OperatorState next) private {
        OperatorState previous = op.state;
        op.state = next;
        op.revision += 1;
        emit OperatorStateChanged(operatorId, previous, next, op.revision);
    }
}
