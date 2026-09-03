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

interface VmBongGogglesPublishing420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract BongGogglesPublishingCapsMock420 is ICapabilityRegistry420 {
    mapping(bytes32 => bool) internal allowed;

    function grant(bytes32) external pure override returns (CapabilityGrant memory capabilityGrant) { return capabilityGrant; }

    function isAuthorized(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, uint256 amount)
        external view override returns (bool)
    {
        return allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash, amount))];
    }
}

contract BongGogglesPublishingMedia420Test {
    VmBongGogglesPublishing420 constant vm = VmBongGogglesPublishing420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);

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
        objects = new BongGogglesSocialObjectRegistry420(address(auth), address(profiles));
        media = new BongGogglesMediaRegistry420(address(auth), address(profiles));
        reactions = new BongGogglesReactionRegistry420(address(auth), address(profiles), address(objects), address(policy));
        _create(ALICE);
        _create(BOB);
    }

    function _create(address user) internal {
        vm.prank(user);
        profiles.createProfile(
            user,
            BongGogglesTypes420.ProfileType.PERSONAL,
            keccak256(abi.encode(user)),
            bytes32(0),
            bytes32(0),
            bytes32(0),
            bytes32(0)
        );
    }

    function _post(address author) internal returns (bytes32) {
        BongGogglesTypes420.AudiencePolicy memory audience = BongGogglesTypes420.AudiencePolicy(
            BongGogglesTypes420.AudienceType.PUBLIC,
            bytes32(0)
        );
        vm.prank(author);
        return objects.publish(
            author,
            BongGogglesTypes420.SocialObjectType.STATUS,
            bytes32(0),
            bytes32(0),
            bytes32(0),
            keccak256("post"),
            bytes32(0),
            audience
        );
    }

    function testMediaManifestBindsOwnerAndContent() public {
        bytes32 manifestHash = keccak256("manifest");
        vm.prank(ALICE);
        bytes32 root = media.registerManifest(ALICE, BongGogglesTypes420.MediaType.IMAGE, manifestHash, 3);
        BongGogglesMediaRegistry420.MediaManifest memory m = media.mediaManifest(root);
        require(m.exists, "manifest missing");
        require(m.owner == ALICE, "owner mismatch");
        require(m.manifestHash == manifestHash, "hash mismatch");
        require(m.itemCount == 3, "count mismatch");
        require(media.isValidManifest(root, ALICE), "owner validation failed");
        require(!media.isValidManifest(root, BOB), "foreign owner validated");
    }

    function testMediaRejectsEmptyManifest() public {
        vm.expectRevert(BongGogglesMediaRegistry420.InvalidManifest.selector);
        vm.prank(ALICE);
        media.registerManifest(ALICE, BongGogglesTypes420.MediaType.IMAGE, bytes32(0), 1);
    }

    function testReactionSetReplacesSingleActiveReaction() public {
        bytes32 objectId = _post(ALICE);
        vm.prank(BOB);
        reactions.setReaction(BOB, objectId, BongGogglesTypes420.ReactionType.LIKE);
        require(
            reactions.reaction(objectId, BOB).reactionType == BongGogglesTypes420.ReactionType.LIKE,
            "like missing"
        );
        vm.prank(BOB);
        reactions.setReaction(BOB, objectId, BongGogglesTypes420.ReactionType.LOVE);
        require(
            reactions.reaction(objectId, BOB).reactionType == BongGogglesTypes420.ReactionType.LOVE,
            "reaction not replaced"
        );
    }

    function testReactionCanBeCleared() public {
        bytes32 objectId = _post(ALICE);
        vm.prank(BOB);
        reactions.setReaction(BOB, objectId, BongGogglesTypes420.ReactionType.SUPPORT);
        vm.prank(BOB);
        reactions.clearReaction(BOB, objectId);
        require(
            reactions.reaction(objectId, BOB).reactionType == BongGogglesTypes420.ReactionType.NONE,
            "reaction survived clear"
        );
    }

    function testBlockDeniesReaction() public {
        bytes32 objectId = _post(ALICE);
        vm.prank(ALICE);
        graph.blockUser(ALICE, BOB);
        vm.expectRevert(BongGogglesReactionRegistry420.InteractionDenied.selector);
        vm.prank(BOB);
        reactions.setReaction(BOB, objectId, BongGogglesTypes420.ReactionType.LIKE);
    }

    function testDeletedObjectDeniesReaction() public {
        bytes32 objectId = _post(ALICE);
        vm.prank(ALICE);
        objects.deleteObject(ALICE, objectId);
        vm.expectRevert(BongGogglesReactionRegistry420.ObjectUnavailable.selector);
        vm.prank(BOB);
        reactions.setReaction(BOB, objectId, BongGogglesTypes420.ReactionType.LIKE);
    }
}
