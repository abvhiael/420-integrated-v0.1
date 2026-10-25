// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Required authoritative contest-engine boundary, not a data-provider API.
/// @dev The host must enforce immutable manifests, funded prizes, entry identity and
/// early-start recovery. A production host must consume the controller's final/cancel
/// state before releasing any entry/prize escrow. This interface does not implement it.
interface IFantasyDisputeHost420 {
    function isEntrant(bytes32 poolId, bytes32 identityId) external view returns (bool);
    /// Include launcher, entrants, staff with a material interest and known related identities.
    function isInterested(bytes32 poolId, bytes32 identityId) external view returns (bool);
    /// Finality must fail closed if an authenticated newer revision is unfinished.
    function candidateIsCurrent(bytes32 poolId, bytes32 candidate) external view returns (bool);
}
