// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./AIJobManager.sol";
import "./AIProviderRegistry.sol";
import "./AIModelRegistry.sol";
import "./AIModelDeploymentRegistry420.sol";
import "./AIComputeAdapter420.sol";

/// @notice Canonical read/discovery root for 420AI.
/// @dev User-authorizing writes remain on the owning registries/job manager so router calls cannot obscure msg.sender.
contract AIRouter420 is I420System {
    AIJobManager public immutable jobs;
    AIProviderRegistry public immutable providers;
    AIModelRegistry public immutable models;
    AIModelDeploymentRegistry420 public immutable deployments;
    AIComputeAdapter420 public immutable computeAdapter;

    error InvalidDependency();

    constructor(
        address jobs_,
        address providers_,
        address models_,
        address deployments_,
        address computeAdapter_
    ) {
        if (
            jobs_ == address(0) || providers_ == address(0) || models_ == address(0)
                || deployments_ == address(0) || computeAdapter_ == address(0)
        ) revert InvalidDependency();
        jobs = AIJobManager(jobs_);
        providers = AIProviderRegistry(providers_);
        models = AIModelRegistry(models_);
        deployments = AIModelDeploymentRegistry420(deployments_);
        computeAdapter = AIComputeAdapter420(computeAdapter_);
    }

    function systemName() external pure returns (string memory) { return "AIRouter420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function canUseDeployment(bytes32 deploymentId) external view returns (bool) {
        return deployments.isOperational(deploymentId);
    }

    function isProviderOperational(bytes32 providerId) external view returns (bool) {
        return providers.isOperational(providerId);
    }

    function isModelVersionOperational(bytes32 modelVersionId) external view returns (bool) {
        return models.isVersionOperational(modelVersionId);
    }

    function getJob(bytes32 jobId) external view returns (AIJobManager.Job memory) {
        return jobs.getJob(jobId);
    }

    function getComputeBinding(bytes32 jobId) external view returns (AIComputeAdapter420.Binding memory) {
        return computeAdapter.getBinding(jobId);
    }
}
