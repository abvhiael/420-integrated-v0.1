// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./InteropProviderRegistry420.sol";
import "./InteropNamespaceRegistry420.sol";
import "./InteropCheckpointRegistry420.sol";
import "./InteropIds420.sol";

contract InteropRouter420 {
    InteropProviderRegistry420 public immutable providers;
    InteropNamespaceRegistry420 public immutable namespaces;
    InteropCheckpointRegistry420 public immutable checkpoints;

    constructor(address providers_, address namespaces_, address checkpoints_) {
        require(providers_ != address(0) && namespaces_ != address(0) && checkpoints_ != address(0), "420IS: zero address");
        providers = InteropProviderRegistry420(providers_);
        namespaces = InteropNamespaceRegistry420(namespaces_);
        checkpoints = InteropCheckpointRegistry420(checkpoints_);
    }

    function standardVersion() external pure returns (uint32) { return InteropIds420.STANDARD_VERSION; }

    function resolve(bytes32 namespaceId, bytes32 externalIdHash, uint64 revision)
        external view returns (bytes32 canonicalId, bytes32 attestationHash, InteropNamespaceRegistry420.MappingStatus status)
    {
        bytes32 key = namespaces.mappingKey(namespaceId, externalIdHash, revision);
        InteropNamespaceRegistry420.ExternalMapping memory m = namespaces.externalMapping(key);
        return (m.canonicalId, m.attestationHash, m.status);
    }

    function providerSupports(bytes32 providerId, bytes32 domainId) external view returns (bool) {
        InteropProviderRegistry420.Provider memory p = providers.provider(providerId);
        if (!p.active) return false;
        return I420ISAdapter(p.adapter).supportsDomain(domainId);
    }
}
