// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";
import "../interfaces/genesis/IProtocolRegistry420.sol";
import "../interfaces/genesis/Types420.sol";
import "../libraries/ServiceIds420.sol";

/// @notice Canonical discovery and version registry for 420 Integrated protocol services and Genesis components.
/// @dev Service IDs and Genesis component IDs are intentionally independent namespaces.
/// Service publication revisions are sequential uint32 values; component compatibility uses semantic Types420.Version.
/// Registration does not grant custody, execution, governance or upgrade authority.
contract ProtocolRegistry is SystemAccess, I420System, IProtocolRegistry420 {
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

    mapping(bytes32 => Types420.ContractRef) private _components;
    mapping(bytes32 => uint32) private _componentRevisions;
    mapping(bytes32 => mapping(uint32 => Types420.ContractRef)) private _componentHistory;

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
    error CanonicalServiceIdImmutable();
    error InvalidComponentId();
    error InvalidLifecycle();
    error UnknownComponent();
    error ComponentLifecycleUnchanged();

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
        if (ServiceIds420.isGenesisCanonical(serviceId)) revert CanonicalServiceIdImmutable();
        if (descriptorHash == bytes32(0)) revert InvalidManifest();
        approvedServiceIds[serviceId] = true;
        serviceDescriptorHash[serviceId] = descriptorHash;
        emit ServiceIdApproved(serviceId, descriptorHash);
    }

    /// @notice Backwards-compatible service publication path retained for existing integrations.
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

    /// @notice Backwards-compatible service publication alias.
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

    /// @notice Genesis-grade service publication path with code verification and compatibility commitments.
    function publishRegisteredService(
        bytes32 serviceId,
        address implementation,
        bytes32 metadataHash,
        uint32 version,
        bool active,
        ComponentType componentType_,
        bytes32 manifestHash,
        bytes32 dependencyRoot,
        bytes32 interfaceHash
    ) external onlyGovernance {
        if (componentType_ == ComponentType.UNSET) revert InvalidComponentType();
        if (manifestHash == bytes32(0) || interfaceHash == bytes32(0)) revert InvalidManifest();
        if (implementation.code.length == 0) revert ImplementationHasNoCode();

        bytes32 codeHash = implementation.codehash;
        if (codeHash == bytes32(0)) revert CodeHashMismatch();

        _publish(serviceId, implementation, codeHash, metadataHash, version, active);
        _profiles[serviceId][version] = RegistrationProfile({
            componentType: componentType_,
            manifestHash: manifestHash,
            dependencyRoot: dependencyRoot,
            interfaceHash: interfaceHash
        });
        emit ServiceRegistrationProfilePublished(
            serviceId,
            version,
            componentType_,
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

    /// @notice Governance-register a Genesis component without inferring or mutating any service ID.
    /// @dev Each registration appends a provenance revision even when semantic version is unchanged.
    function registerComponent(
        bytes32 componentId,
        address implementation,
        Types420.Version calldata version,
        Types420.Lifecycle lifecycle
    ) external onlyGovernance {
        if (componentId == bytes32(0)) revert InvalidComponentId();
        if (implementation == address(0)) revert InvalidImplementation();
        if (implementation.code.length == 0) revert ImplementationHasNoCode();
        if (lifecycle == Types420.Lifecycle.NONE) revert InvalidLifecycle();

        bytes32 codeHash = implementation.codehash;
        if (codeHash == bytes32(0)) revert CodeHashMismatch();

        Types420.ContractRef memory ref = Types420.ContractRef({
            componentId: componentId,
            implementation: implementation,
            runtimeCodeHash: codeHash,
            version: version,
            lifecycle: lifecycle
        });

        uint32 revision = _componentRevisions[componentId] + 1;
        _componentRevisions[componentId] = revision;
        _components[componentId] = ref;
        _componentHistory[componentId][revision] = ref;

        emit ComponentRegistered(
            componentId,
            implementation,
            codeHash,
            version.major,
            version.minor,
            version.patch,
            lifecycle
        );
    }

    /// @notice Governance lifecycle transition for the current component revision.
    function setComponentLifecycle(bytes32 componentId, Types420.Lifecycle lifecycle) external onlyGovernance {
        if (lifecycle == Types420.Lifecycle.NONE) revert InvalidLifecycle();
        Types420.ContractRef storage current = _components[componentId];
        if (current.implementation == address(0)) revert UnknownComponent();
        if (current.lifecycle == lifecycle) revert ComponentLifecycleUnchanged();

        current.lifecycle = lifecycle;
        _componentHistory[componentId][_componentRevisions[componentId]].lifecycle = lifecycle;
        emit ComponentLifecycleChanged(componentId, lifecycle);
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

    /// @notice Explicit service-catalogue activity read.
    /// @dev This replaces the old ambiguous isActive(serviceId) selector, which is frozen for component semantics.
    function isServiceActive(bytes32 serviceId) external view returns (bool) { return _services[serviceId].active; }

    function resolveActive(bytes32 serviceId) external view returns (address implementation, uint32 version) {
        Service memory current = _services[serviceId];
        if (current.version == 0 || !current.active) revert UnknownService();
        return (current.implementation, current.version);
    }

    /// @inheritdoc IProtocolRegistry420
    function component(bytes32 componentId) external view override returns (Types420.ContractRef memory) {
        return _components[componentId];
    }

    /// @inheritdoc IProtocolRegistry420
    function isActive(bytes32 componentId) external view override returns (bool) {
        return _components[componentId].lifecycle == Types420.Lifecycle.ACTIVE;
    }

    /// @inheritdoc IProtocolRegistry420
    function resolve(bytes32 componentId) external view override returns (address implementation) {
        Types420.ContractRef memory ref = _components[componentId];
        if (ref.implementation == address(0) || ref.lifecycle != Types420.Lifecycle.ACTIVE) revert UnknownComponent();
        return ref.implementation;
    }

    /// @inheritdoc IProtocolRegistry420
    function runtimeCodeHash(bytes32 componentId) external view override returns (bytes32) {
        return _components[componentId].runtimeCodeHash;
    }

    /// @inheritdoc IProtocolRegistry420
    function supportsVersion(bytes32 componentId, Types420.Version calldata requested)
        external
        view
        override
        returns (bool)
    {
        Types420.ContractRef memory ref = _components[componentId];
        if (ref.implementation == address(0) || ref.lifecycle != Types420.Lifecycle.ACTIVE) return false;
        Types420.Version memory registered = ref.version;
        if (registered.major != requested.major) return false;
        if (registered.minor < requested.minor) return false;
        if (registered.minor == requested.minor && registered.patch < requested.patch) return false;
        return true;
    }

    function currentComponentRevision(bytes32 componentId) external view returns (uint32) {
        return _componentRevisions[componentId];
    }

    function getComponentRevision(bytes32 componentId, uint32 revision)
        external
        view
        returns (Types420.ContractRef memory)
    {
        return _componentHistory[componentId][revision];
    }
}
