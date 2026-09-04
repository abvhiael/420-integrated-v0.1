// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library FoundingRegions {
    uint16 internal constant REGION_ONE = 1;
    uint16 internal constant REGION_TWO = 2;
    uint16 internal constant REGION_THREE = 3;

    bytes32 internal constant REGION_ONE_METADATA = keccak256("HC.REGION.1.METADATA.V1");
    bytes32 internal constant REGION_TWO_METADATA = keccak256("HC.REGION.2.METADATA.V1");
    bytes32 internal constant REGION_THREE_METADATA = keccak256("HC.REGION.3.METADATA.V1");

    bytes32 internal constant REGION_ONE_CLIMATE = keccak256("HC.REGION.1.CLIMATE.V1");
    bytes32 internal constant REGION_TWO_CLIMATE = keccak256("HC.REGION.2.CLIMATE.V1");
    bytes32 internal constant REGION_THREE_CLIMATE = keccak256("HC.REGION.3.CLIMATE.V1");

    bytes32 internal constant REGION_ONE_RULESET = keccak256("HC.REGION.1.RULESET.V1");
    bytes32 internal constant REGION_TWO_RULESET = keccak256("HC.REGION.2.RULESET.V1");
    bytes32 internal constant REGION_THREE_RULESET = keccak256("HC.REGION.3.RULESET.V1");
}
