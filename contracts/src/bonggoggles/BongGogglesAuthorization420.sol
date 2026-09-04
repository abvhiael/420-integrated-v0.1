// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/genesis/ICapabilityRegistry420.sol";
import "./BongGogglesIds420.sol";

contract BongGogglesAuthorization420 {
    ICapabilityRegistry420 public immutable capabilityRegistry;

    error ZeroAddress();

    constructor(address capabilityRegistry_) {
        if (capabilityRegistry_ == address(0)) revert ZeroAddress();
        capabilityRegistry = ICapabilityRegistry420(capabilityRegistry_);
    }

    function scopeForAccount(address account) public pure returns (bytes32) {
        return keccak256(abi.encode("420/BONG_GOGGLES/SCOPE/ACCOUNT/V1", account));
    }

    function scopeForObject(bytes32 objectId) public pure returns (bytes32) {
        return keccak256(abi.encode("420/BONG_GOGGLES/SCOPE/OBJECT/V1", objectId));
    }

    function canActFor(address principal, address account, bytes32 actionId) public view returns (bool) {
        if (principal == account) return true;
        return capabilityRegistry.isAuthorized(
            principal,
            BongGogglesIds420.COMPONENT_BONG_GOGGLES,
            actionId,
            scopeForAccount(account),
            0
        );
    }

    function canActOnObject(address principal, address owner, bytes32 objectId, bytes32 actionId) external view returns (bool) {
        if (principal == owner) return true;
        if (capabilityRegistry.isAuthorized(
            principal,
            BongGogglesIds420.COMPONENT_BONG_GOGGLES,
            actionId,
            scopeForObject(objectId),
            0
        )) return true;
        return canActFor(principal, owner, actionId);
    }
}
