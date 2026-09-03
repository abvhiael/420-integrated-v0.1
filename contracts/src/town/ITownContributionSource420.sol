// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface ITownContributionSource420 {
    struct PostRecord {
        bool exists;
        bool active;
        address author;
        bytes32 contentHash;
    }

    struct CommentRecord {
        bool exists;
        bool active;
        address author;
        bytes32 parentId;
        bytes32 contentHash;
    }

    struct CurationRecord {
        bool exists;
        bool active;
        address curator;
        bytes32 targetId;
        bytes32 decisionHash;
    }

    struct ModerationRecord {
        bool exists;
        bool finalized;
        bool overturned;
        bool authorizedAtAction;
        address moderator;
        bytes32 communityId;
        bytes32 targetId;
        bytes32 actionHash;
    }

    struct TranslationRecord {
        bool exists;
        bool accepted;
        address translator;
        bytes32 sourceId;
        bytes32 sourceLanguage;
        bytes32 targetLanguage;
        bytes32 translationHash;
    }

    struct CommunityResourceRecord {
        bool exists;
        bool published;
        address contributor;
        bytes32 communityId;
        bytes32 resourceHash;
    }

    function post(bytes32 sourceId) external view returns (PostRecord memory);
    function comment(bytes32 sourceId) external view returns (CommentRecord memory);
    function curation(bytes32 sourceId) external view returns (CurationRecord memory);
    function moderationAction(bytes32 sourceId) external view returns (ModerationRecord memory);
    function translation(bytes32 sourceId) external view returns (TranslationRecord memory);
    function communityResource(bytes32 sourceId) external view returns (CommunityResourceRecord memory);
}
