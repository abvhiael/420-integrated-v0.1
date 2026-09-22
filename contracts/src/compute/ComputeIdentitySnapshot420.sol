// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ComputeResourceRegistry420.sol";

/// @notice Read-only, registry-resolved identity snapshot for a future matching component.
/// @dev Local administrative availability is NOT verified capacity, stake, attestation, policy,
///      signature, payment authorization or an accepted match. Callers must enforce those independently.
contract ComputeIdentitySnapshot420 is I420System {
    ComputeResourceRegistry420 public immutable resources;
    ComputeNodeRegistry420 public immutable nodes;
    ComputeProviderRegistry420 public immutable providers;

    struct Snapshot {
        bytes32 providerId;
        bytes32 nodeId;
        bytes32 resourceId;
        uint64 providerRevision;
        uint64 nodeRevision;
        uint64 resourceRevision;
        address settlementAccount;
        bytes32 providerManifestHash;
        bytes32 nodeManifestHash;
        bytes32 endpointHash;
        uint64 endpointExpiresAt;
        bytes32 computeClass;
        bytes32 hardwareProfileHash;
        bytes32 runtimeProfileHash;
        bytes32 capabilityHash;
        uint256 advertisedCapacityUnits;
    }

    error InvalidRegistry();
    error IneligibleIdentity();
    error InvalidRequest();

    constructor(address resourceRegistry_) {
        if (resourceRegistry_ == address(0) || resourceRegistry_.code.length == 0) revert InvalidRegistry();
        resources = ComputeResourceRegistry420(resourceRegistry_);
        nodes = resources.nodes();
        providers = resources.providers();
        if (address(nodes) == address(0) || address(providers) == address(0)
            || address(nodes).code.length == 0 || address(providers).code.length == 0) revert InvalidRegistry();
    }

    function systemName() external pure returns (string memory) { return "ComputeIdentitySnapshot420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    /// @notice Resolve parents from authoritative registry state, never from a caller-supplied parent.
    /// @dev Do not use this as a payment or capacity-reservation authorization; state can change
    ///      immediately after this view returns. A future matching transaction must recheck atomically.
    function snapshot(bytes32 resourceId, bytes32 expectedClass, uint256 requiredUnits)
        external view returns (Snapshot memory s)
    {
        if (resourceId == bytes32(0) || expectedClass == bytes32(0) || requiredUnits == 0)
            revert InvalidRequest();
        if (!resources.isAvailable(resourceId)) revert IneligibleIdentity();
        ComputeResourceRegistry420.Resource memory r = resources.resource(resourceId);
        if (r.computeClass != expectedClass || requiredUnits > r.capacityUnits) revert IneligibleIdentity();
        ComputeNodeRegistry420.Node memory n = nodes.node(r.nodeId);
        ComputeProviderRegistry420.Provider memory p = providers.provider(r.providerId);
        if (n.providerId != r.providerId || n.status != ComputeNodeRegistry420.Status.ACTIVE
            || p.status != ComputeProviderRegistry420.Status.ACTIVE || n.endpointExpiresAt <= block.timestamp
            || r.status != ComputeResourceRegistry420.Status.AVAILABLE || p.settlementAccount == address(0))
            revert IneligibleIdentity();
        s = Snapshot(r.providerId, r.nodeId, resourceId, p.revision, n.revision, r.revision,
            p.settlementAccount, p.manifestHash, n.manifestHash, n.endpointHash, n.endpointExpiresAt,
            r.computeClass, r.hardwareProfileHash, r.runtimeProfileHash, r.capabilityHash, r.capacityUnits);
    }
}
