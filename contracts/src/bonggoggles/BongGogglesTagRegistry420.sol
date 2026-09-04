// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./BongGogglesAuthorization420.sol";
import "./BongGogglesIds420.sol";
import "./BongGogglesProfileRegistry420.sol";
import "./BongGogglesSocialPolicy420.sol";
import "./BongGogglesSocialObjectRegistry420.sol";

contract BongGogglesTagRegistry420 {
    struct TagRecord {
        bytes32 tagId;
        bytes32 objectId;
        address objectAuthor;
        address target;
        BongGogglesTypes420.TagTargetType targetType;
        BongGogglesTypes420.TagState state;
        uint64 createdAt;
        uint64 resolvedAt;
        bool exists;
    }

    BongGogglesAuthorization420 public immutable authorization;
    BongGogglesProfileRegistry420 public immutable profiles;
    BongGogglesSocialPolicy420 public immutable policy;
    BongGogglesSocialObjectRegistry420 public immutable objects;

    mapping(bytes32 => TagRecord) private _tags;
    mapping(bytes32 => bytes32) public currentTagForKey;
    mapping(address => uint256) public authorTagNonce;

    error ZeroAddress();
    error Unauthorized();
    error ProfileInactive();
    error ObjectMissing();
    error ObjectUnavailable();
    error WrongObjectAuthor();
    error ProtectedObject();
    error MentionDenied();
    error TargetCannotView();
    error InvalidTargetType();
    error DuplicateTag();
    error TagMissing();
    error TagNotPending();
    error TagNotRemovable();
    error WrongTarget();
    error WrongActor();

    event TagCreated(
        bytes32 indexed tagId,
        bytes32 indexed objectId,
        address indexed target,
        address objectAuthor,
        BongGogglesTypes420.TagTargetType targetType,
        BongGogglesTypes420.TagState state,
        address operator
    );
    event TagApproved(bytes32 indexed tagId, bytes32 indexed objectId, address indexed target, address operator);
    event TagRejected(bytes32 indexed tagId, bytes32 indexed objectId, address indexed target, address operator);
    event TagRemoved(bytes32 indexed tagId, bytes32 indexed objectId, address indexed actor, address operator);

    constructor(address authorization_, address profiles_, address policy_, address objects_) {
        if (authorization_ == address(0) || profiles_ == address(0) || policy_ == address(0) || objects_ == address(0)) {
            revert ZeroAddress();
        }
        authorization = BongGogglesAuthorization420(authorization_);
        profiles = BongGogglesProfileRegistry420(profiles_);
        policy = BongGogglesSocialPolicy420(policy_);
        objects = BongGogglesSocialObjectRegistry420(objects_);
    }

    function tag(bytes32 tagId) external view returns (TagRecord memory) {
        return _tags[tagId];
    }

    function tagKey(bytes32 objectId, address target, BongGogglesTypes420.TagTargetType targetType)
        public pure returns (bytes32)
    {
        return keccak256(abi.encode("420/BONG_GOGGLES/TAG_KEY/V1", objectId, target, targetType));
    }

    function isEffectiveTag(bytes32 tagId) external view returns (bool) {
        TagRecord storage r = _tags[tagId];
        if (!r.exists || r.state != BongGogglesTypes420.TagState.ACTIVE) return false;
        if (!profiles.isActive(r.objectAuthor) || !profiles.isActive(r.target)) return false;
        BongGogglesSocialObjectRegistry420.SocialObject memory object_ = objects.socialObject(r.objectId);
        if (!object_.exists || object_.status != BongGogglesTypes420.SocialObjectStatus.ACTIVE) return false;
        if (object_.audienceType != BongGogglesTypes420.AudienceType.PUBLIC) return false;
        if (r.objectAuthor == r.target) return true;
        return policy.canMention(r.objectAuthor, r.target);
    }

    function createTag(
        address author,
        bytes32 objectId,
        address target,
        BongGogglesTypes420.TagTargetType targetType
    ) external returns (bytes32 tagId) {
        if (author == address(0) || target == address(0)) revert ZeroAddress();
        if (!authorization.canActOnObject(msg.sender, author, objectId, BongGogglesIds420.ACTION_TAG_CREATE)) revert Unauthorized();
        if (!profiles.isActive(author) || !profiles.isActive(target)) revert ProfileInactive();

        BongGogglesSocialObjectRegistry420.SocialObject memory object_ = objects.socialObject(objectId);
        if (!object_.exists) revert ObjectMissing();
        if (object_.author != author) revert WrongObjectAuthor();
        if (object_.status != BongGogglesTypes420.SocialObjectStatus.ACTIVE) revert ObjectUnavailable();
        // Canonical on-chain tags are public-object only in V1. Protected-content mentions belong in the encrypted/off-chain layer.
        if (object_.audienceType != BongGogglesTypes420.AudienceType.PUBLIC) revert ProtectedObject();

        _validateTargetType(target, targetType);
        if (author != target) {
            if (!policy.canMention(author, target)) revert MentionDenied();
            BongGogglesTypes420.AudiencePolicy memory publicAudience =
                BongGogglesTypes420.AudiencePolicy(BongGogglesTypes420.AudienceType.PUBLIC, bytes32(0));
            if (!policy.canView(target, author, publicAudience)) revert TargetCannotView();
        }

        bytes32 key = tagKey(objectId, target, targetType);
        bytes32 existingId = currentTagForKey[key];
        if (existingId != bytes32(0)) {
            BongGogglesTypes420.TagState existingState = _tags[existingId].state;
            if (existingState == BongGogglesTypes420.TagState.PENDING || existingState == BongGogglesTypes420.TagState.ACTIVE) {
                revert DuplicateTag();
            }
        }

        BongGogglesTypes420.TagState initialState =
            targetType == BongGogglesTypes420.TagTargetType.PROFILE || author == target
                ? BongGogglesTypes420.TagState.ACTIVE
                : BongGogglesTypes420.TagState.PENDING;

        uint256 nonce = ++authorTagNonce[author];
        tagId = keccak256(abi.encode(
            "420/BONG_GOGGLES/TAG/V1",
            block.chainid,
            objectId,
            author,
            target,
            targetType,
            nonce
        ));
        uint64 now_ = uint64(block.timestamp);
        _tags[tagId] = TagRecord(tagId, objectId, author, target, targetType, initialState, now_, 0, true);
        currentTagForKey[key] = tagId;
        emit TagCreated(tagId, objectId, target, author, targetType, initialState, msg.sender);
    }

    function approveTag(address target, bytes32 tagId) external {
        TagRecord storage r = _pending(tagId);
        if (r.target != target) revert WrongTarget();
        if (!authorization.canActFor(msg.sender, target, BongGogglesIds420.ACTION_TAG_APPROVE)) revert Unauthorized();
        if (!profiles.isActive(target) || !profiles.isActive(r.objectAuthor)) revert ProfileInactive();
        _revalidate(r);
        r.state = BongGogglesTypes420.TagState.ACTIVE;
        r.resolvedAt = uint64(block.timestamp);
        emit TagApproved(tagId, r.objectId, target, msg.sender);
    }

    function rejectTag(address target, bytes32 tagId) external {
        TagRecord storage r = _pending(tagId);
        if (r.target != target) revert WrongTarget();
        if (!authorization.canActFor(msg.sender, target, BongGogglesIds420.ACTION_TAG_REJECT)) revert Unauthorized();
        r.state = BongGogglesTypes420.TagState.REJECTED;
        r.resolvedAt = uint64(block.timestamp);
        delete currentTagForKey[tagKey(r.objectId, r.target, r.targetType)];
        emit TagRejected(tagId, r.objectId, target, msg.sender);
    }

    function removeTag(address actor, bytes32 tagId) external {
        TagRecord storage r = _tags[tagId];
        if (!r.exists) revert TagMissing();
        if (r.state != BongGogglesTypes420.TagState.PENDING && r.state != BongGogglesTypes420.TagState.ACTIVE) {
            revert TagNotRemovable();
        }
        if (actor == r.objectAuthor) {
            if (!authorization.canActOnObject(msg.sender, actor, r.objectId, BongGogglesIds420.ACTION_TAG_REMOVE)) revert Unauthorized();
        } else if (actor == r.target) {
            if (!authorization.canActFor(msg.sender, actor, BongGogglesIds420.ACTION_TAG_REMOVE)) revert Unauthorized();
        } else {
            revert WrongActor();
        }
        r.state = BongGogglesTypes420.TagState.REMOVED;
        r.resolvedAt = uint64(block.timestamp);
        delete currentTagForKey[tagKey(r.objectId, r.target, r.targetType)];
        emit TagRemoved(tagId, r.objectId, actor, msg.sender);
    }

    function _pending(bytes32 tagId) internal view returns (TagRecord storage r) {
        r = _tags[tagId];
        if (!r.exists) revert TagMissing();
        if (r.state != BongGogglesTypes420.TagState.PENDING) revert TagNotPending();
    }

    function _revalidate(TagRecord storage r) internal view {
        BongGogglesSocialObjectRegistry420.SocialObject memory object_ = objects.socialObject(r.objectId);
        if (!object_.exists || object_.status != BongGogglesTypes420.SocialObjectStatus.ACTIVE) revert ObjectUnavailable();
        if (object_.audienceType != BongGogglesTypes420.AudienceType.PUBLIC) revert ProtectedObject();
        if (r.objectAuthor != r.target && !policy.canMention(r.objectAuthor, r.target)) revert MentionDenied();
    }

    function _validateTargetType(address target, BongGogglesTypes420.TagTargetType targetType) internal view {
        BongGogglesTypes420.ProfileType profileType = profiles.profile(target).profileType;
        if (targetType == BongGogglesTypes420.TagTargetType.PROFILE) {
            if (profileType != BongGogglesTypes420.ProfileType.PERSONAL && profileType != BongGogglesTypes420.ProfileType.CREATOR) {
                revert InvalidTargetType();
            }
            return;
        }
        if (targetType == BongGogglesTypes420.TagTargetType.PAGE) {
            if (profileType != BongGogglesTypes420.ProfileType.BUSINESS && profileType != BongGogglesTypes420.ProfileType.ORGANIZATION) {
                revert InvalidTargetType();
            }
            return;
        }
        if (profileType != BongGogglesTypes420.ProfileType.COMMUNITY) revert InvalidTargetType();
    }
}
