// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";
import "../libraries/ServiceIds420.sol";

/// @notice Canonical discovery and version registry for 420 Integrated protocol services.
/// @dev 420Registry records service identity, implementations and immutable version history.
/// It does not grant custody, execution, governance or upgrade authority to registered services.
contract ProtocolRegistry is SystemAccess, I420System {
    enum ComponentType {
        UNSET,
        PROTOCOL,
        APPLICATION,
        SERVICE,
        REGISTRY,
        ADAPTER,
        INFRASTRUCTURE
    }

    struct Service {
        address implementation;
        bytes32 codeHash;
        bytes32 metadataHash;
        uint32 version;
        uint64 activatedAt;
        bool active;
    }

    struct RegistrationProfile {
        ComponentType componentType;
        bytes32 manifestHash;
        bytes32 dependencyRoot;
        bytes32 interfaceHash;
    }

    mapping(bytes32 => Service) private _services;
    mapping(bytes32 => mapping(uint32 => Service)) private _history;
    mapping(bytes32 => mapping(uint32 => RegistrationProfile)) private _profiles;
    mapping(bytes32 => bool) public approvedServiceIds;
    mapping(bytes32 => bytes32) public serviceDescriptorHash;

    error InvalidServiceId();
    error InvalidImplementation();
    error InvalidVersion();
    error UnknownService();
    error ServiceAlreadyInactive();
    error UnapprovedServiceId();
    error InvalidManifest();
    error InvalidComponentType();
    error ImplementationHasNoCode();
    error CodeHashMismatch();

    event ServiceIdApproved(bytes32 indexed serviceId, bytes32 indexed descriptorHash);
    event ServiceVersionPublished(
        bytes32 indexed serviceId,
        uint32 indexed version,
        address indexed implementation,
        bytes32 codeHash,
        bytes32 metadataHash,
        bool active
    );
    event ServiceRegistrationProfilePublished(
        bytes32 indexed serviceId,
        uint32 indexed version,
        ComponentType componentType,
        bytes32 manifestHash,
        bytes32 dependencyRoot,
        bytes32 interfaceHash
    );
    event ServiceDeprecated(bytes32 indexed serviceId, uint32 indexed version);

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) { return "ProtocolRegistry"; }
    function protocolVersion() external pure returns (uint32) { return 4; }

    function isGenesisCanonicalServiceId(bytes32 serviceId) public pure returns (bool) {
        return ServiceIds420.isGenesisCanonical(serviceId);
    }

    /// @notice Approves an extension service ID while preserving the frozen Genesis catalog.
    function approveServiceId(bytes32 serviceId, bytes32 descriptorHash) external onlyGovernance {
        if (serviceId == bytes32(0)) revert InvalidServiceId();
        if (descriptorHash == bytes32(0)) revert InvalidManifest();
        approvedServiceIds[serviceId] = true;
        serviceDescriptorHash[serviceId] = descriptorHash;
        emit ServiceIdApproved(serviceId, descriptorHash);
    }

    /// @notice Backwards-compatible publication path retained for existing Genesis integrations.
    function publishService(
        bytes32 serviceId,
        address implementation,
        bytes32 codeHash,
        bytes32 metadataHash,
        uint32 version,
        bool active
    ) external onlyGovernance {
        _publish(serviceId, implementation, codeHash, metadataHash, version, active);
    }

    /// @notice Backwards-compatible alias.
    function setService(
        bytes32 serviceId,
        address implementation,
        bytes32 codeHash,
        bytes32 metadataHash,
        uint32 version,
        bool active
    ) external onlyGovernance {
        _publish(serviceId, implementation, codeHash, metadataHash, version, active);
    }

    /// @notice Genesis-grade publication path with code verification and committed compatibility metadata.
    function publishRegisteredService(
        bytes32 serviceId,
        address implementation,
        bytes32 metadataHash,
        uint32 version,
        bool active,
        ComponentType componentType,
        bytes32 manifestHash,
        bytes32 dependencyRoot,
        bytes32 interfaceHash
    ) external onlyGovernance {
        if (componentType == ComponentType.UNSET) revert InvalidComponentType();
        if (manifestHash == bytes32(0) || interfaceHash == bytes32(0)) revert InvalidManifest();
        if (implementation.code.length == 0) revert ImplementationHasNoCode();

        bytes32 runtimeCodeHash;
        assembly {
            runtimeCodeHash := extcodehash(implementation)
        }
        if (runtimeCodeHash == bytes32(0)) revert CodeHashMismatch();

        _publish(serviceId, implementation, runtimeCodeHash, metadataHash, version, active);
        _profiles[serviceId][version] = RegistrationProfile({
            componentType: componentType,
            manifestHash: manifestHash,
            dependencyRoot: dependencyRoot,
            interfaceHash: interfaceHash
        });
        emit ServiceRegistrationProfilePublished(
            serviceId,
            version,
            componentType,
            manifestHash,
            dependencyRoot,
            interfaceHash
        );
    }

    function _publish(
        bytes32 serviceId,
        address implementation,
        bytes32 codeHash,
        bytes32 metadataHash,
        uint32 version,
        bool active
    ) private {
        if (serviceId == bytes32(0)) revert InvalidServiceId();
        if (!ServiceIds420.isGenesisCanonical(serviceId) && !approvedServiceIds[serviceId]) revert UnapprovedServiceId();
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

    function deprecateService(bytes32 serviceId) external onlyGovernance {
        Service storage current = _services[serviceId];
        if (current.version == 0) revert UnknownService();
        if (!current.active) revert ServiceAlreadyInactive();
        current.active = false;
        _history[serviceId][current.version].active = false;
        emit ServiceDeprecated(serviceId, current.version);
    }

    function getService(bytes32 serviceId) external view returns (Service memory) { return _services[serviceId]; }
    function getServiceVersion(bytes32 serviceId, uint32 version) external view returns (Service memory) {
        return _history[serviceId][version];
    }
    function getRegistrationProfile(bytes32 serviceId, uint32 version)
        external
        view
        returns (RegistrationProfile memory)
    {
        return _profiles[serviceId][version];
    }
    function currentVersion(bytes32 serviceId) external view returns (uint32) { return _services[serviceId].version; }
    function isActive(bytes32 serviceId) external view returns (bool) { return _services[serviceId].active; }

    function resolveActive(bytes32 serviceId) external view returns (address implementation, uint32 version) {
        Service memory current = _services[serviceId];
        if (current.version == 0 || !current.active) revert UnknownService();
        return (current.implementation, current.version);
    }
}
