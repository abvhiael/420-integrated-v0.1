// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/bonggoggles/BongGogglesIds420.sol";
import "../src/bonggoggles/BongGogglesAuthorization420.sol";
import "../src/bonggoggles/BongGogglesProfileRegistry420.sol";
import "../src/bonggoggles/BongGogglesRelationshipGraph420.sol";
import "../src/bonggoggles/BongGogglesCommunityRegistry420.sol";

interface VmBongGogglesCommunity420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract BongGogglesCommunityCapsMock420 is ICapabilityRegistry420 {
    function grant(bytes32) external pure override returns (CapabilityGrant memory capabilityGrant) { return capabilityGrant; }
    function isAuthorized(address, bytes32, bytes32, bytes32, uint256) external pure override returns (bool) { return false; }
}

contract BongGogglesCommunityRegistry420Test {
    VmBongGogglesCommunity420 constant vm = VmBongGogglesCommunity420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);
    address constant BIZ = address(0xB12);

    BongGogglesAuthorization420 auth;
    BongGogglesProfileRegistry420 profiles;
    BongGogglesRelationshipGraph420 relationships;
    BongGogglesCommunityRegistry420 community;

    function setUp() public {
        BongGogglesCommunityCapsMock420 caps = new BongGogglesCommunityCapsMock420();
        auth = new BongGogglesAuthorization420(address(caps));
        profiles = new BongGogglesProfileRegistry420(address(auth));
        relationships = new BongGogglesRelationshipGraph420(address(auth), address(profiles));
        community = new BongGogglesCommunityRegistry420(address(auth), address(profiles), address(relationships));
        _create(ALICE, BongGogglesTypes420.ProfileType.PERSONAL);
        _create(BOB, BongGogglesTypes420.ProfileType.PERSONAL);
        _create(BIZ, BongGogglesTypes420.ProfileType.BUSINESS);
    }

    function _create(address account, BongGogglesTypes420.ProfileType profileType) internal {
        vm.prank(account);
        profiles.createProfile(account, profileType, keccak256(abi.encode(account)), bytes32(0), bytes32(0), bytes32(0), bytes32(0));
    }

    function testPageRequiresPageEligibleProfile() public {
        vm.prank(ALICE);
        vm.expectRevert(BongGogglesCommunityRegistry420.InvalidPageProfile.selector);
        community.createPage(ALICE, ALICE, keccak256("bad-page"));

        vm.prank(ALICE);
        bytes32 pageId = community.createPage(ALICE, BIZ, keccak256("page"));
        BongGogglesCommunityRegistry420.Page memory p = community.page(pageId);
        require(p.exists && p.active && p.owner == ALICE && p.profileAccount == BIZ, "page binding");
    }

    function testOpenGroupAutoJoinsAndOwnerIsCanonicalOwner() public {
        vm.prank(ALICE);
        bytes32 groupId = community.createGroup(
            ALICE,
            BongGogglesTypes420.GroupPrivacy.PUBLIC,
            BongGogglesTypes420.GroupJoinPolicy.OPEN,
            keccak256("group")
        );
        BongGogglesCommunityRegistry420.GroupMember memory ownerMember = community.groupMember(groupId, ALICE);
        require(ownerMember.state == BongGogglesTypes420.GroupMemberState.ACTIVE, "owner inactive");
        require(ownerMember.role == BongGogglesTypes420.GroupRole.OWNER, "owner role missing");

        vm.prank(BOB);
        community.joinGroup(BOB, groupId);
        require(community.isActiveGroupMember(groupId, BOB), "open join failed");
    }

    function testApprovalGroupRequiresOwnerApproval() public {
        vm.prank(ALICE);
        bytes32 groupId = community.createGroup(
            ALICE,
            BongGogglesTypes420.GroupPrivacy.PRIVATE,
            BongGogglesTypes420.GroupJoinPolicy.APPROVAL_REQUIRED,
            keccak256("private-group")
        );
        vm.prank(BOB);
        community.joinGroup(BOB, groupId);
        require(community.groupMember(groupId, BOB).state == BongGogglesTypes420.GroupMemberState.PENDING, "not pending");
        vm.prank(ALICE);
        community.approveGroupMember(ALICE, groupId, BOB);
        require(community.isActiveGroupMember(groupId, BOB), "approval failed");
    }

    function testBlockPreventsGroupJoin() public {
        vm.prank(ALICE);
        bytes32 groupId = community.createGroup(
            ALICE,
            BongGogglesTypes420.GroupPrivacy.PUBLIC,
            BongGogglesTypes420.GroupJoinPolicy.OPEN,
            keccak256("group")
        );
        vm.prank(ALICE);
        relationships.blockUser(ALICE, BOB);
        vm.expectRevert(BongGogglesCommunityRegistry420.BlockedRelationship.selector);
        vm.prank(BOB);
        community.joinGroup(BOB, groupId);
    }

    function testPublicEventRSVPIsIntentOnlyState() public {
        vm.prank(ALICE);
        bytes32 eventId = community.createEvent(
            ALICE,
            BongGogglesTypes420.EventHostType.PROFILE,
            ALICE,
            bytes32(0),
            BongGogglesTypes420.EventVisibility.PUBLIC,
            keccak256("event"),
            100,
            200
        );
        vm.prank(BOB);
        community.setRSVP(BOB, eventId, BongGogglesTypes420.RSVPState.GOING);
        require(community.rsvp(eventId, BOB) == BongGogglesTypes420.RSVPState.GOING, "rsvp missing");
    }

    function testGroupOnlyEventRequiresActiveMembership() public {
        vm.prank(ALICE);
        bytes32 groupId = community.createGroup(
            ALICE,
            BongGogglesTypes420.GroupPrivacy.PRIVATE,
            BongGogglesTypes420.GroupJoinPolicy.APPROVAL_REQUIRED,
            keccak256("group")
        );
        vm.prank(ALICE);
        bytes32 eventId = community.createEvent(
            ALICE,
            BongGogglesTypes420.EventHostType.GROUP,
            address(0),
            groupId,
            BongGogglesTypes420.EventVisibility.GROUP_ONLY,
            keccak256("member-event"),
            100,
            200
        );
        vm.expectRevert(BongGogglesCommunityRegistry420.RSVPDenied.selector);
        vm.prank(BOB);
        community.setRSVP(BOB, eventId, BongGogglesTypes420.RSVPState.INTERESTED);

        vm.prank(BOB);
        community.joinGroup(BOB, groupId);
        vm.prank(ALICE);
        community.approveGroupMember(ALICE, groupId, BOB);
        vm.prank(BOB);
        community.setRSVP(BOB, eventId, BongGogglesTypes420.RSVPState.INTERESTED);
        require(community.rsvp(eventId, BOB) == BongGogglesTypes420.RSVPState.INTERESTED, "member rsvp failed");
    }

    function testInviteOnlyEventFailsClosedUntilInvitationLayer() public {
        vm.prank(ALICE);
        bytes32 eventId = community.createEvent(
            ALICE,
            BongGogglesTypes420.EventHostType.PROFILE,
            ALICE,
            bytes32(0),
            BongGogglesTypes420.EventVisibility.INVITE_ONLY,
            keccak256("invite-event"),
            100,
            200
        );
        vm.expectRevert(BongGogglesCommunityRegistry420.RSVPDenied.selector);
        vm.prank(BOB);
        community.setRSVP(BOB, eventId, BongGogglesTypes420.RSVPState.GOING);
    }
}
