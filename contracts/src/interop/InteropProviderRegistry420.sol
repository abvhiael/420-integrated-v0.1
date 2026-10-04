// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420IS.sol";
import "./InteropIds420.sol";

contract InteropProviderRegistry420 is SystemAccess {
    struct Provider {
        address adapter;
        bytes32 adapterType;
        bytes32 manifestHash;
        uint32 standardVersion;
        uint64 revision;
        bool active;
    }

    mapping(bytes32 => Provider) private _providers;

    error InvalidProvider();
    error AlreadyExists();
    error NotFound();
    error VersionMismatch();

    event ProviderRegistered(bytes32 indexed providerId, address indexed adapter, bytes32 indexed adapterType, bytes32 manifestHash);
    event ProviderRevised(bytes32 indexed providerId, address indexed adapter, bytes32 manifestHash, uint64 revision);
    event ProviderActivationChanged(bytes32 indexed providerId, bool active);

    constructor(address timelock_) SystemAccess(timelock_) {}

    function registerProvider(bytes32 providerId, address adapter, bytes32 expectedType, bytes32 manifestHash) external onlyGovernance {
        if (providerId == bytes32(0) || adapter == address(0) || adapter.code.length == 0 || expectedType == bytes32(0) || manifestHash == bytes32(0)) revert InvalidProvider();
        if (_providers[providerId].adapter != address(0)) revert AlreadyExists();
        I420ISAdapter candidate = I420ISAdapter(adapter);
        if (candidate.standardVersion() != InteropIds420.STANDARD_VERSION) revert VersionMismatch();
        if (candidate.adapterType() != expectedType || candidate.adapterManifestHash() != manifestHash) revert InvalidProvider();
        _providers[providerId] = Provider(adapter, expectedType, manifestHash, InteropIds420.STANDARD_VERSION, 1, true);
        emit ProviderRegistered(providerId, adapter, expectedType, manifestHash);
    }

    function reviseProvider(bytes32 providerId, address adapter, bytes32 manifestHash) external onlyGovernance {
        Provider storage p = _providers[providerId];
        if (p.adapter == address(0)) revert NotFound();
        if (adapter == address(0) || adapter.code.length == 0 || manifestHash == bytes32(0)) revert InvalidProvider();
        I420ISAdapter candidate = I420ISAdapter(adapter);
        if (candidate.standardVersion() != InteropIds420.STANDARD_VERSION) revert VersionMismatch();
        if (candidate.adapterType() != p.adapterType || candidate.adapterManifestHash() != manifestHash) revert InvalidProvider();
        p.adapter = adapter;
        p.manifestHash = manifestHash;
        p.revision += 1;
        emit ProviderRevised(providerId, adapter, manifestHash, p.revision);
    }

    function setActive(bytes32 providerId, bool active) external onlyGovernance {
        Provider storage p = _providers[providerId];
        if (p.adapter == address(0)) revert NotFound();
        p.active = active;
        emit ProviderActivationChanged(providerId, active);
    }

    function provider(bytes32 providerId) external view returns (Provider memory) { return _providers[providerId]; }

    function isActiveAdapter(bytes32 providerId, address caller) external view returns (bool) {
        Provider storage p = _providers[providerId];
        return p.active && p.adapter == caller;
    }
}
