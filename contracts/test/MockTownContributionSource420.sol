// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/town/ITownContributionSource420.sol";

contract MockTownContributionSource420 is ITownContributionSource420 {
    mapping(bytes32 => PostRecord) internal posts;
    mapping(bytes32 => CommentRecord) internal comments;
    mapping(bytes32 => CurationRecord) internal curations;
    mapping(bytes32 => ModerationRecord) internal moderation;
    mapping(bytes32 => TranslationRecord) internal translations;
    mapping(bytes32 => CommunityResourceRecord) internal resources;

    function setPost(bytes32 id, PostRecord calldata r) external { posts[id] = r; }
    function setComment(bytes32 id, CommentRecord calldata r) external { comments[id] = r; }
    function setCuration(bytes32 id, CurationRecord calldata r) external { curations[id] = r; }
    function setModeration(bytes32 id, ModerationRecord calldata r) external { moderation[id] = r; }
    function setTranslation(bytes32 id, TranslationRecord calldata r) external { translations[id] = r; }
    function setResource(bytes32 id, CommunityResourceRecord calldata r) external { resources[id] = r; }

    function post(bytes32 id) external view returns (PostRecord memory) { return posts[id]; }
    function comment(bytes32 id) external view returns (CommentRecord memory) { return comments[id]; }
    function curation(bytes32 id) external view returns (CurationRecord memory) { return curations[id]; }
    function moderationAction(bytes32 id) external view returns (ModerationRecord memory) { return moderation[id]; }
    function translation(bytes32 id) external view returns (TranslationRecord memory) { return translations[id]; }
    function communityResource(bytes32 id) external view returns (CommunityResourceRecord memory) { return resources[id]; }
}
