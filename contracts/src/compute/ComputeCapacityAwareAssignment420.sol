// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ComputeJobRegistry420.sol";
import "./ComputeMatch420.sol";
import "./ComputeRequestRegistry420.sol";
import "./ComputeOfferRegistry420.sol";
import "./ComputeResourceRegistry420.sol";
import "./IComputeAcceptedMatchRuntime420.sol";

/// @notice CMP-2.5 bridge from an owner-accepted market match into the canonical JobRegistry/WorkerSnapshot path.
/// @dev Capacity is never accounted here. ComputeJobWorkerSnapshotEvidence420 remains the sole controller that
/// atomically reserves CMP-1.3 capacity and moves the canonical job to RUNNING.
contract ComputeCapacityAwareAssignment420 is IComputeJobMatchEvidence420, IComputeAcceptedMatchRuntime420 {
    bytes32 public constant JOB_ACCEPTANCE_DOMAIN =
        keccak256("420/COMPUTE/CAPACITY_AWARE_JOB_ACCEPTANCE/V1");

    ComputeMatch420 public immutable marketMatches;
    ComputeRequestRegistry420 public immutable requests;
    address public immutable bindingAdmin;
    ComputeJobRegistry420 private _jobs;

    mapping(bytes32 => bytes32) public marketMatchForJob;
    mapping(bytes32 => bytes32) public jobForMarketMatch;
    mapping(bytes32 => bytes32) public acceptanceForJob;

    error InvalidAssignment();
    error Unauthorized();

    event MarketMatchLinked(bytes32 indexed jobId, bytes32 indexed marketMatchId, bytes32 indexed requestId);
    event JobMatchAccepted(bytes32 indexed jobId, bytes32 indexed marketMatchId, bytes32 acceptanceRef);

    constructor(address marketMatches_) {
        if (marketMatches_.code.length == 0) revert InvalidAssignment();
        marketMatches = ComputeMatch420(marketMatches_);
        requests = marketMatches.requests();
        if (address(requests).code.length == 0) revert InvalidAssignment();
        bindingAdmin = msg.sender;
    }

    function jobs() external view returns (address) {
        return address(_jobs);
    }

    function bindJobs(address jobs_) external {
        if (
            msg.sender != bindingAdmin || address(_jobs) != address(0)
                || jobs_ == address(0) || jobs_.code.length == 0
        ) revert Unauthorized();
        ComputeJobRegistry420 candidate = ComputeJobRegistry420(jobs_);
        if (address(candidate.matchEvidence()) != address(this)
            || address(candidate.requestEvidence()) != address(requests)) revert InvalidAssignment();
        _jobs = candidate;
    }

    /// @notice Owner binds one immutable CMP-2 accepted match to its funded canonical job.
    /// Scheduler proposal authority is deliberately insufficient.
    function linkAcceptedMatch(bytes32 jobId, bytes32 marketMatchId) external {
        if (address(_jobs) == address(0) || marketMatchId == bytes32(0)
            || marketMatchForJob[jobId] != bytes32(0) || jobForMarketMatch[marketMatchId] != bytes32(0))
            revert InvalidAssignment();

        ComputeJobRegistry420.Job memory j = _jobs.job(jobId);
        if (j.status != ComputeJobRegistry420.Status.FUNDED || j.owner != msg.sender) revert Unauthorized();

        ComputeMatch420.AcceptedMatch memory m = marketMatches.acceptedMatch(marketMatchId);
        if (!_jobMatchesMarket(j, m, marketMatchId) || !_resourceStillEligible(m)) revert InvalidAssignment();

        marketMatchForJob[jobId] = marketMatchId;
        jobForMarketMatch[marketMatchId] = jobId;
        emit MarketMatchLinked(jobId, marketMatchId, m.requestId);
    }

    /// @notice Owner confirms the already owner-accepted market match into JobRegistry.
    /// Worker selection and capacity reservation occur later in WorkerSnapshot, atomically.
    function acceptIntoJob(bytes32 jobId, uint64 expectedJobRevision) external returns (bytes32 acceptanceRef) {
        if (address(_jobs) == address(0) || acceptanceForJob[jobId] != bytes32(0))
            revert InvalidAssignment();
        ComputeJobRegistry420.Job memory j = _jobs.job(jobId);
        bytes32 marketMatchId = marketMatchForJob[jobId];
        if (
            marketMatchId == bytes32(0) || j.status != ComputeJobRegistry420.Status.MATCHED
                || j.revision != expectedJobRevision || j.matchId != marketMatchId || j.owner != msg.sender
        ) revert Unauthorized();

        ComputeMatch420.AcceptedMatch memory m = marketMatches.acceptedMatch(marketMatchId);
        if (!_jobMatchesMarket(j, m, marketMatchId) || !_resourceStillEligible(m)) revert InvalidAssignment();

        bytes32 marketCommitment = marketMatches.commitment(marketMatchId);
        acceptanceRef = keccak256(
            abi.encode(
                JOB_ACCEPTANCE_DOMAIN,
                block.chainid,
                address(this),
                jobId,
                expectedJobRevision,
                marketMatchId,
                marketCommitment,
                m.requestCommitment,
                m.offerCommitment,
                m.resourceId,
                m.operator
            )
        );
        acceptanceForJob[jobId] = acceptanceRef;
        _jobs.recordAcceptance(jobId, expectedJobRevision, acceptanceRef);
        emit JobMatchAccepted(jobId, marketMatchId, acceptanceRef);
    }

    function matched(bytes32 jobId, bytes32 requestId, bytes32 matchId, bytes32 manifestHash)
        external view returns (bool)
    {
        if (address(_jobs) == address(0) || marketMatchForJob[jobId] != matchId
            || jobForMarketMatch[matchId] != jobId || matchId == bytes32(0)) return false;
        ComputeJobRegistry420.Job memory j = _jobs.job(jobId);
        if (j.requestId != requestId || j.manifestHash != manifestHash) return false;
        ComputeMatch420.AcceptedMatch memory m = marketMatches.acceptedMatch(matchId);
        return _jobMatchesMarket(j, m, matchId) && _resourceStillEligible(m);
    }

    function accepted(bytes32 jobId, bytes32 matchId, bytes32 acceptanceRef)
        external view returns (bool)
    {
        return marketMatchForJob[jobId] == matchId
            && jobForMarketMatch[matchId] == jobId
            && acceptanceRef != bytes32(0)
            && acceptanceForJob[jobId] == acceptanceRef;
    }

    /// @notice WorkerSnapshot admission gate. It verifies the exact resource/operator frozen by the
    /// accepted market offer and requires that resource revision to remain eligible at assignment time.
    function authorizedResource(
        bytes32 jobId,
        bytes32 matchId,
        bytes32 acceptanceRef,
        bytes32 resourceId,
        address operator
    ) external view returns (bool) {
        if (
            marketMatchForJob[jobId] != matchId || jobForMarketMatch[matchId] != jobId
                || acceptanceForJob[jobId] == bytes32(0)
                || acceptanceForJob[jobId] != acceptanceRef
        ) return false;
        ComputeMatch420.AcceptedMatch memory m = marketMatches.acceptedMatch(matchId);
        return m.resourceId == resourceId && m.operator == operator && _resourceStillEligible(m);
    }

    function matchParties(bytes32 matchId)
        external view returns (bytes32 jobId, address owner, address operator, bool exists)
    {
        jobId = jobForMarketMatch[matchId];
        if (jobId == bytes32(0)) return (bytes32(0), address(0), address(0), false);
        ComputeMatch420.AcceptedMatch memory m = marketMatches.acceptedMatch(matchId);
        return (jobId, m.owner, m.operator, true);
    }

    function _jobMatchesMarket(
        ComputeJobRegistry420.Job memory j,
        ComputeMatch420.AcceptedMatch memory m,
        bytes32 marketMatchId
    ) private view returns (bool) {
        if (
            marketMatches.acceptedForRequest(m.requestId) != marketMatchId
                || m.requestId != j.requestId || m.owner != j.owner
                || requests.commitment(m.requestId, m.requestRevision) != m.requestCommitment
        ) return false;
        ComputeRequestRegistry420.Request memory r = requests.revision(m.requestId, m.requestRevision);
        return r.manifestHash == j.manifestHash
            && r.workloadType == j.workloadType
            && r.inputCommitment == j.inputCommitment
            && r.outputSchemaCommitment == j.outputSchemaCommitment
            && r.terms.deadline == j.deadline;
    }

    function _resourceStillEligible(ComputeMatch420.AcceptedMatch memory m) private view returns (bool) {
        ComputeOfferRegistry420 offers = marketMatches.offers();
        ComputeOfferRegistry420.Offer memory o = offers.revision(m.offerId, m.offerRevision);
        if (
            offers.commitment(m.offerId, m.offerRevision) != m.offerCommitment
                || o.resourceId != m.resourceId || o.providerId != m.providerId
                || o.nodeId != m.nodeId || o.operator != m.operator
        ) return false;

        ComputeResourceRegistry420 resources = offers.resources();
        if (!resources.isAvailable(m.resourceId)) return false;
        ComputeResourceRegistry420.Resource memory r = resources.resource(m.resourceId);
        if (
            r.revision != o.resourceRevision || r.providerId != m.providerId
                || r.nodeId != m.nodeId
        ) return false;
        ComputeNodeRegistry420.Node memory n = resources.nodes().node(m.nodeId);
        return n.providerId == m.providerId && n.operator == m.operator
            && resources.providers().isOperator(m.providerId, m.operator);
    }
}
