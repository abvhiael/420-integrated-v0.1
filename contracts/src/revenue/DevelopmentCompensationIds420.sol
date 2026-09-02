// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library DevelopmentCompensationIds420 {
    bytes32 internal constant COMPONENT_DEVELOPMENT_COMPENSATION = keccak256("420/REVENUE/DEVELOPMENT_COMPENSATION/COMPONENT/V1");
    bytes32 internal constant ACTION_CONTRIBUTE_REVENUE = keccak256("420/REVENUE/DEVELOPMENT_COMPENSATION/ACTION/CONTRIBUTE/V1");
    bytes32 internal constant BENEFICIARY_420_INTEGRATED_LABS = keccak256("420/REVENUE/BENEFICIARY/420_INTEGRATED_LABS/V1");
    bytes32 internal constant POLICY_APPLICATION_REVENUE_V1 = keccak256("420/REVENUE/POLICY/APPLICATION_REVENUE/V1");

    function scopeSource(bytes32 sourceApplicationId) internal pure returns (bytes32) {
        return keccak256(abi.encode("420/REVENUE/DEVELOPMENT_COMPENSATION/SCOPE/SOURCE/V1", sourceApplicationId));
    }
}
