// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/genesis/IReplayProtection420.sol";
import "../interfaces/genesis/IReplayConsumer420.sol";

/// @notice Canonical mutable replay-protection companion for Genesis applications.
/// @dev Keeps the existing read-only IReplayProtection420 surface frozen while providing
///      an explicit, auditable consumption boundary. Each object id is terminal once consumed.
contract ReplayProtectionConsumer420 is IReplayProtection420, IReplayConsumer420 {
    mapping(bytes32 => bool) private _consumed;
    mapping(bytes32 => bytes32) private _domain;
    mapping(address => mapping(bytes32 => uint256)) private _nonce;

    event ReplayConsumed(bytes32 indexed objectId, bytes32 indexed domain, address indexed consumer);

    function nonce(address actor, bytes32 domain) external view returns (uint256) {
        return _nonce[actor][domain];
    }

    function isConsumed(bytes32 objectId) external view returns (bool) {
        return _consumed[objectId];
    }

    function objectDomain(bytes32 objectId) external view returns (bytes32) {
        return _domain[objectId];
    }

    function consume(bytes32 objectId, bytes32 domain) external {
        require(objectId != bytes32(0) && domain != bytes32(0), "replay input");
        require(!_consumed[objectId], "replay consumed");
        _consumed[objectId] = true;
        _domain[objectId] = domain;
        unchecked { ++_nonce[msg.sender][domain]; }
        emit ReplayConsumed(objectId, domain, msg.sender);
    }
}
