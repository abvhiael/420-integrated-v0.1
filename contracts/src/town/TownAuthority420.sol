// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";

/// @notice Authoritative on-chain community membership and authorization state for 420Town.
/// @dev Search, indexers, transport, UI and rewards may project this state but never replace it.
/// Treasury handling is reference-only: this contract stores canonical authority bindings but has no custody API.
contract TownAuthority420 is I420System {
    enum MembershipState { NONE, ACTIVE, LEFT, REMOVED }
    enum SubscriptionState { NONE, ACTIVE, CANCELLED, EXPIRED }
    enum EntitlementState { NONE, ACTIVE, REVOKED, EXPIRED }

    struct Community {
        bool exists;
        address owner;
        bytes32 metadataHash;
        bytes32 treasuryAuthorityId;
        address treasury;
        uint64 createdAt;
        uint64 updatedAt;
        uint64 treasuryRevision;
    }

    struct Membership {
        MembershipState state;
        uint64 joinedAt;
        uint64 updatedAt;
    }

    struct Subscription {
        SubscriptionState state;
        bytes32 planId;
        uint64 startedAt;
        uint64 expiresAt;
        uint64 updatedAt;
        uint64 revision;
    }

    struct Entitlement {
        EntitlementState state;
        uint64 grantedAt;
        uint64 expiresAt;
        uint64 updatedAt;
        uint64 revision;
    }

    bytes32 public constant ROLE_MEMBER = keccak256("420/TOWN/ROLE/MEMBER/V1");
    bytes32 public constant ROLE_MODERATOR = keccak256("420/TOWN/ROLE/MODERATOR/V1");
    bytes32 public constant ROLE_ADMIN = keccak256("420/TOWN/ROLE/ADMIN/V1");

    bytes32 public constant PERMISSION_MANAGE_MEMBERS = keccak256("420/TOWN/PERMISSION/MANAGE_MEMBERS/V1");
    bytes32 public constant PERMISSION_MANAGE_ROLES = keccak256("420/TOWN/PERMISSION/MANAGE_ROLES/V1");
    bytes32 public constant PERMISSION_MANAGE_SUBSCRIPTIONS = keccak256("420/TOWN/PERMISSION/MANAGE_SUBSCRIPTIONS/V1");
    bytes32 public constant PERMISSION_MANAGE_ENTITLEMENTS = keccak256("420/TOWN/PERMISSION/MANAGE_ENTITLEMENTS/V1");
    bytes32 public constant PERMISSION_MANAGE_TREASURY = keccak256("420/TOWN/PERMISSION/MANAGE_TREASURY/V1");

    mapping(bytes32 => Community) private _communities;
    mapping(bytes32 => mapping(address => Membership)) private _memberships;
    mapping(bytes32 => mapping(bytes32 => mapping(address => bool))) private _roleAssignments;
    mapping(bytes32 => mapping(bytes32 => mapping(bytes32 => bool))) private _rolePermissions;
    mapping(bytes32 => mapping(address => Subscription)) private _subscriptions;
    mapping(bytes32 => mapping(address => mapping(bytes32 => Entitlement))) private _entitlements;

    error InvalidInput();
    error CommunityExists();
    error UnknownCommunity();
    error Unauthorized();
    error InvalidTransition();
    error OwnerInvariant();
    error UnknownRole();
    error UnknownPermission();
    error TreasuryReferenceInvalid();

    event CommunityCreated(bytes32 indexed communityId, address indexed owner, bytes32 metadataHash, bytes32 treasuryAuthorityId, address treasury);
    event CommunityMetadataUpdated(bytes32 indexed communityId, bytes32 metadataHash);
    event CommunityOwnershipTransferred(bytes32 indexed communityId, address indexed previousOwner, address indexed newOwner);
    event MembershipTransitioned(bytes32 indexed communityId, address indexed member, MembershipState previousState, MembershipState newState, address actor);
    event RoleAssignmentChanged(bytes32 indexed communityId, bytes32 indexed roleId, address indexed member, bool enabled, address actor);
    event RolePermissionChanged(bytes32 indexed communityId, bytes32 indexed roleId, bytes32 indexed permissionId, bool enabled);
    event SubscriptionTransitioned(bytes32 indexed communityId, address indexed subscriber, SubscriptionState previousState, SubscriptionState newState, bytes32 planId, uint64 expiresAt, uint64 revision, address actor);
    event EntitlementTransitioned(bytes32 indexed communityId, address indexed beneficiary, bytes32 indexed entitlementType, EntitlementState previousState, EntitlementState newState, uint64 expiresAt, uint64 revision, address actor);
    event TreasuryReferenceChanged(bytes32 indexed communityId, bytes32 indexed treasuryAuthorityId, address indexed treasury, uint64 revision, address actor);

    function systemName() external pure returns (string memory) { return "TownAuthority420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function createCommunity(bytes32 communityId, bytes32 metadataHash, bytes32 treasuryAuthorityId, address treasury) external {
        if (communityId == bytes32(0) || metadataHash == bytes32(0)) revert InvalidInput();
        if (_communities[communityId].exists) revert CommunityExists();
        _validateTreasuryReference(treasuryAuthorityId, treasury);

        uint64 nowTs = uint64(block.timestamp);
        _communities[communityId] = Community({
            exists: true,
            owner: msg.sender,
            metadataHash: metadataHash,
            treasuryAuthorityId: treasuryAuthorityId,
            treasury: treasury,
            createdAt: nowTs,
            updatedAt: nowTs,
            treasuryRevision: treasury == address(0) ? 0 : 1
        });
        _memberships[communityId][msg.sender] = Membership({
            state: MembershipState.ACTIVE,
            joinedAt: nowTs,
            updatedAt: nowTs
        });

        emit CommunityCreated(communityId, msg.sender, metadataHash, treasuryAuthorityId, treasury);
        emit MembershipTransitioned(communityId, msg.sender, MembershipState.NONE, MembershipState.ACTIVE, msg.sender);
        if (treasury != address(0)) emit TreasuryReferenceChanged(communityId, treasuryAuthorityId, treasury, 1, msg.sender);
    }

    function updateCommunityMetadata(bytes32 communityId, bytes32 metadataHash) external {
        if (metadataHash == bytes32(0)) revert InvalidInput();
        Community storage c = _requireCommunity(communityId);
        if (msg.sender != c.owner) revert Unauthorized();
        c.metadataHash = metadataHash;
        c.updatedAt = uint64(block.timestamp);
        emit CommunityMetadataUpdated(communityId, metadataHash);
    }

    function transferCommunityOwnership(bytes32 communityId, address newOwner) external {
        if (newOwner == address(0)) revert InvalidInput();
        Community storage c = _requireCommunity(communityId);
        if (msg.sender != c.owner) revert Unauthorized();
        if (_memberships[communityId][newOwner].state != MembershipState.ACTIVE) revert InvalidTransition();
        address previous = c.owner;
        if (newOwner == previous) revert InvalidTransition();
        c.owner = newOwner;
        c.updatedAt = uint64(block.timestamp);
        emit CommunityOwnershipTransferred(communityId, previous, newOwner);
    }

    function joinCommunity(bytes32 communityId) external {
        _requireCommunity(communityId);
        Membership storage m = _memberships[communityId][msg.sender];
        MembershipState previous = m.state;
        if (previous != MembershipState.NONE && previous != MembershipState.LEFT) revert InvalidTransition();
        uint64 nowTs = uint64(block.timestamp);
        m.state = MembershipState.ACTIVE;
        if (m.joinedAt == 0) m.joinedAt = nowTs;
        m.updatedAt = nowTs;
        emit MembershipTransitioned(communityId, msg.sender, previous, MembershipState.ACTIVE, msg.sender);
    }

    function addMember(bytes32 communityId, address member) external {
        if (member == address(0)) revert InvalidInput();
        _requirePermission(communityId, msg.sender, PERMISSION_MANAGE_MEMBERS);
        Membership storage m = _memberships[communityId][member];
        MembershipState previous = m.state;
        if (previous == MembershipState.ACTIVE) revert InvalidTransition();
        uint64 nowTs = uint64(block.timestamp);
        m.state = MembershipState.ACTIVE;
        if (m.joinedAt == 0) m.joinedAt = nowTs;
        m.updatedAt = nowTs;
        emit MembershipTransitioned(communityId, member, previous, MembershipState.ACTIVE, msg.sender);
    }

    function leaveCommunity(bytes32 communityId) external {
        Community storage c = _requireCommunity(communityId);
        if (msg.sender == c.owner) revert OwnerInvariant();
        Membership storage m = _memberships[communityId][msg.sender];
        if (m.state != MembershipState.ACTIVE) revert InvalidTransition();
        m.state = MembershipState.LEFT;
        m.updatedAt = uint64(block.timestamp);
        _clearPrivilegedRoles(communityId, msg.sender);
        emit MembershipTransitioned(communityId, msg.sender, MembershipState.ACTIVE, MembershipState.LEFT, msg.sender);
    }

    function removeMember(bytes32 communityId, address member) external {
        Community storage c = _requireCommunity(communityId);
        _requirePermission(communityId, msg.sender, PERMISSION_MANAGE_MEMBERS);
        if (member == c.owner) revert OwnerInvariant();
        Membership storage m = _memberships[communityId][member];
        if (m.state != MembershipState.ACTIVE) revert InvalidTransition();
        m.state = MembershipState.REMOVED;
        m.updatedAt = uint64(block.timestamp);
        _clearPrivilegedRoles(communityId, member);
        emit MembershipTransitioned(communityId, member, MembershipState.ACTIVE, MembershipState.REMOVED, msg.sender);
    }

    function assignRole(bytes32 communityId, bytes32 roleId, address member) external {
        Community storage c = _requireCommunity(communityId);
        _requireKnownAssignableRole(roleId);
        if (_memberships[communityId][member].state != MembershipState.ACTIVE) revert InvalidTransition();
        if (roleId == ROLE_ADMIN) {
            if (msg.sender != c.owner) revert Unauthorized();
        } else {
            _requirePermission(communityId, msg.sender, PERMISSION_MANAGE_ROLES);
        }
        if (_roleAssignments[communityId][roleId][member]) revert InvalidTransition();
        _roleAssignments[communityId][roleId][member] = true;
        emit RoleAssignmentChanged(communityId, roleId, member, true, msg.sender);
    }

    function revokeRole(bytes32 communityId, bytes32 roleId, address member) external {
        Community storage c = _requireCommunity(communityId);
        _requireKnownAssignableRole(roleId);
        if (roleId == ROLE_ADMIN) {
            if (msg.sender != c.owner) revert Unauthorized();
        } else {
            _requirePermission(communityId, msg.sender, PERMISSION_MANAGE_ROLES);
        }
        if (!_roleAssignments[communityId][roleId][member]) revert InvalidTransition();
        _roleAssignments[communityId][roleId][member] = false;
        emit RoleAssignmentChanged(communityId, roleId, member, false, msg.sender);
    }

    function setRolePermission(bytes32 communityId, bytes32 roleId, bytes32 permissionId, bool enabled) external {
        Community storage c = _requireCommunity(communityId);
        if (msg.sender != c.owner) revert Unauthorized();
        _requireKnownRole(roleId);
        if (!_knownPermission(permissionId)) revert UnknownPermission();
        _rolePermissions[communityId][roleId][permissionId] = enabled;
        emit RolePermissionChanged(communityId, roleId, permissionId, enabled);
    }

    function activateSubscription(bytes32 communityId, address subscriber, bytes32 planId, uint64 expiresAt) external {
        if (subscriber == address(0) || planId == bytes32(0)) revert InvalidInput();
        _requirePermission(communityId, msg.sender, PERMISSION_MANAGE_SUBSCRIPTIONS);
        if (_memberships[communityId][subscriber].state != MembershipState.ACTIVE) revert InvalidTransition();
        if (expiresAt != 0 && expiresAt <= block.timestamp) revert InvalidInput();

        Subscription storage s = _subscriptions[communityId][subscriber];
        SubscriptionState previous = s.state;
        if (previous == SubscriptionState.ACTIVE && !_subscriptionExpired(s)) revert InvalidTransition();

        uint64 nowTs = uint64(block.timestamp);
        s.state = SubscriptionState.ACTIVE;
        s.planId = planId;
        s.startedAt = nowTs;
        s.expiresAt = expiresAt;
        s.updatedAt = nowTs;
        s.revision += 1;
        emit SubscriptionTransitioned(communityId, subscriber, previous, SubscriptionState.ACTIVE, planId, expiresAt, s.revision, msg.sender);
    }

    function cancelSubscription(bytes32 communityId, address subscriber) external {
        _requireCommunity(communityId);
        Subscription storage s = _subscriptions[communityId][subscriber];
        if (s.state != SubscriptionState.ACTIVE || _subscriptionExpired(s)) revert InvalidTransition();
        if (msg.sender != subscriber && !hasPermission(communityId, msg.sender, PERMISSION_MANAGE_SUBSCRIPTIONS)) revert Unauthorized();
        SubscriptionState previous = s.state;
        s.state = SubscriptionState.CANCELLED;
        s.updatedAt = uint64(block.timestamp);
        s.revision += 1;
        emit SubscriptionTransitioned(communityId, subscriber, previous, SubscriptionState.CANCELLED, s.planId, s.expiresAt, s.revision, msg.sender);
    }

    function expireSubscription(bytes32 communityId, address subscriber) external {
        _requireCommunity(communityId);
        Subscription storage s = _subscriptions[communityId][subscriber];
        if (s.state != SubscriptionState.ACTIVE || !_subscriptionExpired(s)) revert InvalidTransition();
        SubscriptionState previous = s.state;
        s.state = SubscriptionState.EXPIRED;
        s.updatedAt = uint64(block.timestamp);
        s.revision += 1;
        emit SubscriptionTransitioned(communityId, subscriber, previous, SubscriptionState.EXPIRED, s.planId, s.expiresAt, s.revision, msg.sender);
    }

    function grantEntitlement(bytes32 communityId, address beneficiary, bytes32 entitlementType, uint64 expiresAt) external {
        if (beneficiary == address(0) || entitlementType == bytes32(0)) revert InvalidInput();
        _requirePermission(communityId, msg.sender, PERMISSION_MANAGE_ENTITLEMENTS);
        if (_memberships[communityId][beneficiary].state != MembershipState.ACTIVE) revert InvalidTransition();
        if (expiresAt != 0 && expiresAt <= block.timestamp) revert InvalidInput();

        Entitlement storage e = _entitlements[communityId][beneficiary][entitlementType];
        EntitlementState previous = e.state;
        if (previous == EntitlementState.ACTIVE && !_entitlementExpired(e)) revert InvalidTransition();

        uint64 nowTs = uint64(block.timestamp);
        e.state = EntitlementState.ACTIVE;
        e.grantedAt = nowTs;
        e.expiresAt = expiresAt;
        e.updatedAt = nowTs;
        e.revision += 1;
        emit EntitlementTransitioned(communityId, beneficiary, entitlementType, previous, EntitlementState.ACTIVE, expiresAt, e.revision, msg.sender);
    }

    function revokeEntitlement(bytes32 communityId, address beneficiary, bytes32 entitlementType) external {
        _requirePermission(communityId, msg.sender, PERMISSION_MANAGE_ENTITLEMENTS);
        Entitlement storage e = _entitlements[communityId][beneficiary][entitlementType];
        if (e.state != EntitlementState.ACTIVE || _entitlementExpired(e)) revert InvalidTransition();
        EntitlementState previous = e.state;
        e.state = EntitlementState.REVOKED;
        e.updatedAt = uint64(block.timestamp);
        e.revision += 1;
        emit EntitlementTransitioned(communityId, beneficiary, entitlementType, previous, EntitlementState.REVOKED, e.expiresAt, e.revision, msg.sender);
    }

    function expireEntitlement(bytes32 communityId, address beneficiary, bytes32 entitlementType) external {
        _requireCommunity(communityId);
        Entitlement storage e = _entitlements[communityId][beneficiary][entitlementType];
        if (e.state != EntitlementState.ACTIVE || !_entitlementExpired(e)) revert InvalidTransition();
        EntitlementState previous = e.state;
        e.state = EntitlementState.EXPIRED;
        e.updatedAt = uint64(block.timestamp);
        e.revision += 1;
        emit EntitlementTransitioned(communityId, beneficiary, entitlementType, previous, EntitlementState.EXPIRED, e.expiresAt, e.revision, msg.sender);
    }

    function setTreasuryReference(bytes32 communityId, bytes32 treasuryAuthorityId, address treasury) external {
        _validateTreasuryReference(treasuryAuthorityId, treasury);
        _requirePermission(communityId, msg.sender, PERMISSION_MANAGE_TREASURY);
        Community storage c = _communities[communityId];
        if (c.treasuryAuthorityId == treasuryAuthorityId && c.treasury == treasury) revert InvalidTransition();
        c.treasuryAuthorityId = treasuryAuthorityId;
        c.treasury = treasury;
        c.treasuryRevision += 1;
        c.updatedAt = uint64(block.timestamp);
        emit TreasuryReferenceChanged(communityId, treasuryAuthorityId, treasury, c.treasuryRevision, msg.sender);
    }

    function community(bytes32 communityId) external view returns (Community memory) { return _communities[communityId]; }
    function membership(bytes32 communityId, address member) external view returns (Membership memory) { return _memberships[communityId][member]; }
    function subscription(bytes32 communityId, address subscriber) external view returns (Subscription memory) { return _subscriptions[communityId][subscriber]; }
    function entitlement(bytes32 communityId, address beneficiary, bytes32 entitlementType) external view returns (Entitlement memory) { return _entitlements[communityId][beneficiary][entitlementType]; }

    function hasRole(bytes32 communityId, bytes32 roleId, address member) public view returns (bool) {
        Community memory c = _communities[communityId];
        if (!c.exists) return false;
        if (_memberships[communityId][member].state != MembershipState.ACTIVE) return false;
        if (roleId == ROLE_MEMBER) return true;
        if (roleId == ROLE_ADMIN || roleId == ROLE_MODERATOR) return _roleAssignments[communityId][roleId][member];
        return false;
    }

    function hasPermission(bytes32 communityId, address actor, bytes32 permissionId) public view returns (bool) {
        Community memory c = _communities[communityId];
        if (!c.exists || !_knownPermission(permissionId)) return false;
        if (_memberships[communityId][actor].state != MembershipState.ACTIVE) return false;
        if (actor == c.owner) return true;
        if (_roleAssignments[communityId][ROLE_ADMIN][actor] && _rolePermissions[communityId][ROLE_ADMIN][permissionId]) return true;
        if (_roleAssignments[communityId][ROLE_MODERATOR][actor] && _rolePermissions[communityId][ROLE_MODERATOR][permissionId]) return true;
        if (_rolePermissions[communityId][ROLE_MEMBER][permissionId]) return true;
        return false;
    }

    function rolePermission(bytes32 communityId, bytes32 roleId, bytes32 permissionId) external view returns (bool) {
        return _rolePermissions[communityId][roleId][permissionId];
    }

    function subscriptionActive(bytes32 communityId, address subscriber) external view returns (bool) {
        Subscription storage s = _subscriptions[communityId][subscriber];
        return s.state == SubscriptionState.ACTIVE && !_subscriptionExpired(s);
    }

    function entitlementActive(bytes32 communityId, address beneficiary, bytes32 entitlementType) external view returns (bool) {
        Entitlement storage e = _entitlements[communityId][beneficiary][entitlementType];
        return e.state == EntitlementState.ACTIVE && !_entitlementExpired(e);
    }

    function _requireCommunity(bytes32 communityId) internal view returns (Community storage c) {
        c = _communities[communityId];
        if (!c.exists) revert UnknownCommunity();
    }

    function _requirePermission(bytes32 communityId, address actor, bytes32 permissionId) internal view {
        _requireCommunity(communityId);
        if (!hasPermission(communityId, actor, permissionId)) revert Unauthorized();
    }

    function _knownPermission(bytes32 permissionId) internal pure returns (bool) {
        return permissionId == PERMISSION_MANAGE_MEMBERS
            || permissionId == PERMISSION_MANAGE_ROLES
            || permissionId == PERMISSION_MANAGE_SUBSCRIPTIONS
            || permissionId == PERMISSION_MANAGE_ENTITLEMENTS
            || permissionId == PERMISSION_MANAGE_TREASURY;
    }

    function _requireKnownRole(bytes32 roleId) internal pure {
        if (roleId != ROLE_MEMBER && roleId != ROLE_MODERATOR && roleId != ROLE_ADMIN) revert UnknownRole();
    }

    function _requireKnownAssignableRole(bytes32 roleId) internal pure {
        if (roleId != ROLE_MODERATOR && roleId != ROLE_ADMIN) revert UnknownRole();
    }

    function _clearPrivilegedRoles(bytes32 communityId, address member) internal {
        if (_roleAssignments[communityId][ROLE_ADMIN][member]) {
            _roleAssignments[communityId][ROLE_ADMIN][member] = false;
            emit RoleAssignmentChanged(communityId, ROLE_ADMIN, member, false, msg.sender);
        }
        if (_roleAssignments[communityId][ROLE_MODERATOR][member]) {
            _roleAssignments[communityId][ROLE_MODERATOR][member] = false;
            emit RoleAssignmentChanged(communityId, ROLE_MODERATOR, member, false, msg.sender);
        }
    }

    function _validateTreasuryReference(bytes32 treasuryAuthorityId, address treasury) internal pure {
        bool idMissing = treasuryAuthorityId == bytes32(0);
        bool addressMissing = treasury == address(0);
        if (idMissing != addressMissing) revert TreasuryReferenceInvalid();
    }

    function _subscriptionExpired(Subscription storage s) internal view returns (bool) {
        return s.expiresAt != 0 && s.expiresAt <= block.timestamp;
    }

    function _entitlementExpired(Entitlement storage e) internal view returns (bool) {
        return e.expiresAt != 0 && e.expiresAt <= block.timestamp;
    }
}
