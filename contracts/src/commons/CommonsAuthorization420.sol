// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../interfaces/genesis/ICapabilityRegistry420.sol";
import "./CommonsIds420.sol";

contract CommonsAuthorization420 is I420System {
    ICapabilityRegistry420 public immutable capabilityRegistry;

    error ZeroAddress();

    constructor(address capabilityRegistry_) {
        if (capabilityRegistry_ == address(0)) revert ZeroAddress();
        capabilityRegistry = ICapabilityRegistry420(capabilityRegistry_);
    }

    function systemName() external pure returns (string memory) { return "CommonsAuthorization420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function scopeForSpace(bytes32 spaceId) public pure returns (bytes32) {
        return keccak256(abi.encode(spaceId));
    }

    function isAuthorized(bytes32 spaceId, address principal, bytes32 actionId) external view returns (bool) {
        return capabilityRegistry.isAuthorized(
            principal,
            CommonsIds420.COMPONENT_COMMONS,
            actionId,
            scopeForSpace(spaceId),
            0
        );
    }
}
