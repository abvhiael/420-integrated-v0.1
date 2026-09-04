// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/genesis/ICapabilityRegistry420.sol";
import "./MessengerIds420.sol";

contract MessengerAuthorization420 {
    ICapabilityRegistry420 public immutable capabilityRegistry;
    error ZeroAddress();

    constructor(address capabilityRegistry_) {
        if (capabilityRegistry_ == address(0)) revert ZeroAddress();
        capabilityRegistry = ICapabilityRegistry420(capabilityRegistry_);
    }

    function scopeForAccount(address account) public pure returns (bytes32) {
        return keccak256(abi.encode("420/MESSENGER/SCOPE/ACCOUNT/V1", account));
    }

    function isAuthorized(address principal, address account, bytes32 actionId) external view returns (bool) {
        return capabilityRegistry.isAuthorized(principal, MessengerIds420.COMPONENT_MESSENGER, actionId, scopeForAccount(account), 0);
    }
}
