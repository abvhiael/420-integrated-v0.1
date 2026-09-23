// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ComputeJobRegistry420.sol";
import "./ComputeJobAcceptedMatch420.sol";

/// @notice Strict assignment/receipt evidence requiring the exact accepted
/// resource and operator, with a unique attempt and authenticated submission.
/// @dev Receipt commitments authenticate the operator's on-chain submission,
/// NOT external hardware, metering or correctness.
contract ComputeJobMatchedWorkerEvidence420 is IComputeJobWorkerEvidence420 {
    bytes32 private constant ASSIGNMENT_DOMAIN = keccak256("420/COMPUTE/STRICT_ASSIGNMENT/V1");
    bytes32 private constant RESULT_DOMAIN = keccak256("420/COMPUTE/STRICT_RESULT/V1");
    struct Assignment {
        bytes32 jobId;
        bytes32 matchId;
        bytes32 acceptanceRef;
        bytes32 resourceId;
        address worker;
        uint64 attempt;
        bytes32 resultCommitment;
        bytes32 receiptHash;
        bool exists;
    }
    ComputeJobRegistry420 public jobs;
    ComputeJobAcceptedMatch420 public immutable matches;
    ComputeAuthorization420 public immutable authorization;
    address public immutable bindingAdmin;
    mapping(bytes32 => Assignment) private _assignments;
    mapping(bytes32 => bytes32) public assignmentForJob;
    error InvalidEvidence();
    error Unauthorized();
    event AssignmentAccepted(bytes32 indexed jobId, bytes32 indexed assignmentRef, bytes32 indexed resourceId, address worker);
    event WorkerResultCommitted(bytes32 indexed jobId, bytes32 indexed assignmentRef, bytes32 resultCommitment);

    constructor(address matches_, address authorization_) {
        if (matches_.code.length == 0 || authorization_.code.length == 0) revert InvalidEvidence();
        matches = ComputeJobAcceptedMatch420(matches_);
        authorization = ComputeAuthorization420(authorization_);
        bindingAdmin = msg.sender;
    }

    function bindJobs(address jobs_) external {
        if (msg.sender != bindingAdmin || address(jobs) != address(0) || jobs_.code.length == 0)
            revert Unauthorized();
        ComputeJobRegistry420 candidate = ComputeJobRegistry420(jobs_);
        if (address(candidate.workerEvidence()) != address(this)
            || address(candidate.matchEvidence()) != address(matches)
            || address(matches.jobs()) != jobs_) revert InvalidEvidence();
        jobs = candidate;
    }

    function acceptAssignment(bytes32 jobId, bytes32 resourceId, uint64 expectedRevision)
        external returns (bytes32 assignmentRef) {
        if (address(jobs) == address(0) || assignmentForJob[jobId] != bytes32(0)) revert InvalidEvidence();
        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        if (j.status != ComputeJobRegistry420.Status.ACCEPTED || j.revision != expectedRevision
            || j.matchId == bytes32(0) || j.acceptanceRef == bytes32(0)
            || j.deadline <= block.timestamp) revert InvalidEvidence();
        if (!matches.authorizedResource(jobId, j.matchId, j.acceptanceRef, resourceId, msg.sender))
            revert Unauthorized();
        if (!authorization.isAuthorized(msg.sender, authorization.ACTION_EXECUTE_ATTEMPT(),
            authorization.scopeJob(jobId), 0)) revert Unauthorized();
        uint64 attempt = 1;
        assignmentRef = keccak256(abi.encode(ASSIGNMENT_DOMAIN, block.chainid, address(this),
            jobId, j.matchId, j.acceptanceRef, resourceId, msg.sender, attempt, expectedRevision));
        _assignments[assignmentRef] = Assignment(jobId, j.matchId, j.acceptanceRef, resourceId,
            msg.sender, attempt, bytes32(0), bytes32(0), true);
        assignmentForJob[jobId] = assignmentRef;
        jobs.assignWorker(jobId, expectedRevision, msg.sender, assignmentRef);
        emit AssignmentAccepted(jobId, assignmentRef, resourceId, msg.sender);
    }

    function authorizedAssignment(bytes32 jobId, bytes32 matchId, address worker, bytes32 assignmentRef)
        external view returns (bool) {
        Assignment storage a = _assignments[assignmentRef];
        return a.exists && a.jobId == jobId && a.matchId == matchId && a.worker == worker
            && a.attempt == 1 && assignmentForJob[jobId] == assignmentRef
            && matches.authorizedResource(jobId, matchId, a.acceptanceRef, a.resourceId, worker);
    }

    function commitResult(bytes32 jobId, bytes32 receiptHash, bytes32 outputHash)
        external returns (bytes32 resultCommitment) {
        bytes32 ref = assignmentForJob[jobId];
        Assignment storage a = _assignments[ref];
        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        if (!a.exists || a.worker != msg.sender || a.resultCommitment != bytes32(0)
            || j.status != ComputeJobRegistry420.Status.RUNNING || j.assignmentRef != ref
            || receiptHash == bytes32(0) || outputHash == bytes32(0)
            || !matches.authorizedResource(jobId, a.matchId, a.acceptanceRef, a.resourceId, msg.sender))
            revert InvalidEvidence();
        if (!authorization.isAuthorized(msg.sender, authorization.ACTION_SUBMIT_RECEIPT(),
            authorization.scopeJob(jobId), 0)) revert Unauthorized();
        resultCommitment = keccak256(abi.encode(RESULT_DOMAIN, block.chainid, address(this),
            jobId, j.requestId, j.manifestHash, a.matchId, a.acceptanceRef, ref,
            a.resourceId, a.attempt, msg.sender, receiptHash, outputHash));
        a.resultCommitment = resultCommitment;
        a.receiptHash = receiptHash;
        emit WorkerResultCommitted(jobId, ref, resultCommitment);
    }

    function committedResult(bytes32 jobId, bytes32 assignmentRef, bytes32 resultCommitment)
        external view returns (bool) {
        Assignment storage a = _assignments[assignmentRef];
        return a.exists && a.jobId == jobId && assignmentForJob[jobId] == assignmentRef
            && resultCommitment != bytes32(0) && a.resultCommitment == resultCommitment
            && a.receiptHash != bytes32(0);
    }

    function getAssignment(bytes32 assignmentRef) external view returns (Assignment memory a) {
        a = _assignments[assignmentRef];
        if (!a.exists) revert InvalidEvidence();
    }
}
