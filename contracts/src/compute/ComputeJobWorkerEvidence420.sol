// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ComputeJobRegistry420.sol";
import "./ComputeResourceRegistry420.sol";
import "./ComputeAuthorization420.sol";

/// @notice Evidence gateway for authenticated assignment and worker-signed
/// on-chain result commitments. It does not certify hardware, correctness,
/// capacity reservation, metering, or the independent accepted-match authority.
contract ComputeJobWorkerEvidence420 is IComputeJobWorkerEvidence420 {
    bytes32 private constant ASSIGNMENT_DOMAIN = keccak256("420/COMPUTE/ASSIGNMENT/V1");
    bytes32 private constant RESULT_DOMAIN = keccak256("420/COMPUTE/WORKER_RESULT/V1");

    struct Assignment {
        bytes32 jobId;
        bytes32 matchId;
        bytes32 resourceId;
        address worker;
        bytes32 resultCommitment;
        bytes32 receiptHash;
        bool exists;
    }

    ComputeJobRegistry420 public immutable jobs;
    ComputeResourceRegistry420 public immutable resources;
    ComputeAuthorization420 public immutable authorization;
    uint64 public nextAssignmentNonce;
    mapping(bytes32 => Assignment) public assignment;
    mapping(bytes32 => bytes32) public assignmentForJob;
    error Unauthorized();
    error InvalidEvidence();
    event AssignmentAccepted(bytes32 indexed jobId, bytes32 indexed assignmentRef, bytes32 indexed resourceId, address worker);
    event WorkerResultCommitted(bytes32 indexed jobId, bytes32 indexed assignmentRef, bytes32 resultCommitment, bytes32 receiptHash);

    constructor(address jobs_, address resources_, address authorization_) {
        if (jobs_.code.length == 0 || resources_.code.length == 0 || authorization_.code.length == 0)
            revert InvalidEvidence();
        jobs = ComputeJobRegistry420(jobs_);
        resources = ComputeResourceRegistry420(resources_);
        authorization = ComputeAuthorization420(authorization_);
    }

    /// @dev The principal is msg.sender, never a caller-supplied worker address.
    function acceptAssignment(bytes32 jobId, bytes32 resourceId, uint64 expectedRevision)
        external returns (bytes32 assignmentRef) {
        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        if (j.status != ComputeJobRegistry420.Status.ACCEPTED || j.revision != expectedRevision
            || j.matchId == bytes32(0) || assignmentForJob[jobId] != bytes32(0)) revert InvalidEvidence();
        if (!resources.isAvailable(resourceId)) revert InvalidEvidence();
        ComputeResourceRegistry420.Resource memory r = resources.resource(resourceId);
        ComputeNodeRegistry420.Node memory node_ = resources.nodes().node(r.nodeId);
        if (node_.providerId != r.providerId || node_.operator != msg.sender
            || !resources.providers().isOperator(r.providerId, msg.sender)) revert Unauthorized();
        if (!authorization.isAuthorized(msg.sender, authorization.ACTION_EXECUTE_ATTEMPT(),
                authorization.scopeJob(jobId), 0)) revert Unauthorized();
        uint64 nonce = ++nextAssignmentNonce;
        assignmentRef = keccak256(abi.encode(ASSIGNMENT_DOMAIN, block.chainid, address(this),
            jobId, j.matchId, resourceId, msg.sender, nonce));
        assignment[assignmentRef] = Assignment(jobId, j.matchId, resourceId, msg.sender,
            bytes32(0), bytes32(0), true);
        assignmentForJob[jobId] = assignmentRef;
        jobs.assignWorker(jobId, expectedRevision, msg.sender, assignmentRef);
        emit AssignmentAccepted(jobId, assignmentRef, resourceId, msg.sender);
    }

    function authorizedAssignment(bytes32 jobId, bytes32 matchId, address worker, bytes32 assignmentRef)
        external view returns (bool) {
        Assignment storage a = assignment[assignmentRef];
        return a.exists && a.jobId == jobId && a.matchId == matchId && a.worker == worker
            && a.resourceId != bytes32(0) && assignmentForJob[jobId] == assignmentRef
            && resources.isAvailable(a.resourceId);
    }

    /// @notice On-chain worker-authenticated receipt commitment; the worker
    /// then calls jobs.recordResult directly so registry msg.sender is the worker.
    function commitResult(bytes32 jobId, bytes32 receiptHash, bytes32 outputHash) external returns (bytes32 resultCommitment) {
        bytes32 ref = assignmentForJob[jobId];
        Assignment storage a = assignment[ref];
        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        if (!a.exists || a.worker != msg.sender || a.resultCommitment != bytes32(0)
            || j.status != ComputeJobRegistry420.Status.RUNNING || j.assignmentRef != ref
            || receiptHash == bytes32(0) || outputHash == bytes32(0)) revert InvalidEvidence();
        if (!authorization.isAuthorized(msg.sender, authorization.ACTION_SUBMIT_RECEIPT(),
                authorization.scopeJob(jobId), 0)) revert Unauthorized();
        resultCommitment = keccak256(abi.encode(RESULT_DOMAIN, block.chainid, address(this),
            jobId, j.matchId, j.manifestHash, ref, msg.sender, receiptHash, outputHash));
        a.resultCommitment = resultCommitment;
        a.receiptHash = receiptHash;
        emit WorkerResultCommitted(jobId, ref, resultCommitment, receiptHash);
    }

    function committedResult(bytes32 jobId, bytes32 assignmentRef, bytes32 resultCommitment)
        external view returns (bool) {
        Assignment storage a = assignment[assignmentRef];
        return a.exists && a.jobId == jobId && assignmentForJob[jobId] == assignmentRef
            && resultCommitment != bytes32(0) && a.resultCommitment == resultCommitment
            && a.receiptHash != bytes32(0);
    }
}
