// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IReplayProtection420 {
    function nonce(address actor, bytes32 domain) external view returns (uint256);
    function isConsumed(bytes32 objectId) external view returns (bool);
    function objectDomain(bytes32 objectId) external view returns (bytes32);

    /// @notice Atomically marks an object id consumed in its application domain.
    /// @dev Implementations MUST reject a previously consumed object id and MUST bind the
    /// object id to exactly one domain. Callers should invoke this only after all economic
    /// postconditions have succeeded so a reverted transaction cannot burn authorization.
    function consume(bytes32 objectId, bytes32 domain) external;
}
