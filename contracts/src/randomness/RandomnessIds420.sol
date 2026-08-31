// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library RandomnessIds420 {
    bytes32 internal constant METHOD_NATIVE_THRESHOLD_VRF = keccak256("420.RANDOM.METHOD.NATIVE_THRESHOLD_VRF.V1");
    bytes32 internal constant METHOD_COMMIT_REVEAL = keccak256("420.RANDOM.METHOD.COMMIT_REVEAL.V1");
    bytes32 internal constant METHOD_EXTERNAL_VRF = keccak256("420.RANDOM.METHOD.EXTERNAL_VRF.V1");

    bytes32 internal constant DOMAIN_BET = keccak256("420.RANDOM.DOMAIN.BET.V1");
    bytes32 internal constant DOMAIN_GAME = keccak256("420.RANDOM.DOMAIN.GAME.V1");
    bytes32 internal constant DOMAIN_LOTTERY = keccak256("420.RANDOM.DOMAIN.LOTTERY.V1");
    bytes32 internal constant DOMAIN_GENERIC = keccak256("420.RANDOM.DOMAIN.GENERIC.V1");

    bytes32 internal constant REQUEST_TYPEHASH = keccak256("420.RANDOM.REQUEST.V1");
    bytes32 internal constant ROOT_TYPEHASH = keccak256("420.RANDOM.ROOT.V1");
    bytes32 internal constant DRAW_TYPEHASH = keccak256("420.RANDOM.DRAW.V1");
}