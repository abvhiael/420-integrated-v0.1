// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../interfaces/genesis/ICapabilityRegistry420.sol";
import "./GamingIds420.sol";

contract GamingAuthorization420 is I420System {
    ICapabilityRegistry420 public immutable capabilityRegistry;

    error ZeroAddress();
    error NotAuthorized();

    constructor(address capabilityRegistry_) {
        if (capabilityRegistry_ == address(0)) revert ZeroAddress();
        capabilityRegistry = ICapabilityRegistry420(capabilityRegistry_);
    }

    function systemName() external pure returns (string memory) { return "GamingAuthorization420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function scopeForGame(bytes32 gameId) public pure returns (bytes32) {
        return keccak256(abi.encode(gameId));
    }

    function isAuthorized(address principal, bytes32 gameId, bytes32 actionId) public view returns (bool) {
        return capabilityRegistry.isAuthorized(
            principal,
            GamingIds420.COMPONENT_GAMING,
            actionId,
            scopeForGame(gameId),
            0
        );
    }

    function requireAuthorized(address principal, bytes32 gameId, bytes32 actionId) external view {
        if (!isAuthorized(principal, gameId, actionId)) revert NotAuthorized();
    }
}
