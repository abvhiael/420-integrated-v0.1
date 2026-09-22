// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ComputeIdentitySnapshot420.sol";

/// @notice Fail-closed, revision-bound preflight for callers holding a previously observed identity snapshot.
/// @dev This view is NOT an accepted match, reservation, signed authorization, hardware attestation or payment grant.
///      An eventual matching transaction must perform all authoritative checks and funding atomically.
contract ComputeIdentityGuard420 is I420System {
    bytes32 public constant GUARD_DOMAIN_V1 = keccak256("420Integrated.ComputeMarket.IdentityGuard.v1");
    ComputeIdentitySnapshot420 public immutable snapshots;

    struct Expected {
        uint64 providerRevision;
        uint64 nodeRevision;
        uint64 resourceRevision;
        bytes32 snapshotCommitment;
    }

    error InvalidSnapshotRegistry();
    error InvalidExpectation();
    error StaleIdentitySnapshot();

    constructor(address snapshotRegistry_) {
        if (snapshotRegistry_ == address(0) || snapshotRegistry_.code.length == 0) revert InvalidSnapshotRegistry();
        snapshots = ComputeIdentitySnapshot420(snapshotRegistry_);
        if (address(snapshots.resources()).code.length == 0 || address(snapshots.nodes()).code.length == 0
            || address(snapshots.providers()).code.length == 0) revert InvalidSnapshotRegistry();
    }

    function systemName() external pure returns (string memory) { return "ComputeIdentityGuard420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    /// @dev Standard ABI encodes the entire fixed-size snapshot, with explicit chain, contract and registry domains.
    ///      The commitment covers the settlement account, endpoint expiry and all manifest/profile fields.
    function commitment(ComputeIdentitySnapshot420.Snapshot memory s) public view returns (bytes32) {
        if (block.chainid == 0 || s.providerId == bytes32(0) || s.nodeId == bytes32(0)
            || s.resourceId == bytes32(0) || s.providerRevision == 0 || s.nodeRevision == 0
            || s.resourceRevision == 0) revert InvalidExpectation();
        return keccak256(abi.encode(GUARD_DOMAIN_V1, block.chainid, address(this), address(snapshots),
            address(snapshots.providers()), address(snapshots.nodes()), address(snapshots.resources()), s));
    }

    /// @notice Reject previously observed versions after any canonical provider/node/resource revision or status change.
    /// @dev A caller MUST obtain `expected` from a trusted earlier read, never build it from untrusted user claims.
    function requireCurrent(bytes32 resourceId, bytes32 expectedClass, uint256 requiredUnits, Expected calldata expected)
        external view returns (ComputeIdentitySnapshot420.Snapshot memory current)
    {
        if (expected.providerRevision == 0 || expected.nodeRevision == 0 || expected.resourceRevision == 0
            || expected.snapshotCommitment == bytes32(0)) revert InvalidExpectation();
        current = snapshots.snapshot(resourceId, expectedClass, requiredUnits);
        if (current.providerRevision != expected.providerRevision || current.nodeRevision != expected.nodeRevision
            || current.resourceRevision != expected.resourceRevision
            || commitment(current) != expected.snapshotCommitment) revert StaleIdentitySnapshot();
    }
}
