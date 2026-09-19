// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ComputeAuthorization420.sol";
import "./ComputeIds420.sol";

contract ComputeProviderRegistry420 is I420System {
    enum State { NONE, REGISTERED, ACTIVE, SUSPENDED, RETIRED }

    struct Provider {
        address operatorAccount;
        address settlementAccount;
        bytes32 manifestHash;
        bytes32 stakeRef;
        uint64 createdAt;
        uint32 revision;
        State state;
        bool exists;
    }

    ComputeAuthorization420 public immutable authorization;
    mapping(bytes32 => Provider) private _providers;

    error InvalidProvider();
    error ProviderExists();
    error ProviderNotFound();
    error Unauthorized();
    error InvalidState();
    error StakeRequired();

    event ProviderRegistered(
        bytes32 indexed providerId,
        address indexed operatorAccount,
        address indexed settlementAccount,
        bytes32 stakeRef
    );
    event ProviderUpdated(bytes32 indexed providerId, bytes32 manifestHash, bytes32 stakeRef, uint32 revision);
    event ProviderStateChanged(bytes32 indexed providerId, State previousState, State newState, uint32 revision);

    constructor(address authorization_) {
        if (authorization_ == address(0)) revert InvalidProvider();
        authorization = ComputeAuthorization420(authorization_);
    }

    function systemName() external pure returns (string memory) { return "ComputeProviderRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function registerProvider(
        bytes32 providerId,
        address operatorAccount,
        address settlementAccount,
        bytes32 manifestHash,
        bytes32 stakeRef
    ) external {
        if (
            providerId == bytes32(0) || operatorAccount == address(0) || settlementAccount == address(0)
                || manifestHash == bytes32(0)
        ) revert InvalidProvider();
        if (_providers[providerId].exists) revert ProviderExists();
        if (
            msg.sender != operatorAccount
                && !authorization.isProviderAuthorized(msg.sender, providerId, ComputeIds420.ACTION_REGISTER_PROVIDER)
        ) revert Unauthorized();

        _providers[providerId] = Provider({
            operatorAccount: operatorAccount,
            settlementAccount: settlementAccount,
            manifestHash: manifestHash,
            stakeRef: stakeRef,
            createdAt: uint64(block.timestamp),
            revision: 1,
            state: State.REGISTERED,
            exists: true
        });
        emit ProviderRegistered(providerId, operatorAccount, settlementAccount, stakeRef);
    }

    function updateProvider(
        bytes32 providerId,
        address settlementAccount,
        bytes32 manifestHash,
        bytes32 stakeRef
    ) external {
        Provider storage p = _get(providerId);
        if (p.state == State.ACTIVE || p.state == State.RETIRED) revert InvalidState();
        if (settlementAccount == address(0) || manifestHash == bytes32(0)) revert InvalidProvider();
        if (
            msg.sender != p.operatorAccount
                && !authorization.isProviderAuthorized(msg.sender, providerId, ComputeIds420.ACTION_UPDATE_PROVIDER)
        ) revert Unauthorized();
        p.settlementAccount = settlementAccount;
        p.manifestHash = manifestHash;
        p.stakeRef = stakeRef;
        p.revision += 1;
        emit ProviderUpdated(providerId, manifestHash, stakeRef, p.revision);
    }

    function setState(bytes32 providerId, State next) external {
        Provider storage p = _get(providerId);
        if (
            msg.sender != p.operatorAccount
                && !authorization.isProviderAuthorized(msg.sender, providerId, ComputeIds420.ACTION_SET_PROVIDER_STATE)
        ) revert Unauthorized();

        State previous = p.state;
        bool ok = (previous == State.REGISTERED && (next == State.ACTIVE || next == State.RETIRED))
            || (previous == State.ACTIVE && (next == State.SUSPENDED || next == State.RETIRED))
            || (previous == State.SUSPENDED && (next == State.ACTIVE || next == State.RETIRED));
        if (!ok) revert InvalidState();
        if (next == State.ACTIVE && p.stakeRef == bytes32(0)) revert StakeRequired();

        p.state = next;
        p.revision += 1;
        emit ProviderStateChanged(providerId, previous, next, p.revision);
    }

    function getProvider(bytes32 providerId) external view returns (Provider memory) { return _get(providerId); }

    function isActive(bytes32 providerId) external view returns (bool) {
        Provider memory p = _providers[providerId];
        return p.exists && p.state == State.ACTIVE && p.stakeRef != bytes32(0);
    }

    function _get(bytes32 providerId) private view returns (Provider storage p) {
        p = _providers[providerId];
        if (!p.exists) revert ProviderNotFound();
    }
}
