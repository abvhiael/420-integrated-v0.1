// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./BongGogglesIds420.sol";
import "./BongGogglesProfileRegistry420.sol";
import "./BongGogglesRelationshipGraph420.sol";
import "./BongGogglesSocialPolicy420.sol";
import "./BongGogglesSocialObjectRegistry420.sol";
import "./BongGogglesDiscoveryRegistry420.sol";

/// @notice Read-only canonical search and recommendation policy surface for Bong Goggles V1.
/// @dev Indexers may rank and retrieve off-chain, but eligibility is derived from canonical state.
contract BongGogglesSearchIndexSurface420 {
    enum SearchClass {
        PEOPLE,
        PAGES,
        GROUPS,
        POSTS,
        PLACES,
        PRODUCTS,
        BRANDS,
        EVENTS,
        RESOURCES,
        COLLECTIONS,
        GAMES
    }

    struct QueryCursorContext {
        address viewer;
        SearchClass searchClass;
        bytes32 queryHash;
        bytes32 filtersHash;
        uint64 snapshotBlock;
        uint64 position;
        bytes32 rankerId;
    }

    struct RecommendationContext {
        address viewer;
        bytes32 surfaceId;
        bytes32 candidateSetHash;
        bytes32 modelId;
        uint64 snapshotBlock;
    }

    struct Freshness {
        uint64 indexedBlock;
        bytes32 indexedBlockHash;
        uint64 observedAt;
    }

    BongGogglesProfileRegistry420 public immutable profiles;
    BongGogglesRelationshipGraph420 public immutable relationships;
    BongGogglesSocialPolicy420 public immutable policy;
    BongGogglesSocialObjectRegistry420 public immutable objects;
    BongGogglesDiscoveryRegistry420 public immutable discovery;

    error ZeroAddress();
    error InvalidQuery();

    constructor(
        address profiles_,
        address relationships_,
        address policy_,
        address objects_,
        address discovery_
    ) {
        if (
            profiles_ == address(0) || relationships_ == address(0) || policy_ == address(0)
                || objects_ == address(0) || discovery_ == address(0)
        ) revert ZeroAddress();
        profiles = BongGogglesProfileRegistry420(profiles_);
        relationships = BongGogglesRelationshipGraph420(relationships_);
        policy = BongGogglesSocialPolicy420(policy_);
        objects = BongGogglesSocialObjectRegistry420(objects_);
        discovery = BongGogglesDiscoveryRegistry420(discovery_);
    }

    function isProfileEligible(address viewer, address account) external view returns (bool) {
        if (!profiles.isActive(account)) return false;
        if (viewer != address(0) && viewer != account && relationships.isBlockedEither(viewer, account)) return false;
        return true;
    }

    function isSocialObjectEligible(address viewer, bytes32 objectId, SearchClass searchClass) external view returns (bool) {
        BongGogglesSocialObjectRegistry420.SocialObject memory object_ = objects.socialObject(objectId);
        if (!object_.exists || object_.status != BongGogglesTypes420.SocialObjectStatus.ACTIVE) return false;
        if (!profiles.isActive(object_.author)) return false;

        if (searchClass == SearchClass.COLLECTIONS) {
            if (object_.objectType != BongGogglesTypes420.SocialObjectType.COLLECTION) return false;
        } else if (searchClass == SearchClass.POSTS) {
            if (!_isPostType(object_.objectType)) return false;
        } else {
            return false;
        }

        BongGogglesTypes420.AudiencePolicy memory audience =
            BongGogglesTypes420.AudiencePolicy(object_.audienceType, object_.audienceRef);
        return policy.canView(viewer, object_.author, audience);
    }

    function isDiscoveryEligible(bytes32 subjectId, SearchClass searchClass) external view returns (bool) {
        BongGogglesDiscoveryRegistry420.Subject memory subject_ = discovery.subject(subjectId);
        if (!subject_.exists) return false;
        if (!_isSearchableDiscoveryStatus(subject_.status)) return false;
        return _matchesDiscoveryClass(subject_.subjectType, searchClass);
    }

    /// @notice Whether an indexer may use the subject in geospatial search/ranking.
    /// @dev PRIVATE location commitments remain searchable as non-geographic subjects, but never geo-eligible.
    function isGeospatiallyEligible(bytes32 subjectId) external view returns (bool) {
        BongGogglesDiscoveryRegistry420.Subject memory subject_ = discovery.subject(subjectId);
        return subject_.exists && _isSearchableDiscoveryStatus(subject_.status)
            && subject_.locationPrecision != BongGogglesTypes420.LocationPrecision.PRIVATE;
    }

    function queryCursorDigest(QueryCursorContext calldata context) external view returns (bytes32) {
        if (context.queryHash == bytes32(0) || context.rankerId == bytes32(0)) revert InvalidQuery();
        return keccak256(
            abi.encode(
                "420/BONG_GOGGLES/SEARCH_CURSOR/V1",
                block.chainid,
                context.viewer,
                context.searchClass,
                context.queryHash,
                context.filtersHash,
                context.snapshotBlock,
                context.position,
                context.rankerId
            )
        );
    }

    function recommendationDigest(RecommendationContext calldata context) external view returns (bytes32) {
        if (context.surfaceId == bytes32(0) || context.candidateSetHash == bytes32(0) || context.modelId == bytes32(0)) {
            revert InvalidQuery();
        }
        return keccak256(
            abi.encode(
                "420/BONG_GOGGLES/RECOMMENDATION_CONTEXT/V1",
                block.chainid,
                context.viewer,
                context.surfaceId,
                context.candidateSetHash,
                context.modelId,
                context.snapshotBlock
            )
        );
    }

    function freshnessDigest(Freshness calldata freshness) external view returns (bytes32) {
        return keccak256(
            abi.encode(
                "420/BONG_GOGGLES/SEARCH_INDEXER_FRESHNESS/V1",
                block.chainid,
                freshness.indexedBlock,
                freshness.indexedBlockHash,
                freshness.observedAt
            )
        );
    }

    function canonicalSearchSchemaHash() external pure returns (bytes32) {
        return keccak256(
            abi.encode(
                "420/BONG_GOGGLES/SEARCH_SCHEMA/V1",
                uint8(SearchClass.PEOPLE),
                uint8(SearchClass.PAGES),
                uint8(SearchClass.GROUPS),
                uint8(SearchClass.POSTS),
                uint8(SearchClass.PLACES),
                uint8(SearchClass.PRODUCTS),
                uint8(SearchClass.BRANDS),
                uint8(SearchClass.EVENTS),
                uint8(SearchClass.RESOURCES),
                uint8(SearchClass.COLLECTIONS),
                uint8(SearchClass.GAMES)
            )
        );
    }

    function _isPostType(BongGogglesTypes420.SocialObjectType objectType) private pure returns (bool) {
        return objectType == BongGogglesTypes420.SocialObjectType.STATUS
            || objectType == BongGogglesTypes420.SocialObjectType.PHOTO_POST
            || objectType == BongGogglesTypes420.SocialObjectType.STORY
            || objectType == BongGogglesTypes420.SocialObjectType.COMMENT
            || objectType == BongGogglesTypes420.SocialObjectType.EVENT_POST
            || objectType == BongGogglesTypes420.SocialObjectType.REPOST
            || objectType == BongGogglesTypes420.SocialObjectType.QUOTE_POST;
    }

    function _isSearchableDiscoveryStatus(BongGogglesTypes420.DiscoveryStatus status) private pure returns (bool) {
        return status == BongGogglesTypes420.DiscoveryStatus.SUBMITTED
            || status == BongGogglesTypes420.DiscoveryStatus.ACTIVE
            || status == BongGogglesTypes420.DiscoveryStatus.STALE
            || status == BongGogglesTypes420.DiscoveryStatus.DISPUTED;
    }

    function _matchesDiscoveryClass(BongGogglesTypes420.DiscoverySubjectType subjectType, SearchClass searchClass)
        private pure returns (bool)
    {
        if (subjectType == BongGogglesTypes420.DiscoverySubjectType.PLACE) return searchClass == SearchClass.PLACES;
        if (subjectType == BongGogglesTypes420.DiscoverySubjectType.PRODUCT) return searchClass == SearchClass.PRODUCTS;
        if (subjectType == BongGogglesTypes420.DiscoverySubjectType.BRAND) return searchClass == SearchClass.BRANDS;
        if (subjectType == BongGogglesTypes420.DiscoverySubjectType.EVENT) return searchClass == SearchClass.EVENTS;
        if (subjectType == BongGogglesTypes420.DiscoverySubjectType.RESOURCE) return searchClass == SearchClass.RESOURCES;
        return false;
    }
}
