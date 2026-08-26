// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";
import "../libraries/ServiceIds420.sol";

/// @notice Canonical discovery registry for 420 protocol services.
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
    mapping(bytes32 => bool) public approvedServiceIds;
    mapping(bytes32 => bytes32) public serviceDescriptorHash;

    error InvalidServiceId();
    error InvalidImplementation();
    error InvalidVersion();
    error UnknownService();
    error ServiceAlreadyInactive();
    error UnapprovedServiceId();

    event ServiceIdApproved(bytes32 indexed serviceId, bytes32 indexed descriptorHash);
    event ServiceVersionPublished(bytes32 indexed serviceId, uint32 indexed version, address indexed implementation, bytes32 codeHash, bytes32 metadataHash, bool active);
    event ServiceDeprecated(bytes32 indexed serviceId, uint32 indexed version);

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) { return "ProtocolRegistry"; }
    function protocolVersion() external pure returns (uint32) { return 3; }

    function isGenesisCanonicalServiceId(bytes32 serviceId) public pure returns (bool) {
        return ServiceIds420.isGenesisCanonical(serviceId);
    }

    /// @notice Approves an extension service ID while preserving the frozen genesis catalog.
    function approveServiceId(bytes32 serviceId, bytes32 descriptorHash) external onlyGovernance {
        if (serviceId == bytes32(0)) revert InvalidServiceId();
        approvedServiceIds[serviceId] = true;
        serviceDescriptorHash[serviceId] = descriptorHash;
        emit ServiceIdApproved(serviceId, descriptorHash);
    }

    function publishService(bytes32 serviceId, address implementation, bytes32 codeHash, bytes32 metadataHash, uint32 version, bool active) external onlyGovernance {
        _publish(serviceId, implementation, codeHash, metadataHash, version, active);
    }

    function setService(bytes32 serviceId, address implementation, bytes32 codeHash, bytes32 metadataHash, uint32 version, bool active) external onlyGovernance {
        _publish(serviceId, implementation, codeHash, metadataHash, version, active);
    }

    function _publish(bytes32 serviceId, address implementation, bytes32 codeHash, bytes32 metadataHash, uint32 version, bool active) private {
        if (serviceId == bytes32(0)) revert InvalidServiceId();
        if (!ServiceIds420.isGenesisCanonical(serviceId) && !approvedServiceIds[serviceId]) revert UnapprovedServiceId();
        if (implementation == address(0)) revert InvalidImplementation();
        uint32 expected = _services[serviceId].version + 1;
        if (version != expected) revert InvalidVersion();

        Service memory record = Service(implementation, codeHash, metadataHash, version, uint64(block.timestamp), active);
        _services[serviceId] = record;
        _history[serviceId][version] = record;
        emit ServiceVersionPublished(serviceId, version, implementation, codeHash, metadataHash, active);
    }

    function deprecateService(bytes32 serviceId) external onlyGovernance {
        Service storage current = _services[serviceId];
        if (current.version == 0) revert UnknownService();
        if (!current.active) revert ServiceAlreadyInactive();
        current.active = false;
        _history[serviceId][current.version].active = false;
        emit ServiceDeprecated(serviceId, current.version);
    }

    function getService(bytes32 serviceId) external view returns (Service memory) { return _services[serviceId]; }
    function getServiceVersion(bytes32 serviceId, uint32 version) external view returns (Service memory) { return _history[serviceId][version]; }
    function currentVersion(bytes32 serviceId) external view returns (uint32) { return _services[serviceId].version; }
    function isActive(bytes32 serviceId) external view returns (bool) { return _services[serviceId].active; }
}
