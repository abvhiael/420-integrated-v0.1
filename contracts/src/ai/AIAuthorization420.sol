// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../interfaces/genesis/ICapabilityRegistry420.sol";
import "./AIIds420.sol";

contract AIAuthorization420 is I420System {
    ICapabilityRegistry420 public immutable capabilityRegistry;
    error ZeroAddress();

    constructor(address capabilityRegistry_) {
        if (capabilityRegistry_ == address(0)) revert ZeroAddress();
        capabilityRegistry = ICapabilityRegistry420(capabilityRegistry_);
    }

    function systemName() external pure returns (string memory) { return "AIAuthorization420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function scopeProvider(bytes32 providerId) public pure returns (bytes32) {
        return keccak256(abi.encode("420/AI/SCOPE/PROVIDER/V1", providerId));
    }

    function scopeDeployment(bytes32 deploymentId) public pure returns (bytes32) {
        return keccak256(abi.encode("420/AI/SCOPE/DEPLOYMENT/V1", deploymentId));
    }

    function scopeJob(bytes32 jobId) public pure returns (bytes32) {
        return keccak256(abi.encode("420/AI/SCOPE/JOB/V1", jobId));
    }

    function isProviderAuthorized(address principal, bytes32 providerId, bytes32 actionId)
        external
        view
        returns (bool)
    {
        return capabilityRegistry.isAuthorized(
            principal, AIIds420.COMPONENT_AI, actionId, scopeProvider(providerId), 0
        );
    }

    function isDeploymentAuthorized(address principal, bytes32 deploymentId, bytes32 actionId)
        external
        view
        returns (bool)
    {
        return capabilityRegistry.isAuthorized(
            principal, AIIds420.COMPONENT_AI, actionId, scopeDeployment(deploymentId), 0
        );
    }

    function isJobAuthorized(address principal, bytes32 jobId, bytes32 actionId, uint256 amount)
        external
        view
        returns (bool)
    {
        return capabilityRegistry.isAuthorized(
            principal, AIIds420.COMPONENT_AI, actionId, scopeJob(jobId), amount
        );
    }
}
