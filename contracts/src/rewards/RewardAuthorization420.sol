// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/genesis/ICapabilityRegistry420.sol";
import "./RewardIds420.sol";

contract RewardAuthorization420 {
    ICapabilityRegistry420 public immutable capabilityRegistry;

    error ZeroAddress();

    constructor(address capabilityRegistry_) {
        if (capabilityRegistry_ == address(0)) revert ZeroAddress();
        capabilityRegistry = ICapabilityRegistry420(capabilityRegistry_);
    }

    function globalScope() public pure returns (bytes32) {
        return keccak256("420/REWARDS/SCOPE/GLOBAL/V1");
    }

    function scopeForApp(bytes32 appId) public pure returns (bytes32) {
        return keccak256(abi.encode("420/REWARDS/SCOPE/APP/V1", appId));
    }

    function scopeForAccount(address account) public pure returns (bytes32) {
        return keccak256(abi.encode("420/REWARDS/SCOPE/ACCOUNT/V1", account));
    }

    function canPublish(address principal, bytes32 appId) external view returns (bool) {
        return capabilityRegistry.isAuthorized(
            principal,
            RewardIds420.COMPONENT_REWARDS,
            RewardIds420.ACTION_PUBLISH_CONTRIBUTION,
            scopeForApp(appId),
            0
        );
    }

    function canClaim(address principal, address account) external view returns (bool) {
        return capabilityRegistry.isAuthorized(
            principal,
            RewardIds420.COMPONENT_REWARDS,
            RewardIds420.ACTION_CLAIM_REWARD,
            scopeForAccount(account),
            0
        );
    }

    function canBindDistributor(address principal) external view returns (bool) {
        return capabilityRegistry.isAuthorized(
            principal,
            RewardIds420.COMPONENT_REWARDS,
            RewardIds420.ACTION_BIND_DISTRIBUTOR,
            globalScope(),
            0
        );
    }
}