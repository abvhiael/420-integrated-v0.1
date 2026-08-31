// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library TreasuryIds420 {
    bytes32 internal constant COMPONENT_TREASURY = keccak256("420/TREASURY/COMPONENT/V1");
    bytes32 internal constant ACTION_EXECUTE_DISBURSEMENT = keccak256("420/TREASURY/ACTION/EXECUTE_DISBURSEMENT/V1");
    bytes32 internal constant ACTION_CANCEL_DISBURSEMENT = keccak256("420/TREASURY/ACTION/CANCEL_DISBURSEMENT/V1");
    bytes32 internal constant BUDGET_PROTOCOL = keccak256("420/TREASURY/BUDGET/PROTOCOL/V1");
    bytes32 internal constant BUDGET_DEVELOPMENT = keccak256("420/TREASURY/BUDGET/DEVELOPMENT/V1");
    bytes32 internal constant BUDGET_SECURITY = keccak256("420/TREASURY/BUDGET/SECURITY/V1");
    bytes32 internal constant BUDGET_COMMUNITY = keccak256("420/TREASURY/BUDGET/COMMUNITY/V1");
    bytes32 internal constant BUDGET_ECOSYSTEM = keccak256("420/TREASURY/BUDGET/ECOSYSTEM/V1");
    bytes32 internal constant BUDGET_EMERGENCY = keccak256("420/TREASURY/BUDGET/EMERGENCY/V1");
}
