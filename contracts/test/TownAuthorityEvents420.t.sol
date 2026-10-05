// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/town/TownAuthority420.sol";

interface VmTownAuthorityEvents420 {
    function prank(address) external;
    function expectEmit(bool, bool, bool, bool) external;
}

contract TownAuthorityEvents420Test {
    VmTownAuthorityEvents420 constant vm =
        VmTownAuthorityEvents420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant OWNER = address(0x4241);
    address constant USER = address(0x4242);
    address constant TREASURY = address(0x7788);
    bytes32 constant COMMUNITY = keccak256("town-community-events");
    bytes32 constant PLAN = keccak256("plan");
    bytes32 constant ENTITLEMENT = keccak256("entitlement");
    bytes32 constant TREASURY_AUTHORITY = keccak256("treasury-authority");

    TownAuthority420 town;

    event MembershipTransitioned(
        bytes32 indexed communityId,
        address indexed member,
        TownAuthority420.MembershipState previousState,
        TownAuthority420.MembershipState newState,
        address actor
    );
    event RolePermissionChanged(
        bytes32 indexed communityId,
        bytes32 indexed roleId,
        bytes32 indexed permissionId,
        bool enabled
    );
    event RoleAssignmentChanged(
        bytes32 indexed communityId,
        bytes32 indexed roleId,
        address indexed member,
        bool enabled,
        address actor
    );
    event SubscriptionTransitioned(
        bytes32 indexed communityId,
        address indexed subscriber,
        TownAuthority420.SubscriptionState previousState,
        TownAuthority420.SubscriptionState newState,
        bytes32 planId,
        uint64 expiresAt,
        uint64 revision,
        address actor
    );
    event EntitlementTransitioned(
        bytes32 indexed communityId,
        address indexed beneficiary,
        bytes32 indexed entitlementType,
        TownAuthority420.EntitlementState previousState,
        TownAuthority420.EntitlementState newState,
        uint64 expiresAt,
        uint64 revision,
        address actor
    );
    event TreasuryReferenceChanged(
        bytes32 indexed communityId,
        bytes32 indexed treasuryAuthorityId,
        address indexed treasury,
        uint64 revision,
        address actor
    );

    function setUp() public {
        town = new TownAuthority420();
        vm.prank(OWNER);
        town.createCommunity(COMMUNITY, keccak256("meta"), bytes32(0), address(0));
    }

    function testMembershipTransitionEventBindsActorAndScope() public {
        vm.expectEmit(true, true, false, true);
        emit MembershipTransitioned(
            COMMUNITY,
            USER,
            TownAuthority420.MembershipState.NONE,
            TownAuthority420.MembershipState.ACTIVE,
            USER
        );
        vm.prank(USER);
        town.joinCommunity(COMMUNITY);
    }

    function testRoleEventsBindCommunityRolePermissionAndActor() public {
        vm.expectEmit(true, true, true, true);
        emit RolePermissionChanged(
            COMMUNITY,
            town.ROLE_MODERATOR(),
            town.PERMISSION_MANAGE_MEMBERS(),
            true
        );
        vm.prank(OWNER);
        town.setRolePermission(COMMUNITY, town.ROLE_MODERATOR(), town.PERMISSION_MANAGE_MEMBERS(), true);

        vm.prank(USER);
        town.joinCommunity(COMMUNITY);

        vm.expectEmit(true, true, true, true);
        emit RoleAssignmentChanged(COMMUNITY, town.ROLE_MODERATOR(), USER, true, OWNER);
        vm.prank(OWNER);
        town.assignRole(COMMUNITY, town.ROLE_MODERATOR(), USER);
    }

    function testSubscriptionAndEntitlementEventsAreRevisioned() public {
        vm.prank(USER);
        town.joinCommunity(COMMUNITY);

        vm.expectEmit(true, true, false, true);
        emit SubscriptionTransitioned(
            COMMUNITY,
            USER,
            TownAuthority420.SubscriptionState.NONE,
            TownAuthority420.SubscriptionState.ACTIVE,
            PLAN,
            0,
            1,
            OWNER
        );
        vm.prank(OWNER);
        town.activateSubscription(COMMUNITY, USER, PLAN, 0);

        vm.expectEmit(true, true, true, true);
        emit EntitlementTransitioned(
            COMMUNITY,
            USER,
            ENTITLEMENT,
            TownAuthority420.EntitlementState.NONE,
            TownAuthority420.EntitlementState.ACTIVE,
            0,
            1,
            OWNER
        );
        vm.prank(OWNER);
        town.grantEntitlement(COMMUNITY, USER, ENTITLEMENT, 0);
    }

    function testTreasuryReferenceEventCarriesRevisionAndActor() public {
        vm.expectEmit(true, true, true, true);
        emit TreasuryReferenceChanged(COMMUNITY, TREASURY_AUTHORITY, TREASURY, 1, OWNER);
        vm.prank(OWNER);
        town.setTreasuryReference(COMMUNITY, TREASURY_AUTHORITY, TREASURY);
    }
}
