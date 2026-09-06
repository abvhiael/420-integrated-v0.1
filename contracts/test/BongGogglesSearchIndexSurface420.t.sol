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
import "../src/bonggoggles/BongGogglesDiscoveryRegistry420.sol";
import "../src/bonggoggles/BongGogglesSearchIndexSurface420.sol";

interface VmBongGogglesSearch420 {
    function prank(address) external;
}

contract BongGogglesSearchCapsMock420 is ICapabilityRegistry420 {
    function grant(bytes32) external pure override returns (CapabilityGrant memory capabilityGrant) { return capabilityGrant; }
    function isAuthorized(address, bytes32, bytes32, bytes32, uint256) external pure override returns (bool) { return false; }
}

contract BongGogglesSearchIndexSurface420Test {
    VmBongGogglesSearch420 constant vm = VmBongGogglesSearch420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);

    BongGogglesAuthorization420 auth;
    BongGogglesProfileRegistry420 profiles;
    BongGogglesRelationshipGraph420 graph;
    BongGogglesSocialPolicy420 policy;
    BongGogglesMediaRegistry420 media;
    BongGogglesSocialObjectRegistry420 objects;
    BongGogglesDiscoveryRegistry420 discovery;
    BongGogglesSearchIndexSurface420 surface;

    function setUp() public {
        BongGogglesSearchCapsMock420 caps = new BongGogglesSearchCapsMock420();
        auth = new BongGogglesAuthorization420(address(caps));
        profiles = new BongGogglesProfileRegistry420(address(auth));
        graph = new BongGogglesRelationshipGraph420(address(auth), address(profiles));
        policy = new BongGogglesSocialPolicy420(address(profiles), address(graph));
        media = new BongGogglesMediaRegistry420(address(auth), address(profiles));
        objects = new BongGogglesSocialObjectRegistry420(address(auth), address(profiles), address(policy), address(media));
        discovery = new BongGogglesDiscoveryRegistry420(address(auth), address(profiles));
        surface = new BongGogglesSearchIndexSurface420(address(profiles), address(graph), address(policy), address(objects), address(discovery));
        _create(ALICE);
        _create(BOB);
    }

    function _create(address user) internal {
        vm.prank(user);
        profiles.createProfile(user, BongGogglesTypes420.ProfileType.PERSONAL, keccak256(abi.encode(user)), bytes32(0), bytes32(0), bytes32(0), bytes32(0));
    }

    function _publish(address author, BongGogglesTypes420.SocialObjectType objectType, BongGogglesTypes420.AudienceType audienceType)
        internal returns (bytes32)
    {
        BongGogglesTypes420.AudiencePolicy memory audience = BongGogglesTypes420.AudiencePolicy(audienceType, bytes32(0));
        vm.prank(author);
        return objects.publish(author, objectType, bytes32(0), bytes32(0), bytes32(0), keccak256("search-object"), bytes32(0), audience);
    }

    function testProfileEligibilityRespectsBlockBoundary() public {
        require(surface.isProfileEligible(BOB, ALICE), "active profile missing");
        vm.prank(ALICE);
        graph.blockUser(ALICE, BOB);
        require(!surface.isProfileEligible(BOB, ALICE), "blocked profile leaked");
    }

    function testPublicGuestCanSearchPublicPostButNotFriendsPost() public {
        bytes32 publicId = _publish(ALICE, BongGogglesTypes420.SocialObjectType.STATUS, BongGogglesTypes420.AudienceType.PUBLIC);
        bytes32 friendsId = _publish(ALICE, BongGogglesTypes420.SocialObjectType.STATUS, BongGogglesTypes420.AudienceType.FRIENDS);
        require(surface.isSocialObjectEligible(address(0), publicId, BongGogglesSearchIndexSurface420.SearchClass.POSTS), "public guest missing");
        require(!surface.isSocialObjectEligible(address(0), friendsId, BongGogglesSearchIndexSurface420.SearchClass.POSTS), "friends leak");
    }

    function testCollectionsStayOutOfPostsSearch() public {
        bytes32 collectionId = _publish(ALICE, BongGogglesTypes420.SocialObjectType.COLLECTION, BongGogglesTypes420.AudienceType.PUBLIC);
        require(!surface.isSocialObjectEligible(BOB, collectionId, BongGogglesSearchIndexSurface420.SearchClass.POSTS), "collection leaked into posts");
        require(surface.isSocialObjectEligible(BOB, collectionId, BongGogglesSearchIndexSurface420.SearchClass.COLLECTIONS), "collection missing");
    }

    function testDeletedObjectCannotRemainSearchEligible() public {
        bytes32 objectId = _publish(ALICE, BongGogglesTypes420.SocialObjectType.STATUS, BongGogglesTypes420.AudienceType.PUBLIC);
        require(surface.isSocialObjectEligible(BOB, objectId, BongGogglesSearchIndexSurface420.SearchClass.POSTS), "post missing");
        vm.prank(ALICE);
        objects.deleteObject(ALICE, objectId);
        require(!surface.isSocialObjectEligible(BOB, objectId, BongGogglesSearchIndexSurface420.SearchClass.POSTS), "deleted post leaked");
    }

    function testDiscoveryClassesAndPrivateGeoFailClosed() public {
        bytes32 canonicalRef = keccak256("private-place");
        vm.prank(ALICE);
        bytes32 subjectId = discovery.submitSubject(
            ALICE,
            BongGogglesTypes420.DiscoverySubjectType.PLACE,
            canonicalRef,
            keccak256("metadata"),
            keccak256("location"),
            BongGogglesTypes420.LocationPrecision.PRIVATE
        );
        require(surface.isDiscoveryEligible(subjectId, BongGogglesSearchIndexSurface420.SearchClass.PLACES), "place missing");
        require(!surface.isDiscoveryEligible(subjectId, BongGogglesSearchIndexSurface420.SearchClass.PRODUCTS), "place leaked into product search");
        require(!surface.isGeospatiallyEligible(subjectId), "private location geo leaked");
    }

    function testSearchCursorBindsQueryFiltersSnapshotPositionAndRanker() public {
        BongGogglesSearchIndexSurface420.QueryCursorContext memory a = BongGogglesSearchIndexSurface420.QueryCursorContext(
            BOB,
            BongGogglesSearchIndexSurface420.SearchClass.POSTS,
            keccak256("cannabis"),
            keccak256("filters-a"),
            100,
            7,
            keccak256("ranker-a")
        );
        bytes32 digest = surface.queryCursorDigest(a);
        BongGogglesSearchIndexSurface420.QueryCursorContext memory b = a;
        b.queryHash = keccak256("different");
        require(digest != surface.queryCursorDigest(b), "query not bound");
        b = a;
        b.filtersHash = keccak256("filters-b");
        require(digest != surface.queryCursorDigest(b), "filters not bound");
        b = a;
        b.position = 8;
        require(digest != surface.queryCursorDigest(b), "position not bound");
        b = a;
        b.rankerId = keccak256("ranker-b");
        require(digest != surface.queryCursorDigest(b), "ranker not bound");
    }

    function testRecommendationContextIsSeparateAndExplicit() public {
        BongGogglesSearchIndexSurface420.RecommendationContext memory a = BongGogglesSearchIndexSurface420.RecommendationContext(
            BOB,
            keccak256("discover"),
            keccak256("candidate-set-a"),
            keccak256("model-a"),
            200
        );
        bytes32 digest = surface.recommendationDigest(a);
        a.candidateSetHash = keccak256("candidate-set-b");
        require(digest != surface.recommendationDigest(a), "candidate set not bound");
        require(surface.canonicalSearchSchemaHash() != bytes32(0), "search schema missing");
    }
}
