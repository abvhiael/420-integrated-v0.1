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

interface VmBongGogglesShare420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract BongGogglesShareCapsMock420 is ICapabilityRegistry420 {
    function grant(bytes32) external pure override returns (CapabilityGrant memory capabilityGrant) { return capabilityGrant; }
    function isAuthorized(address, bytes32, bytes32, bytes32, uint256) external pure override returns (bool) { return false; }
}

contract BongGogglesShareProvenance420Test {
    VmBongGogglesShare420 constant vm = VmBongGogglesShare420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);

    BongGogglesAuthorization420 auth;
    BongGogglesProfileRegistry420 profiles;
    BongGogglesRelationshipGraph420 graph;
    BongGogglesSocialPolicy420 policy;
    BongGogglesMediaRegistry420 media;
    BongGogglesSocialObjectRegistry420 objects;

    function setUp() public {
        BongGogglesShareCapsMock420 caps = new BongGogglesShareCapsMock420();
        auth = new BongGogglesAuthorization420(address(caps));
        profiles = new BongGogglesProfileRegistry420(address(auth));
        graph = new BongGogglesRelationshipGraph420(address(auth), address(profiles));
        policy = new BongGogglesSocialPolicy420(address(profiles), address(graph));
        media = new BongGogglesMediaRegistry420(address(auth), address(profiles));
        objects = new BongGogglesSocialObjectRegistry420(address(auth), address(profiles), address(policy), address(media));
        _create(ALICE);
        _create(BOB);
    }

    function _create(address user) internal {
        vm.prank(user);
        profiles.createProfile(user, BongGogglesTypes420.ProfileType.PERSONAL, keccak256(abi.encode(user)), bytes32(0), bytes32(0), bytes32(0), bytes32(0));
    }

    function _post(address author, BongGogglesTypes420.AudienceType audienceType) internal returns (bytes32) {
        BongGogglesTypes420.AudiencePolicy memory audience = BongGogglesTypes420.AudiencePolicy(audienceType, bytes32(0));
        vm.prank(author);
        return objects.publish(author, BongGogglesTypes420.SocialObjectType.STATUS, bytes32(0), bytes32(0), bytes32(0), keccak256("source"), bytes32(0), audience);
    }

    function testRepostSnapshotsSourceVersionAndProvenance() public {
        bytes32 sourceId = _post(ALICE, BongGogglesTypes420.AudienceType.PUBLIC);
        BongGogglesTypes420.AudiencePolicy memory audience = BongGogglesTypes420.AudiencePolicy(BongGogglesTypes420.AudienceType.PUBLIC, bytes32(0));
        vm.prank(BOB);
        bytes32 repostId = objects.repost(BOB, sourceId, bytes32(0), audience);
        BongGogglesSocialObjectRegistry420.SocialObject memory reposted = objects.socialObject(repostId);
        require(reposted.objectType == BongGogglesTypes420.SocialObjectType.REPOST, "wrong object type");
        require(reposted.provenanceType == BongGogglesTypes420.ProvenanceType.REPOST, "wrong provenance");
        require(reposted.sourceObjectId == sourceId, "source not bound");
        require(reposted.sourceVersion == 1, "source version not snapshotted");
        require(reposted.contentHash == bytes32(0) && reposted.mediaRoot == bytes32(0), "repost invented content");
    }

    function testProtectedSourceCannotBeRepostedOrShared() public {
        bytes32 sourceId = _post(ALICE, BongGogglesTypes420.AudienceType.FRIENDS);
        BongGogglesTypes420.AudiencePolicy memory audience = BongGogglesTypes420.AudiencePolicy(BongGogglesTypes420.AudienceType.PUBLIC, bytes32(0));
        vm.expectRevert(BongGogglesSocialObjectRegistry420.SourceProtected.selector);
        vm.prank(BOB);
        objects.repost(BOB, sourceId, bytes32(0), audience);
        vm.expectRevert(BongGogglesSocialObjectRegistry420.SourceProtected.selector);
        vm.prank(BOB);
        objects.share(BOB, sourceId, bytes32("feed"));
    }

    function testBlockOverridesPublicRepost() public {
        bytes32 sourceId = _post(ALICE, BongGogglesTypes420.AudienceType.PUBLIC);
        vm.prank(ALICE);
        graph.blockUser(ALICE, BOB);
        BongGogglesTypes420.AudiencePolicy memory audience = BongGogglesTypes420.AudiencePolicy(BongGogglesTypes420.AudienceType.PUBLIC, bytes32(0));
        vm.expectRevert(BongGogglesSocialObjectRegistry420.SourceInteractionDenied.selector);
        vm.prank(BOB);
        objects.repost(BOB, sourceId, bytes32(0), audience);
    }

    function testRepostIsImmutable() public {
        bytes32 sourceId = _post(ALICE, BongGogglesTypes420.AudienceType.PUBLIC);
        BongGogglesTypes420.AudiencePolicy memory audience = BongGogglesTypes420.AudiencePolicy(BongGogglesTypes420.AudienceType.PUBLIC, bytes32(0));
        vm.prank(BOB);
        bytes32 repostId = objects.repost(BOB, sourceId, bytes32(0), audience);
        vm.expectRevert(BongGogglesSocialObjectRegistry420.ImmutableRepost.selector);
        vm.prank(BOB);
        objects.edit(BOB, repostId, keccak256("mutated"), bytes32(0));
    }

    function testQuotePostCanEditCommentaryWithoutChangingSourceSnapshot() public {
        bytes32 sourceId = _post(ALICE, BongGogglesTypes420.AudienceType.PUBLIC);
        BongGogglesTypes420.AudiencePolicy memory audience = BongGogglesTypes420.AudiencePolicy(BongGogglesTypes420.AudienceType.PUBLIC, bytes32(0));
        vm.prank(BOB);
        bytes32 quoteId = objects.quotePost(BOB, sourceId, bytes32(0), keccak256("quote-v1"), bytes32(0), audience);
        vm.prank(BOB);
        objects.edit(BOB, quoteId, keccak256("quote-v2"), bytes32(0));
        BongGogglesSocialObjectRegistry420.SocialObject memory quoted = objects.socialObject(quoteId);
        require(quoted.objectType == BongGogglesTypes420.SocialObjectType.QUOTE_POST, "wrong quote type");
        require(quoted.provenanceType == BongGogglesTypes420.ProvenanceType.QUOTE_POST, "wrong quote provenance");
        require(quoted.sourceObjectId == sourceId && quoted.sourceVersion == 1, "source snapshot changed");
        require(quoted.version == 2, "quote commentary not versioned");
    }

    function testDeletedSourcePreservesProvenanceButBecomesUnavailable() public {
        bytes32 sourceId = _post(ALICE, BongGogglesTypes420.AudienceType.PUBLIC);
        BongGogglesTypes420.AudiencePolicy memory audience = BongGogglesTypes420.AudiencePolicy(BongGogglesTypes420.AudienceType.PUBLIC, bytes32(0));
        vm.prank(BOB);
        bytes32 repostId = objects.repost(BOB, sourceId, bytes32(0), audience);
        require(objects.sourceIsCurrentlyAvailable(repostId), "source unexpectedly unavailable");
        vm.prank(ALICE);
        objects.deleteObject(ALICE, sourceId);
        require(!objects.sourceIsCurrentlyAvailable(repostId), "deleted source still available");
        BongGogglesSocialObjectRegistry420.SocialObject memory reposted = objects.socialObject(repostId);
        require(reposted.sourceObjectId == sourceId && reposted.sourceVersion == 1, "provenance erased");
    }

    function testNestedRepostFailsClosed() public {
        bytes32 sourceId = _post(ALICE, BongGogglesTypes420.AudienceType.PUBLIC);
        BongGogglesTypes420.AudiencePolicy memory audience = BongGogglesTypes420.AudiencePolicy(BongGogglesTypes420.AudienceType.PUBLIC, bytes32(0));
        vm.prank(BOB);
        bytes32 repostId = objects.repost(BOB, sourceId, bytes32(0), audience);
        vm.expectRevert(BongGogglesSocialObjectRegistry420.SourceProvenanceUnsupported.selector);
        vm.prank(ALICE);
        objects.repost(ALICE, repostId, bytes32(0), audience);
    }

    function testGenericPublishCannotForgeRepostType() public {
        BongGogglesTypes420.AudiencePolicy memory audience = BongGogglesTypes420.AudiencePolicy(BongGogglesTypes420.AudienceType.PUBLIC, bytes32(0));
        vm.expectRevert(BongGogglesSocialObjectRegistry420.InvalidObjectType.selector);
        vm.prank(ALICE);
        objects.publish(ALICE, BongGogglesTypes420.SocialObjectType.REPOST, bytes32(0), bytes32(0), bytes32(0), bytes32(0), bytes32(0), audience);
    }

    function testPublicShareIntentSucceedsWithoutCreatingObject() public {
        bytes32 sourceId = _post(ALICE, BongGogglesTypes420.AudienceType.PUBLIC);
        uint256 beforeNonce = objects.authorNonce(BOB);
        vm.prank(BOB);
        objects.share(BOB, sourceId, keccak256("home-feed"));
        require(objects.authorNonce(BOB) == beforeNonce, "share created canonical object");
    }
}
