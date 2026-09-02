// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library ApplicationRevenueIds420 {
    bytes32 internal constant COMPONENT_APPLICATION_REVENUE = keccak256("420/REVENUE/APPLICATION/COMPONENT/V1");
    bytes32 internal constant ACTION_SET_PROFILE = keccak256("420/REVENUE/APPLICATION/ACTION/SET_PROFILE/V1");
    bytes32 internal constant ACTION_DEACTIVATE_PROFILE = keccak256("420/REVENUE/APPLICATION/ACTION/DEACTIVATE_PROFILE/V1");

    bytes32 internal constant TREASURY_SMART_ACCOUNT = keccak256("420/REVENUE/TREASURY_KIND/SMART_ACCOUNT/V1");
    bytes32 internal constant TREASURY_VAULT = keccak256("420/REVENUE/TREASURY_KIND/VAULT/V1");
    bytes32 internal constant TREASURY_CONTRACT = keccak256("420/REVENUE/TREASURY_KIND/CONTRACT/V1");

    function scopeApplication(bytes32 applicationId) internal pure returns (bytes32) {
        return keccak256(abi.encode("420/REVENUE/APPLICATION/SCOPE/V1", applicationId));
    }

    function validTreasuryKind(bytes32 treasuryKind) internal pure returns (bool) {
        return treasuryKind == TREASURY_SMART_ACCOUNT || treasuryKind == TREASURY_VAULT || treasuryKind == TREASURY_CONTRACT;
    }
}
