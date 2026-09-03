// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library BongGogglesIds420 {
    bytes32 internal constant COMPONENT_BONG_GOGGLES = keccak256("420/BONG_GOGGLES/COMPONENT/CORE_SOCIAL/V1");

    bytes32 internal constant ACTION_PROFILE_CREATE = keccak256("BG/ACTION/PROFILE_CREATE/V1");
    bytes32 internal constant ACTION_PROFILE_UPDATE = keccak256("BG/ACTION/PROFILE_UPDATE/V1");
    bytes32 internal constant ACTION_PROFILE_DEACTIVATE = keccak256("BG/ACTION/PROFILE_DEACTIVATE/V1");

    bytes32 internal constant ACTION_FRIEND_REQUEST = keccak256("BG/ACTION/FRIEND_REQUEST/V1");
    bytes32 internal constant ACTION_FRIEND_ACCEPT = keccak256("BG/ACTION/FRIEND_ACCEPT/V1");
    bytes32 internal constant ACTION_FRIEND_DECLINE = keccak256("BG/ACTION/FRIEND_DECLINE/V1");
    bytes32 internal constant ACTION_FRIEND_CANCEL = keccak256("BG/ACTION/FRIEND_CANCEL/V1");
    bytes32 internal constant ACTION_FRIEND_REMOVE = keccak256("BG/ACTION/FRIEND_REMOVE/V1");

    bytes32 internal constant ACTION_FOLLOW = keccak256("BG/ACTION/FOLLOW/V1");
    bytes32 internal constant ACTION_UNFOLLOW = keccak256("BG/ACTION/UNFOLLOW/V1");
    bytes32 internal constant ACTION_BLOCK = keccak256("BG/ACTION/BLOCK/V1");
    bytes32 internal constant ACTION_UNBLOCK = keccak256("BG/ACTION/UNBLOCK/V1");
    bytes32 internal constant ACTION_MUTE = keccak256("BG/ACTION/MUTE/V1");
    bytes32 internal constant ACTION_UNMUTE = keccak256("BG/ACTION/UNMUTE/V1");
    bytes32 internal constant ACTION_PREFERENCES_UPDATE = keccak256("BG/ACTION/PREFERENCES_UPDATE/V1");

    bytes32 internal constant ACTION_POST_CREATE = keccak256("BG/ACTION/POST_CREATE/V1");
    bytes32 internal constant ACTION_POST_EDIT = keccak256("BG/ACTION/POST_EDIT/V1");
    bytes32 internal constant ACTION_POST_DELETE = keccak256("BG/ACTION/POST_DELETE/V1");
    bytes32 internal constant ACTION_POST_HIDE = keccak256("BG/ACTION/POST_HIDE/V1");
}

library BongGogglesTypes420 {
    enum ProfileType { PERSONAL, CREATOR, BUSINESS, ORGANIZATION, COMMUNITY }
    enum ProfileStatus { ACTIVE, DEACTIVATED, RESTRICTED, CLOSED }
    enum FollowPolicy { OPEN, APPROVAL_REQUIRED, DISABLED }
    enum AccessPolicy { EVERYONE, FOLLOWERS, FRIENDS, FRIENDS_OF_FRIENDS, NOBODY }
    enum AudienceType { PUBLIC, FOLLOWERS, FRIENDS, GROUP, PRIVATE }
    enum SocialObjectType { STATUS, PHOTO_POST, STORY, COMMENT, REVIEW, DISCOVERY, EVENT_POST, COLLECTION }
    enum SocialObjectStatus { ACTIVE, HIDDEN, DELETED, REMOVED }

    uint32 internal constant MUTE_FEED = 1 << 0;
    uint32 internal constant MUTE_STORIES = 1 << 1;
    uint32 internal constant MUTE_NOTIFICATIONS = 1 << 2;
    uint32 internal constant MUTE_MESSAGES = 1 << 3;
    uint32 internal constant MUTE_GAME_INVITES = 1 << 4;
    uint32 internal constant MUTE_ALL = type(uint32).max;

    struct AudiencePolicy {
        AudienceType audienceType;
        bytes32 audienceRef;
    }
}
