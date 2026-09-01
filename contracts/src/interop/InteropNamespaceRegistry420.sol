// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "./InteropProviderRegistry420.sol";

contract InteropNamespaceRegistry420 is SystemAccess {
    enum MappingStatus { NONE, ACTIVE, SUPERSEDED, REVOKED }

    struct Namespace {
        bytes32 providerId;
        bytes32 schemaHash;
        uint64 revision;
        bool active;
    }

    struct ExternalMapping {
        bytes32 canonicalId;
        bytes32 attestationHash;
        bytes32 supersedesKey;
        uint64 revision;
        MappingStatus status;
    }

    InteropProviderRegistry420 public immutable providers;
    mapping(bytes32 => Namespace) private _namespaces;
    mapping(bytes32 => ExternalMapping) private _mappings;

    error InvalidInput();
    error AlreadyExists();
    error NotFound();
    error UnauthorizedAdapter();
    error NamespaceInactive();
    error InvalidSupersession();

    event NamespaceRegistered(bytes32 indexed namespaceId, bytes32 indexed providerId, bytes32 schemaHash);
    event NamespaceActivationChanged(bytes32 indexed namespaceId, bool active);
    event ExternalIdMapped(bytes32 indexed mappingKey, bytes32 indexed namespaceId, bytes32 indexed canonicalId, bytes32 externalIdHash, bytes32 attestationHash);
    event ExternalIdSuperseded(bytes32 indexed oldMappingKey, bytes32 indexed newMappingKey, bytes32 indexed canonicalId);
    event ExternalIdRevoked(bytes32 indexed mappingKey);

    constructor(address timelock_, address providers_) SystemAccess(timelock_) {
        if (providers_ == address(0)) revert ZeroAddress();
        providers = InteropProviderRegistry420(providers_);
    }

    function mappingKey(bytes32 namespaceId, bytes32 externalIdHash, uint64 revision) public pure returns (bytes32) {
        return keccak256(abi.encode("420/IS/MAPPING/V1", namespaceId, externalIdHash, revision));
    }

    function registerNamespace(bytes32 namespaceId, bytes32 providerId, bytes32 schemaHash) external onlyGovernance {
        if (namespaceId == bytes32(0) || providerId == bytes32(0) || schemaHash == bytes32(0)) revert InvalidInput();
        if (_namespaces[namespaceId].providerId != bytes32(0)) revert AlreadyExists();
        InteropProviderRegistry420.Provider memory p = providers.provider(providerId);
        if (!p.active) revert InvalidInput();
        _namespaces[namespaceId] = Namespace(providerId, schemaHash, 1, true);
        emit NamespaceRegistered(namespaceId, providerId, schemaHash);
    }

    function setNamespaceActive(bytes32 namespaceId, bool active) external onlyGovernance {
        Namespace storage n = _namespaces[namespaceId];
        if (n.providerId == bytes32(0)) revert NotFound();
        n.active = active;
        emit NamespaceActivationChanged(namespaceId, active);
    }

    function publishMapping(bytes32 namespaceId, bytes32 externalIdHash, bytes32 canonicalId, bytes32 attestationHash) external returns (bytes32 key) {
        Namespace storage n = _namespaces[namespaceId];
        if (!n.active) revert NamespaceInactive();
        if (!providers.isActiveAdapter(n.providerId, msg.sender)) revert UnauthorizedAdapter();
        if (externalIdHash == bytes32(0) || canonicalId == bytes32(0) || attestationHash == bytes32(0)) revert InvalidInput();
        key = mappingKey(namespaceId, externalIdHash, 1);
        if (_mappings[key].status != MappingStatus.NONE) revert AlreadyExists();
        _mappings[key] = ExternalMapping(canonicalId, attestationHash, bytes32(0), 1, MappingStatus.ACTIVE);
        emit ExternalIdMapped(key, namespaceId, canonicalId, externalIdHash, attestationHash);
    }

    function supersedeMapping(bytes32 namespaceId, bytes32 externalIdHash, uint64 oldRevision, bytes32 canonicalId, bytes32 attestationHash) external returns (bytes32 newKey) {
        Namespace storage n = _namespaces[namespaceId];
        if (!n.active) revert NamespaceInactive();
        if (!providers.isActiveAdapter(n.providerId, msg.sender)) revert UnauthorizedAdapter();
        bytes32 oldKey = mappingKey(namespaceId, externalIdHash, oldRevision);
        ExternalMapping storage oldMap = _mappings[oldKey];
        if (oldMap.status != MappingStatus.ACTIVE || oldMap.canonicalId != canonicalId) revert InvalidSupersession();
        uint64 newRevision = oldRevision + 1;
        newKey = mappingKey(namespaceId, externalIdHash, newRevision);
        if (_mappings[newKey].status != MappingStatus.NONE || attestationHash == bytes32(0)) revert InvalidSupersession();
        oldMap.status = MappingStatus.SUPERSEDED;
        _mappings[newKey] = ExternalMapping(canonicalId, attestationHash, oldKey, newRevision, MappingStatus.ACTIVE);
        emit ExternalIdSuperseded(oldKey, newKey, canonicalId);
    }

    function revokeMapping(bytes32 mappingKey_) external onlyGovernance {
        ExternalMapping storage m = _mappings[mappingKey_];
        if (m.status != MappingStatus.ACTIVE) revert NotFound();
        m.status = MappingStatus.REVOKED;
        emit ExternalIdRevoked(mappingKey_);
    }

    function namespace(bytes32 namespaceId) external view returns (Namespace memory) { return _namespaces[namespaceId]; }
    function externalMapping(bytes32 key) external view returns (ExternalMapping memory) { return _mappings[key]; }
}
