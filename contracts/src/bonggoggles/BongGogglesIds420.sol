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
    bytes32 internal constant ACTION_FOLLOW_ACCEPT = keccak256("BG/ACTION/FOLLOW_ACCEPT/V1");
    bytes32 internal constant ACTION_FOLLOW_DECLINE = keccak256("BG/ACTION/FOLLOW_DECLINE/V1");
    bytes32 internal constant ACTION_FOLLOW_CANCEL = keccak256("BG/ACTION/FOLLOW_CANCEL/V1");
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
    bytes32 internal constant ACTION_REPOST_CREATE = keccak256("BG/ACTION/REPOST_CREATE/V1");
    bytes32 internal constant ACTION_QUOTE_POST_CREATE = keccak256("BG/ACTION/QUOTE_POST_CREATE/V1");
    bytes32 internal constant ACTION_SHARE = keccak256("BG/ACTION/SHARE/V1");

    bytes32 internal constant ACTION_MEDIA_REGISTER = keccak256("BG/ACTION/MEDIA_REGISTER/V1");
    bytes32 internal constant ACTION_REACTION_SET = keccak256("BG/ACTION/REACTION_SET/V1");
    bytes32 internal constant ACTION_REACTION_CLEAR = keccak256("BG/ACTION/REACTION_CLEAR/V1");

    bytes32 internal constant ACTION_TAG_CREATE = keccak256("BG/ACTION/TAG_CREATE/V1");
    bytes32 internal constant ACTION_TAG_APPROVE = keccak256("BG/ACTION/TAG_APPROVE/V1");
    bytes32 internal constant ACTION_TAG_REJECT = keccak256("BG/ACTION/TAG_REJECT/V1");
    bytes32 internal constant ACTION_TAG_REMOVE = keccak256("BG/ACTION/TAG_REMOVE/V1");

    bytes32 internal constant ACTION_PAGE_CREATE = keccak256("BG/ACTION/PAGE_CREATE/V1");
    bytes32 internal constant ACTION_PAGE_UPDATE = keccak256("BG/ACTION/PAGE_UPDATE/V1");
    bytes32 internal constant ACTION_GROUP_CREATE = keccak256("BG/ACTION/GROUP_CREATE/V1");
    bytes32 internal constant ACTION_GROUP_UPDATE = keccak256("BG/ACTION/GROUP_UPDATE/V1");
    bytes32 internal constant ACTION_GROUP_JOIN = keccak256("BG/ACTION/GROUP_JOIN/V1");
    bytes32 internal constant ACTION_GROUP_MEMBER_APPROVE = keccak256("BG/ACTION/GROUP_MEMBER_APPROVE/V1");
    bytes32 internal constant ACTION_GROUP_MEMBER_REMOVE = keccak256("BG/ACTION/GROUP_MEMBER_REMOVE/V1");
    bytes32 internal constant ACTION_EVENT_CREATE = keccak256("BG/ACTION/EVENT_CREATE/V1");
    bytes32 internal constant ACTION_EVENT_UPDATE = keccak256("BG/ACTION/EVENT_UPDATE/V1");
    bytes32 internal constant ACTION_EVENT_RSVP = keccak256("BG/ACTION/EVENT_RSVP/V1");

    bytes32 internal constant ACTION_PRIVATE_DEVICE_SET = keccak256("BG/ACTION/PRIVATE_DEVICE_SET/V1");
    bytes32 internal constant ACTION_PRIVATE_DEVICE_REVOKE = keccak256("BG/ACTION/PRIVATE_DEVICE_REVOKE/V1");
    bytes32 internal constant ACTION_PRIVATE_CONTEXT_BIND = keccak256("BG/ACTION/PRIVATE_CONTEXT_BIND/V1");
    bytes32 internal constant ACTION_PRIVATE_EPOCH_ROTATE = keccak256("BG/ACTION/PRIVATE_EPOCH_ROTATE/V1");
    bytes32 internal constant ACTION_PRIVATE_CONTEXT_CLOSE = keccak256("BG/ACTION/PRIVATE_CONTEXT_CLOSE/V1");
}

library BongGogglesTypes420 {
    enum ProfileType { PERSONAL, CREATOR, BUSINESS, ORGANIZATION, COMMUNITY }
    enum ProfileStatus { ACTIVE, DEACTIVATED, RESTRICTED, CLOSED }
    enum FollowPolicy { OPEN, APPROVAL_REQUIRED, DISABLED }
    enum AccessPolicy { EVERYONE, FOLLOWERS, FRIENDS, FRIENDS_OF_FRIENDS, NOBODY }
    enum AudienceType { PUBLIC, FOLLOWERS, FRIENDS, GROUP, PRIVATE }
    enum SocialObjectType { STATUS, PHOTO_POST, STORY, COMMENT, REVIEW, DISCOVERY, EVENT_POST, COLLECTION, REPOST, QUOTE_POST }
    enum SocialObjectStatus { ACTIVE, HIDDEN, DELETED, REMOVED }
    enum MediaType { IMAGE, VIDEO, AUDIO, DOCUMENT }
    enum ReactionType { NONE, LIKE, LOVE, LAUGH, WOW, SUPPORT }
    enum ProvenanceType { NONE, REPOST, QUOTE_POST }
    enum TagTargetType { PROFILE, PAGE, COMMUNITY }
    enum TagState { NONE, PENDING, ACTIVE, REJECTED, REMOVED }
    enum GroupPrivacy { PUBLIC, PRIVATE, HIDDEN }
    enum GroupJoinPolicy { OPEN, APPROVAL_REQUIRED, INVITE_ONLY, CLOSED }
    enum GroupMemberState { NONE, PENDING, ACTIVE, REMOVED }
    enum GroupRole { NONE, MEMBER, MODERATOR, ADMIN, OWNER }
    enum EventHostType { PROFILE, PAGE, GROUP }
    enum EventVisibility { PUBLIC, GROUP_ONLY, INVITE_ONLY }
    enum RSVPState { NONE, INTERESTED, GOING, DECLINED }
    enum PrivateConversationType { DIRECT, GROUP, GAME, EVENT }

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
