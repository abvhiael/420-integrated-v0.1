// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./BongGogglesAuthorization420.sol";
import "./BongGogglesIds420.sol";
import "./BongGogglesProfileRegistry420.sol";
import "./BongGogglesRelationshipGraph420.sol";

/// @notice Canonical Page, Group, membership and Event primitives for Bong Goggles V1.
/// @dev Social relationships stay in BongGogglesRelationshipGraph420; RSVPs are intent, never attendance proof.
contract BongGogglesCommunityRegistry420 {
    struct Page {
        bytes32 pageId;
        address profileAccount;
        address owner;
        bytes32 metadataRoot;
        uint64 createdAt;
        uint64 updatedAt;
        bool active;
        bool exists;
    }

    struct Group {
        bytes32 groupId;
        address owner;
        BongGogglesTypes420.GroupPrivacy privacy;
        BongGogglesTypes420.GroupJoinPolicy joinPolicy;
        bytes32 metadataRoot;
        uint64 createdAt;
        uint64 updatedAt;
        bool active;
        bool exists;
    }

    struct GroupMember {
        BongGogglesTypes420.GroupMemberState state;
        BongGogglesTypes420.GroupRole role;
        uint64 joinedAt;
        uint64 updatedAt;
    }

    struct EventRecord {
        bytes32 eventId;
        address owner;
        BongGogglesTypes420.EventHostType hostType;
        address hostAccount;
        bytes32 hostId;
        BongGogglesTypes420.EventVisibility visibility;
        bytes32 metadataRoot;
        uint64 startsAt;
        uint64 endsAt;
        uint64 createdAt;
        uint64 updatedAt;
        bool active;
        bool exists;
    }

    BongGogglesAuthorization420 public immutable authorization;
    BongGogglesProfileRegistry420 public immutable profiles;
    BongGogglesRelationshipGraph420 public immutable relationships;

    mapping(bytes32 => Page) private _pages;
    mapping(address => bytes32) public pageForProfile;
    mapping(address => uint256) public pageNonce;

    mapping(bytes32 => Group) private _groups;
    mapping(bytes32 => mapping(address => GroupMember)) private _groupMembers;
    mapping(address => uint256) public groupNonce;

    mapping(bytes32 => EventRecord) private _events;
    mapping(bytes32 => mapping(address => BongGogglesTypes420.RSVPState)) private _rsvps;
    mapping(address => uint256) public eventNonce;

    error ZeroAddress();
    error Unauthorized();
    error ProfileInactive();
    error InvalidPageProfile();
    error PageExists();
    error PageMissing();
    error GroupMissing();
    error GroupInactive();
    error EventMissing();
    error EventInactive();
    error InvalidTimeRange();
    error JoinDisabled();
    error AlreadyMember();
    error MembershipPending();
    error MembershipMissing();
    error MembershipNotPending();
    error BlockedRelationship();
    error InvalidHost();
    error RSVPDenied();
    error InvalidRSVP();
    error OwnerCannotLeave();

    event PageCreated(bytes32 indexed pageId, address indexed profileAccount, address indexed owner, bytes32 metadataRoot, address operator);
    event PageUpdated(bytes32 indexed pageId, bytes32 metadataRoot, bool active, address indexed operator);
    event GroupCreated(bytes32 indexed groupId, address indexed owner, BongGogglesTypes420.GroupPrivacy privacy, BongGogglesTypes420.GroupJoinPolicy joinPolicy, address operator);
    event GroupUpdated(bytes32 indexed groupId, BongGogglesTypes420.GroupPrivacy privacy, BongGogglesTypes420.GroupJoinPolicy joinPolicy, bytes32 metadataRoot, bool active, address operator);
    event GroupJoinRequested(bytes32 indexed groupId, address indexed account, address indexed operator);
    event GroupMemberActivated(bytes32 indexed groupId, address indexed account, BongGogglesTypes420.GroupRole role, address operator);
    event GroupMemberRemoved(bytes32 indexed groupId, address indexed account, address indexed operator);
    event EventCreated(bytes32 indexed eventId, address indexed owner, BongGogglesTypes420.EventHostType hostType, bytes32 indexed hostId, address operator);
    event EventUpdated(bytes32 indexed eventId, bytes32 metadataRoot, uint64 startsAt, uint64 endsAt, bool active, address operator);
    event EventRSVP(bytes32 indexed eventId, address indexed account, BongGogglesTypes420.RSVPState state, address operator);

    constructor(address authorization_, address profiles_, address relationships_) {
        if (authorization_ == address(0) || profiles_ == address(0) || relationships_ == address(0)) revert ZeroAddress();
        authorization = BongGogglesAuthorization420(authorization_);
        profiles = BongGogglesProfileRegistry420(profiles_);
        relationships = BongGogglesRelationshipGraph420(relationships_);
    }

    function page(bytes32 pageId) external view returns (Page memory) { return _pages[pageId]; }
    function group(bytes32 groupId) external view returns (Group memory) { return _groups[groupId]; }
    function groupMember(bytes32 groupId, address account) external view returns (GroupMember memory) { return _groupMembers[groupId][account]; }
    function eventRecord(bytes32 eventId) external view returns (EventRecord memory) { return _events[eventId]; }
    function rsvp(bytes32 eventId, address account) external view returns (BongGogglesTypes420.RSVPState) { return _rsvps[eventId][account]; }

    function createPage(address owner, address profileAccount, bytes32 metadataRoot) external returns (bytes32 pageId) {
        if (owner == address(0) || profileAccount == address(0)) revert ZeroAddress();
        if (!authorization.canActFor(msg.sender, owner, BongGogglesIds420.ACTION_PAGE_CREATE)) revert Unauthorized();
        if (!profiles.isActive(owner) || !profiles.isActive(profileAccount)) revert ProfileInactive();
        BongGogglesTypes420.ProfileType t = profiles.profile(profileAccount).profileType;
        if (t != BongGogglesTypes420.ProfileType.CREATOR && t != BongGogglesTypes420.ProfileType.BUSINESS && t != BongGogglesTypes420.ProfileType.ORGANIZATION) revert InvalidPageProfile();
        if (pageForProfile[profileAccount] != bytes32(0)) revert PageExists();
        uint256 nonce = ++pageNonce[owner];
        pageId = keccak256(abi.encode("420/BONG_GOGGLES/PAGE/V1", block.chainid, owner, profileAccount, nonce));
        uint64 now_ = uint64(block.timestamp);
        _pages[pageId] = Page(pageId, profileAccount, owner, metadataRoot, now_, now_, true, true);
        pageForProfile[profileAccount] = pageId;
        emit PageCreated(pageId, profileAccount, owner, metadataRoot, msg.sender);
    }

    function updatePage(address owner, bytes32 pageId, bytes32 metadataRoot, bool active) external {
        Page storage p = _pages[pageId];
        if (!p.exists) revert PageMissing();
        if (p.owner != owner || !authorization.canActFor(msg.sender, owner, BongGogglesIds420.ACTION_PAGE_UPDATE)) revert Unauthorized();
        p.metadataRoot = metadataRoot;
        p.active = active;
        p.updatedAt = uint64(block.timestamp);
        emit PageUpdated(pageId, metadataRoot, active, msg.sender);
    }

    function createGroup(address owner, BongGogglesTypes420.GroupPrivacy privacy, BongGogglesTypes420.GroupJoinPolicy joinPolicy, bytes32 metadataRoot) external returns (bytes32 groupId) {
        if (owner == address(0)) revert ZeroAddress();
        if (!authorization.canActFor(msg.sender, owner, BongGogglesIds420.ACTION_GROUP_CREATE)) revert Unauthorized();
        if (!profiles.isActive(owner)) revert ProfileInactive();
        uint256 nonce = ++groupNonce[owner];
        groupId = keccak256(abi.encode("420/BONG_GOGGLES/GROUP/V1", block.chainid, owner, nonce));
        uint64 now_ = uint64(block.timestamp);
        _groups[groupId] = Group(groupId, owner, privacy, joinPolicy, metadataRoot, now_, now_, true, true);
        _groupMembers[groupId][owner] = GroupMember(BongGogglesTypes420.GroupMemberState.ACTIVE, BongGogglesTypes420.GroupRole.OWNER, now_, now_);
        emit GroupCreated(groupId, owner, privacy, joinPolicy, msg.sender);
        emit GroupMemberActivated(groupId, owner, BongGogglesTypes420.GroupRole.OWNER, msg.sender);
    }

    function updateGroup(address owner, bytes32 groupId, BongGogglesTypes420.GroupPrivacy privacy, BongGogglesTypes420.GroupJoinPolicy joinPolicy, bytes32 metadataRoot, bool active) external {
        Group storage g = _groups[groupId];
        if (!g.exists) revert GroupMissing();
        if (g.owner != owner || !authorization.canActFor(msg.sender, owner, BongGogglesIds420.ACTION_GROUP_UPDATE)) revert Unauthorized();
        g.privacy = privacy;
        g.joinPolicy = joinPolicy;
        g.metadataRoot = metadataRoot;
        g.active = active;
        g.updatedAt = uint64(block.timestamp);
        emit GroupUpdated(groupId, privacy, joinPolicy, metadataRoot, active, msg.sender);
    }

    function joinGroup(address account, bytes32 groupId) external {
        Group storage g = _activeGroup(groupId);
        if (!authorization.canActFor(msg.sender, account, BongGogglesIds420.ACTION_GROUP_JOIN)) revert Unauthorized();
        if (!profiles.isActive(account)) revert ProfileInactive();
        if (relationships.isBlockedEither(account, g.owner)) revert BlockedRelationship();
        GroupMember storage m = _groupMembers[groupId][account];
        if (m.state == BongGogglesTypes420.GroupMemberState.ACTIVE) revert AlreadyMember();
        if (m.state == BongGogglesTypes420.GroupMemberState.PENDING) revert MembershipPending();
        uint64 now_ = uint64(block.timestamp);
        if (g.joinPolicy == BongGogglesTypes420.GroupJoinPolicy.OPEN) {
            _groupMembers[groupId][account] = GroupMember(BongGogglesTypes420.GroupMemberState.ACTIVE, BongGogglesTypes420.GroupRole.MEMBER, now_, now_);
            emit GroupMemberActivated(groupId, account, BongGogglesTypes420.GroupRole.MEMBER, msg.sender);
            return;
        }
        if (g.joinPolicy != BongGogglesTypes420.GroupJoinPolicy.APPROVAL_REQUIRED) revert JoinDisabled();
        _groupMembers[groupId][account] = GroupMember(BongGogglesTypes420.GroupMemberState.PENDING, BongGogglesTypes420.GroupRole.NONE, 0, now_);
        emit GroupJoinRequested(groupId, account, msg.sender);
    }

    function approveGroupMember(address owner, bytes32 groupId, address account) external {
        Group storage g = _activeGroup(groupId);
        if (g.owner != owner || !authorization.canActFor(msg.sender, owner, BongGogglesIds420.ACTION_GROUP_MEMBER_APPROVE)) revert Unauthorized();
        if (!profiles.isActive(account)) revert ProfileInactive();
        if (relationships.isBlockedEither(account, owner)) revert BlockedRelationship();
        GroupMember storage m = _groupMembers[groupId][account];
        if (m.state == BongGogglesTypes420.GroupMemberState.NONE || m.state == BongGogglesTypes420.GroupMemberState.REMOVED) revert MembershipMissing();
        if (m.state != BongGogglesTypes420.GroupMemberState.PENDING) revert MembershipNotPending();
        uint64 now_ = uint64(block.timestamp);
        m.state = BongGogglesTypes420.GroupMemberState.ACTIVE;
        m.role = BongGogglesTypes420.GroupRole.MEMBER;
        m.joinedAt = now_;
        m.updatedAt = now_;
        emit GroupMemberActivated(groupId, account, BongGogglesTypes420.GroupRole.MEMBER, msg.sender);
    }

    function removeGroupMember(address actor, bytes32 groupId, address account) external {
        Group storage g = _groups[groupId];
        if (!g.exists) revert GroupMissing();
        if (account == g.owner) revert OwnerCannotLeave();
        if (actor == account) {
            if (!authorization.canActFor(msg.sender, account, BongGogglesIds420.ACTION_GROUP_MEMBER_REMOVE)) revert Unauthorized();
        } else if (actor == g.owner) {
            if (!authorization.canActFor(msg.sender, g.owner, BongGogglesIds420.ACTION_GROUP_MEMBER_REMOVE)) revert Unauthorized();
        } else {
            revert Unauthorized();
        }
        GroupMember storage m = _groupMembers[groupId][account];
        if (m.state != BongGogglesTypes420.GroupMemberState.ACTIVE && m.state != BongGogglesTypes420.GroupMemberState.PENDING) revert MembershipMissing();
        m.state = BongGogglesTypes420.GroupMemberState.REMOVED;
        m.role = BongGogglesTypes420.GroupRole.NONE;
        m.updatedAt = uint64(block.timestamp);
        emit GroupMemberRemoved(groupId, account, msg.sender);
    }

    function createEvent(address owner, BongGogglesTypes420.EventHostType hostType, address hostAccount, bytes32 hostId, BongGogglesTypes420.EventVisibility visibility, bytes32 metadataRoot, uint64 startsAt, uint64 endsAt) external returns (bytes32 eventId) {
        if (owner == address(0)) revert ZeroAddress();
        if (!authorization.canActFor(msg.sender, owner, BongGogglesIds420.ACTION_EVENT_CREATE)) revert Unauthorized();
        if (!profiles.isActive(owner)) revert ProfileInactive();
        if (startsAt == 0 || endsAt <= startsAt) revert InvalidTimeRange();
        _validateHost(owner, hostType, hostAccount, hostId);
        uint256 nonce = ++eventNonce[owner];
        eventId = keccak256(abi.encode("420/BONG_GOGGLES/EVENT/V1", block.chainid, owner, hostType, hostAccount, hostId, nonce));
        uint64 now_ = uint64(block.timestamp);
        _events[eventId] = EventRecord(eventId, owner, hostType, hostAccount, hostId, visibility, metadataRoot, startsAt, endsAt, now_, now_, true, true);
        emit EventCreated(eventId, owner, hostType, hostId, msg.sender);
    }

    function updateEvent(address owner, bytes32 eventId, bytes32 metadataRoot, uint64 startsAt, uint64 endsAt, bool active) external {
        EventRecord storage e = _events[eventId];
        if (!e.exists) revert EventMissing();
        if (e.owner != owner || !authorization.canActFor(msg.sender, owner, BongGogglesIds420.ACTION_EVENT_UPDATE)) revert Unauthorized();
        if (startsAt == 0 || endsAt <= startsAt) revert InvalidTimeRange();
        e.metadataRoot = metadataRoot;
        e.startsAt = startsAt;
        e.endsAt = endsAt;
        e.active = active;
        e.updatedAt = uint64(block.timestamp);
        emit EventUpdated(eventId, metadataRoot, startsAt, endsAt, active, msg.sender);
    }

    function setRSVP(address account, bytes32 eventId, BongGogglesTypes420.RSVPState state) external {
        if (state == BongGogglesTypes420.RSVPState.NONE) revert InvalidRSVP();
        if (!authorization.canActFor(msg.sender, account, BongGogglesIds420.ACTION_EVENT_RSVP)) revert Unauthorized();
        if (!profiles.isActive(account)) revert ProfileInactive();
        EventRecord storage e = _events[eventId];
        if (!e.exists) revert EventMissing();
        if (!e.active) revert EventInactive();
        if (relationships.isBlockedEither(account, e.owner)) revert RSVPDenied();
        if (e.visibility == BongGogglesTypes420.EventVisibility.INVITE_ONLY) revert RSVPDenied();
        if (e.visibility == BongGogglesTypes420.EventVisibility.GROUP_ONLY) {
            if (e.hostType != BongGogglesTypes420.EventHostType.GROUP || _groupMembers[e.hostId][account].state != BongGogglesTypes420.GroupMemberState.ACTIVE) revert RSVPDenied();
        }
        _rsvps[eventId][account] = state;
        emit EventRSVP(eventId, account, state, msg.sender);
    }

    function isActiveGroupMember(bytes32 groupId, address account) external view returns (bool) {
        Group storage g = _groups[groupId];
        return g.exists && g.active && _groupMembers[groupId][account].state == BongGogglesTypes420.GroupMemberState.ACTIVE;
    }

    function canViewGroup(bytes32 groupId, address viewer) external view returns (bool) {
        Group storage g = _groups[groupId];
        if (!g.exists || !g.active) return false;
        if (g.privacy == BongGogglesTypes420.GroupPrivacy.PUBLIC) return true;
        return viewer != address(0) && _groupMembers[groupId][viewer].state == BongGogglesTypes420.GroupMemberState.ACTIVE;
    }

    function _activeGroup(bytes32 groupId) internal view returns (Group storage g) {
        g = _groups[groupId];
        if (!g.exists) revert GroupMissing();
        if (!g.active) revert GroupInactive();
    }

    function _validateHost(address owner, BongGogglesTypes420.EventHostType hostType, address hostAccount, bytes32 hostId) internal view {
        if (hostType == BongGogglesTypes420.EventHostType.PROFILE) {
            if (hostAccount != owner || hostId != bytes32(0) || !profiles.isActive(hostAccount)) revert InvalidHost();
            return;
        }
        if (hostType == BongGogglesTypes420.EventHostType.PAGE) {
            Page storage p = _pages[hostId];
            if (!p.exists || !p.active || p.owner != owner || p.profileAccount != hostAccount) revert InvalidHost();
            return;
        }
        Group storage g = _groups[hostId];
        if (!g.exists || !g.active || g.owner != owner || hostAccount != address(0)) revert InvalidHost();
    }
}
