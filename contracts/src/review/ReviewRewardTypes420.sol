// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library ReviewRewardTypes420 {
    bytes32 internal constant APP_ID = keccak256("420Review");

    bytes32 internal constant REVIEW = keccak256("REVIEW");
    bytes32 internal constant CORRECTION = keccak256("CORRECTION");
    bytes32 internal constant VERIFICATION = keccak256("VERIFICATION");
    bytes32 internal constant CURATION = keccak256("CURATION");

    function supported(bytes32 contributionType) internal pure returns (bool) {
        return contributionType == REVIEW
            || contributionType == CORRECTION
            || contributionType == VERIFICATION
            || contributionType == CURATION;
    }
}
