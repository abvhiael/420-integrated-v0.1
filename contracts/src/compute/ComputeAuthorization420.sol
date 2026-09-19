// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../interfaces/genesis/ICapabilityRegistry420.sol";
import "./ComputeIds420.sol";

contract ComputeAuthorization420 is I420System {
    ICapabilityRegistry420 public immutable capabilityRegistry;
    error ZeroAddress();

    constructor(address capabilityRegistry_) {
        if (capabilityRegistry_ == address(0)) revert ZeroAddress();
        capabilityRegistry = ICapabilityRegistry420(capabilityRegistry_);
    }

    function systemName() external pure returns (string memory) { return "ComputeAuthorization420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function scopeProvider(bytes32 providerId) public pure returns (bytes32) {
        return keccak256(abi.encode("420/COMPUTE/SCOPE/PROVIDER/V1", providerId));
    }

    function scopeNode(bytes32 providerId, bytes32 nodeId) public pure returns (bytes32) {
        return keccak256(abi.encode("420/COMPUTE/SCOPE/NODE/V1", providerId, nodeId));
    }

    function scopeResource(bytes32 providerId, bytes32 nodeId, bytes32 resourceId) public pure returns (bytes32) {
        return keccak256(abi.encode("420/COMPUTE/SCOPE/RESOURCE/V1", providerId, nodeId, resourceId));
    }

    function scopeRequest(bytes32 requestId) public pure returns (bytes32) {
        return keccak256(abi.encode("420/COMPUTE/SCOPE/REQUEST/V1", requestId));
    }

    function scopeJob(bytes32 jobId) public pure returns (bytes32) {
        return keccak256(abi.encode("420/COMPUTE/SCOPE/JOB/V1", jobId));
    }

    function isProviderAuthorized(address principal, bytes32 providerId, bytes32 actionId) external view returns (bool) {
        return capabilityRegistry.isAuthorized(
            principal, ComputeIds420.COMPONENT_COMPUTE, actionId, scopeProvider(providerId), 0
        );
    }

    function isNodeAuthorized(address principal, bytes32 providerId, bytes32 nodeId, bytes32 actionId)
        external
        view
        returns (bool)
    {
        return capabilityRegistry.isAuthorized(
            principal, ComputeIds420.COMPONENT_COMPUTE, actionId, scopeNode(providerId, nodeId), 0
        );
    }

    function isResourceAuthorized(
        address principal,
        bytes32 providerId,
        bytes32 nodeId,
        bytes32 resourceId,
        bytes32 actionId
    ) external view returns (bool) {
        return capabilityRegistry.isAuthorized(
            principal,
            ComputeIds420.COMPONENT_COMPUTE,
            actionId,
            scopeResource(providerId, nodeId, resourceId),
            0
        );
    }

    function isRequestAuthorized(address principal, bytes32 requestId, bytes32 actionId, uint256 amount)
        external
        view
        returns (bool)
    {
        return capabilityRegistry.isAuthorized(
            principal, ComputeIds420.COMPONENT_COMPUTE, actionId, scopeRequest(requestId), amount
        );
    }

    function isJobAuthorized(address principal, bytes32 jobId, bytes32 actionId, uint256 amount)
        external
        view
        returns (bool)
    {
        return capabilityRegistry.isAuthorized(
            principal, ComputeIds420.COMPONENT_COMPUTE, actionId, scopeJob(jobId), amount
        );
    }
}
