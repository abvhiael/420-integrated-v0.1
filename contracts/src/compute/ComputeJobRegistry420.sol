// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice CMP-1.1 canonical job record. Does not custody funds, select matches,
///         attest hardware, verify execution, or pay workers.
/// @dev The immutable evidence authorities must be audited canonical adapters;
///      an arbitrary callback or a mock is NOT production funding/verification proof.
interface IComputeJobFundingEvidence420 {
    function funded(bytes32 jobId, address owner, bytes32 fundingRef) external view returns (bool);
}
interface IComputeJobMatchEvidence420 {
    function matched(bytes32 jobId, bytes32 requestId, bytes32 matchId, bytes32 manifestHash) external view returns (bool);
    function accepted(bytes32 jobId, bytes32 matchId, bytes32 acceptanceRef) external view returns (bool);
}
interface IComputeJobWorkerEvidence420 {
    function authorizedAssignment(bytes32 jobId, bytes32 matchId, address worker, bytes32 assignmentRef) external view returns (bool);
    function committedResult(bytes32 jobId, bytes32 assignmentRef, bytes32 resultCommitment) external view returns (bool);
}
interface IComputeJobVerificationEvidence420 {
    function verified(bytes32 jobId, bytes32 resultCommitment, address verifier, bytes32 decisionRef, bool approved)
        external view returns (bool);
}
interface IComputeJobSettlementEvidence420 {
    function settled(bytes32 jobId, bytes32 verificationRef, bytes32 settlementRef) external view returns (bool);
}

contract ComputeJobRegistry420 {
    enum Status { NONE, CREATED, FUNDED, MATCHED, ACCEPTED, RUNNING, RESULT_COMMITTED, VERIFIED, SETTLED,
        CANCELLED, EXPIRED, FAILED, DISPUTED, REFUNDED }

    struct Job {
        address owner;
        bytes32 requestId;
        bytes32 requestCommitment;
        bytes32 manifestHash;
        bytes32 workloadType;
        bytes32 inputCommitment;
        bytes32 outputSchemaCommitment;
        bytes32 matchId;
        bytes32 fundingRef;
        bytes32 acceptanceRef;
        bytes32 assignmentRef;
        address worker;
        bytes32 resultCommitment;
        address verifier;
        bytes32 verificationRef;
        bytes32 settlementRef;
        uint64 deadline;
        uint64 revision;
        Status status;
    }

    bytes32 private constant JOB_DOMAIN = keccak256("420/COMPUTE/JOB/V1");
    IComputeJobFundingEvidence420 public immutable fundingEvidence;
    IComputeJobMatchEvidence420 public immutable matchEvidence;
    IComputeJobWorkerEvidence420 public immutable workerEvidence;
    IComputeJobVerificationEvidence420 public immutable verificationEvidence;
    IComputeJobSettlementEvidence420 public immutable settlementEvidence;
    uint64 public nextJobNonce;
    mapping(bytes32 => Job) private jobs;
    mapping(bytes32 => bool) public requestUsed;

    error BadInput();
    error UnknownJob();
    error WrongState();
    error StaleRevision();
    error Unauthorized();
    error UnprovenEvidence();

    event JobCreated(bytes32 indexed jobId, bytes32 indexed requestId, address indexed owner, bytes32 manifestHash,
        bytes32 workloadType, bytes32 inputCommitment, bytes32 outputSchemaCommitment);
    event JobTransition(bytes32 indexed jobId, Status indexed previous, Status indexed current,
        uint64 previousRevision, uint64 currentRevision, address actor, bytes32 evidenceRef);
    event WorkerAssigned(bytes32 indexed jobId, address indexed worker, bytes32 assignmentRef);
    event ResultRecorded(bytes32 indexed jobId, bytes32 resultCommitment);
    event VerifierDecision(bytes32 indexed jobId, address indexed verifier, bytes32 decisionRef, bool approved);

    constructor(address funding_, address match_, address worker_, address verification_, address settlement_) {
        if (funding_.code.length == 0 || match_.code.length == 0 || worker_.code.length == 0
            || verification_.code.length == 0 || settlement_.code.length == 0) revert BadInput();
        fundingEvidence = IComputeJobFundingEvidence420(funding_);
        matchEvidence = IComputeJobMatchEvidence420(match_);
        workerEvidence = IComputeJobWorkerEvidence420(worker_);
        verificationEvidence = IComputeJobVerificationEvidence420(verification_);
        settlementEvidence = IComputeJobSettlementEvidence420(settlement_);
    }

    function job(bytes32 jobId) external view returns (Job memory) {
        Job memory record = jobs[jobId];
        if (record.status == Status.NONE) revert UnknownJob();
        return record;
    }

    /// @notice Owner is the authenticated caller; request/manifest validation remains
    ///         subject to future canonical request and signed-manifest adapters.
    function createJob(bytes32 requestId, bytes32 requestCommitment, bytes32 manifestHash, bytes32 workloadType,
        bytes32 inputCommitment, bytes32 outputSchemaCommitment, uint64 deadline) external returns (bytes32 jobId) {
        if (requestId == 0 || requestCommitment == 0 || manifestHash == 0 || workloadType == 0
            || inputCommitment == 0 || outputSchemaCommitment == 0 || deadline <= block.timestamp
            || requestUsed[requestId]) revert BadInput();
        uint64 nonce = ++nextJobNonce;
        jobId = keccak256(abi.encode(JOB_DOMAIN, block.chainid, address(this), nonce, requestId));
        Job storage j = jobs[jobId];
        j.owner = msg.sender;
        j.requestId = requestId;
        j.requestCommitment = requestCommitment;
        j.manifestHash = manifestHash;
        j.workloadType = workloadType;
        j.inputCommitment = inputCommitment;
        j.outputSchemaCommitment = outputSchemaCommitment;
        j.deadline = deadline;
        j.revision = 1;
        j.status = Status.CREATED;
        requestUsed[requestId] = true;
        emit JobCreated(jobId, requestId, msg.sender, manifestHash, workloadType, inputCommitment, outputSchemaCommitment);
    }

    function recordFunding(bytes32 jobId, uint64 expectedRevision, bytes32 fundingRef) external {
        Job storage j = _guard(jobId, expectedRevision, Status.CREATED);
        if (msg.sender != j.owner) revert Unauthorized();
        if (fundingRef == 0 || !fundingEvidence.funded(jobId, j.owner, fundingRef)) revert UnprovenEvidence();
        j.fundingRef = fundingRef;
        _transition(jobId, j, Status.FUNDED, fundingRef);
    }

    function recordMatch(bytes32 jobId, uint64 expectedRevision, bytes32 matchId) external {
        Job storage j = _guard(jobId, expectedRevision, Status.FUNDED);
        if (msg.sender != j.owner) revert Unauthorized();
        if (matchId == 0 || !matchEvidence.matched(jobId, j.requestId, matchId, j.manifestHash)) revert UnprovenEvidence();
        j.matchId = matchId;
        _transition(jobId, j, Status.MATCHED, matchId);
    }

    function recordAcceptance(bytes32 jobId, uint64 expectedRevision, bytes32 acceptanceRef) external {
        Job storage j = _guard(jobId, expectedRevision, Status.MATCHED);
        if (msg.sender != address(matchEvidence) || acceptanceRef == 0
            || !matchEvidence.accepted(jobId, j.matchId, acceptanceRef)) revert UnprovenEvidence();
        j.acceptanceRef = acceptanceRef;
        _transition(jobId, j, Status.ACCEPTED, acceptanceRef);
    }

    function assignWorker(bytes32 jobId, uint64 expectedRevision, address worker, bytes32 assignmentRef) external {
        Job storage j = _guard(jobId, expectedRevision, Status.ACCEPTED);
        if (msg.sender != address(workerEvidence) || worker == address(0) || assignmentRef == 0
            || !workerEvidence.authorizedAssignment(jobId, j.matchId, worker, assignmentRef)) revert UnprovenEvidence();
        j.worker = worker;
        j.assignmentRef = assignmentRef;
        _transition(jobId, j, Status.RUNNING, assignmentRef);
        emit WorkerAssigned(jobId, worker, assignmentRef);
    }

    function recordResult(bytes32 jobId, uint64 expectedRevision, bytes32 resultCommitment) external {
        Job storage j = _guard(jobId, expectedRevision, Status.RUNNING);
        if (msg.sender != j.worker || resultCommitment == 0
            || !workerEvidence.committedResult(jobId, j.assignmentRef, resultCommitment)) revert UnprovenEvidence();
        j.resultCommitment = resultCommitment;
        _transition(jobId, j, Status.RESULT_COMMITTED, resultCommitment);
        emit ResultRecorded(jobId, resultCommitment);
    }

    function recordVerification(bytes32 jobId, uint64 expectedRevision, address verifier, bytes32 decisionRef,
        bool approved) external {
        Job storage j = _guard(jobId, expectedRevision, Status.RESULT_COMMITTED);
        if (msg.sender != address(verificationEvidence) || verifier == address(0) || verifier == j.worker
            || decisionRef == 0 || !verificationEvidence.verified(jobId, j.resultCommitment, verifier, decisionRef, approved))
            revert UnprovenEvidence();
        j.verifier = verifier;
        j.verificationRef = decisionRef;
        _transition(jobId, j, approved ? Status.VERIFIED : Status.FAILED, decisionRef);
        emit VerifierDecision(jobId, verifier, decisionRef, approved);
    }

    function recordSettlement(bytes32 jobId, uint64 expectedRevision, bytes32 settlementRef) external {
        Job storage j = _guard(jobId, expectedRevision, Status.VERIFIED);
        if (msg.sender != address(settlementEvidence) || settlementRef == 0
            || !settlementEvidence.settled(jobId, j.verificationRef, settlementRef)) revert UnprovenEvidence();
        j.settlementRef = settlementRef;
        _transition(jobId, j, Status.SETTLED, settlementRef);
    }

    /// @dev No generic setter or speculative cancellation/refund: those require
    ///      authoritative CMP-1.2 custody and later dispute/expiry evidence.
    function _guard(bytes32 jobId, uint64 expectedRevision, Status expected) private view returns (Job storage j) {
        j = jobs[jobId];
        if (j.status == Status.NONE) revert UnknownJob();
        if (j.status != expected) revert WrongState();
        if (j.revision != expectedRevision) revert StaleRevision();
        if (block.timestamp > j.deadline && expected != Status.RESULT_COMMITTED && expected != Status.VERIFIED)
            revert BadInput();
    }

    function _transition(bytes32 jobId, Job storage j, Status next, bytes32 evidenceRef) private {
        Status prior = j.status;
        uint64 revision = j.revision;
        j.status = next;
        j.revision = revision + 1;
        emit JobTransition(jobId, prior, next, revision, j.revision, msg.sender, evidenceRef);
    }
}
