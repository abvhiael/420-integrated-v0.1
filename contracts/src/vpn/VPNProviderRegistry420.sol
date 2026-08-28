// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./VPNAuthorization420.sol";
import "./VPNIds420.sol";

contract VPNProviderRegistry420 is I420System {
    enum ProviderState { NONE, REGISTERED, ACTIVE, SUSPENDED, RETIRED }

    struct Provider {
        address operatorAccount;
        bytes32 metadataHash;
        bytes32 stakeRef;
        uint64 createdAt;
        uint32 revision;
        ProviderState state;
        bool exists;
    }

    VPNAuthorization420 public immutable authorization;
    mapping(bytes32 => Provider) private _providers;

    error ZeroAddress();
    error InvalidProviderId();
    error ProviderAlreadyExists();
    error ProviderNotFound();
    error Unauthorized();
    error InvalidStateTransition();
    error NoChange();

    event ProviderRegistered(bytes32 indexed providerId, address indexed operatorAccount, bytes32 stakeRef);
    event ProviderUpdated(bytes32 indexed providerId, bytes32 metadataHash, bytes32 stakeRef, uint32 revision);
    event ProviderStateChanged(bytes32 indexed providerId, ProviderState previousState, ProviderState newState, uint32 revision);

    constructor(address authorization_) {
        if (authorization_ == address(0)) revert ZeroAddress();
        authorization = VPNAuthorization420(authorization_);
    }

    function systemName() external pure returns (string memory) { return "VPNProviderRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function registerProvider(bytes32 providerId, address operatorAccount, bytes32 metadataHash, bytes32 stakeRef) external {
        if (providerId == bytes32(0)) revert InvalidProviderId();
        if (operatorAccount == address(0)) revert ZeroAddress();
        if (_providers[providerId].exists) revert ProviderAlreadyExists();
        if (!authorization.isProviderAuthorized(msg.sender, providerId, VPNIds420.ACTION_REGISTER_PROVIDER, 0)) revert Unauthorized();
        _providers[providerId] = Provider({
            operatorAccount: operatorAccount,
            metadataHash: metadataHash,
            stakeRef: stakeRef,
            createdAt: uint64(block.timestamp),
            revision: 1,
            state: ProviderState.REGISTERED,
            exists: true
        });
        emit ProviderRegistered(providerId, operatorAccount, stakeRef);
    }

    function updateProvider(bytes32 providerId, bytes32 metadataHash, bytes32 stakeRef) external {
        Provider storage provider = _get(providerId);
        if (provider.state == ProviderState.RETIRED) revert InvalidStateTransition();
        if (!authorization.isProviderAuthorized(msg.sender, providerId, VPNIds420.ACTION_UPDATE_PROVIDER, 0)) revert Unauthorized();
        provider.metadataHash = metadataHash;
        provider.stakeRef = stakeRef;
        provider.revision += 1;
        emit ProviderUpdated(providerId, metadataHash, stakeRef, provider.revision);
    }

    function setState(bytes32 providerId, ProviderState newState) external {
        Provider storage provider = _get(providerId);
        ProviderState oldState = provider.state;
        if (newState == oldState) revert NoChange();
        if (!authorization.isProviderAuthorized(msg.sender, providerId, VPNIds420.ACTION_SET_PROVIDER_STATUS, 0)) revert Unauthorized();
        bool valid =
            (oldState == ProviderState.REGISTERED && (newState == ProviderState.ACTIVE || newState == ProviderState.RETIRED)) ||
            (oldState == ProviderState.ACTIVE && (newState == ProviderState.SUSPENDED || newState == ProviderState.RETIRED)) ||
            (oldState == ProviderState.SUSPENDED && (newState == ProviderState.ACTIVE || newState == ProviderState.RETIRED));
        if (!valid) revert InvalidStateTransition();
        provider.state = newState;
        provider.revision += 1;
        emit ProviderStateChanged(providerId, oldState, newState, provider.revision);
    }

    function getProvider(bytes32 providerId) external view returns (Provider memory) { return _get(providerId); }
    function providerState(bytes32 providerId) external view returns (ProviderState) { return _get(providerId).state; }

    function _get(bytes32 providerId) private view returns (Provider storage provider) {
        provider = _providers[providerId];
        if (!provider.exists) revert ProviderNotFound();
    }
}
