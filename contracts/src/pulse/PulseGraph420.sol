// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./PulseProfileRegistry420.sol";

contract PulseGraph420 is I420System {
    PulseProfileRegistry420 public immutable profiles;

    mapping(bytes32 => mapping(bytes32 => bool)) public following;
    mapping(bytes32 => mapping(bytes32 => bool)) public blocked;

    error ZeroAddress();
    error ProfileInactive();
    error Unauthorized();
    error SelfRelation();
    error BlockedRelation();
    error NoChange();

    event FollowSet(bytes32 indexed followerProfileId, bytes32 indexed followedProfileId, bool active);
    event BlockSet(bytes32 indexed blockerProfileId, bytes32 indexed blockedProfileId, bool active);

    constructor(address profiles_) {
        if (profiles_ == address(0)) revert ZeroAddress();
        profiles = PulseProfileRegistry420(profiles_);
    }

    function systemName() external pure returns (string memory) { return "PulseGraph420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function setFollow(bytes32 followerProfileId, bytes32 followedProfileId, bool active) external {
        _requireController(followerProfileId);
        if (followerProfileId == followedProfileId) revert SelfRelation();
        if (!profiles.profileActive(followedProfileId)) revert ProfileInactive();
        if (blocked[followerProfileId][followedProfileId] || blocked[followedProfileId][followerProfileId]) revert BlockedRelation();
        if (following[followerProfileId][followedProfileId] == active) revert NoChange();
        following[followerProfileId][followedProfileId] = active;
        emit FollowSet(followerProfileId, followedProfileId, active);
    }

    function setBlock(bytes32 blockerProfileId, bytes32 blockedProfileId, bool active) external {
        _requireController(blockerProfileId);
        if (blockerProfileId == blockedProfileId) revert SelfRelation();
        if (!profiles.profileActive(blockedProfileId)) revert ProfileInactive();
        if (blocked[blockerProfileId][blockedProfileId] == active) revert NoChange();
        blocked[blockerProfileId][blockedProfileId] = active;
        if (active && following[blockerProfileId][blockedProfileId]) {
            following[blockerProfileId][blockedProfileId] = false;
            emit FollowSet(blockerProfileId, blockedProfileId, false);
        }
        if (active && following[blockedProfileId][blockerProfileId]) {
            following[blockedProfileId][blockerProfileId] = false;
            emit FollowSet(blockedProfileId, blockerProfileId, false);
        }
        emit BlockSet(blockerProfileId, blockedProfileId, active);
    }

    function canInteract(bytes32 actorProfileId, bytes32 targetProfileId) external view returns (bool) {
        if (!profiles.profileActive(actorProfileId) || !profiles.profileActive(targetProfileId)) return false;
        return !blocked[actorProfileId][targetProfileId] && !blocked[targetProfileId][actorProfileId];
    }

    function _requireController(bytes32 profileId) private view {
        if (!profiles.profileActive(profileId)) revert ProfileInactive();
        if (profiles.controllerOf(profileId) != msg.sender) revert Unauthorized();
    }
}
