// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Adapter interface for a 420Civic electorate source.
/// @dev A source exposes historical electorate commitments. The returned root commits the electorate
/// and weighting policy at snapshotBlock; totalWeight is the denominator used for quorum math.
interface ICivicElectorateSource420 {
    function sourceType() external pure returns (bytes32);

    function snapshotAt(uint64 snapshotBlock) external view returns (bytes32 electorateRoot, uint256 totalWeight);

    /// @notice Resolve a voter's weight against an already-committed electorate root.
    /// @dev proofData encoding is source-specific.
    function votingWeight(bytes32 electorateRoot, address voter, bytes calldata proofData)
        external
        view
        returns (uint256 weight);
}
