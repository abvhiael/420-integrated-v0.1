// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./BongGogglesIds420.sol";
import "./BongGogglesProfileRegistry420.sol";
import "./BongGogglesRelationshipGraph420.sol";
import "./BongGogglesSocialObjectRegistry420.sol";
import "./BongGogglesSocialPolicy420.sol";

/// @notice Read-only canonical feed/indexer policy surface for Bong Goggles V1.
/// @dev This contract never ranks content, mutates social truth, or authorizes an indexer.
contract BongGogglesFeedIndexSurface420 {
    enum FeedClass { HOME, FRIENDS, FOLLOWING, GROUPS, DISCOVER, GAMES }
    enum FeedMode { MOST_RECENT, RANKED }
    enum PromotionClass { ORGANIC, REWARDED, SPONSORED }

    struct CursorContext {
        address viewer;
        FeedClass feedClass;
        FeedMode mode;
        uint64 snapshotBlock;
        uint64 position;
        bytes32 rankerId;
    }

    struct Freshness {
        uint64 indexedBlock;
        bytes32 indexedBlockHash;
        uint64 observedAt;
    }

    BongGogglesProfileRegistry420 public immutable profiles;
    BongGogglesRelationshipGraph420 public immutable relationships;
    BongGogglesSocialObjectRegistry420 public immutable objects;
    BongGogglesSocialPolicy420 public immutable policy;

    bytes32 public constant EVENT_SOCIAL_OBJECT_PUBLISHED = keccak256("SocialObjectPublished(bytes32,address,uint8,bytes32,uint32)");
    bytes32 public constant EVENT_SOCIAL_OBJECT_EDITED = keccak256("SocialObjectEdited(bytes32,address,uint32,uint32,bytes32,bytes32)");
    bytes32 public constant EVENT_SOCIAL_OBJECT_HIDDEN = keccak256("SocialObjectHidden(bytes32,address,address)");
    bytes32 public constant EVENT_SOCIAL_OBJECT_RESTORED = keccak256("SocialObjectRestored(bytes32,address,address)");
    bytes32 public constant EVENT_SOCIAL_OBJECT_DELETED = keccak256("SocialObjectDeleted(bytes32,address,address)");
    bytes32 public constant EVENT_SOCIAL_OBJECT_PROVENANCE = keccak256("SocialObjectProvenance(bytes32,bytes32,uint32,uint8,address)");
    bytes32 public constant EVENT_SOCIAL_OBJECT_SHARED = keccak256("SocialObjectShared(bytes32,uint32,address,address,bytes32,address)");
    bytes32 public constant EVENT_REACTION_SET = keccak256("ReactionSet(bytes32,address,uint8,uint8,address)");
    bytes32 public constant EVENT_REACTION_CLEARED = keccak256("ReactionCleared(bytes32,address,uint8,address)");
    bytes32 public constant EVENT_TAG_CREATED = keccak256("TagCreated(bytes32,bytes32,address,address,uint8,uint8,address)");
    bytes32 public constant EVENT_TAG_APPROVED = keccak256("TagApproved(bytes32,address,address)");
    bytes32 public constant EVENT_TAG_REJECTED = keccak256("TagRejected(bytes32,address,address)");
    bytes32 public constant EVENT_TAG_REMOVED = keccak256("TagRemoved(bytes32,address,address)");

    error ZeroAddress();
    error RankedModeForbidden();

    constructor(address profiles_, address relationships_, address objects_, address policy_) {
        if (profiles_ == address(0) || relationships_ == address(0) || objects_ == address(0) || policy_ == address(0)) {
            revert ZeroAddress();
        }
        profiles = BongGogglesProfileRegistry420(profiles_);
        relationships = BongGogglesRelationshipGraph420(relationships_);
        objects = BongGogglesSocialObjectRegistry420(objects_);
        policy = BongGogglesSocialPolicy420(policy_);
    }

    function requiredMode(FeedClass feedClass) public pure returns (FeedMode) {
        if (feedClass == FeedClass.FRIENDS || feedClass == FeedClass.FOLLOWING) return FeedMode.MOST_RECENT;
        return FeedMode.RANKED;
    }

    function validateMode(FeedClass feedClass, FeedMode mode) external pure returns (bool) {
        if ((feedClass == FeedClass.FRIENDS || feedClass == FeedClass.FOLLOWING) && mode != FeedMode.MOST_RECENT) {
            revert RankedModeForbidden();
        }
        return true;
    }

    function isEligible(address viewer, bytes32 objectId, FeedClass feedClass) external view returns (bool) {
        BongGogglesSocialObjectRegistry420.SocialObject memory object_ = objects.socialObject(objectId);
        if (!object_.exists || object_.status != BongGogglesTypes420.SocialObjectStatus.ACTIVE) return false;
        if (!profiles.isActive(object_.author)) return false;

        BongGogglesTypes420.AudiencePolicy memory audience =
            BongGogglesTypes420.AudiencePolicy(object_.audienceType, object_.audienceRef);
        if (!policy.canView(viewer, object_.author, audience)) return false;

        if (feedClass == FeedClass.FRIENDS) {
            return viewer != address(0) && relationships.areFriends(viewer, object_.author);
        }
        if (feedClass == FeedClass.FOLLOWING) {
            return viewer != address(0) && relationships.isFollowing(viewer, object_.author);
        }
        if (feedClass == FeedClass.GROUPS) {
            // Membership semantics land with Pages/Groups/Events. Until then, fail closed.
            return false;
        }
        if (feedClass == FeedClass.DISCOVER) {
            return object_.audienceType == BongGogglesTypes420.AudienceType.PUBLIC;
        }
        if (feedClass == FeedClass.GAMES) {
            // Canonical game-session objects are not defined yet. Fail closed in V1.
            return false;
        }
        return true;
    }

    function cursorDigest(CursorContext calldata context) external view returns (bytes32) {
        return keccak256(
            abi.encode(
                "420/BONG_GOGGLES/FEED_CURSOR/V1",
                block.chainid,
                context.viewer,
                context.feedClass,
                context.mode,
                context.snapshotBlock,
                context.position,
                context.rankerId
            )
        );
    }

    function freshnessDigest(Freshness calldata freshness) external view returns (bytes32) {
        return keccak256(
            abi.encode(
                "420/BONG_GOGGLES/INDEXER_FRESHNESS/V1",
                block.chainid,
                freshness.indexedBlock,
                freshness.indexedBlockHash,
                freshness.observedAt
            )
        );
    }

    function promotionLabel(PromotionClass promotionClass) external pure returns (bytes32) {
        if (promotionClass == PromotionClass.SPONSORED) return keccak256("SPONSORED");
        if (promotionClass == PromotionClass.REWARDED) return keccak256("REWARDED");
        return keccak256("ORGANIC");
    }

    function canonicalEventSchemaHash() external pure returns (bytes32) {
        return keccak256(
            abi.encode(
                "420/BONG_GOGGLES/FEED_EVENT_SCHEMA/V1",
                EVENT_SOCIAL_OBJECT_PUBLISHED,
                EVENT_SOCIAL_OBJECT_EDITED,
                EVENT_SOCIAL_OBJECT_HIDDEN,
                EVENT_SOCIAL_OBJECT_RESTORED,
                EVENT_SOCIAL_OBJECT_DELETED,
                EVENT_SOCIAL_OBJECT_PROVENANCE,
                EVENT_SOCIAL_OBJECT_SHARED,
                EVENT_REACTION_SET,
                EVENT_REACTION_CLEARED,
                EVENT_TAG_CREATED,
                EVENT_TAG_APPROVED,
                EVENT_TAG_REJECTED,
                EVENT_TAG_REMOVED
            )
        );
    }
}
