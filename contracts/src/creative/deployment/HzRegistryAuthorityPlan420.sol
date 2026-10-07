// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./HzDeploymentGraph420.sol";

/// @notice Canonical HZ-AUDIT-3 Registry and authority identities.
/// @dev Establishes repository commitments only. Live submitter addresses, deployment addresses,
///      transaction hashes and ProtocolRegistry receipts remain environment evidence.
library HzRegistryAuthorityPlan420 {
    uint32 internal constant MODULE_VERSION = 1;
    uint32 internal constant SERVICE_VERSION = 1;

    bytes32 internal constant MODULE_MANIFEST_HASH = keccak256("420/HZ/AUDIT-3/MODULE-MANIFEST/V1");
    bytes32 internal constant COMPONENT_ID = keccak256("420/component/hz/creative-protocol-registry/v1");
    bytes32 internal constant SERVICE_ID = keccak256("420/service/hz/v1");
    bytes32 internal constant SERVICE_DESCRIPTOR_HASH = keccak256("420/HZ/SERVICE/DESCRIPTOR/V1");
    bytes32 internal constant METADATA_HASH = keccak256("420/HZ/RELEASE/METADATA/V1");
    bytes32 internal constant REGISTRY_MANIFEST_HASH = keccak256("420/HZ/AUDIT-3/REGISTRY-MANIFEST/V1");
    bytes32 internal constant INTERFACE_HASH = keccak256("420/HZ/CREATIVE_PROTOCOL_REGISTRY/INTERFACE/V1");

    bytes32 internal constant CREATIVE_PROTOCOL_REGISTRY = keccak256("CREATIVE_PROTOCOL_REGISTRY");
    bytes32 internal constant CREATOR_PROFILE_REGISTRY = keccak256("CREATOR_PROFILE_REGISTRY");
    bytes32 internal constant WORK_REGISTRY = keccak256("WORK_REGISTRY");
    bytes32 internal constant RECORDING_REGISTRY = keccak256("RECORDING_REGISTRY");
    bytes32 internal constant CONTRIBUTOR_REGISTRY = keccak256("CONTRIBUTOR_REGISTRY");
    bytes32 internal constant RIGHTS_REGISTRY = keccak256("RIGHTS_REGISTRY");
    bytes32 internal constant AUTHORIZATION_REGISTRY = keccak256("AUTHORIZATION_REGISTRY");
    bytes32 internal constant LICENSE_REGISTRY = keccak256("LICENSE_REGISTRY");
    bytes32 internal constant ROYALTY_SCHEDULE_REGISTRY = keccak256("ROYALTY_SCHEDULE_REGISTRY");
    bytes32 internal constant ROYALTY_VAULT = keccak256("ROYALTY_VAULT");
    bytes32 internal constant ROYALTY_ROUTER = keccak256("ROYALTY_ROUTER");
    bytes32 internal constant CATALOG_REGISTRY = keccak256("CATALOG_REGISTRY");
    bytes32 internal constant CATALOG_METADATA_REGISTRY = keccak256("CATALOG_METADATA_REGISTRY");
    bytes32 internal constant MEDIA_MANIFEST_REGISTRY = keccak256("MEDIA_MANIFEST_REGISTRY");
    bytes32 internal constant STORAGE_SOURCE_REGISTRY = keccak256("STORAGE_SOURCE_REGISTRY");
    bytes32 internal constant PLAYBACK_RESOLVER = keccak256("PLAYBACK_RESOLVER");
    bytes32 internal constant PLAYBACK_ACCOUNTING = keccak256("PLAYBACK_ACCOUNTING");
    bytes32 internal constant STREAMING_SETTLEMENT_EPOCH = keccak256("STREAMING_SETTLEMENT_EPOCH");
    bytes32 internal constant STREAMING_REVENUE_ALLOCATOR = keccak256("STREAMING_REVENUE_ALLOCATOR");
    bytes32 internal constant STREAMING_ROYALTY_SETTLEMENT = keccak256("STREAMING_ROYALTY_SETTLEMENT");

    function dependencyRoot(
        HzDeploymentGraph420.Deployment memory d
    ) internal view returns (bytes32 root) {
        root = _mix(root, CREATIVE_PROTOCOL_REGISTRY, address(d.creativeProtocolRegistry));
        root = _mix(root, CREATOR_PROFILE_REGISTRY, address(d.creatorProfileRegistry));
        root = _mix(root, WORK_REGISTRY, address(d.workRegistry));
        root = _mix(root, RECORDING_REGISTRY, address(d.recordingRegistry));
        root = _mix(root, CONTRIBUTOR_REGISTRY, address(d.contributorRegistry));
        root = _mix(root, RIGHTS_REGISTRY, address(d.rightsRegistry));
        root = _mix(root, AUTHORIZATION_REGISTRY, address(d.authorizationRegistry));
        root = _mix(root, LICENSE_REGISTRY, address(d.licenseRegistry));
        root = _mix(root, ROYALTY_SCHEDULE_REGISTRY, address(d.royaltyScheduleRegistry));
        root = _mix(root, ROYALTY_VAULT, address(d.royaltyVault));
        root = _mix(root, ROYALTY_ROUTER, address(d.royaltyRouter));
        root = _mix(root, CATALOG_REGISTRY, address(d.catalogRegistry));
        root = _mix(root, CATALOG_METADATA_REGISTRY, address(d.catalogMetadataRegistry));
        root = _mix(root, MEDIA_MANIFEST_REGISTRY, address(d.mediaManifestRegistry));
        root = _mix(root, STORAGE_SOURCE_REGISTRY, address(d.storageSourceRegistry));
        root = _mix(root, PLAYBACK_RESOLVER, address(d.playbackResolver));
        root = _mix(root, PLAYBACK_ACCOUNTING, address(d.playbackAccounting));
        root = _mix(root, STREAMING_SETTLEMENT_EPOCH, address(d.streamingSettlementEpoch));
        root = _mix(root, STREAMING_REVENUE_ALLOCATOR, address(d.streamingRevenueAllocator));
        root = _mix(root, STREAMING_ROYALTY_SETTLEMENT, address(d.streamingRoyaltySettlement));
    }

    function _mix(
        bytes32 prior,
        bytes32 moduleKey,
        address implementation
    ) private view returns (bytes32) {
        return keccak256(abi.encode(prior, moduleKey, implementation, implementation.codehash));
    }
}
