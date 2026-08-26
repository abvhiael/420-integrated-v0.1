// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";

/// @notice Canonical discovery registry for 420 protocol services.
/// @dev Service IDs are stable bytes32 identifiers. Every mutation creates a new
/// versioned record so historical discovery state remains reconstructable from storage/events.
contract ProtocolRegistry is SystemAccess, I420System {
    struct Service {
        address implementation;
        bytes32 codeHash;
        bytes32 metadataHash;
        uint32 version;
        uint64 activatedAt;
        bool active;
    }

    mapping(bytes32 => Service) private _services;
    mapping(bytes32 => mapping(uint32 => Service)) private _history;

    error InvalidServiceId();
    error InvalidImplementation();
    error InvalidVersion();
    error UnknownService();
    error ServiceAlreadyInactive();

    event ServiceVersionPublished(
        bytes32 indexed serviceId,
        uint32 indexed version,
        address indexed implementation,
        bytes32 codeHash,
        bytes32 metadataHash,
        bool active
    );
    event ServiceDeprecated(bytes32 indexed serviceId, uint32 indexed version);

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) { return "ProtocolRegistry"; }
    function protocolVersion() external pure returns (uint32) { return 2; }

    /// @notice Publish the next canonical version of a protocol service.
    /// @dev Version numbers are strictly monotonic and contiguous per service ID.
    function publishService(
        bytes32 serviceId,
        address implementation,
        bytes32 codeHash,
        bytes32 metadataHash,
        uint32 version,
        bool active
    ) external onlyGovernance {
        if (serviceId == bytes32(0)) revert InvalidServiceId();
        if (implementation == address(0)) revert InvalidImplementation();

        uint32 expected = _services[serviceId].version + 1;
        if (version != expected) revert InvalidVersion();

        Service memory record = Service({
            implementation: implementation,
            codeHash: codeHash,
            metadataHash: metadataHash,
            version: version,
            activatedAt: uint64(block.timestamp),
            active: active
        });

        _services[serviceId] = record;
        _history[serviceId][version] = record;
        emit ServiceVersionPublished(serviceId, version, implementation, codeHash, metadataHash, active);
    }

    /// @notice Compatibility wrapper for the original genesis interface.
    /// @dev The supplied version must still be exactly currentVersion + 1.
    function setService(
        bytes32 serviceId,
        address implementation,
        bytes32 codeHash,
        bytes32 metadataHash,
        uint32 version,
        bool active
    ) external onlyGovernance {
        if (serviceId == bytes32(0)) revert InvalidServiceId();
        if (implementation == address(0)) revert InvalidImplementation();
        uint32 expected = _services[serviceId].version + 1;
        if (version != expected) revert InvalidVersion();

        Service memory record = Service(
            implementation,
            codeHash,
            metadataHash,
            version,
            uint64(block.timestamp),
            active
        );
        _services[serviceId] = record;
        _history[serviceId][version] = record;
        emit ServiceVersionPublished(serviceId, version, implementation, codeHash, metadataHash, active);
    }

    /// @notice Disable the current version without replacing its implementation.
    function deprecateService(bytes32 serviceId) external onlyGovernance {
        Service storage current = _services[serviceId];
        if (current.version == 0) revert UnknownService();
        if (!current.active) revert ServiceAlreadyInactive();

        current.active = false;
        _history[serviceId][current.version].active = false;
        emit ServiceDeprecated(serviceId, current.version);
    }

    function getService(bytes32 serviceId) external view returns (Service memory) {
        return _services[serviceId];
    }

    function getServiceVersion(bytes32 serviceId, uint32 version) external view returns (Service memory) {
        return _history[serviceId][version];
    }

    function currentVersion(bytes32 serviceId) external view returns (uint32) {
        return _services[serviceId].version;
    }

    function isActive(bytes32 serviceId) external view returns (bool) {
        return _services[serviceId].active;
    }
}
