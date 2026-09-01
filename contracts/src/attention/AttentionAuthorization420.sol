// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/genesis/ICapabilityRegistry420.sol";
import "./AttentionIds420.sol";

contract AttentionAuthorization420 {
    ICapabilityRegistry420 public immutable capabilityRegistry;
    error ZeroAddress();

    constructor(address capabilityRegistry_) {
        if (capabilityRegistry_ == address(0)) revert ZeroAddress();
        capabilityRegistry = ICapabilityRegistry420(capabilityRegistry_);
    }

    function scopeForAccount(address account) public pure returns (bytes32) {
        return keccak256(abi.encode("420/ATTENTION/SCOPE/ACCOUNT/V1", account));
    }

    function isAuthorized(address principal, address account, bytes32 actionId) external view returns (bool) {
        return capabilityRegistry.isAuthorized(principal, AttentionIds420.COMPONENT_ATTENTION, actionId, scopeForAccount(account), 0);
    }
}
