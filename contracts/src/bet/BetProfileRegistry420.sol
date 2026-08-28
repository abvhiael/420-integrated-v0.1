// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./BetAuthorization420.sol";
import "./BetIds420.sol";

contract BetProfileRegistry420 is I420System {
    struct Profile {
        bytes32 profileId;
        bytes32 profileType;
        bytes32 manifestHash;
        bytes32 artifactHash;
        uint64 registeredAt;
        bool active;
        bool exists;
    }

    BetAuthorization420 public immutable authorization;
    mapping(bytes32 => Profile) private _profiles;

    error ZeroAddress();
    error InvalidId();
    error AlreadyExists();
    error NotFound();
    error Unauthorized();
    error AlreadyDeprecated();

    event ProfileRegistered(bytes32 indexed profileId, bytes32 indexed profileType, bytes32 manifestHash, bytes32 artifactHash);
    event ProfileDeprecated(bytes32 indexed profileId);

    constructor(address authorization_) {
        if (authorization_ == address(0)) revert ZeroAddress();
        authorization = BetAuthorization420(authorization_);
    }

    function systemName() external pure returns (string memory) { return "BetProfileRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function registerProfile(bytes32 profileId, bytes32 profileType, bytes32 manifestHash, bytes32 artifactHash) external {
        if (profileId == bytes32(0) || profileType == bytes32(0)) revert InvalidId();
        if (_profiles[profileId].exists) revert AlreadyExists();
        _requireAuth(profileId, BetIds420.ACTION_PROFILE_REGISTER);
        _profiles[profileId] = Profile(profileId, profileType, manifestHash, artifactHash, uint64(block.timestamp), true, true);
        emit ProfileRegistered(profileId, profileType, manifestHash, artifactHash);
    }

    function deprecate(bytes32 profileId) external {
        Profile storage p = _get(profileId);
        if (!p.active) revert AlreadyDeprecated();
        _requireAuth(profileId, BetIds420.ACTION_PROFILE_DEPRECATE);
        p.active = false;
        emit ProfileDeprecated(profileId);
    }

    function getProfile(bytes32 profileId) external view returns (Profile memory) { return _get(profileId); }
    function isActive(bytes32 profileId) external view returns (bool) { return _get(profileId).active; }
    function isActiveOfType(bytes32 profileId, bytes32 profileType) external view returns (bool) {
        Profile storage p = _profiles[profileId];
        return p.exists && p.active && p.profileType == profileType;
    }

    function _get(bytes32 profileId) private view returns (Profile storage p) {
        p = _profiles[profileId];
        if (!p.exists) revert NotFound();
    }

    function _requireAuth(bytes32 profileId, bytes32 action) private view {
        if (!authorization.isAuthorized(msg.sender, action, authorization.scopeForProfile(profileId), 0)) revert Unauthorized();
    }
}
