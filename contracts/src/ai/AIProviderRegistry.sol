// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";

contract AIProviderRegistry is SystemAccess, I420System {
    enum ProviderState { NONE, REGISTERED, ACTIVE, SUSPENDED, RETIRED }

    struct Provider {
        address operatorAccount;
        address settlementAccount;
        bytes32 metadataHash;
        bytes32 stakeRef;
        bytes32 computeProviderRef;
        uint64 createdAt;
        uint32 revision;
        ProviderState state;
        bool exists;
    }

    mapping(bytes32 => Provider) public providers;

    error InvalidProviderId();
    error ProviderAlreadyExists();
    error ProviderNotFound();
    error NotOperator();
    error InvalidStateTransition();
    error ActiveStakeLocked();
    error MissingStake();
    error NoChange();

    event ProviderRegistered(bytes32 indexed providerId, address indexed operatorAccount, address indexed settlementAccount, bytes32 stakeRef, bytes32 computeProviderRef);
    event ProviderMetadataUpdated(bytes32 indexed providerId, bytes32 metadataHash, uint32 revision);
    event ProviderSettlementUpdated(bytes32 indexed providerId, address indexed settlementAccount, uint32 revision);
    event ProviderStakeReferenceUpdated(bytes32 indexed providerId, bytes32 stakeRef, uint32 revision);
    event ProviderComputeReferenceUpdated(bytes32 indexed providerId, bytes32 computeProviderRef, uint32 revision);
    event ProviderStateChanged(bytes32 indexed providerId, ProviderState previousState, ProviderState newState, uint32 revision);

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) { return "AIProviderRegistry"; }
    function protocolVersion() external pure returns (uint32) { return 2; }

    function register(bytes32 providerId, address operatorAccount, bytes32 metadataHash, uint256 legacyBond) external {
        bytes32 stakeRef = legacyBond == 0 ? bytes32(0) : keccak256(abi.encode("LEGACY_BOND", legacyBond));
        _register(providerId, operatorAccount, operatorAccount, metadataHash, stakeRef, bytes32(0));
    }

    function registerProvider(
        bytes32 providerId,
        address operatorAccount,
        address settlementAccount,
        bytes32 metadataHash,
        bytes32 stakeRef,
        bytes32 computeProviderRef
    ) external {
        _register(providerId, operatorAccount, settlementAccount, metadataHash, stakeRef, computeProviderRef);
    }

    function updateMetadata(bytes32 providerId, bytes32 metadataHash) external {
        Provider storage p = _operator(providerId);
        if (p.state == ProviderState.RETIRED) revert InvalidStateTransition();
        p.metadataHash = metadataHash;
        p.revision += 1;
        emit ProviderMetadataUpdated(providerId, metadataHash, p.revision);
    }

    function updateSettlementAccount(bytes32 providerId, address settlementAccount) external {
        if (settlementAccount == address(0)) revert ZeroAddress();
        Provider storage p = _operator(providerId);
        if (p.state == ProviderState.RETIRED) revert InvalidStateTransition();
        p.settlementAccount = settlementAccount;
        p.revision += 1;
        emit ProviderSettlementUpdated(providerId, settlementAccount, p.revision);
    }

    function updateStakeReference(bytes32 providerId, bytes32 stakeRef) external {
        if (stakeRef == bytes32(0)) revert MissingStake();
        Provider storage p = _operator(providerId);
        if (p.state == ProviderState.ACTIVE) revert ActiveStakeLocked();
        if (p.state == ProviderState.RETIRED) revert InvalidStateTransition();
        p.stakeRef = stakeRef;
        p.revision += 1;
        emit ProviderStakeReferenceUpdated(providerId, stakeRef, p.revision);
    }

    function updateComputeProviderReference(bytes32 providerId, bytes32 computeProviderRef) external {
        Provider storage p = _operator(providerId);
        if (p.state == ProviderState.ACTIVE || p.state == ProviderState.RETIRED) revert InvalidStateTransition();
        p.computeProviderRef = computeProviderRef;
        p.revision += 1;
        emit ProviderComputeReferenceUpdated(providerId, computeProviderRef, p.revision);
    }

    function activate(bytes32 providerId) external {
        Provider storage p = _operator(providerId);
        if (p.state != ProviderState.REGISTERED) revert InvalidStateTransition();
        if (p.stakeRef == bytes32(0)) revert MissingStake();
        _setState(providerId, p, ProviderState.ACTIVE);
    }

    function retire(bytes32 providerId) external {
        Provider storage p = _operator(providerId);
        if (p.state == ProviderState.RETIRED || p.state == ProviderState.NONE) revert InvalidStateTransition();
        _setState(providerId, p, ProviderState.RETIRED);
    }

    function setActive(bytes32 providerId, bool active) external onlyGovernance {
        Provider storage p = _get(providerId);
        if (p.state == ProviderState.RETIRED) revert InvalidStateTransition();
        if (!active) {
            if (p.state != ProviderState.ACTIVE) revert InvalidStateTransition();
            _setState(providerId, p, ProviderState.SUSPENDED);
        } else {
            if (p.state != ProviderState.SUSPENDED) revert InvalidStateTransition();
            if (p.stakeRef == bytes32(0)) revert MissingStake();
            _setState(providerId, p, ProviderState.ACTIVE);
        }
    }

    function isOperational(bytes32 providerId) external view returns (bool) {
        Provider storage p = providers[providerId];
        return p.exists && p.state == ProviderState.ACTIVE && p.stakeRef != bytes32(0);
    }

    function _register(
        bytes32 providerId,
        address operatorAccount,
        address settlementAccount,
        bytes32 metadataHash,
        bytes32 stakeRef,
        bytes32 computeProviderRef
    ) private {
        if (providerId == bytes32(0)) revert InvalidProviderId();
        if (operatorAccount == address(0) || settlementAccount == address(0)) revert ZeroAddress();
        if (providers[providerId].exists) revert ProviderAlreadyExists();
        if (msg.sender != operatorAccount) revert NotOperator();
        providers[providerId] = Provider({
            operatorAccount: operatorAccount,
            settlementAccount: settlementAccount,
            metadataHash: metadataHash,
            stakeRef: stakeRef,
            computeProviderRef: computeProviderRef,
            createdAt: uint64(block.timestamp),
            revision: 1,
            state: ProviderState.REGISTERED,
            exists: true
        });
        emit ProviderRegistered(providerId, operatorAccount, settlementAccount, stakeRef, computeProviderRef);
    }

    function _operator(bytes32 providerId) private view returns (Provider storage p) {
        p = _get(providerId);
        if (msg.sender != p.operatorAccount) revert NotOperator();
    }

    function _get(bytes32 providerId) private view returns (Provider storage p) {
        p = providers[providerId];
        if (!p.exists) revert ProviderNotFound();
    }

    function _setState(bytes32 providerId, Provider storage p, ProviderState newState) private {
        ProviderState oldState = p.state;
        if (oldState == newState) revert NoChange();
        p.state = newState;
        p.revision += 1;
        emit ProviderStateChanged(providerId, oldState, newState, p.revision);
    }
}
