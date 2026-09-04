// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library EmergencyDomains {
    bytes32 internal constant CULTIVATION = keccak256("HC.EMERGENCY.CULTIVATION");
    bytes32 internal constant BREEDING = keccak256("HC.EMERGENCY.BREEDING");
    bytes32 internal constant MANUFACTURING = keccak256("HC.EMERGENCY.MANUFACTURING");
    bytes32 internal constant MARKET = keccak256("HC.EMERGENCY.MARKET");
    bytes32 internal constant LEASE = keccak256("HC.EMERGENCY.LEASE");
    bytes32 internal constant LICENSE = keccak256("HC.EMERGENCY.LICENSE");
    bytes32 internal constant RIGHTS = keccak256("HC.EMERGENCY.RIGHTS");
    bytes32 internal constant ORGANIZATION_GOVERNANCE = keccak256("HC.EMERGENCY.ORGANIZATION_GOVERNANCE");
    bytes32 internal constant COOPERATIVE_GOVERNANCE = keccak256("HC.EMERGENCY.COOPERATIVE_GOVERNANCE");
    bytes32 internal constant RANDOMNESS_REQUEST = keccak256("HC.EMERGENCY.RANDOMNESS_REQUEST");
    bytes32 internal constant COMPETITION_ENTRY = keccak256("HC.EMERGENCY.COMPETITION_ENTRY");
    bytes32 internal constant MISSION_ACTIVATION = keccak256("HC.EMERGENCY.MISSION_ACTIVATION");
    bytes32 internal constant MODULE_ACTIVATION = keccak256("HC.EMERGENCY.MODULE_ACTIVATION");
}
