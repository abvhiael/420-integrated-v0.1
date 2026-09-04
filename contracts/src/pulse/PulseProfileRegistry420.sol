// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./PulseIds420.sol";

contract PulseProfileRegistry420 is I420System {
    struct Profile {
        address controller;
        bytes32 profileType;
        bytes32 identityRef;
        bytes32 nameRef;
        bytes32 metadataHash;
        bytes32 avatarContentRef;
        bytes32 headerContentRef;
        uint64 createdAt;
        uint32 revision;
        bool active;
        bool exists;
    }

    mapping(bytes32 => Profile) private _profiles;

    error InvalidProfileId();
    error ProfileAlreadyExists();
    error ProfileNotFound();
    error InvalidProfileType();
    error Unauthorized();
    error ZeroController();

    event ProfileCreated(bytes32 indexed profileId, address indexed controller, bytes32 profileType, uint64 createdAt);
    event ProfileUpdated(bytes32 indexed profileId, bytes32 metadataHash, bytes32 avatarContentRef, bytes32 headerContentRef, uint32 revision, bool active);

    function systemName() external pure returns (string memory) { return "PulseProfileRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function createProfile(
        bytes32 profileId,
        address controller,
        bytes32 profileType,
        bytes32 identityRef,
        bytes32 nameRef,
        bytes32 metadataHash,
        bytes32 avatarContentRef,
        bytes32 headerContentRef
    ) external {
        if (profileId == bytes32(0)) revert InvalidProfileId();
        if (_profiles[profileId].exists) revert ProfileAlreadyExists();
        if (controller == address(0)) revert ZeroController();
        if (msg.sender != controller) revert Unauthorized();
        if (!_validProfileType(profileType)) revert InvalidProfileType();
        _profiles[profileId] = Profile({
            controller: controller,
            profileType: profileType,
            identityRef: identityRef,
            nameRef: nameRef,
            metadataHash: metadataHash,
            avatarContentRef: avatarContentRef,
            headerContentRef: headerContentRef,
            createdAt: uint64(block.timestamp),
            revision: 1,
            active: true,
            exists: true
        });
        emit ProfileCreated(profileId, controller, profileType, uint64(block.timestamp));
    }

    function updateProfile(
        bytes32 profileId,
        bytes32 metadataHash,
        bytes32 avatarContentRef,
        bytes32 headerContentRef,
        bool active
    ) external {
        Profile storage profile = _profiles[profileId];
        if (!profile.exists) revert ProfileNotFound();
        if (msg.sender != profile.controller) revert Unauthorized();
        profile.metadataHash = metadataHash;
        profile.avatarContentRef = avatarContentRef;
        profile.headerContentRef = headerContentRef;
        profile.revision += 1;
        profile.active = active;
        emit ProfileUpdated(profileId, metadataHash, avatarContentRef, headerContentRef, profile.revision, active);
    }

    function getProfile(bytes32 profileId) external view returns (Profile memory profile) {
        profile = _profiles[profileId];
        if (!profile.exists) revert ProfileNotFound();
    }

    function controllerOf(bytes32 profileId) external view returns (address) {
        Profile storage profile = _profiles[profileId];
        if (!profile.exists) revert ProfileNotFound();
        return profile.controller;
    }

    function profileActive(bytes32 profileId) external view returns (bool) {
        Profile storage profile = _profiles[profileId];
        return profile.exists && profile.active;
    }

    function _validProfileType(bytes32 x) private pure returns (bool) {
        return x == PulseIds420.PROFILE_PERSON || x == PulseIds420.PROFILE_CREATOR
            || x == PulseIds420.PROFILE_ORGANIZATION || x == PulseIds420.PROFILE_MERCHANT
            || x == PulseIds420.PROFILE_PROJECT || x == PulseIds420.PROFILE_PROTOCOL
            || x == PulseIds420.PROFILE_COMMUNITY;
    }
}
