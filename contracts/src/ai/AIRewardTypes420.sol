// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library AIRewardTypes420 {
    bytes32 internal constant APP_ID = keccak256("420AI");

    bytes32 internal constant DATASET_CONTRIBUTION = keccak256("DATASET_CONTRIBUTION");
    bytes32 internal constant EVALUATION = keccak256("EVALUATION");
    bytes32 internal constant MODEL_CORRECTION = keccak256("MODEL_CORRECTION");
    bytes32 internal constant PROVIDER_VALIDATION = keccak256("PROVIDER_VALIDATION");

    function supported(bytes32 contributionType) internal pure returns (bool) {
        return contributionType == DATASET_CONTRIBUTION
            || contributionType == EVALUATION
            || contributionType == MODEL_CORRECTION
            || contributionType == PROVIDER_VALIDATION;
    }
}
