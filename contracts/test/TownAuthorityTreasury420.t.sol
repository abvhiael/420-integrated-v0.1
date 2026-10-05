// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/town/TownAuthority420.sol";

interface VmTownAuthorityTreasury420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract TownAuthorityTreasury420Test {
    VmTownAuthorityTreasury420 constant vm =
        VmTownAuthorityTreasury420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant OWNER = address(0x4231);
    address constant ADMIN = address(0x4232);
    address constant TREASURY_A = address(0x7771);
    address constant TREASURY_B = address(0x7772);
    bytes32 constant AUTH_A = keccak256("treasury-authority-a");
    bytes32 constant AUTH_B = keccak256("treasury-authority-b");
    bytes32 constant COMMUNITY = keccak256("town-community-treasury");

    TownAuthority420 town;

    function setUp() public {
        town = new TownAuthority420();
        vm.prank(OWNER);
        town.createCommunity(COMMUNITY, keccak256("meta"), AUTH_A, TREASURY_A);
        vm.prank(ADMIN);
        town.joinCommunity(COMMUNITY);
    }

    function testTreasuryReferenceRequiresPairedAuthorityAndAddress() public {
        vm.prank(OWNER);
        vm.expectRevert(TownAuthority420.TreasuryReferenceInvalid.selector);
        town.setTreasuryReference(COMMUNITY, AUTH_B, address(0));

        vm.prank(OWNER);
        vm.expectRevert(TownAuthority420.TreasuryReferenceInvalid.selector);
        town.setTreasuryReference(COMMUNITY, bytes32(0), TREASURY_B);
    }

    function testTreasuryReferenceIsPermissionScopedAndRevisioned() public {
        vm.prank(ADMIN);
        vm.expectRevert(TownAuthority420.Unauthorized.selector);
        town.setTreasuryReference(COMMUNITY, AUTH_B, TREASURY_B);

        vm.prank(OWNER);
        town.assignRole(COMMUNITY, town.ROLE_ADMIN(), ADMIN);
        vm.prank(OWNER);
        town.setRolePermission(COMMUNITY, town.ROLE_ADMIN(), town.PERMISSION_MANAGE_TREASURY(), true);

        vm.prank(ADMIN);
        town.setTreasuryReference(COMMUNITY, AUTH_B, TREASURY_B);

        TownAuthority420.Community memory c = town.community(COMMUNITY);
        require(c.treasuryAuthorityId == AUTH_B, "authority updated");
        require(c.treasury == TREASURY_B, "treasury updated");
        require(c.treasuryRevision == 2, "revision advanced");
    }

    function testTownAuthorityHasNoValueCustodyPath() public {
        (bool ok,) = address(town).call{value: 1}("");
        require(!ok, "plain value transfer must fail");
    }

    receive() external payable {}
}
