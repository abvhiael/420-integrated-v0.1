// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./BongGogglesIds420.sol";
import "./BongGogglesProfileRegistry420.sol";
import "./BongGogglesRelationshipGraph420.sol";

contract BongGogglesSocialPolicy420 {
    BongGogglesProfileRegistry420 public immutable profiles;
    BongGogglesRelationshipGraph420 public immutable relationships;

    error ZeroAddress();

    constructor(address profiles_, address relationships_) {
        if (profiles_ == address(0) || relationships_ == address(0)) revert ZeroAddress();
        profiles = BongGogglesProfileRegistry420(profiles_);
        relationships = BongGogglesRelationshipGraph420(relationships_);
    }

    function canInteract(address actor, address target) public view returns (bool) {
        if (actor == address(0) || target == address(0) || actor == target) return false;
        if (!profiles.isActive(actor) || !profiles.isActive(target)) return false;
        return !relationships.isBlockedEither(actor, target);
    }

    function canView(address viewer, address author, BongGogglesTypes420.AudiencePolicy calldata audience)
        external view returns (bool)
    {
        if (viewer == author) return profiles.isActive(author);
        if (!canInteract(viewer, author)) return false;
        if (audience.audienceType == BongGogglesTypes420.AudienceType.PUBLIC) return true;
        if (audience.audienceType == BongGogglesTypes420.AudienceType.FOLLOWERS) return relationships.isFollowing(viewer, author);
        if (audience.audienceType == BongGogglesTypes420.AudienceType.FRIENDS) return relationships.areFriends(viewer, author);
        return false; // GROUP and PRIVATE require context-specific resolvers.
    }

    function canSendFriendRequest(address requester, address recipient) external view returns (bool) {
        if (!canInteract(requester, recipient) || relationships.areFriends(requester, recipient)) return false;
        BongGogglesProfileRegistry420.Preferences memory p = profiles.preferences(recipient);
        if (p.friendRequestPolicy == BongGogglesTypes420.AccessPolicy.EVERYONE) return true;
        if (p.friendRequestPolicy == BongGogglesTypes420.AccessPolicy.FRIENDS) return relationships.areFriends(requester, recipient);
        return false; // FRIENDS_OF_FRIENDS is indexer-assisted until canonical mutual lookup exists.
    }

    function canMessage(address sender, address recipient) external view returns (bool) {
        if (!canInteract(sender, recipient)) return false;
        BongGogglesProfileRegistry420.Preferences memory p = profiles.preferences(recipient);
        return _meetsPolicy(sender, recipient, p.messagePolicy);
    }

    function canInviteToGame(address inviter, address recipient) external view returns (bool) {
        if (!canInteract(inviter, recipient)) return false;
        if (relationships.isMuted(recipient, inviter, BongGogglesTypes420.MUTE_GAME_INVITES)) return false;
        BongGogglesProfileRegistry420.Preferences memory p = profiles.preferences(recipient);
        return _meetsPolicy(inviter, recipient, p.gameInvitePolicy);
    }

    function _meetsPolicy(address actor, address target, BongGogglesTypes420.AccessPolicy policy) internal view returns (bool) {
        if (policy == BongGogglesTypes420.AccessPolicy.EVERYONE) return true;
        if (policy == BongGogglesTypes420.AccessPolicy.FOLLOWERS) return relationships.isFollowing(actor, target);
        if (policy == BongGogglesTypes420.AccessPolicy.FRIENDS) return relationships.areFriends(actor, target);
        return false;
    }
}
