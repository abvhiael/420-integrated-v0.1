// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";
import "./AIIds420.sol";

interface IAICanonicalDisputeEvidence420 {
    function disputeEvidence(bytes32 aiJobId, bytes32 disputeRef)
        external view returns (bytes32 computeJobId, bytes32 resultCommitment,
            bytes32 verificationRef, bool active, bool finalized, bool providerWins, bytes32 resolutionRef);
}

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

    mapping(bytes32 => Job) private _jobs;
    address public computeAdapter;
    bool public computeAdapterBound;

    // Append-only storage: do not change Job or the legacy jobs() getter.
    enum DisputeOutcome { NONE, PROVIDER_WINS, PAYER_WINS }
    struct DisputeContext {
        Status originalStatus;
        bytes32 computeJobId;
        bytes32 resultCommitment;
        bytes32 disputeRef;
        bytes32 verificationRef;
        uint64 sequence;
        bytes32 resolutionRef;
        DisputeOutcome outcome;
    }
    mapping(bytes32 => uint64) public disputeSequence;
    mapping(bytes32 => mapping(uint64 => DisputeContext)) private _disputeContexts;
    mapping(bytes32 => bool) public disputeReferenceUsed;
    error InvalidDisputeEvidence();
    event DisputeContextRecorded(bytes32 indexed jobId, uint64 indexed sequence, bytes32 indexed disputeRef,
        Status originalStatus, bytes32 computeJobId, bytes32 resultCommitment, bytes32 verificationRef);
    event DisputeContextResolved(bytes32 indexed jobId, uint64 indexed sequence, bytes32 indexed resolutionRef,
        DisputeOutcome outcome, Status restoredStatus);

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
    event JobCreated(
        bytes32 indexed jobId,
        address indexed requester,
        bytes32 indexed modelVersionId,
        bytes32 workloadClass,
        uint256 maxSpend,
        uint64 deadline
    );
    event FundingConfirmed(bytes32 indexed jobId, bytes32 fundingRef, uint256 amount);
    event ComputeMatched(bytes32 indexed jobId, bytes32 computeRequestId, bytes32 computeJobId, bytes32 providerId);
    event JobStatus(bytes32 indexed jobId, Status previousStatus, Status newStatus);
    event ResultCommitted(bytes32 indexed jobId, bytes32 resultHash, bytes32 resultManifestHash);
    event DisputeOpened(bytes32 indexed jobId, bytes32 disputeRef);
    event DisputeResolved(bytes32 indexed jobId, bool upheld, bytes32 resolutionRef);

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) {
        return "AIJobManager";
    }

    function protocolVersion() external pure returns (uint32) {
        return 2;
    }

    /// @notice ABI-compatible replacement for the compiler-generated public mapping getter.
    /// @dev Returning directly from assembly avoids legacy codegen stack pressure from a 17-field struct getter.
    function jobs(bytes32 jobId)
        external
        view
        returns (
            address,
            bytes32,
            bytes32,
            bytes32,
            bytes32,
            bytes32,
            uint256,
            uint64,
            bytes32,
            uint256,
            bytes32,
            bytes32,
            bytes32,
            bytes32,
            bytes32,
            bytes32,
            Status
        )
    {
        assembly ("memory-safe") {
            mstore(0x00, jobId)
            mstore(0x20, _jobs.slot)
            let slot := keccak256(0x00, 0x40)
            let ptr := mload(0x40)

            mstore(ptr, sload(slot))
            mstore(add(ptr, 0x20), sload(add(slot, 1)))
            mstore(add(ptr, 0x40), sload(add(slot, 2)))
            mstore(add(ptr, 0x60), sload(add(slot, 3)))
            mstore(add(ptr, 0x80), sload(add(slot, 4)))
            mstore(add(ptr, 0xa0), sload(add(slot, 5)))
            mstore(add(ptr, 0xc0), sload(add(slot, 6)))
            mstore(add(ptr, 0xe0), sload(add(slot, 7)))
            mstore(add(ptr, 0x100), sload(add(slot, 8)))
            mstore(add(ptr, 0x120), sload(add(slot, 9)))
            mstore(add(ptr, 0x140), sload(add(slot, 10)))
            mstore(add(ptr, 0x160), sload(add(slot, 11)))
            mstore(add(ptr, 0x180), sload(add(slot, 12)))
            mstore(add(ptr, 0x1a0), sload(add(slot, 13)))
            mstore(add(ptr, 0x1c0), sload(add(slot, 14)))
            mstore(add(ptr, 0x1e0), sload(add(slot, 15)))
            mstore(add(ptr, 0x200), sload(add(slot, 16)))
            return(ptr, 0x220)
        }
    }

    function bindComputeAdapter(address adapter) external onlyGovernance {
        if (computeAdapterBound) revert AdapterAlreadyBound();
        if (adapter == address(0)) revert ZeroAddress();
        computeAdapter = adapter;
        computeAdapterBound = true;
        emit ComputeAdapterBound(adapter);
    }

    /// @notice Legacy create shape retained. It creates a bounded CREATED request rather than falsely marking it FUNDED.
    function create(bytes32 jobId, bytes32, bytes32 modelId, bytes32 requestHash) external {
        _create(
            jobId,
            modelId,
            AIIds420.WORKLOAD_TEXT,
            requestHash,
            bytes32(0),
            bytes32(0),
            type(uint256).max,
            uint64(block.timestamp + 1 days)
        );
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
        _create(
            jobId,
            modelVersionId,
            workloadClass,
            requestHash,
            privacyPolicyId,
            verificationProfileId,
            maxSpend,
            deadline
        );
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

    /// @notice Mirror canonical CMP/Vault funding after the bound compute adapter has
    ///         independently verified payer, obligation, funding reference and spend ceiling.
    /// @dev This records no assets and grants no transfer authority.
    function confirmCanonicalFunding(bytes32 jobId, bytes32 fundingRef, uint256 amount)
        external
        onlyComputeAdapter
    {
        Job storage j = _get(jobId);
        if (j.status != Status.CREATED) revert InvalidTransition();
        if (fundingRef == bytes32(0)) revert InvalidReference();
        if (amount == 0 || amount > j.maxSpend) revert FundingExceedsMaximum();
        j.fundingRef = fundingRef;
        j.fundedAmount = amount;
        _setStatus(jobId, j, Status.FUNDED);
        emit FundingConfirmed(jobId, fundingRef, amount);
    }

    function matchCompute(bytes32 jobId, bytes32 computeRequestId, bytes32 computeJobId, bytes32 providerId)
        external
        onlyComputeAdapter
    {
        Job storage j = _get(jobId);
        if (j.status != Status.FUNDED) revert InvalidTransition();
        if (computeRequestId == bytes32(0) || computeJobId == bytes32(0) || providerId == bytes32(0)) {
            revert InvalidReference();
        }
        j.computeRequestId = computeRequestId;
        j.computeJobId = computeJobId;
        j.providerId = providerId;
        _setStatus(jobId, j, Status.MATCHED);
        emit ComputeMatched(jobId, computeRequestId, computeJobId, providerId);
    }

    function acceptCompute(bytes32 jobId) external onlyComputeAdapter {
        _advance(jobId, Status.MATCHED, Status.ACCEPTED);
    }

    function markRunning(bytes32 jobId) external onlyComputeAdapter {
        _advance(jobId, Status.ACCEPTED, Status.RUNNING);
    }

    function commitResult(bytes32 jobId, bytes32 resultHash, bytes32 resultManifestHash) external onlyComputeAdapter {
        Job storage j = _get(jobId);
        if (j.status != Status.RUNNING) revert InvalidTransition();
        if (resultHash == bytes32(0) || resultManifestHash == bytes32(0)) revert InvalidReference();
        j.resultHash = resultHash;
        j.resultManifestHash = resultManifestHash;
        _setStatus(jobId, j, Status.RESULT_COMMITTED);
        emit ResultCommitted(jobId, resultHash, resultManifestHash);
    }

    function verifyResult(bytes32 jobId) external onlyComputeAdapter {
        _advance(jobId, Status.RESULT_COMMITTED, Status.VERIFIED);
    }

    function confirmSettlement(bytes32 jobId) external {
        if (msg.sender != AI_JOB_ESCROW) revert NotEscrow();
        _advance(jobId, Status.VERIFIED, Status.SETTLED);
    }

    /// @notice Mirror an already-executed canonical CMP provider payout.
    function confirmCanonicalSettlement(bytes32 jobId) external onlyComputeAdapter {
        _advance(jobId, Status.VERIFIED, Status.SETTLED);
    }

    function confirmRefund(bytes32 jobId) external {
        if (msg.sender != AI_JOB_ESCROW) revert NotEscrow();
        Job storage j = _get(jobId);
        if (
            j.status != Status.FUNDED && j.status != Status.EXPIRED && j.status != Status.FAILED
                
        ) revert InvalidTransition();
        _setStatus(jobId, j, Status.REFUNDED);
    }

    /// @notice Mirror an already-executed canonical CMP payer refund.
    function confirmCanonicalRefund(bytes32 jobId) external onlyComputeAdapter {
        Job storage j = _get(jobId);
        if (
            j.status != Status.FUNDED && j.status != Status.EXPIRED && j.status != Status.FAILED
                
        ) revert InvalidTransition();
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
        if (
            j.status != Status.CREATED && j.status != Status.FUNDED && j.status != Status.MATCHED
                && j.status != Status.ACCEPTED
        ) revert InvalidTransition();
        _setStatus(jobId, j, Status.EXPIRED);
    }

    function markFailed(bytes32 jobId) external onlyComputeAdapter {
        Job storage j = _get(jobId);
        if (j.status != Status.MATCHED && j.status != Status.ACCEPTED && j.status != Status.RUNNING) {
            revert InvalidTransition();
        }
        _setStatus(jobId, j, Status.FAILED);
    }

    /// @notice Mirror an already-open canonical CMP case. The requester must first
    /// open the economic dispute at CMP, which installs the actual settlement hold.
    function openDispute(bytes32 jobId, bytes32 disputeRef) external {
        Job storage j = _requester(jobId);
        if (j.status != Status.RESULT_COMMITTED && j.status != Status.VERIFIED) revert InvalidTransition();
        if (disputeRef == bytes32(0) || disputeReferenceUsed[disputeRef]) revert InvalidDisputeEvidence();
        (bytes32 cmpJob, bytes32 result, bytes32 verification, bool active, bool finalized,,) =
            _canonicalDispute(jobId, disputeRef);
        if (!active || finalized || cmpJob != j.computeJobId || result != j.resultHash
            || cmpJob == bytes32(0) || verification == bytes32(0)) revert InvalidDisputeEvidence();
        uint64 sequence = ++disputeSequence[jobId];
        _disputeContexts[jobId][sequence] = DisputeContext(
            j.status, cmpJob, result, disputeRef, verification, sequence, bytes32(0), DisputeOutcome.NONE
        );
        disputeReferenceUsed[disputeRef] = true;
        emit DisputeContextRecorded(jobId, sequence, disputeRef, j.status, cmpJob, result, verification);
        j.disputeRef = disputeRef;
        _setStatus(jobId, j, Status.DISPUTED);
        emit DisputeOpened(jobId, disputeRef);
    }

    function getDisputeContext(bytes32 jobId, uint64 sequence) external view returns (DisputeContext memory) {
        return _disputeContexts[jobId][sequence];
    }

    /// @notice Compatibility signature: supplied outcome is only an assertion,
    /// never an adjudication. Anyone may synchronize finalized canonical evidence.
    function resolveDispute(bytes32 jobId, bool upheld, bytes32 resolutionRef) external {
        _resolveCanonicalDispute(jobId, upheld, resolutionRef);
    }

    function _resolveCanonicalDispute(bytes32 jobId, bool upheld, bytes32 resolutionRef) private {
        Job storage j = _get(jobId);
        if (j.status != Status.DISPUTED) revert InvalidTransition();
        DisputeContext storage d = _disputeContexts[jobId][disputeSequence[jobId]];
        if (d.sequence == 0 || d.outcome != DisputeOutcome.NONE || resolutionRef == bytes32(0))
            revert InvalidDisputeEvidence();
        (bytes32 cmpJob, bytes32 result, bytes32 verification, bool active, bool finalized,
            bool providerWins, bytes32 canonicalResolution) = _canonicalDispute(jobId, d.disputeRef);
        if (active || !finalized || canonicalResolution != resolutionRef || upheld == providerWins
            || cmpJob != d.computeJobId || cmpJob != j.computeJobId || result != d.resultCommitment
            || result != j.resultHash || verification != d.verificationRef || j.disputeRef != d.disputeRef)
            revert InvalidDisputeEvidence();
        d.resolutionRef = resolutionRef;
        d.outcome = providerWins ? DisputeOutcome.PROVIDER_WINS : DisputeOutcome.PAYER_WINS;
        Status next = providerWins ? d.originalStatus : Status.FAILED;
        _setStatus(jobId, j, next);
        emit DisputeResolved(jobId, upheld, resolutionRef);
        emit DisputeContextResolved(jobId, d.sequence, resolutionRef, d.outcome, next);
    }

    function _canonicalDispute(bytes32 jobId, bytes32 disputeRef) private view returns (
        bytes32, bytes32, bytes32, bool, bool, bool, bytes32
    ) {
        if (!computeAdapterBound || computeAdapter.code.length == 0) revert InvalidDisputeEvidence();
        return IAICanonicalDisputeEvidence420(computeAdapter).disputeEvidence(jobId, disputeRef);
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
        if (_jobs[jobId].status != Status.NONE) revert JobExists();
        if (!_validWorkload(workloadClass)) revert InvalidWorkloadClass();
        if (maxSpend == 0) revert InvalidSpend();
        if (deadline <= block.timestamp) revert InvalidDeadline();

        Job storage j = _jobs[jobId];
        j.requester = msg.sender;
        j.modelVersionId = modelVersionId;
        j.workloadClass = workloadClass;
        j.requestHash = requestHash;
        j.privacyPolicyId = privacyPolicyId;
        j.verificationProfileId = verificationProfileId;
        j.maxSpend = maxSpend;
        j.deadline = deadline;
        j.status = Status.CREATED;

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
        j = _jobs[jobId];
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
