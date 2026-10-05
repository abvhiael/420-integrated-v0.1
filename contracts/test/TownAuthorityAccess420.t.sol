// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/town/TownAuthority420.sol";

interface VmTownAuthorityAccess420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract TownAuthorityAccess420Test {
    VmTownAuthorityAccess420 constant vm =
        VmTownAuthorityAccess420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant OWNER = address(0x4211);
    address constant ADMIN = address(0x4212);
    address constant MOD = address(0x4213);
    address constant USER = address(0x4214);
    bytes32 constant COMMUNITY = keccak256("town-community-access");

    TownAuthority420 town;

    function setUp() public {
        town = new TownAuthority420();
        vm.prank(OWNER);
        town.createCommunity(COMMUNITY, keccak256("meta"), bytes32(0), address(0));

        vm.prank(ADMIN);
        town.joinCommunity(COMMUNITY);
        vm.prank(MOD);
        town.joinCommunity(COMMUNITY);
        vm.prank(USER);
        town.joinCommunity(COMMUNITY);
    }

    function testDefaultDenyForNonOwner() public view {
        require(!town.hasPermission(COMMUNITY, ADMIN, town.PERMISSION_MANAGE_MEMBERS()), "default deny members");
        require(!town.hasPermission(COMMUNITY, MOD, town.PERMISSION_MANAGE_ROLES()), "default deny roles");
        require(town.hasPermission(COMMUNITY, OWNER, town.PERMISSION_MANAGE_TREASURY()), "owner authority");
    }

    function testOwnerCanGrantBoundedRolePermissionAndAdminCanAct() public {
        vm.prank(OWNER);
        town.assignRole(COMMUNITY, town.ROLE_ADMIN(), ADMIN);

        vm.prank(OWNER);
        town.setRolePermission(COMMUNITY, town.ROLE_ADMIN(), town.PERMISSION_MANAGE_MEMBERS(), true);

        require(town.hasPermission(COMMUNITY, ADMIN, town.PERMISSION_MANAGE_MEMBERS()), "admin permission");

        vm.prank(ADMIN);
        town.removeMember(COMMUNITY, USER);
        TownAuthority420.Membership memory m = town.membership(COMMUNITY, USER);
        require(m.state == TownAuthority420.MembershipState.REMOVED, "admin removed");
    }

    function testAdminCannotSelfEscalateRolePermissionsOrGrantAdmin() public {
        vm.prank(OWNER);
        town.assignRole(COMMUNITY, town.ROLE_ADMIN(), ADMIN);

        vm.prank(ADMIN);
        vm.expectRevert(TownAuthority420.Unauthorized.selector);
        town.setRolePermission(COMMUNITY, town.ROLE_ADMIN(), town.PERMISSION_MANAGE_ROLES(), true);

        vm.prank(OWNER);
        town.setRolePermission(COMMUNITY, town.ROLE_ADMIN(), town.PERMISSION_MANAGE_ROLES(), true);

        vm.prank(ADMIN);
        vm.expectRevert(TownAuthority420.Unauthorized.selector);
        town.assignRole(COMMUNITY, town.ROLE_ADMIN(), MOD);
    }

    function testScopedRoleCannotCrossCommunity() public {
        bytes32 other = keccak256("other-community");
        vm.prank(OWNER);
        town.createCommunity(other, keccak256("other-meta"), bytes32(0), address(0));

        vm.prank(OWNER);
        town.assignRole(COMMUNITY, town.ROLE_ADMIN(), ADMIN);
        vm.prank(OWNER);
        town.setRolePermission(COMMUNITY, town.ROLE_ADMIN(), town.PERMISSION_MANAGE_MEMBERS(), true);

        require(town.hasPermission(COMMUNITY, ADMIN, town.PERMISSION_MANAGE_MEMBERS()), "permission in scope");
        require(!town.hasPermission(other, ADMIN, town.PERMISSION_MANAGE_MEMBERS()), "no cross-scope permission");
    }

    function testLeavingClearsPrivilegedRolesAndRejoinDoesNotRestoreThem() public {
        vm.prank(OWNER);
        town.assignRole(COMMUNITY, town.ROLE_MODERATOR(), MOD);
        vm.prank(OWNER);
        town.setRolePermission(COMMUNITY, town.ROLE_MODERATOR(), town.PERMISSION_MANAGE_MEMBERS(), true);
        require(town.hasPermission(COMMUNITY, MOD, town.PERMISSION_MANAGE_MEMBERS()), "moderator permission");

        vm.prank(MOD);
        town.leaveCommunity(COMMUNITY);
        require(!town.hasRole(COMMUNITY, town.ROLE_MODERATOR(), MOD), "role cleared on leave");

        vm.prank(MOD);
        town.joinCommunity(COMMUNITY);
        require(!town.hasPermission(COMMUNITY, MOD, town.PERMISSION_MANAGE_MEMBERS()), "role not resurrected");
    }

    function testUnknownPermissionFailsClosed() public view {
        require(!town.hasPermission(COMMUNITY, OWNER, keccak256("UNKNOWN")), "unknown permission denied");
    }
}
