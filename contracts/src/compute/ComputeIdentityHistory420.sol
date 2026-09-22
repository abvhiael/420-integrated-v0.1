// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ComputeIdentityGuard420.sol";

/// @notice Authenticates historical identity *records* against all three canonical revision stores.
/// @dev Not an accepted match, signed consent, stake/attestation proof, capacity reservation or payout authority.
contract ComputeIdentityHistory420 is I420System {
    ComputeIdentityGuard420 public immutable guard;
    ComputeIdentitySnapshot420 public immutable snapshots;
    ComputeProviderRegistry420 public immutable providers;
    ComputeNodeRegistry420 public immutable nodes;
    ComputeResourceRegistry420 public immutable resources;

    error InvalidGuard();
    error InvalidHistoricalSnapshot();

    constructor(address guard_) {
        if (guard_ == address(0) || guard_.code.length == 0) revert InvalidGuard();
        guard = ComputeIdentityGuard420(guard_);
        snapshots = guard.snapshots();
        providers = snapshots.providers();
        nodes = snapshots.nodes();
        resources = snapshots.resources();
        if (address(snapshots).code.length == 0 || address(providers).code.length == 0
            || address(nodes).code.length == 0 || address(resources).code.length == 0) revert InvalidGuard();
    }

    function systemName() external pure returns (string memory) { return "ComputeIdentityHistory420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    /// @notice Check all observed fields against the exact canonical historical revisions.
    /// @dev History records remain readable after rotation, suspension and retirement; this does NOT
    ///      assert that the resource was eligible at a historical timestamp or any job accepted it.
    function verifyHistorical(ComputeIdentitySnapshot420.Snapshot calldata observed, bytes32 expectedCommitment)
        external view returns (bool)
    {
        if (expectedCommitment == bytes32(0) || observed.providerId == bytes32(0)
            || observed.nodeId == bytes32(0) || observed.resourceId == bytes32(0)
            || observed.providerRevision == 0 || observed.nodeRevision == 0 || observed.resourceRevision == 0)
            revert InvalidHistoricalSnapshot();
        if (guard.commitment(observed) != expectedCommitment) revert InvalidHistoricalSnapshot();
        ComputeProviderRegistry420.Provider memory p = providers.revision(observed.providerId, observed.providerRevision);
        ComputeNodeRegistry420.Node memory n = nodes.revision(observed.nodeId, observed.nodeRevision);
        ComputeResourceRegistry420.Resource memory r = resources.revision(observed.resourceId, observed.resourceRevision);
        if (n.providerId != observed.providerId || r.providerId != observed.providerId || r.nodeId != observed.nodeId
            || p.settlementAccount != observed.settlementAccount || p.manifestHash != observed.providerManifestHash
            || n.manifestHash != observed.nodeManifestHash || n.endpointHash != observed.endpointHash
            || n.endpointExpiresAt != observed.endpointExpiresAt || r.computeClass != observed.computeClass
            || r.hardwareProfileHash != observed.hardwareProfileHash || r.runtimeProfileHash != observed.runtimeProfileHash
            || r.capabilityHash != observed.capabilityHash || r.capacityUnits != observed.advertisedCapacityUnits)
            revert InvalidHistoricalSnapshot();
        return true;
    }
}
