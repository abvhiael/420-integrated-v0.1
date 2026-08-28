// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../interfaces/genesis/ICapabilityRegistry420.sol";
import "./VPNIds420.sol";

contract VPNAuthorization420 is I420System {
    ICapabilityRegistry420 public immutable capabilityRegistry;

    error ZeroAddress();

    constructor(address capabilityRegistry_) {
        if (capabilityRegistry_ == address(0)) revert ZeroAddress();
        capabilityRegistry = ICapabilityRegistry420(capabilityRegistry_);
    }

    function systemName() external pure returns (string memory) { return "VPNAuthorization420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function scopeForProvider(bytes32 providerId) public pure returns (bytes32) {
        return keccak256(abi.encode(providerId));
    }

    function scopeForNode(bytes32 providerId, bytes32 nodeId) public pure returns (bytes32) {
        return keccak256(abi.encode(providerId, nodeId));
    }

    function scopeForSession(bytes32 sessionId) public pure returns (bytes32) {
        return keccak256(abi.encode(sessionId));
    }

    function isProviderAuthorized(address principal, bytes32 providerId, bytes32 actionId, uint256 amount) external view returns (bool) {
        return capabilityRegistry.isAuthorized(principal, VPNIds420.COMPONENT_VPN, actionId, scopeForProvider(providerId), amount);
    }

    function isNodeAuthorized(address principal, bytes32 providerId, bytes32 nodeId, bytes32 actionId, uint256 amount) external view returns (bool) {
        return capabilityRegistry.isAuthorized(principal, VPNIds420.COMPONENT_VPN, actionId, scopeForNode(providerId, nodeId), amount);
    }

    function isSessionAuthorized(address principal, bytes32 sessionId, bytes32 actionId, uint256 amount) external view returns (bool) {
        return capabilityRegistry.isAuthorized(principal, VPNIds420.COMPONENT_VPN, actionId, scopeForSession(sessionId), amount);
    }
}
