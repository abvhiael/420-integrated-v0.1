// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../interfaces/genesis/ICapabilityRegistry420.sol";
import "./ResourceIds420.sol";

contract ResourceAuthorization420 is I420System {
    ICapabilityRegistry420 public immutable capabilityRegistry;
    error ZeroAddress();
    constructor(address capabilityRegistry_) { if (capabilityRegistry_ == address(0)) revert ZeroAddress(); capabilityRegistry = ICapabilityRegistry420(capabilityRegistry_); }
    function systemName() external pure returns (string memory) { return "ResourceAuthorization420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }
    function scopeProvider(bytes32 providerId) public pure returns (bytes32) { return keccak256(abi.encode(providerId)); }
    function scopeNode(bytes32 providerId, bytes32 nodeId) public pure returns (bytes32) { return keccak256(abi.encode(providerId,nodeId)); }
    function scopeSession(bytes32 sessionId) public pure returns (bytes32) { return keccak256(abi.encode(sessionId)); }
    function scopeProofScheme(bytes32 proofSchemeId) public pure returns (bytes32) { return keccak256(abi.encode("420/STORAGE/PROOF_SCHEME/SCOPE/V1", proofSchemeId)); }
    function isProviderAuthorized(address p, bytes32 providerId, bytes32 actionId) external view returns (bool) { return capabilityRegistry.isAuthorized(p,ResourceIds420.COMPONENT_RESOURCE,actionId,scopeProvider(providerId),0); }
    function isNodeAuthorized(address p, bytes32 providerId, bytes32 nodeId, bytes32 actionId) external view returns (bool) { return capabilityRegistry.isAuthorized(p,ResourceIds420.COMPONENT_RESOURCE,actionId,scopeNode(providerId,nodeId),0); }
    function isSessionAuthorized(address p, bytes32 sessionId, bytes32 actionId, uint256 amount) external view returns (bool) { return capabilityRegistry.isAuthorized(p,ResourceIds420.COMPONENT_RESOURCE,actionId,scopeSession(sessionId),amount); }
    function isProofSchemeAuthorized(address p, bytes32 proofSchemeId, bytes32 actionId) external view returns (bool) { return capabilityRegistry.isAuthorized(p,ResourceIds420.COMPONENT_RESOURCE,actionId,scopeProofScheme(proofSchemeId),0); }
}
