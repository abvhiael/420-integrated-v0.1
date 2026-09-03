// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./BongGogglesAuthorization420.sol";
import "./BongGogglesIds420.sol";

contract BongGogglesProfileRegistry420 {
    using BongGogglesTypes420 for *;

    struct Profile {
        address account;
        bytes32 profileId;
        BongGogglesTypes420.ProfileType profileType;
        bytes32 displayNameHash;
        bytes32 bioHash;
        bytes32 avatarRef;
        bytes32 bannerRef;
        bytes32 metadataRoot;
        uint64 createdAt;
        uint64 updatedAt;
        BongGogglesTypes420.ProfileStatus status;
        bool exists;
    }

    struct Preferences {
        BongGogglesTypes420.FollowPolicy followPolicy;
        BongGogglesTypes420.AccessPolicy friendRequestPolicy;
        BongGogglesTypes420.AccessPolicy messagePolicy;
        BongGogglesTypes420.AccessPolicy gameInvitePolicy;
        BongGogglesTypes420.AccessPolicy mentionPolicy;
        BongGogglesTypes420.AccessPolicy presencePolicy;
    }

    BongGogglesAuthorization420 public immutable authorization;
    mapping(address => Profile) private _profiles;
    mapping(address => Preferences) private _preferences;

    error Unauthorized();
    error ZeroAddress();
    error ProfileExists();
    error ProfileMissing();
    error ClosedProfile();

    event ProfileCreated(address indexed account, bytes32 indexed profileId, BongGogglesTypes420.ProfileType profileType, address indexed operator);
    event ProfileUpdated(address indexed account, bytes32 indexed profileId, uint64 updatedAt, address indexed operator);
    event ProfileStatusChanged(address indexed account, bytes32 indexed profileId, BongGogglesTypes420.ProfileStatus status, address operator);
    event SocialPreferencesUpdated(address indexed account, address indexed operator);

    constructor(address authorization_) {
        if (authorization_ == address(0)) revert ZeroAddress();
        authorization = BongGogglesAuthorization420(authorization_);
    }

    function profileIdFor(address account) public view returns (bytes32) {
        return keccak256(abi.encode("420/BONG_GOGGLES/PROFILE/V1", block.chainid, account));
    }

    function profile(address account) external view returns (Profile memory) { return _profiles[account]; }
    function preferences(address account) external view returns (Preferences memory) { return _preferences[account]; }
    function exists(address account) external view returns (bool) { return _profiles[account].exists; }
    function isActive(address account) external view returns (bool) {
        Profile storage p = _profiles[account];
        return p.exists && p.status == BongGogglesTypes420.ProfileStatus.ACTIVE;
    }

    function createProfile(
        address account,
        BongGogglesTypes420.ProfileType profileType,
        bytes32 displayNameHash,
        bytes32 bioHash,
        bytes32 avatarRef,
        bytes32 bannerRef,
        bytes32 metadataRoot
    ) external returns (bytes32 profileId) {
        if (account == address(0)) revert ZeroAddress();
        if (!authorization.canActFor(msg.sender, account, BongGogglesIds420.ACTION_PROFILE_CREATE)) revert Unauthorized();
        if (_profiles[account].exists) revert ProfileExists();
        profileId = profileIdFor(account);
        uint64 now_ = uint64(block.timestamp);
        _profiles[account] = Profile(account, profileId, profileType, displayNameHash, bioHash, avatarRef, bannerRef, metadataRoot, now_, now_, BongGogglesTypes420.ProfileStatus.ACTIVE, true);
        _preferences[account] = Preferences(
            BongGogglesTypes420.FollowPolicy.OPEN,
            BongGogglesTypes420.AccessPolicy.EVERYONE,
            BongGogglesTypes420.AccessPolicy.FRIENDS,
            BongGogglesTypes420.AccessPolicy.FRIENDS,
            BongGogglesTypes420.AccessPolicy.FRIENDS,
            BongGogglesTypes420.AccessPolicy.FRIENDS
        );
        emit ProfileCreated(account, profileId, profileType, msg.sender);
    }

    function updateProfile(
        address account,
        BongGogglesTypes420.ProfileType profileType,
        bytes32 displayNameHash,
        bytes32 bioHash,
        bytes32 avatarRef,
        bytes32 bannerRef,
        bytes32 metadataRoot
    ) external {
        if (!authorization.canActFor(msg.sender, account, BongGogglesIds420.ACTION_PROFILE_UPDATE)) revert Unauthorized();
        Profile storage p = _profiles[account];
        if (!p.exists) revert ProfileMissing();
        if (p.status == BongGogglesTypes420.ProfileStatus.CLOSED) revert ClosedProfile();
        p.profileType = profileType;
        p.displayNameHash = displayNameHash;
        p.bioHash = bioHash;
        p.avatarRef = avatarRef;
        p.bannerRef = bannerRef;
        p.metadataRoot = metadataRoot;
        p.updatedAt = uint64(block.timestamp);
        emit ProfileUpdated(account, p.profileId, p.updatedAt, msg.sender);
    }

    function setStatus(address account, BongGogglesTypes420.ProfileStatus status) external {
        bytes32 actionId = status == BongGogglesTypes420.ProfileStatus.DEACTIVATED || status == BongGogglesTypes420.ProfileStatus.CLOSED
            ? BongGogglesIds420.ACTION_PROFILE_DEACTIVATE
            : BongGogglesIds420.ACTION_PROFILE_UPDATE;
        if (!authorization.canActFor(msg.sender, account, actionId)) revert Unauthorized();
        Profile storage p = _profiles[account];
        if (!p.exists) revert ProfileMissing();
        if (p.status == BongGogglesTypes420.ProfileStatus.CLOSED) revert ClosedProfile();
        p.status = status;
        p.updatedAt = uint64(block.timestamp);
        emit ProfileStatusChanged(account, p.profileId, status, msg.sender);
    }

    function updatePreferences(address account, Preferences calldata prefs) external {
        if (!authorization.canActFor(msg.sender, account, BongGogglesIds420.ACTION_PREFERENCES_UPDATE)) revert Unauthorized();
        if (!_profiles[account].exists) revert ProfileMissing();
        _preferences[account] = prefs;
        emit SocialPreferencesUpdated(account, msg.sender);
    }
}
