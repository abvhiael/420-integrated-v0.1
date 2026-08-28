// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";
import "./AIIds420.sol";

contract AIJobManager is SystemAccess, I420System {
    address public constant AI_JOB_ESCROW = address(0x0000000000000000000000000000000000000432);

    enum Status {
        NONE,
        CREATED,
        FUNDED,
        MATCHED,
        ACCEPTED,
        RUNNING,
        RESULT_COMMITTED,
        VERIFIED,
        SETTLED,
        CANCELLED,
        EXPIRED,
        FAILED,
        DISPUTED,
        REFUNDED
    }

    struct Job {
        address requester;
        bytes32 modelVersionId;
        bytes32 workloadClass;
        bytes32 requestHash;
        bytes32 privacyPolicyId;
        bytes32 verificationProfileId;
        uint256 maxSpend;
        uint64 deadline;
        bytes32 fundingRef;
        uint256 fundedAmount;
        bytes32 computeRequestId;
        bytes32 computeJobId;
        bytes32 providerId;
        bytes32 resultHash;
        bytes32 resultManifestHash;
        bytes32 disputeRef;
        Status status;
    }

    mapping(bytes32 => Job) public jobs;
    address public computeAdapter;
    bool public computeAdapterBound;

    error InvalidJobId();
    error InvalidWorkloadClass();
    error InvalidDeadline();
    error InvalidSpend();
    error JobExists();
    error JobNotFound();
    error InvalidTransition();
    error NotRequester();
    error NotEscrow();
    error NotComputeAdapter();
    error AdapterAlreadyBound();
    error InvalidReference();
    error FundingExceedsMaximum();

    event ComputeAdapterBound(address indexed adapter);
    event JobCreated(bytes32 indexed jobId, address indexed requester, bytes32 indexed modelVersionId, bytes32 workloadClass, uint256 maxSpend, uint64 deadline);
    event FundingConfirmed(bytes32 indexed jobId, bytes32 fundingRef, uint256 amount);
    event ComputeMatched(bytes32 indexed jobId, bytes32 computeRequestId, bytes32 computeJobId, bytes32 providerId);
    event JobStatus(bytes32 indexed jobId, Status previousStatus, Status newStatus);
    event ResultCommitted(bytes32 indexed jobId, bytes32 resultHash, bytes32 resultManifestHash);
    event DisputeOpened(bytes32 indexed jobId, bytes32 disputeRef);
    event DisputeResolved(bytes32 indexed jobId, bool upheld, bytes32 resolutionRef);

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) { return "AIJobManager"; }
    function protocolVersion() external pure returns (uint32) { return 2; }

    function bindComputeAdapter(address adapter) external onlyGovernance {
        if (computeAdapterBound) revert AdapterAlreadyBound();
        if (adapter == address(0)) revert ZeroAddress();
        computeAdapter = adapter;
        computeAdapterBound = true;
        emit ComputeAdapterBound(adapter);
    }

    /// @notice Legacy create shape retained. It creates a bounded CREATED request rather than falsely marking it FUNDED.
    function create(bytes32 jobId, bytes32, bytes32 modelId, bytes32 requestHash) external {
        _create(jobId, modelId, AIIds420.WORKLOAD_TEXT, requestHash, bytes32(0), bytes32(0), type(uint256).max, uint64(block.timestamp + 1 days));
    }

    function createRequest(
        bytes32 jobId,
        bytes32 modelVersionId,
        bytes32 workloadClass,
        bytes32 requestHash,
        bytes32 privacyPolicyId,
        bytes32 verificationProfileId,
        uint256 maxSpend,
        uint64 deadline
    ) external {
        _create(jobId, modelVersionId, workloadClass, requestHash, privacyPolicyId, verificationProfileId, maxSpend, deadline);
    }

    function confirmFunding(bytes32 jobId, bytes32 fundingRef, uint256 amount) external {
        if (msg.sender != AI_JOB_ESCROW) revert NotEscrow();
        Job storage j = _get(jobId);
        if (j.status != Status.CREATED) revert InvalidTransition();
        if (fundingRef == bytes32(0)) revert InvalidReference();
        if (amount == 0 || amount > j.maxSpend) revert FundingExceedsMaximum();
        j.fundingRef = fundingRef;
        j.fundedAmount = amount;
        _setStatus(jobId, j, Status.FUNDED);
        emit FundingConfirmed(jobId, fundingRef, amount);
    }

    function matchCompute(bytes32 jobId, bytes32 computeRequestId, bytes32 computeJobId, bytes32 providerId) external onlyComputeAdapter {
        Job storage j = _get(jobId);
        if (j.status != Status.FUNDED) revert InvalidTransition();
        if (computeRequestId == bytes32(0) || computeJobId == bytes32(0) || providerId == bytes32(0)) revert InvalidReference();
        j.computeRequestId = computeRequestId;
        j.computeJobId = computeJobId;
        j.providerId = providerId;
        _setStatus(jobId, j, Status.MATCHED);
        emit ComputeMatched(jobId, computeRequestId, computeJobId, providerId);
    }

    function acceptCompute(bytes32 jobId) external onlyComputeAdapter { _advance(jobId, Status.MATCHED, Status.ACCEPTED); }
    function markRunning(bytes32 jobId) external onlyComputeAdapter { _advance(jobId, Status.ACCEPTED, Status.RUNNING); }

    function commitResult(bytes32 jobId, bytes32 resultHash, bytes32 resultManifestHash) external onlyComputeAdapter {
        Job storage j = _get(jobId);
        if (j.status != Status.RUNNING) revert InvalidTransition();
        if (resultHash == bytes32(0) || resultManifestHash == bytes32(0)) revert InvalidReference();
        j.resultHash = resultHash;
        j.resultManifestHash = resultManifestHash;
        _setStatus(jobId, j, Status.RESULT_COMMITTED);
        emit ResultCommitted(jobId, resultHash, resultManifestHash);
    }

    function verifyResult(bytes32 jobId) external onlyComputeAdapter { _advance(jobId, Status.RESULT_COMMITTED, Status.VERIFIED); }

    function confirmSettlement(bytes32 jobId) external {
        if (msg.sender != AI_JOB_ESCROW) revert NotEscrow();
        _advance(jobId, Status.VERIFIED, Status.SETTLED);
    }

    function confirmRefund(bytes32 jobId) external {
        if (msg.sender != AI_JOB_ESCROW) revert NotEscrow();
        Job storage j = _get(jobId);
        if (j.status != Status.FUNDED && j.status != Status.EXPIRED && j.status != Status.FAILED && j.status != Status.DISPUTED) revert InvalidTransition();
        _setStatus(jobId, j, Status.REFUNDED);
    }

    function cancel(bytes32 jobId) external {
        Job storage j = _requester(jobId);
        if (j.status != Status.CREATED) revert InvalidTransition();
        _setStatus(jobId, j, Status.CANCELLED);
    }

    function expire(bytes32 jobId) external {
        Job storage j = _get(jobId);
        if (block.timestamp <= j.deadline) revert InvalidDeadline();
        if (j.status != Status.CREATED && j.status != Status.FUNDED && j.status != Status.MATCHED && j.status != Status.ACCEPTED) revert InvalidTransition();
        _setStatus(jobId, j, Status.EXPIRED);
    }

    function markFailed(bytes32 jobId) external onlyComputeAdapter {
        Job storage j = _get(jobId);
        if (j.status != Status.MATCHED && j.status != Status.ACCEPTED && j.status != Status.RUNNING) revert InvalidTransition();
        _setStatus(jobId, j, Status.FAILED);
    }

    function openDispute(bytes32 jobId, bytes32 disputeRef) external {
        Job storage j = _requester(jobId);
        if (j.status != Status.RESULT_COMMITTED && j.status != Status.VERIFIED) revert InvalidTransition();
        if (disputeRef == bytes32(0)) revert InvalidReference();
        j.disputeRef = disputeRef;
        _setStatus(jobId, j, Status.DISPUTED);
        emit DisputeOpened(jobId, disputeRef);
    }

    /// @notice Governance may resolve only an already-open dispute into a bounded outcome; it cannot assign arbitrary states.
    function resolveDispute(bytes32 jobId, bool upheld, bytes32 resolutionRef) external onlyGovernance {
        Job storage j = _get(jobId);
        if (j.status != Status.DISPUTED) revert InvalidTransition();
        if (resolutionRef == bytes32(0)) revert InvalidReference();
        _setStatus(jobId, j, upheld ? Status.FAILED : Status.VERIFIED);
        emit DisputeResolved(jobId, upheld, resolutionRef);
    }

    function _create(
        bytes32 jobId,
        bytes32 modelVersionId,
        bytes32 workloadClass,
        bytes32 requestHash,
        bytes32 privacyPolicyId,
        bytes32 verificationProfileId,
        uint256 maxSpend,
        uint64 deadline
    ) private {
        if (jobId == bytes32(0) || modelVersionId == bytes32(0) || requestHash == bytes32(0)) revert InvalidJobId();
        if (jobs[jobId].status != Status.NONE) revert JobExists();
        if (!_validWorkload(workloadClass)) revert InvalidWorkloadClass();
        if (maxSpend == 0) revert InvalidSpend();
        if (deadline <= block.timestamp) revert InvalidDeadline();
        jobs[jobId] = Job({
            requester: msg.sender,
            modelVersionId: modelVersionId,
            workloadClass: workloadClass,
            requestHash: requestHash,
            privacyPolicyId: privacyPolicyId,
            verificationProfileId: verificationProfileId,
            maxSpend: maxSpend,
            deadline: deadline,
            fundingRef: bytes32(0),
            fundedAmount: 0,
            computeRequestId: bytes32(0),
            computeJobId: bytes32(0),
            providerId: bytes32(0),
            resultHash: bytes32(0),
            resultManifestHash: bytes32(0),
            disputeRef: bytes32(0),
            status: Status.CREATED
        });
        emit JobCreated(jobId, msg.sender, modelVersionId, workloadClass, maxSpend, deadline);
    }

    function _advance(bytes32 jobId, Status from, Status to) private {
        Job storage j = _get(jobId);
        if (j.status != from) revert InvalidTransition();
        _setStatus(jobId, j, to);
    }

    function _setStatus(bytes32 jobId, Job storage j, Status next) private {
        Status previous = j.status;
        j.status = next;
        emit JobStatus(jobId, previous, next);
    }

    function _requester(bytes32 jobId) private view returns (Job storage j) {
        j = _get(jobId);
        if (msg.sender != j.requester) revert NotRequester();
    }

    function _get(bytes32 jobId) private view returns (Job storage j) {
        j = jobs[jobId];
        if (j.status == Status.NONE) revert JobNotFound();
    }

    modifier onlyComputeAdapter() {
        if (!computeAdapterBound || msg.sender != computeAdapter) revert NotComputeAdapter();
        _;
    }

    function _validWorkload(bytes32 x) private pure returns (bool) {
        return x == AIIds420.WORKLOAD_TEXT || x == AIIds420.WORKLOAD_MULTIMODAL || x == AIIds420.WORKLOAD_IMAGE
            || x == AIIds420.WORKLOAD_AUDIO || x == AIIds420.WORKLOAD_VIDEO || x == AIIds420.WORKLOAD_EMBEDDING
            || x == AIIds420.WORKLOAD_RERANK || x == AIIds420.WORKLOAD_FINE_TUNE || x == AIIds420.WORKLOAD_BATCH;
    }
}
