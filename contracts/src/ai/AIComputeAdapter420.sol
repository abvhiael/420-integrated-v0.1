// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../compute/ComputeIds420.sol";
import "../compute/ComputeRequestRegistry420.sol";
import "../compute/ComputeMatch420.sol";
import "../compute/ComputeJobRegistry420.sol";
import "./AIIds420.sol";
import "./AIJobManager.sol";
import "./AIProviderRegistry.sol";

/// @notice Binds frozen Genesis AI jobs to canonical ComputeMarket state without duplicating compute economics.
/// @dev The requester creates/funds the ComputeRequest directly; this adapter validates and binds it, so
///      the adapter never broadens user spend/provider/deadline authority.
contract AIComputeAdapter420 is I420System {
    struct Binding {
        bytes32 computeRequestId;
        bytes32 computeMatchId;
        bytes32 computeJobId;
        bytes32 aiProviderId;
        bool exists;
    }

    AIJobManager public immutable aiJobs;
    AIProviderRegistry public immutable aiProviders;
    ComputeRequestRegistry420 public immutable computeRequests;
    ComputeMatch420 public immutable computeMatches;
    ComputeJobRegistry420 public immutable computeJobs;

    mapping(bytes32 => Binding) private _bindings;

    error InvalidBinding();
    error BindingExists();
    error Unauthorized();
    error IncompatibleComputeState();

    event ComputeRequestBound(bytes32 indexed aiJobId, bytes32 indexed computeRequestId);
    event ComputeMatchBound(
        bytes32 indexed aiJobId,
        bytes32 indexed computeMatchId,
        bytes32 indexed computeJobId,
        bytes32 aiProviderId
    );
    event AIJobSynchronized(bytes32 indexed aiJobId, AIJobManager.Status aiStatus);

    constructor(
        address aiJobs_,
        address aiProviders_,
        address computeRequests_,
        address computeMatches_,
        address computeJobs_
    ) {
        if (
            aiJobs_ == address(0) || aiProviders_ == address(0) || computeRequests_ == address(0)
                || computeMatches_ == address(0) || computeJobs_ == address(0)
        ) revert InvalidBinding();
        aiJobs = AIJobManager(aiJobs_);
        aiProviders = AIProviderRegistry(aiProviders_);
        computeRequests = ComputeRequestRegistry420(computeRequests_);
        computeMatches = ComputeMatch420(computeMatches_);
        computeJobs = ComputeJobRegistry420(computeJobs_);
    }

    function systemName() external pure returns (string memory) { return "AIComputeAdapter420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function bindComputeRequest(bytes32 aiJobId, bytes32 computeRequestId) external {
        if (_bindings[aiJobId].exists || computeRequestId == bytes32(0)) revert BindingExists();

        AIJobManager.Job memory a = aiJobs.getJob(aiJobId);
        ComputeRequestRegistry420.Request memory c = computeRequests.getRequest(computeRequestId);
        if (msg.sender != a.requester || c.requester != a.requester) revert Unauthorized();
        if (a.status != AIJobManager.Status.FUNDED || c.state != ComputeRequestRegistry420.State.FUNDED) {
            revert IncompatibleComputeState();
        }
        if (
            c.maxSpend420 > a.maxSpend || c.fundedAmount > a.fundedAmount || c.deadline > a.deadline
                || c.inputCommitment != a.requestHash || c.verificationProfileId != a.verificationProfileId
                || c.privacyPolicyId != a.privacyPolicyId || c.workloadClass != _computeWorkload(a.workloadClass)
        ) revert InvalidBinding();

        _bindings[aiJobId] = Binding(computeRequestId, bytes32(0), bytes32(0), bytes32(0), true);
        emit ComputeRequestBound(aiJobId, computeRequestId);
    }

    function bindComputeMatch(
        bytes32 aiJobId,
        bytes32 computeMatchId,
        bytes32 computeJobId,
        bytes32 aiProviderId
    ) external {
        Binding storage b = _binding(aiJobId);
        AIJobManager.Job memory a = aiJobs.getJob(aiJobId);
        if (msg.sender != a.requester) revert Unauthorized();

        ComputeMatch420.MatchRecord memory m = computeMatches.getMatch(computeMatchId);
        ComputeJobRegistry420.Job memory j = computeJobs.getJob(computeJobId);
        AIProviderRegistry.Provider memory p = aiProviders.getProvider(aiProviderId);

        if (
            m.requestId != b.computeRequestId || j.matchId != computeMatchId || j.requestId != b.computeRequestId
                || p.computeProviderRef != m.providerId || !aiProviders.isOperational(aiProviderId)
        ) revert InvalidBinding();

        b.computeMatchId = computeMatchId;
        b.computeJobId = computeJobId;
        b.aiProviderId = aiProviderId;

        aiJobs.matchCompute(aiJobId, b.computeRequestId, computeJobId, aiProviderId);
        emit ComputeMatchBound(aiJobId, computeMatchId, computeJobId, aiProviderId);
    }

    function sync(bytes32 aiJobId) external {
        Binding storage b = _binding(aiJobId);
        if (b.computeJobId == bytes32(0)) revert InvalidBinding();

        AIJobManager.Job memory a = aiJobs.getJob(aiJobId);
        ComputeJobRegistry420.Job memory c = computeJobs.getJob(b.computeJobId);

        if (a.status == AIJobManager.Status.MATCHED && _atLeast(c.state, ComputeJobRegistry420.State.ACCEPTED)) {
            aiJobs.acceptCompute(aiJobId);
            a = aiJobs.getJob(aiJobId);
        }
        if (a.status == AIJobManager.Status.ACCEPTED && _atLeast(c.state, ComputeJobRegistry420.State.RUNNING)) {
            aiJobs.markRunning(aiJobId);
            a = aiJobs.getJob(aiJobId);
        }
        if (
            a.status == AIJobManager.Status.RUNNING
                && _atLeast(c.state, ComputeJobRegistry420.State.RESULT_COMMITTED)
        ) {
            if (c.outputCommitment == bytes32(0) || c.resultManifestHash == bytes32(0)) revert InvalidBinding();
            aiJobs.commitResult(aiJobId, c.outputCommitment, c.resultManifestHash);
            a = aiJobs.getJob(aiJobId);
        }
        if (a.status == AIJobManager.Status.RESULT_COMMITTED && _atLeast(c.state, ComputeJobRegistry420.State.VERIFIED)) {
            aiJobs.verifyResult(aiJobId);
            a = aiJobs.getJob(aiJobId);
        }
        if (c.state == ComputeJobRegistry420.State.FAILED && _isActiveAIState(a.status)) {
            aiJobs.markFailed(aiJobId);
            a = aiJobs.getJob(aiJobId);
        }

        emit AIJobSynchronized(aiJobId, a.status);
    }

    function getBinding(bytes32 aiJobId) external view returns (Binding memory) {
        return _binding(aiJobId);
    }

    function _computeWorkload(bytes32 aiWorkload) private pure returns (bytes32) {
        if (aiWorkload == AIIds420.WORKLOAD_FINE_TUNE) return ComputeIds420.WORKLOAD_AI_TRAINING;
        if (!AIIds420.isWorkload(aiWorkload)) revert InvalidBinding();
        return ComputeIds420.WORKLOAD_AI_INFERENCE;
    }

    function _atLeast(ComputeJobRegistry420.State actual, ComputeJobRegistry420.State threshold)
        private
        pure
        returns (bool)
    {
        return uint8(actual) >= uint8(threshold) && actual != ComputeJobRegistry420.State.FAILED
            && actual != ComputeJobRegistry420.State.DISPUTED && actual != ComputeJobRegistry420.State.REFUNDED;
    }

    function _isActiveAIState(AIJobManager.Status s) private pure returns (bool) {
        return s == AIJobManager.Status.MATCHED || s == AIJobManager.Status.ACCEPTED
            || s == AIJobManager.Status.RUNNING;
    }

    function _binding(bytes32 aiJobId) private view returns (Binding storage b) {
        b = _bindings[aiJobId];
        if (!b.exists) revert InvalidBinding();
    }
}
