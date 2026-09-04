// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/bonggoggles/BongGogglesIds420.sol";
import "../src/bonggoggles/BongGogglesAuthorization420.sol";
import "../src/bonggoggles/BongGogglesProfileRegistry420.sol";
import "../src/bonggoggles/BongGogglesRelationshipGraph420.sol";
import "../src/bonggoggles/BongGogglesSocialPolicy420.sol";
import "../src/bonggoggles/BongGogglesSocialObjectRegistry420.sol";
import "../src/bonggoggles/BongGogglesMediaRegistry420.sol";
import "../src/bonggoggles/BongGogglesReactionRegistry420.sol";

interface VmBongGogglesPublishing420 { function prank(address) external; function expectRevert(bytes4) external; }

contract BongGogglesPublishingCapsMock420 is ICapabilityRegistry420 {
    mapping(bytes32 => bool) internal allowed;
    function grant(bytes32) external pure override returns (CapabilityGrant memory capabilityGrant) { return capabilityGrant; }
    function isAuthorized(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, uint256 amount) external view override returns (bool) { return allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash, amount))]; }
}

contract BongGogglesPublishingMedia420Test {
    VmBongGogglesPublishing420 constant vm = VmBongGogglesPublishing420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);
    address constant CAROL = address(0xCA401);

    BongGogglesAuthorization420 auth;
    BongGogglesProfileRegistry420 profiles;
    BongGogglesRelationshipGraph420 graph;
    BongGogglesSocialPolicy420 policy;
    BongGogglesSocialObjectRegistry420 objects;
    BongGogglesMediaRegistry420 media;
    BongGogglesReactionRegistry420 reactions;

    function setUp() public {
        BongGogglesPublishingCapsMock420 caps = new BongGogglesPublishingCapsMock420();
        auth = new BongGogglesAuthorization420(address(caps));
        profiles = new BongGogglesProfileRegistry420(address(auth));
        graph = new BongGogglesRelationshipGraph420(address(auth), address(profiles));
        policy = new BongGogglesSocialPolicy420(address(profiles), address(graph));
        media = new BongGogglesMediaRegistry420(address(auth), address(profiles));
        objects = new BongGogglesSocialObjectRegistry420(address(auth), address(profiles), address(policy), address(media));
        reactions = new BongGogglesReactionRegistry420(address(auth), address(profiles), address(objects), address(policy));
        _create(ALICE); _create(BOB); _create(CAROL);
    }

    function _create(address user) internal {
        vm.prank(user);
        profiles.createProfile(user, BongGogglesTypes420.ProfileType.PERSONAL, keccak256(abi.encode(user)), bytes32(0), bytes32(0), bytes32(0), bytes32(0));
    }

    function _post(address author) internal returns (bytes32) {
        return _postWithAudience(author, BongGogglesTypes420.AudienceType.PUBLIC);
    }

    function _postWithAudience(address author, BongGogglesTypes420.AudienceType audienceType) internal returns (bytes32) {
        BongGogglesTypes420.AudiencePolicy memory audience = BongGogglesTypes420.AudiencePolicy(audienceType, bytes32(0));
        vm.prank(author);
        return objects.publish(author, BongGogglesTypes420.SocialObjectType.STATUS, bytes32(0), bytes32(0), bytes32(0), keccak256("post"), bytes32(0), audience);
    }

    function _friend(address a, address b) internal {
        vm.prank(a);
        bytes32 requestId = graph.requestFriend(a, b);
        vm.prank(b);
        graph.acceptFriend(b, requestId);
    }

    function testMediaManifestBindsOwnerAndContent() public {
        bytes32 manifestHash = keccak256("manifest");
        vm.prank(ALICE);
        bytes32 root = media.registerManifest(ALICE, BongGogglesTypes420.MediaType.IMAGE, manifestHash, 3);
        BongGogglesMediaRegistry420.MediaManifest memory m = media.mediaManifest(root);
        require(m.exists && m.owner == ALICE && m.manifestHash == manifestHash && m.itemCount == 3, "manifest binding");
        require(media.isValidManifest(root, ALICE), "owner validation failed");
        require(!media.isValidManifest(root, BOB), "foreign owner validated");
    }

    function testMediaRejectsEmptyManifest() public {
        vm.expectRevert(BongGogglesMediaRegistry420.InvalidManifest.selector);
        vm.prank(ALICE);
        media.registerManifest(ALICE, BongGogglesTypes420.MediaType.IMAGE, bytes32(0), 1);
    }

    function testPublishingAcceptsOwnedMediaManifest() public {
        vm.prank(ALICE);
        bytes32 root = media.registerManifest(ALICE, BongGogglesTypes420.MediaType.IMAGE, keccak256("alice-image"), 1);
        BongGogglesTypes420.AudiencePolicy memory audience = BongGogglesTypes420.AudiencePolicy(BongGogglesTypes420.AudienceType.PUBLIC, bytes32(0));
        vm.prank(ALICE);
        bytes32 objectId = objects.publish(ALICE, BongGogglesTypes420.SocialObjectType.PHOTO_POST, bytes32(0), bytes32(0), bytes32(0), keccak256("photo"), root, audience);
        require(objects.socialObject(objectId).mediaRoot == root, "media root not bound");
    }

    function testPublishingRejectsForeignMediaManifest() public {
        vm.prank(ALICE);
        bytes32 root = media.registerManifest(ALICE, BongGogglesTypes420.MediaType.IMAGE, keccak256("alice-image"), 1);
        BongGogglesTypes420.AudiencePolicy memory audience = BongGogglesTypes420.AudiencePolicy(BongGogglesTypes420.AudienceType.PUBLIC, bytes32(0));
        vm.expectRevert(BongGogglesSocialObjectRegistry420.InvalidMediaRoot.selector);
        vm.prank(BOB);
        objects.publish(BOB, BongGogglesTypes420.SocialObjectType.PHOTO_POST, bytes32(0), bytes32(0), bytes32(0), keccak256("stolen-photo"), root, audience);
    }

    function testReactionSetReplacesSingleActiveReaction() public {
        bytes32 objectId = _post(ALICE);
        vm.prank(BOB); reactions.setReaction(BOB, objectId, BongGogglesTypes420.ReactionType.LIKE);
        require(reactions.reaction(objectId, BOB).reactionType == BongGogglesTypes420.ReactionType.LIKE, "like missing");
        vm.prank(BOB); reactions.setReaction(BOB, objectId, BongGogglesTypes420.ReactionType.LOVE);
        require(reactions.reaction(objectId, BOB).reactionType == BongGogglesTypes420.ReactionType.LOVE, "reaction not replaced");
    }

    function testReactionCanBeCleared() public {
        bytes32 objectId = _post(ALICE);
        vm.prank(BOB); reactions.setReaction(BOB, objectId, BongGogglesTypes420.ReactionType.SUPPORT);
        vm.prank(BOB); reactions.clearReaction(BOB, objectId);
        require(reactions.reaction(objectId, BOB).reactionType == BongGogglesTypes420.ReactionType.NONE, "reaction survived clear");
    }

    function testBlockDeniesReaction() public {
        bytes32 objectId = _post(ALICE);
        vm.prank(ALICE); graph.blockUser(ALICE, BOB);
        vm.expectRevert(BongGogglesReactionRegistry420.AudienceDenied.selector);
        vm.prank(BOB); reactions.setReaction(BOB, objectId, BongGogglesTypes420.ReactionType.LIKE);
    }

    function testDeletedObjectDeniesReaction() public {
        bytes32 objectId = _post(ALICE);
        vm.prank(ALICE); objects.deleteObject(ALICE, objectId);
        vm.expectRevert(BongGogglesReactionRegistry420.ObjectUnavailable.selector);
        vm.prank(BOB); reactions.setReaction(BOB, objectId, BongGogglesTypes420.ReactionType.LIKE);
    }

    function testHiddenObjectDeniesNewReaction() public {
        bytes32 objectId = _post(ALICE);
        vm.prank(ALICE); objects.hide(ALICE, objectId);
        vm.expectRevert(BongGogglesReactionRegistry420.ObjectUnavailable.selector);
        vm.prank(BOB); reactions.setReaction(BOB, objectId, BongGogglesTypes420.ReactionType.LIKE);
    }

    function testFriendsOnlyReactionRequiresFriendAudienceEligibility() public {
        bytes32 objectId = _postWithAudience(ALICE, BongGogglesTypes420.AudienceType.FRIENDS);
        vm.expectRevert(BongGogglesReactionRegistry420.AudienceDenied.selector);
        vm.prank(BOB); reactions.setReaction(BOB, objectId, BongGogglesTypes420.ReactionType.LIKE);

        _friend(ALICE, BOB);
        vm.prank(BOB); reactions.setReaction(BOB, objectId, BongGogglesTypes420.ReactionType.LIKE);
        require(reactions.reaction(objectId, BOB).reactionType == BongGogglesTypes420.ReactionType.LIKE, "friend reaction denied");
    }

    function testFollowersOnlyReactionRequiresFollowAudienceEligibility() public {
        bytes32 objectId = _postWithAudience(ALICE, BongGogglesTypes420.AudienceType.FOLLOWERS);
        vm.expectRevert(BongGogglesReactionRegistry420.AudienceDenied.selector);
        vm.prank(CAROL); reactions.setReaction(CAROL, objectId, BongGogglesTypes420.ReactionType.LIKE);

        vm.prank(BOB); graph.follow(BOB, ALICE);
        vm.prank(BOB); reactions.setReaction(BOB, objectId, BongGogglesTypes420.ReactionType.LOVE);
        require(reactions.reaction(objectId, BOB).reactionType == BongGogglesTypes420.ReactionType.LOVE, "follower reaction denied");
    }

    function testUnresolvedGroupAudienceFailsClosedForReaction() public {
        bytes32 objectId = _postWithAudience(ALICE, BongGogglesTypes420.AudienceType.GROUP);
        vm.expectRevert(BongGogglesReactionRegistry420.AudienceDenied.selector);
        vm.prank(BOB); reactions.setReaction(BOB, objectId, BongGogglesTypes420.ReactionType.LIKE);
    }

    function testAuthorCanReactToOwnProtectedObject() public {
        bytes32 objectId = _postWithAudience(ALICE, BongGogglesTypes420.AudienceType.PRIVATE);
        vm.prank(ALICE); reactions.setReaction(ALICE, objectId, BongGogglesTypes420.ReactionType.SUPPORT);
        require(reactions.reaction(objectId, ALICE).reactionType == BongGogglesTypes420.ReactionType.SUPPORT, "author self reaction denied");
    }
}
