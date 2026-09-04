// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./BongGogglesAuthorization420.sol";
import "./BongGogglesProfileRegistry420.sol";
import "./BongGogglesSocialObjectRegistry420.sol";
import "./BongGogglesSocialPolicy420.sol";
import "./BongGogglesIds420.sol";

contract BongGogglesReactionRegistry420 {
    struct ReactionState {
        BongGogglesTypes420.ReactionType reactionType;
        uint64 updatedAt;
    }

    BongGogglesAuthorization420 public immutable authorization;
    BongGogglesProfileRegistry420 public immutable profiles;
    BongGogglesSocialObjectRegistry420 public immutable objects;
    BongGogglesSocialPolicy420 public immutable policy;

    mapping(bytes32 => mapping(address => ReactionState)) private _reactions;

    error Unauthorized();
    error ZeroAddress();
    error ProfileInactive();
    error ObjectMissing();
    error ObjectUnavailable();
    error AudienceDenied();
    error InvalidReaction();
    error ReactionMissing();

    event ReactionSet(
        bytes32 indexed objectId,
        address indexed reactor,
        BongGogglesTypes420.ReactionType oldReaction,
        BongGogglesTypes420.ReactionType newReaction,
        address operator
    );
    event ReactionCleared(bytes32 indexed objectId, address indexed reactor, BongGogglesTypes420.ReactionType oldReaction, address operator);

    constructor(address authorization_, address profiles_, address objects_, address policy_) {
        if (authorization_ == address(0) || profiles_ == address(0) || objects_ == address(0) || policy_ == address(0)) {
            revert ZeroAddress();
        }
        authorization = BongGogglesAuthorization420(authorization_);
        profiles = BongGogglesProfileRegistry420(profiles_);
        objects = BongGogglesSocialObjectRegistry420(objects_);
        policy = BongGogglesSocialPolicy420(policy_);
    }

    function reaction(bytes32 objectId, address reactor) external view returns (ReactionState memory) {
        return _reactions[objectId][reactor];
    }

    function setReaction(address reactor, bytes32 objectId, BongGogglesTypes420.ReactionType reactionType) external {
        if (reactor == address(0)) revert ZeroAddress();
        if (reactionType == BongGogglesTypes420.ReactionType.NONE) revert InvalidReaction();
        if (!profiles.isActive(reactor)) revert ProfileInactive();
        if (!authorization.canActFor(msg.sender, reactor, BongGogglesIds420.ACTION_REACTION_SET)) revert Unauthorized();

        BongGogglesSocialObjectRegistry420.SocialObject memory object_ = objects.socialObject(objectId);
        if (!object_.exists) revert ObjectMissing();
        if (object_.status != BongGogglesTypes420.SocialObjectStatus.ACTIVE) revert ObjectUnavailable();

        BongGogglesTypes420.AudiencePolicy memory audience =
            BongGogglesTypes420.AudiencePolicy(object_.audienceType, object_.audienceRef);
        if (!policy.canView(reactor, object_.author, audience)) revert AudienceDenied();

        ReactionState storage current = _reactions[objectId][reactor];
        BongGogglesTypes420.ReactionType oldReaction = current.reactionType;
        current.reactionType = reactionType;
        current.updatedAt = uint64(block.timestamp);
        emit ReactionSet(objectId, reactor, oldReaction, reactionType, msg.sender);
    }

    function clearReaction(address reactor, bytes32 objectId) external {
        if (!authorization.canActFor(msg.sender, reactor, BongGogglesIds420.ACTION_REACTION_CLEAR)) revert Unauthorized();
        ReactionState storage current = _reactions[objectId][reactor];
        BongGogglesTypes420.ReactionType oldReaction = current.reactionType;
        if (oldReaction == BongGogglesTypes420.ReactionType.NONE) revert ReactionMissing();
        delete _reactions[objectId][reactor];
        emit ReactionCleared(objectId, reactor, oldReaction, msg.sender);
    }
}
