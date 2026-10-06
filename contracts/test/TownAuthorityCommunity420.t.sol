// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/town/TownAuthority420.sol";

interface VmTownAuthorityCommunity420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract TownAuthorityCommunity420Test {
    VmTownAuthorityCommunity420 constant vm =
        VmTownAuthorityCommunity420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant OWNER = address(0x4201);
    address constant ALICE = address(0x4202);
    address constant BOB = address(0x4203);
    bytes32 constant COMMUNITY = keccak256("town-community-1");

    TownAuthority420 town;

    function setUp() public {
        town = new TownAuthority420();
        vm.prank(OWNER);
        town.createCommunity(COMMUNITY, keccak256("meta-v1"), bytes32(0), address(0));
    }

    function testCreateCommunityEstablishesOwnerAndActiveMembership() public view {
        TownAuthority420.Community memory c = town.community(COMMUNITY);
        TownAuthority420.Membership memory m = town.membership(COMMUNITY, OWNER);
        require(c.exists, "community exists");
        require(c.owner == OWNER, "owner");
        require(m.state == TownAuthority420.MembershipState.ACTIVE, "owner active");
        require(town.hasRole(COMMUNITY, town.ROLE_MEMBER(), OWNER), "owner member");
    }

    function testDuplicateCommunityRejected() public {
        vm.prank(BOB);
        vm.expectRevert(TownAuthority420.CommunityExists.selector);
        town.createCommunity(COMMUNITY, keccak256("other"), bytes32(0), address(0));
    }

    function testJoinLeaveAndRejoinLifecycle() public {
        vm.prank(ALICE);
        town.joinCommunity(COMMUNITY);
        TownAuthority420.Membership memory active = town.membership(COMMUNITY, ALICE);
        require(active.state == TownAuthority420.MembershipState.ACTIVE, "active");

        vm.prank(ALICE);
        town.leaveCommunity(COMMUNITY);
        TownAuthority420.Membership memory left = town.membership(COMMUNITY, ALICE);
        require(left.state == TownAuthority420.MembershipState.LEFT, "left");

        vm.prank(ALICE);
        town.joinCommunity(COMMUNITY);
        TownAuthority420.Membership memory rejoined = town.membership(COMMUNITY, ALICE);
        require(rejoined.state == TownAuthority420.MembershipState.ACTIVE, "rejoined");
    }

    function testRemovedMemberCannotSelfRejoinButOwnerCanReinstate() public {
        vm.prank(ALICE);
        town.joinCommunity(COMMUNITY);

        vm.prank(OWNER);
        town.removeMember(COMMUNITY, ALICE);

        vm.prank(ALICE);
        vm.expectRevert(TownAuthority420.InvalidTransition.selector);
        town.joinCommunity(COMMUNITY);

        vm.prank(OWNER);
        town.addMember(COMMUNITY, ALICE);
        TownAuthority420.Membership memory m = town.membership(COMMUNITY, ALICE);
        require(m.state == TownAuthority420.MembershipState.ACTIVE, "reinstated");
    }

    function testOwnerCannotLeaveOrBeRemoved() public {
        vm.prank(OWNER);
        vm.expectRevert(TownAuthority420.OwnerInvariant.selector);
        town.leaveCommunity(COMMUNITY);

        vm.prank(OWNER);
        vm.expectRevert(TownAuthority420.OwnerInvariant.selector);
        town.removeMember(COMMUNITY, OWNER);
    }

    function testOwnershipTransferRequiresActiveMemberAndPreservesOldOwnerMembership() public {
        vm.prank(OWNER);
        vm.expectRevert(TownAuthority420.InvalidTransition.selector);
        town.transferCommunityOwnership(COMMUNITY, ALICE);

        vm.prank(ALICE);
        town.joinCommunity(COMMUNITY);

        vm.prank(OWNER);
        town.transferCommunityOwnership(COMMUNITY, ALICE);

        TownAuthority420.Community memory c = town.community(COMMUNITY);
        require(c.owner == ALICE, "new owner");
        TownAuthority420.Membership memory oldOwner = town.membership(COMMUNITY, OWNER);
        require(oldOwner.state == TownAuthority420.MembershipState.ACTIVE, "old owner remains member");

        vm.prank(OWNER);
        town.leaveCommunity(COMMUNITY);
        TownAuthority420.Membership memory left = town.membership(COMMUNITY, OWNER);
        require(left.state == TownAuthority420.MembershipState.LEFT, "old owner can leave");
    }
}
