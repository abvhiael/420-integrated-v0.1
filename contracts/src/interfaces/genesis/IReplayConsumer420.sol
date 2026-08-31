// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Narrow mutable companion boundary for canonical replay protection.
/// @dev The frozen IReplayProtection420 read surface remains unchanged. Consumers that must
///      atomically reserve an object id resolve this companion interface explicitly.
interface IReplayConsumer420 {
    function consume(bytes32 objectId, bytes32 domain) external;
}
