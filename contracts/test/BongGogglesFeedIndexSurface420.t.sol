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
import "../src/bonggoggles/BongGogglesFeedIndexSurface420.sol";

interface VmBongGogglesFeed420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract BongGogglesFeedCapsMock420 is ICapabilityRegistry420 {
    function grant(bytes32) external pure override returns (CapabilityGrant memory capabilityGrant) { return capabilityGrant; }
    function isAuthorized(address, bytes32, bytes32, bytes32, uint256) external pure override returns (bool) { return false; }
}

contract BongGogglesFeedIndexSurface420Test {
    VmBongGogglesFeed420 constant vm = VmBongGogglesFeed420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);
    address constant CAROL = address(0xCA401);

    BongGogglesAuthorization420 auth;
    BongGogglesProfileRegistry420 profiles;
    BongGogglesRelationshipGraph420 graph;
    BongGogglesSocialPolicy420 policy;
    BongGogglesMediaRegistry420 media;
    BongGogglesSocialObjectRegistry420 objects;
    BongGogglesFeedIndexSurface420 surface;

    function setUp() public {
        BongGogglesFeedCapsMock420 caps = new BongGogglesFeedCapsMock420();
        auth = new BongGogglesAuthorization420(address(caps));
        profiles = new BongGogglesProfileRegistry420(address(auth));
        graph = new BongGogglesRelationshipGraph420(address(auth), address(profiles));
        policy = new BongGogglesSocialPolicy420(address(profiles), address(graph));
        media = new BongGogglesMediaRegistry420(address(auth), address(profiles));
        objects = new BongGogglesSocialObjectRegistry420(address(auth), address(profiles), address(policy), address(media));
        surface = new BongGogglesFeedIndexSurface420(address(profiles), address(graph), address(objects), address(policy));
        _create(ALICE); _create(BOB); _create(CAROL);
    }

    function _create(address user) internal {
        vm.prank(user);
        profiles.createProfile(user, BongGogglesTypes420.ProfileType.PERSONAL, keccak256(abi.encode(user)), bytes32(0), bytes32(0), bytes32(0), bytes32(0));
    }

    function _post(address author, BongGogglesTypes420.AudienceType audienceType) internal returns (bytes32) {
        BongGogglesTypes420.AudiencePolicy memory audience = BongGogglesTypes420.AudiencePolicy(audienceType, bytes32(0));
        vm.prank(author);
        return objects.publish(author, BongGogglesTypes420.SocialObjectType.STATUS, bytes32(0), bytes32(0), bytes32(0), keccak256("feed-post"), bytes32(0), audience);
    }

    function _friend(address a, address b) internal {
        vm.prank(a);
        bytes32 requestId = graph.requestFriend(a, b);
        vm.prank(b);
        graph.acceptFriend(b, requestId);
    }

    function testFriendsAndFollowingRequireMostRecent() public {
        require(surface.requiredMode(BongGogglesFeedIndexSurface420.FeedClass.FRIENDS) == BongGogglesFeedIndexSurface420.FeedMode.MOST_RECENT, "friends mode");
        require(surface.requiredMode(BongGogglesFeedIndexSurface420.FeedClass.FOLLOWING) == BongGogglesFeedIndexSurface420.FeedMode.MOST_RECENT, "following mode");
        vm.expectRevert(BongGogglesFeedIndexSurface420.RankedModeForbidden.selector);
        surface.validateMode(BongGogglesFeedIndexSurface420.FeedClass.FRIENDS, BongGogglesFeedIndexSurface420.FeedMode.RANKED);
    }

    function testFriendsFeedRequiresFriendshipAndAudience() public {
        bytes32 objectId = _post(ALICE, BongGogglesTypes420.AudienceType.FRIENDS);
        require(!surface.isEligible(BOB, objectId, BongGogglesFeedIndexSurface420.FeedClass.FRIENDS), "outsider eligible");
        _friend(ALICE, BOB);
        require(surface.isEligible(BOB, objectId, BongGogglesFeedIndexSurface420.FeedClass.FRIENDS), "friend missing");
    }

    function testFollowingFeedRequiresFollowRelationship() public {
        bytes32 objectId = _post(ALICE, BongGogglesTypes420.AudienceType.FOLLOWERS);
        require(!surface.isEligible(BOB, objectId, BongGogglesFeedIndexSurface420.FeedClass.FOLLOWING), "outsider eligible");
        vm.prank(BOB);
        graph.follow(BOB, ALICE);
        require(surface.isEligible(BOB, objectId, BongGogglesFeedIndexSurface420.FeedClass.FOLLOWING), "follower missing");
    }

    function testDiscoverIsPublicOnly() public {
        bytes32 publicId = _post(ALICE, BongGogglesTypes420.AudienceType.PUBLIC);
        bytes32 friendsId = _post(ALICE, BongGogglesTypes420.AudienceType.FRIENDS);
        _friend(ALICE, BOB);
        require(surface.isEligible(BOB, publicId, BongGogglesFeedIndexSurface420.FeedClass.DISCOVER), "public discover missing");
        require(!surface.isEligible(BOB, friendsId, BongGogglesFeedIndexSurface420.FeedClass.DISCOVER), "protected discover leak");
    }

    function testGroupAndGamesFailClosedUntilCanonicalSemanticsExist() public {
        bytes32 objectId = _post(ALICE, BongGogglesTypes420.AudienceType.PUBLIC);
        require(!surface.isEligible(BOB, objectId, BongGogglesFeedIndexSurface420.FeedClass.GROUPS), "groups opened early");
        require(!surface.isEligible(BOB, objectId, BongGogglesFeedIndexSurface420.FeedClass.GAMES), "games opened early");
    }

    function testDeletedObjectIsNeverEligible() public {
        bytes32 objectId = _post(ALICE, BongGogglesTypes420.AudienceType.PUBLIC);
        require(surface.isEligible(BOB, objectId, BongGogglesFeedIndexSurface420.FeedClass.HOME), "home missing");
        vm.prank(ALICE);
        objects.deleteObject(ALICE, objectId);
        require(!surface.isEligible(BOB, objectId, BongGogglesFeedIndexSurface420.FeedClass.HOME), "deleted eligible");
    }

    function testCursorBindsViewerFeedSnapshotPositionAndRanker() public {
        BongGogglesFeedIndexSurface420.CursorContext memory a = BongGogglesFeedIndexSurface420.CursorContext(
            BOB,
            BongGogglesFeedIndexSurface420.FeedClass.HOME,
            BongGogglesFeedIndexSurface420.FeedMode.RANKED,
            100,
            7,
            keccak256("ranker-a")
        );
        BongGogglesFeedIndexSurface420.CursorContext memory b = a;
        b.position = 8;
        require(surface.cursorDigest(a) != surface.cursorDigest(b), "cursor position not bound");
        b = a;
        b.rankerId = keccak256("ranker-b");
        require(surface.cursorDigest(a) != surface.cursorDigest(b), "cursor ranker not bound");
    }

    function testFreshnessAndPromotionLabelsAreExplicit() public {
        BongGogglesFeedIndexSurface420.Freshness memory f = BongGogglesFeedIndexSurface420.Freshness(99, keccak256("block-99"), 1234);
        require(surface.freshnessDigest(f) != bytes32(0), "freshness digest");
        require(surface.promotionLabel(BongGogglesFeedIndexSurface420.PromotionClass.ORGANIC) == keccak256("ORGANIC"), "organic label");
        require(surface.promotionLabel(BongGogglesFeedIndexSurface420.PromotionClass.SPONSORED) == keccak256("SPONSORED"), "sponsored label");
        require(surface.canonicalEventSchemaHash() != bytes32(0), "event schema");
    }
}
