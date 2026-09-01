// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library GrantIds420 {
    bytes32 internal constant COMPONENT_GRANTS = keccak256("420/GRANTS/COMPONENT/V1");
    bytes32 internal constant ACTION_SUBMIT_APPLICATION = keccak256("420/GRANTS/ACTION/SUBMIT_APPLICATION/V1");
    bytes32 internal constant ACTION_SUBMIT_MILESTONE = keccak256("420/GRANTS/ACTION/SUBMIT_MILESTONE/V1");
    bytes32 internal constant PROGRAM_DEVELOPMENT = keccak256("420/GRANTS/PROGRAM/DEVELOPMENT/V1");
    bytes32 internal constant PROGRAM_COMMUNITY = keccak256("420/GRANTS/PROGRAM/COMMUNITY/V1");
    bytes32 internal constant PROGRAM_RESEARCH = keccak256("420/GRANTS/PROGRAM/RESEARCH/V1");
    bytes32 internal constant PROGRAM_ECOSYSTEM = keccak256("420/GRANTS/PROGRAM/ECOSYSTEM/V1");
}
