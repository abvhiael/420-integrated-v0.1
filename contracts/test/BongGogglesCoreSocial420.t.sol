// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/bonggoggles/BongGogglesIds420.sol";
import "../src/bonggoggles/BongGogglesAuthorization420.sol";
import "../src/bonggoggles/BongGogglesProfileRegistry420.sol";
import "../src/bonggoggles/BongGogglesRelationshipGraph420.sol";
import "../src/bonggoggles/BongGogglesSocialPolicy420.sol";
import "../src/bonggoggles/BongGogglesMediaRegistry420.sol";
import "../src/bonggoggles/BongGogglesSocialObjectRegistry420.sol";

interface VmBongGoggles420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
    function warp(uint256) external;
}

contract BongGogglesCapabilitiesMock420 is ICapabilityRegistry420 {
    mapping(bytes32 => bool) internal allowed;
    function set(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, uint256 amount, bool value) external { allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash, amount))] = value; }
    function grant(bytes32) external pure override returns (CapabilityGrant memory capabilityGrant) { return capabilityGrant; }
    function isAuthorized(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, uint256 amount) external view override returns (bool) { return allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash, amount))]; }
}

contract BongGogglesCoreSocial420Test {
    VmBongGoggles420 constant vm = VmBongGoggles420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);
    address constant CAROL = address(0xCA401);
    address constant DELEGATE = address(0xD311);

    BongGogglesCapabilitiesMock420 caps;
    BongGogglesAuthorization420 auth;
    BongGogglesProfileRegistry420 profiles;
    BongGogglesRelationshipGraph420 graph;
    BongGogglesSocialPolicy420 policy;
    BongGogglesMediaRegistry420 media;
    BongGogglesSocialObjectRegistry420 objects;

    function setUp() public {
        caps = new BongGogglesCapabilitiesMock420();
        auth = new BongGogglesAuthorization420(address(caps));
        profiles = new BongGogglesProfileRegistry420(address(auth));
        graph = new BongGogglesRelationshipGraph420(address(auth), address(profiles));
        policy = new BongGogglesSocialPolicy420(address(profiles), address(graph));
        media = new BongGogglesMediaRegistry420(address(auth), address(profiles));
        objects = new BongGogglesSocialObjectRegistry420(address(auth), address(profiles), address(policy), address(media));
        _create(ALICE); _create(BOB); _create(CAROL);
    }

    function _create(address user) internal {
        vm.prank(user);
        profiles.createProfile(user, BongGogglesTypes420.ProfileType.PERSONAL, keccak256(abi.encode(user)), bytes32(0), bytes32(0), bytes32(0), bytes32(0));
    }

    function _friend(address a, address b) internal returns (bytes32 requestId) {
        vm.prank(a); requestId = graph.requestFriend(a, b);
        vm.prank(b); graph.acceptFriend(b, requestId);
    }

    function testProfileIdIsDeterministicAndUniquePerAccount() public view {
        require(profiles.profileIdFor(ALICE) == profiles.profile(ALICE).profileId, "alice profile id");
        require(profiles.profileIdFor(ALICE) != profiles.profileIdFor(BOB), "profile collision");
    }

    function testDelegatedCapabilityIsAccountScoped() public {
        caps.set(DELEGATE, BongGogglesIds420.COMPONENT_BONG_GOGGLES, BongGogglesIds420.ACTION_PROFILE_UPDATE, auth.scopeForAccount(ALICE), 0, true);
        vm.prank(DELEGATE);
        profiles.updateProfile(ALICE, BongGogglesTypes420.ProfileType.CREATOR, keccak256("alice2"), bytes32(0), bytes32(0), bytes32(0), bytes32(0));
        require(profiles.profile(ALICE).profileType == BongGogglesTypes420.ProfileType.CREATOR, "delegate update");
        vm.expectRevert(BongGogglesProfileRegistry420.Unauthorized.selector);
        vm.prank(DELEGATE);
        profiles.updateProfile(BOB, BongGogglesTypes420.ProfileType.CREATOR, keccak256("bob2"), bytes32(0), bytes32(0), bytes32(0), bytes32(0));
    }

    function testFriendshipRequiresRecipientAcceptanceAndIsSymmetric() public {
        vm.prank(ALICE); bytes32 requestId = graph.requestFriend(ALICE, BOB);
        require(!graph.areFriends(ALICE, BOB), "premature friendship");
        vm.prank(BOB); graph.acceptFriend(BOB, requestId);
        require(graph.areFriends(ALICE, BOB) && graph.areFriends(BOB, ALICE), "friendship not symmetric");
    }

    function testFollowIsDirectionalAndIndependentOfFriendship() public {
        vm.prank(ALICE); graph.follow(ALICE, BOB);
        require(graph.isFollowing(ALICE, BOB), "missing follow");
        require(!graph.isFollowing(BOB, ALICE), "reverse follow invented");
        _friend(ALICE, BOB);
        vm.prank(ALICE); graph.removeFriend(ALICE, BOB);
        require(graph.isFollowing(ALICE, BOB), "friend removal killed follow");
    }

    function testBlockTerminatesFriendshipAndBothFollowDirections() public {
        _friend(ALICE, BOB);
        vm.prank(ALICE); graph.follow(ALICE, BOB);
        vm.prank(BOB); graph.follow(BOB, ALICE);
        vm.prank(ALICE); graph.blockUser(ALICE, BOB);
        require(graph.isBlockedEither(ALICE, BOB), "block absent");
        require(!graph.areFriends(ALICE, BOB), "friendship survived block");
        require(!graph.isFollowing(ALICE, BOB) && !graph.isFollowing(BOB, ALICE), "follow survived block");
    }

    function testUnblockDoesNotRestoreRelationships() public {
        _friend(ALICE, BOB);
        vm.prank(ALICE); graph.follow(ALICE, BOB);
        vm.prank(ALICE); graph.blockUser(ALICE, BOB);
        vm.prank(ALICE); graph.unblockUser(ALICE, BOB);
        require(!graph.areFriends(ALICE, BOB), "friendship restored");
        require(!graph.isFollowing(ALICE, BOB), "follow restored");
    }

    function testMuteDoesNotDestroyRelationshipAndCanExpire() public {
        _friend(ALICE, BOB);
        vm.prank(ALICE); graph.muteUser(ALICE, BOB, BongGogglesTypes420.MUTE_GAME_INVITES, uint64(block.timestamp + 1 days));
        require(graph.areFriends(ALICE, BOB), "mute destroyed friendship");
        require(graph.isMuted(ALICE, BOB, BongGogglesTypes420.MUTE_GAME_INVITES), "mute absent");
        vm.warp(block.timestamp + 2 days);
        require(!graph.isMuted(ALICE, BOB, BongGogglesTypes420.MUTE_GAME_INVITES), "mute did not expire");
    }

    function testBlockOverridesPublicAudienceAndGamePolicy() public {
        BongGogglesTypes420.AudiencePolicy memory audience = BongGogglesTypes420.AudiencePolicy(BongGogglesTypes420.AudienceType.PUBLIC, bytes32(0));
        require(policy.canView(ALICE, BOB, audience), "public should be visible");
        vm.prank(ALICE); graph.blockUser(ALICE, BOB);
        require(!policy.canView(ALICE, BOB, audience), "block failed visibility");
        require(!policy.canInviteToGame(ALICE, BOB), "block failed game invite");
    }

    function testGuestCanViewPublicAudience() public view {
        BongGogglesTypes420.AudiencePolicy memory audience = BongGogglesTypes420.AudiencePolicy(BongGogglesTypes420.AudienceType.PUBLIC, bytes32(0));
        require(policy.canView(address(0), ALICE, audience), "guest public read denied");
    }

    function testCommentInheritsParentAudience() public {
        _friend(ALICE, BOB);
        BongGogglesTypes420.AudiencePolicy memory friendsOnly = BongGogglesTypes420.AudiencePolicy(BongGogglesTypes420.AudienceType.FRIENDS, bytes32(0));
        vm.prank(ALICE);
        bytes32 postId = objects.publish(ALICE, BongGogglesTypes420.SocialObjectType.STATUS, bytes32(0), bytes32(0), bytes32(0), keccak256("post"), bytes32(0), friendsOnly);
        BongGogglesTypes420.AudiencePolicy memory attemptedPublic = BongGogglesTypes420.AudiencePolicy(BongGogglesTypes420.AudienceType.PUBLIC, bytes32(0));
        vm.prank(BOB);
        bytes32 commentId = objects.publish(BOB, BongGogglesTypes420.SocialObjectType.COMMENT, postId, bytes32(0), bytes32(0), keccak256("comment"), bytes32(0), attemptedPublic);
        BongGogglesSocialObjectRegistry420.SocialObject memory c = objects.socialObject(commentId);
        require(c.audienceType == BongGogglesTypes420.AudienceType.FRIENDS, "comment escalated audience");
        require(c.rootId == postId, "wrong root");
    }

    function testOutsiderCannotCommentOnFriendsOnlyParent() public {
        _friend(ALICE, BOB);
        BongGogglesTypes420.AudiencePolicy memory friendsOnly = BongGogglesTypes420.AudiencePolicy(BongGogglesTypes420.AudienceType.FRIENDS, bytes32(0));
        vm.prank(ALICE);
        bytes32 postId = objects.publish(ALICE, BongGogglesTypes420.SocialObjectType.STATUS, bytes32(0), bytes32(0), bytes32(0), keccak256("post"), bytes32(0), friendsOnly);
        vm.expectRevert(BongGogglesSocialObjectRegistry420.ParentInteractionDenied.selector);
        vm.prank(CAROL);
        objects.publish(CAROL, BongGogglesTypes420.SocialObjectType.COMMENT, postId, bytes32(0), bytes32(0), keccak256("comment"), bytes32(0), friendsOnly);
    }

    function testNonCommentParentPointerFailsClosed() public {
        BongGogglesTypes420.AudiencePolicy memory audience = BongGogglesTypes420.AudiencePolicy(BongGogglesTypes420.AudienceType.PUBLIC, bytes32(0));
        vm.prank(ALICE);
        bytes32 postId = objects.publish(ALICE, BongGogglesTypes420.SocialObjectType.STATUS, bytes32(0), bytes32(0), bytes32(0), keccak256("post"), bytes32(0), audience);
        vm.expectRevert(BongGogglesSocialObjectRegistry420.InvalidParent.selector);
        vm.prank(BOB);
        objects.publish(BOB, BongGogglesTypes420.SocialObjectType.STATUS, postId, bytes32(0), bytes32(0), keccak256("repost-like"), bytes32(0), audience);
    }

    function testEditPreservesVersionHashesAndDeletePreservesObject() public {
        BongGogglesTypes420.AudiencePolicy memory audience = BongGogglesTypes420.AudiencePolicy(BongGogglesTypes420.AudienceType.PUBLIC, bytes32(0));
        bytes32 v1 = keccak256("v1"); bytes32 v2 = keccak256("v2");
        vm.prank(ALICE); bytes32 objectId = objects.publish(ALICE, BongGogglesTypes420.SocialObjectType.STATUS, bytes32(0), bytes32(0), bytes32(0), v1, bytes32(0), audience);
        vm.prank(ALICE); objects.edit(ALICE, objectId, v2, bytes32(0));
        require(objects.contentHashAtVersion(objectId, 1) == v1, "v1 lost");
        require(objects.contentHashAtVersion(objectId, 2) == v2, "v2 missing");
        vm.prank(ALICE); objects.deleteObject(ALICE, objectId);
        BongGogglesSocialObjectRegistry420.SocialObject memory o = objects.socialObject(objectId);
        require(o.exists && o.status == BongGogglesTypes420.SocialObjectStatus.DELETED, "delete provenance/status");
    }

    function testSelfRelationshipsFailClosed() public {
        vm.expectRevert(BongGogglesRelationshipGraph420.SelfRelationship.selector);
        vm.prank(ALICE); graph.follow(ALICE, ALICE);
        vm.expectRevert(BongGogglesRelationshipGraph420.SelfRelationship.selector);
        vm.prank(ALICE); graph.requestFriend(ALICE, ALICE);
    }
}
