// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library ActionIds {
    bytes32 internal constant GROWER_PROFILE_CREATE = keccak256("HC.ACTION.GROWER_PROFILE_REGISTRY.CREATE");

    bytes32 internal constant REGION_REGISTER = keccak256("HC.ACTION.REGION_REGISTRY.REGISTER");

    bytes32 internal constant LAND_REGISTER = keccak256("HC.ACTION.LAND_REGISTRY.REGISTER");
    bytes32 internal constant PUBLIC_PLOT_REGISTER = keccak256("HC.ACTION.PUBLIC_CULTIVATION_ACCESS.REGISTER");

    bytes32 internal constant GENESIS_SET_ROOTS = keccak256("HC.ACTION.GENESIS_REGISTRY.SET_ROOTS");
    bytes32 internal constant GENESIS_FINALIZE = keccak256("HC.ACTION.GENESIS_REGISTRY.FINALIZE");

    bytes32 internal constant RULESET_REGISTER = keccak256("HC.ACTION.RULESET_REGISTRY.REGISTER");
    bytes32 internal constant RULESET_ROUTE = keccak256("HC.ACTION.RULESET_ROUTER.ROUTE");

    bytes32 internal constant MODULE_REGISTER = keccak256("HC.ACTION.MODULE_REGISTRY.REGISTER");
    bytes32 internal constant MODULE_SET_STATE = keccak256("HC.ACTION.MODULE_REGISTRY.SET_STATE");

    bytes32 internal constant EMERGENCY_RESTRICT = keccak256("HC.ACTION.EMERGENCY_STATE.RESTRICT");
    bytes32 internal constant EMERGENCY_RELEASE = keccak256("HC.ACTION.EMERGENCY_STATE.RELEASE");
}
