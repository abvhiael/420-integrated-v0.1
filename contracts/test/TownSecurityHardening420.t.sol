// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/town/TownAuthority420.sol";

interface VmTownSecurityHardening420 {
    function prank(address) external;
    function startPrank(address) external;
    function stopPrank() external;
    function expectRevert(bytes4) external;
}

contract TownSecurityHardening420Test {
    VmTownSecurityHardening420 constant vm =
        VmTownSecurityHardening420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant OWNER = address(0x4291);
    address constant ADMIN = address(0x4292);
    address constant MOD = address(0x4293);
    address constant USER = address(0x4294);
    address constant TREASURY = address(0x4295);

    bytes32 constant COMMUNITY = keccak256("town-security-community");
    bytes32 constant TREASURY_AUTHORITY = keccak256("town-security-treasury");

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

    function testFuzzNonOwnerCannotMutateAuthority(address attacker, bytes32 arbitraryPermission) public {
        if (attacker == OWNER) return;

        bytes32 adminRole = town.ROLE_ADMIN();
        vm.startPrank(attacker);

        vm.expectRevert(TownAuthority420.Unauthorized.selector);
        town.setRolePermission(COMMUNITY, adminRole, arbitraryPermission, true);

        vm.expectRevert(TownAuthority420.Unauthorized.selector);
        town.setTreasuryReference(COMMUNITY, TREASURY_AUTHORITY, TREASURY);

        vm.expectRevert(TownAuthority420.Unauthorized.selector);
        town.removeMember(COMMUNITY, USER);

        vm.stopPrank();
    }

    function testFuzzRoleAuthorityCannotCrossCommunity(bytes32 otherCommunity) public {
        if (otherCommunity == bytes32(0) || otherCommunity == COMMUNITY) return;

        bytes32 adminRole = town.ROLE_ADMIN();
        bytes32 manageMembers = town.PERMISSION_MANAGE_MEMBERS();

        vm.prank(OWNER);
        town.assignRole(COMMUNITY, adminRole, ADMIN);
        vm.prank(OWNER);
        town.setRolePermission(COMMUNITY, adminRole, manageMembers, true);

        vm.prank(OWNER);
        town.createCommunity(otherCommunity, keccak256("other-meta"), bytes32(0), address(0));

        require(town.hasPermission(COMMUNITY, ADMIN, manageMembers), "source permission missing");
        require(!town.hasPermission(otherCommunity, ADMIN, manageMembers), "cross-community permission leak");
    }

    function testPrivilegedRoleDoesNotResurrectAfterRemovalAndReAdd() public {
        bytes32 moderatorRole = town.ROLE_MODERATOR();
        bytes32 manageMembers = town.PERMISSION_MANAGE_MEMBERS();

        vm.prank(OWNER);
        town.assignRole(COMMUNITY, moderatorRole, MOD);
        vm.prank(OWNER);
        town.setRolePermission(COMMUNITY, moderatorRole, manageMembers, true);
        require(town.hasPermission(COMMUNITY, MOD, manageMembers), "moderator permission missing");

        vm.prank(OWNER);
        town.removeMember(COMMUNITY, MOD);
        vm.prank(OWNER);
        town.addMember(COMMUNITY, MOD);

        require(!town.hasRole(COMMUNITY, moderatorRole, MOD), "moderator role resurrected");
        require(!town.hasPermission(COMMUNITY, MOD, manageMembers), "moderator permission resurrected");
    }

    function testTreasurySurfaceRemainsReferenceOnlyAndNonPayable() public {
        vm.prank(OWNER);
        town.setTreasuryReference(COMMUNITY, TREASURY_AUTHORITY, TREASURY);

        (bool ok,) = address(town).call{value: 1}("");
        require(!ok, "Town authority unexpectedly accepted value");

        TownAuthority420.Community memory c = town.community(COMMUNITY);
        require(c.treasury == TREASURY, "treasury reference lost");
        require(c.treasuryAuthorityId == TREASURY_AUTHORITY, "treasury authority reference lost");
    }

    receive() external payable {}
}
