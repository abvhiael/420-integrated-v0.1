// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library TownRewardTypes420 {
    bytes32 internal constant APP_ID = keccak256("420Town");

    bytes32 internal constant POST = keccak256("POST");
    bytes32 internal constant COMMENT = keccak256("COMMENT");
    bytes32 internal constant CURATION = keccak256("CURATION");
    bytes32 internal constant MODERATION_ACTION = keccak256("MODERATION_ACTION");
    bytes32 internal constant TRANSLATION = keccak256("TRANSLATION");
    bytes32 internal constant COMMUNITY_RESOURCE = keccak256("COMMUNITY_RESOURCE");

    function supported(bytes32 contributionType) internal pure returns (bool) {
        return contributionType == POST
            || contributionType == COMMENT
            || contributionType == CURATION
            || contributionType == MODERATION_ACTION
            || contributionType == TRANSLATION
            || contributionType == COMMUNITY_RESOURCE;
    }
}
