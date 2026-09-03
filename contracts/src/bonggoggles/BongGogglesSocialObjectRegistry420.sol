// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./BongGogglesAuthorization420.sol";
import "./BongGogglesIds420.sol";
import "./BongGogglesProfileRegistry420.sol";
import "./BongGogglesSocialPolicy420.sol";
import "./BongGogglesMediaRegistry420.sol";

contract BongGogglesSocialObjectRegistry420 {
    struct SocialObject {
        bytes32 objectId;
        BongGogglesTypes420.SocialObjectType objectType;
        address author;
        bytes32 parentId;
        bytes32 rootId;
        bytes32 communityId;
        bytes32 subjectRef;
        bytes32 contentHash;
        bytes32 mediaRoot;
        BongGogglesTypes420.AudienceType audienceType;
        bytes32 audienceRef;
        uint64 createdAt;
        uint64 updatedAt;
        uint32 version;
        BongGogglesTypes420.SocialObjectStatus status;
        bool exists;
    }

    BongGogglesAuthorization420 public immutable authorization;
    BongGogglesProfileRegistry420 public immutable profiles;
    BongGogglesSocialPolicy420 public immutable policy;
    BongGogglesMediaRegistry420 public immutable media;

    mapping(bytes32 => SocialObject) private _objects;
    mapping(bytes32 => mapping(uint32 => bytes32)) public contentHashAtVersion;
    mapping(bytes32 => mapping(uint32 => bytes32)) public mediaRootAtVersion;
    mapping(address => uint256) public authorNonce;

    error Unauthorized();
    error ZeroAddress();
    error ProfileInactive();
    error ObjectMissing();
    error ParentMissing();
    error InvalidParent();
    error ParentInteractionDenied();
    error InvalidMediaRoot();
    error DeletedObject();
    error InvalidStatusTransition();

    event SocialObjectPublished(bytes32 indexed objectId, address indexed author, BongGogglesTypes420.SocialObjectType objectType, bytes32 indexed parentId, uint32 version);
    event SocialObjectEdited(bytes32 indexed objectId, address indexed author, uint32 oldVersion, uint32 newVersion, bytes32 contentHash, bytes32 mediaRoot);
    event SocialObjectHidden(bytes32 indexed objectId, address indexed author, address indexed operator);
    event SocialObjectRestored(bytes32 indexed objectId, address indexed author, address indexed operator);
    event SocialObjectDeleted(bytes32 indexed objectId, address indexed author, address indexed operator);

    constructor(address authorization_, address profiles_, address policy_, address media_) {
        if (authorization_ == address(0) || profiles_ == address(0) || policy_ == address(0) || media_ == address(0)) revert ZeroAddress();
        authorization = BongGogglesAuthorization420(authorization_);
        profiles = BongGogglesProfileRegistry420(profiles_);
        policy = BongGogglesSocialPolicy420(policy_);
        media = BongGogglesMediaRegistry420(media_);
    }

    function socialObject(bytes32 objectId) external view returns (SocialObject memory) { return _objects[objectId]; }

    function publish(address author, BongGogglesTypes420.SocialObjectType objectType, bytes32 parentId, bytes32 communityId, bytes32 subjectRef, bytes32 contentHash, bytes32 mediaRoot, BongGogglesTypes420.AudiencePolicy calldata audience) external returns (bytes32 objectId) {
        if (author == address(0)) revert ZeroAddress();
        if (!authorization.canActFor(msg.sender, author, BongGogglesIds420.ACTION_POST_CREATE)) revert Unauthorized();
        if (!profiles.isActive(author)) revert ProfileInactive();
        _validateMedia(author, mediaRoot);

        bytes32 rootId;
        BongGogglesTypes420.AudienceType audienceType = audience.audienceType;
        bytes32 audienceRef = audience.audienceRef;
        if (objectType == BongGogglesTypes420.SocialObjectType.COMMENT) {
            SocialObject storage parent = _objects[parentId];
            if (!parent.exists) revert ParentMissing();
            if (parent.status != BongGogglesTypes420.SocialObjectStatus.ACTIVE) revert InvalidParent();
            if (author != parent.author) {
                BongGogglesTypes420.AudiencePolicy memory inheritedAudience = BongGogglesTypes420.AudiencePolicy(parent.audienceType, parent.audienceRef);
                if (!policy.canView(author, parent.author, inheritedAudience) || !policy.canInteract(author, parent.author)) revert ParentInteractionDenied();
            }
            rootId = parent.rootId == bytes32(0) ? parent.objectId : parent.rootId;
            audienceType = parent.audienceType;
            audienceRef = parent.audienceRef;
        } else if (parentId != bytes32(0)) {
            revert InvalidParent();
        }

        uint256 nonce = ++authorNonce[author];
        objectId = keccak256(abi.encode("420/BONG_GOGGLES/SOCIAL_OBJECT/V1", block.chainid, author, nonce, objectType));
        uint64 now_ = uint64(block.timestamp);
        _objects[objectId] = SocialObject(objectId, objectType, author, parentId, rootId, communityId, subjectRef, contentHash, mediaRoot, audienceType, audienceRef, now_, now_, 1, BongGogglesTypes420.SocialObjectStatus.ACTIVE, true);
        contentHashAtVersion[objectId][1] = contentHash;
        mediaRootAtVersion[objectId][1] = mediaRoot;
        emit SocialObjectPublished(objectId, author, objectType, parentId, 1);
    }

    function edit(address author, bytes32 objectId, bytes32 contentHash, bytes32 mediaRoot) external {
        SocialObject storage object_ = _objects[objectId];
        if (!object_.exists) revert ObjectMissing();
        if (object_.author != author) revert Unauthorized();
        if (!authorization.canActOnObject(msg.sender, author, objectId, BongGogglesIds420.ACTION_POST_EDIT)) revert Unauthorized();
        if (object_.status == BongGogglesTypes420.SocialObjectStatus.DELETED || object_.status == BongGogglesTypes420.SocialObjectStatus.REMOVED) revert DeletedObject();
        _validateMedia(author, mediaRoot);
        uint32 oldVersion = object_.version;
        uint32 newVersion = oldVersion + 1;
        object_.version = newVersion;
        object_.contentHash = contentHash;
        object_.mediaRoot = mediaRoot;
        object_.updatedAt = uint64(block.timestamp);
        contentHashAtVersion[objectId][newVersion] = contentHash;
        mediaRootAtVersion[objectId][newVersion] = mediaRoot;
        emit SocialObjectEdited(objectId, author, oldVersion, newVersion, contentHash, mediaRoot);
    }

    function hide(address author, bytes32 objectId) external {
        SocialObject storage object_ = _owned(author, objectId, BongGogglesIds420.ACTION_POST_HIDE);
        if (object_.status != BongGogglesTypes420.SocialObjectStatus.ACTIVE) revert InvalidStatusTransition();
        object_.status = BongGogglesTypes420.SocialObjectStatus.HIDDEN;
        object_.updatedAt = uint64(block.timestamp);
        emit SocialObjectHidden(objectId, author, msg.sender);
    }

    function restore(address author, bytes32 objectId) external {
        SocialObject storage object_ = _owned(author, objectId, BongGogglesIds420.ACTION_POST_HIDE);
        if (object_.status != BongGogglesTypes420.SocialObjectStatus.HIDDEN) revert InvalidStatusTransition();
        object_.status = BongGogglesTypes420.SocialObjectStatus.ACTIVE;
        object_.updatedAt = uint64(block.timestamp);
        emit SocialObjectRestored(objectId, author, msg.sender);
    }

    function deleteObject(address author, bytes32 objectId) external {
        SocialObject storage object_ = _owned(author, objectId, BongGogglesIds420.ACTION_POST_DELETE);
        if (object_.status == BongGogglesTypes420.SocialObjectStatus.DELETED || object_.status == BongGogglesTypes420.SocialObjectStatus.REMOVED) revert InvalidStatusTransition();
        object_.status = BongGogglesTypes420.SocialObjectStatus.DELETED;
        object_.updatedAt = uint64(block.timestamp);
        emit SocialObjectDeleted(objectId, author, msg.sender);
    }

    function _validateMedia(address author, bytes32 mediaRoot) internal view {
        if (mediaRoot != bytes32(0) && !media.isValidManifest(mediaRoot, author)) revert InvalidMediaRoot();
    }

    function _owned(address author, bytes32 objectId, bytes32 actionId) internal view returns (SocialObject storage object_) {
        object_ = _objects[objectId];
        if (!object_.exists) revert ObjectMissing();
        if (object_.author != author) revert Unauthorized();
        if (!authorization.canActOnObject(msg.sender, author, objectId, actionId)) revert Unauthorized();
    }
}
