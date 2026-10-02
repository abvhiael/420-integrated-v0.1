// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ComputeJobRegistry420.sol";
import "./IComputeAcceptedMatchRuntime420.sol";
import "./ComputeAuthorization420.sol";
import "./ComputeWorkerRegistry420.sol";
import "./ComputeWorkerCapacityReservation420.sol";
import "../accounts/ECDSA420.sol";

interface IComputeWorkerAttestationAdmission420 {
    function isAcceptable(
        bytes32 attestationId,
        bytes32 workerId,
        uint64 workerRevision,
        bytes32 resourceId,
        uint64 resourceRevision,
        bytes32 capabilityProfileHash,
        bytes32 executionKeyCommitment,
        bytes32 policyId
    ) external view returns (bool);
}

interface IComputeWorkerTrustAdmission420 {
    function isEligible(
        bytes32 workerId,
        uint64 workerRevision,
        bytes32 policyId,
        bool requireReference,
        bytes32 referenceId
    ) external view returns (bool);
}

interface IComputeWorkerStakeAdmission420 {
    function isEligible(
        bytes32 workerId,
        uint64 workerRevision,
        bytes32 policyId,
        bool requireReference,
        bytes32 referenceId
    ) external view returns (bool);
}

/// @notice CMP-1.3.6 strict worker evidence that freezes the exact worker execution identity
/// used for an accepted paid job.
/// @dev New admission is checked against live worker/policy state once. After assignment, the immutable
/// snapshot remains authoritative for that running job so later worker/resource/key/policy changes cannot
/// rewrite historical execution identity. This contract does not prove result correctness or settle funds.
contract ComputeJobWorkerSnapshotEvidence420 is IComputeJobWorkerEvidence420 {
    bytes32 private constant ASSIGNMENT_DOMAIN =
        keccak256("420/COMPUTE/WORKER_SNAPSHOT_ASSIGNMENT/V1");
    bytes32 private constant SNAPSHOT_DOMAIN =
        keccak256("420/COMPUTE/WORKER_SNAPSHOT/V1");
    bytes32 private constant RESULT_DOMAIN =
        keccak256("420/COMPUTE/WORKER_SNAPSHOT_RESULT/V1");
    bytes32 public constant EXECUTION_SIGNING_POLICY_V1 =
        keccak256("420/COMPUTE/WORKER_EXECUTION_SIGNING/V1");
    bytes32 public constant ACCEPT_EXECUTION_DOMAIN_V1 =
        keccak256("420/COMPUTE/WORKER_EXECUTION_ACCEPT/V1");
    bytes32 public constant RESULT_EXECUTION_DOMAIN_V1 =
        keccak256("420/COMPUTE/WORKER_EXECUTION_RESULT/V1");
    bytes32 public constant CAPACITY_TRANSITION_DOMAIN_V1 =
        keccak256("420/COMPUTE/WORKER_CAPACITY_TRANSITION/V1");
    bytes32 public constant ATTEMPT_TRANSITION_DOMAIN_V1 =
        keccak256("420/COMPUTE/WORKER_ATTEMPT_TRANSITION/V1");
    bytes32 public constant ACCEPTED_CONSTRAINT_DOMAIN_V1 =
        keccak256("420/COMPUTE/WORKER_ACCEPTED_CONSTRAINT/V1");

    struct AdmissionRefs {
        bytes32 capabilityPolicyId;
        bytes32 capabilityAttestationId;
        bytes32 trustPolicyId;
        bytes32 trustReference;
        bytes32 stakePolicyId;
        bytes32 stakeReference;
    }

    enum AttemptStatus { NONE, ACTIVE, RESULT_COMMITTED, FAILED, CANCELLED, EXPIRED }

    struct Assignment {
        bytes32 jobId;
        bytes32 matchId;
        bytes32 acceptanceRef;
        bytes32 workerId;
        uint64 workerRevision;
        bytes32 providerId;
        bytes32 nodeId;
        bytes32 resourceId;
        uint64 resourceRevision;
        address operator;
        address executionSigner;
        bytes32 executionKeyCommitment;
        bytes32 capabilityProfileHash;
        bytes32 jurisdictionHash;
        AdmissionRefs admission;
        bytes32 snapshotCommitment;
        bytes32 reservationId;
        uint64 attempt;
        bytes32 resultCommitment;
        bytes32 receiptHash;
        bool exists;
    }

    struct AttemptLifecycle {
        bytes32 rootAssignmentRef;
        bytes32 previousAttemptRef;
        bytes32 constraintCommitment;
        uint64 acceptedDeadline;
        uint64 openedAt;
        uint64 closedAt;
        uint64 resultCommittedAt;
        bytes32 transitionRef;
        AttemptStatus status;
        bool exists;
    }

    ComputeJobRegistry420 public jobs;
    IComputeAcceptedMatchRuntime420 public immutable matches;
    ComputeAuthorization420 public immutable authorization;
    ComputeWorkerRegistry420 public immutable workers;
    IComputeWorkerAttestationAdmission420 public immutable attestation;
    IComputeWorkerTrustAdmission420 public immutable workerTrust;
    IComputeWorkerStakeAdmission420 public immutable workerStake;
    ComputeWorkerCapacityReservation420 public immutable capacity;
    address public immutable bindingAdmin;

    mapping(bytes32 => Assignment) private _assignments;
    mapping(bytes32 => AttemptLifecycle) private _attemptLifecycle;
    /// @notice Latest attempt reference for the job.
    mapping(bytes32 => bytes32) public assignmentForJob;
    /// @notice Immutable first assignment bound into ComputeJobRegistry420.
    mapping(bytes32 => bytes32) public rootAssignmentForJob;
    mapping(bytes32 => uint64) public attemptCount;
    mapping(bytes32 => bool) public usedExecutionAuthorization;

    error InvalidEvidence();
    error Unauthorized();

    event WorkerSnapshotAssigned(
        bytes32 indexed jobId,
        bytes32 indexed assignmentRef,
        bytes32 indexed workerId,
        uint64 workerRevision,
        bytes32 snapshotCommitment
    );
    event WorkerSnapshotResultCommitted(
        bytes32 indexed jobId,
        bytes32 indexed assignmentRef,
        bytes32 resultCommitment
    );
    event WorkerAttemptTransition(
        bytes32 indexed jobId,
        bytes32 indexed assignmentRef,
        uint64 indexed attempt,
        AttemptStatus previous,
        AttemptStatus current,
        bytes32 transitionRef
    );

    constructor(
        address matches_,
        address authorization_,
        address workers_,
        address attestation_,
        address workerTrust_,
        address workerStake_,
        address capacity_
    ) {
        if (matches_.code.length == 0 || authorization_.code.length == 0 || workers_.code.length == 0) {
            revert InvalidEvidence();
        }
        if (attestation_ != address(0) && attestation_.code.length == 0) revert InvalidEvidence();
        if (workerTrust_ != address(0) && workerTrust_.code.length == 0) revert InvalidEvidence();
        if (workerStake_ != address(0) && workerStake_.code.length == 0) revert InvalidEvidence();
        if (capacity_.code.length == 0) revert InvalidEvidence();

        matches = IComputeAcceptedMatchRuntime420(matches_);
        authorization = ComputeAuthorization420(authorization_);
        workers = ComputeWorkerRegistry420(workers_);
        attestation = IComputeWorkerAttestationAdmission420(attestation_);
        workerTrust = IComputeWorkerTrustAdmission420(workerTrust_);
        workerStake = IComputeWorkerStakeAdmission420(workerStake_);
        capacity = ComputeWorkerCapacityReservation420(capacity_);
        if (address(capacity.workers()) != workers_) revert InvalidEvidence();
        bindingAdmin = msg.sender;
    }

    function bindJobs(address jobs_) external {
        if (msg.sender != bindingAdmin || address(jobs) != address(0) || jobs_.code.length == 0) {
            revert Unauthorized();
        }
        ComputeJobRegistry420 candidate = ComputeJobRegistry420(jobs_);
        if (
            address(candidate.workerEvidence()) != address(this)
                || address(candidate.matchEvidence()) != address(matches)
                || matches.jobs() != jobs_
        ) revert InvalidEvidence();
        jobs = candidate;
    }

    function acceptAssignment(
        bytes32 jobId,
        bytes32 workerId,
        uint64 workerRevision,
        uint64 expectedJobRevision,
        AdmissionRefs calldata refs,
        bytes calldata executionSignature
    ) external returns (bytes32 assignmentRef) {
        if (address(jobs) == address(0) || rootAssignmentForJob[jobId] != bytes32(0)) {
            revert InvalidEvidence();
        }

        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        if (
            j.status != ComputeJobRegistry420.Status.ACCEPTED
                || j.revision != expectedJobRevision
                || j.matchId == bytes32(0)
                || j.acceptanceRef == bytes32(0)
                || j.deadline <= block.timestamp
        ) revert InvalidEvidence();

        ComputeWorkerRegistry420.Worker memory w =
            _validatedWorker(jobId, j, workerId, workerRevision, refs);

        uint64 attempt = 1;
        bytes32 constraintCommitment = _acceptedConstraintCommitment(jobId, j);
        bytes32 snapshotCommitment = _snapshotCommitment(jobId, j, workerId, workerRevision, w, refs);
        bytes32 executionDigest = _assignmentExecutionDigest(
            jobId,
            j,
            workerId,
            workerRevision,
            w,
            expectedJobRevision,
            attempt,
            snapshotCommitment
        );
        if (
            usedExecutionAuthorization[executionDigest]
                || ECDSA420.tryRecover(executionDigest, executionSignature) != w.executionSigner
        ) revert Unauthorized();
        usedExecutionAuthorization[executionDigest] = true;

        assignmentRef = keccak256(
            abi.encode(
                ASSIGNMENT_DOMAIN,
                block.chainid,
                address(this),
                jobId,
                expectedJobRevision,
                attempt,
                snapshotCommitment
            )
        );

        bytes32 reservationId = capacity.reserve(
            jobId,
            assignmentRef,
            workerId,
            workerRevision,
            w.resourceId,
            w.resourceRevision,
            expectedJobRevision,
            j.deadline
        );

        Assignment storage initial = _assignments[assignmentRef];
        initial.jobId = jobId;
        initial.matchId = j.matchId;
        initial.acceptanceRef = j.acceptanceRef;
        initial.workerId = workerId;
        initial.workerRevision = workerRevision;
        initial.providerId = w.providerId;
        initial.nodeId = w.nodeId;
        initial.resourceId = w.resourceId;
        initial.resourceRevision = w.resourceRevision;
        initial.operator = w.operator;
        initial.executionSigner = w.executionSigner;
        initial.executionKeyCommitment = w.executionKeyCommitment;
        initial.capabilityProfileHash = w.capabilityProfileHash;
        initial.jurisdictionHash = w.jurisdictionHash;
        initial.admission = refs;
        initial.snapshotCommitment = snapshotCommitment;
        initial.reservationId = reservationId;
        initial.attempt = attempt;
        initial.exists = true;

        AttemptLifecycle storage initialLife = _attemptLifecycle[assignmentRef];
        initialLife.rootAssignmentRef = assignmentRef;
        initialLife.constraintCommitment = constraintCommitment;
        initialLife.acceptedDeadline = j.deadline;
        initialLife.openedAt = uint64(block.timestamp);
        initialLife.status = AttemptStatus.ACTIVE;
        initialLife.exists = true;
        rootAssignmentForJob[jobId] = assignmentRef;
        assignmentForJob[jobId] = assignmentRef;
        attemptCount[jobId] = attempt;

        jobs.assignWorker(jobId, expectedJobRevision, w.operator, assignmentRef);

        emit WorkerSnapshotAssigned(
            jobId,
            assignmentRef,
            workerId,
            workerRevision,
            snapshotCommitment
        );
    }

    /// @notice Starts a new accepted attempt after a signed failure/cancellation of the prior attempt.
    /// @dev The canonical job remains RUNNING and keeps its immutable root assignment. Retry admission
    ///      rechecks live worker/admission state while preserving the original accepted job/match constraints.
    function retryAssignment(
        bytes32 jobId,
        bytes32 workerId,
        uint64 workerRevision,
        uint64 expectedJobRevision,
        AdmissionRefs calldata refs,
        bytes calldata executionSignature
    ) external returns (bytes32 assignmentRef) {
        bytes32 rootRef = rootAssignmentForJob[jobId];
        bytes32 priorRef = assignmentForJob[jobId];
        if (address(jobs) == address(0) || rootRef == bytes32(0) || priorRef == bytes32(0)) {
            revert InvalidEvidence();
        }

        Assignment storage root = _assignments[rootRef];
        Assignment storage prior = _assignments[priorRef];
        AttemptLifecycle storage rootLife = _attemptLifecycle[rootRef];
        AttemptLifecycle storage priorLife = _attemptLifecycle[priorRef];
        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        if (
            !root.exists
                || !prior.exists
                || !rootLife.exists
                || !priorLife.exists
                || (priorLife.status != AttemptStatus.FAILED && priorLife.status != AttemptStatus.CANCELLED)
                || capacity.isLive(prior.reservationId)
                || j.status != ComputeJobRegistry420.Status.RUNNING
                || j.revision != expectedJobRevision
                || j.assignmentRef != rootRef
                || j.deadline <= block.timestamp
                || _acceptedConstraintCommitment(jobId, j) != rootLife.constraintCommitment
                || !_samePolicyRequirements(root.admission, refs)
        ) revert InvalidEvidence();

        ComputeWorkerRegistry420.Worker memory w =
            _validatedWorker(jobId, j, workerId, workerRevision, refs);
        if (w.resourceId != root.resourceId || w.operator != root.operator) revert InvalidEvidence();

        uint64 attempt = prior.attempt + 1;
        if (attempt == 0 || attempt != attemptCount[jobId] + 1) revert InvalidEvidence();

        bytes32 snapshotCommitment = _snapshotCommitment(jobId, j, workerId, workerRevision, w, refs);
        bytes32 executionDigest = _assignmentExecutionDigest(
            jobId,
            j,
            workerId,
            workerRevision,
            w,
            expectedJobRevision,
            attempt,
            snapshotCommitment
        );
        if (
            usedExecutionAuthorization[executionDigest]
                || ECDSA420.tryRecover(executionDigest, executionSignature) != w.executionSigner
        ) revert Unauthorized();
        usedExecutionAuthorization[executionDigest] = true;

        assignmentRef = keccak256(
            abi.encode(
                ASSIGNMENT_DOMAIN,
                block.chainid,
                address(this),
                jobId,
                expectedJobRevision,
                attempt,
                snapshotCommitment
            )
        );
        if (_assignments[assignmentRef].exists) revert InvalidEvidence();

        bytes32 reservationId = capacity.reserve(
            jobId,
            assignmentRef,
            workerId,
            workerRevision,
            w.resourceId,
            w.resourceRevision,
            expectedJobRevision,
            j.deadline
        );

        Assignment storage nextAttempt = _assignments[assignmentRef];
        nextAttempt.jobId = jobId;
        nextAttempt.matchId = root.matchId;
        nextAttempt.acceptanceRef = root.acceptanceRef;
        nextAttempt.workerId = workerId;
        nextAttempt.workerRevision = workerRevision;
        nextAttempt.providerId = w.providerId;
        nextAttempt.nodeId = w.nodeId;
        nextAttempt.resourceId = w.resourceId;
        nextAttempt.resourceRevision = w.resourceRevision;
        nextAttempt.operator = w.operator;
        nextAttempt.executionSigner = w.executionSigner;
        nextAttempt.executionKeyCommitment = w.executionKeyCommitment;
        nextAttempt.capabilityProfileHash = w.capabilityProfileHash;
        nextAttempt.jurisdictionHash = w.jurisdictionHash;
        nextAttempt.admission = refs;
        nextAttempt.snapshotCommitment = snapshotCommitment;
        nextAttempt.reservationId = reservationId;
        nextAttempt.attempt = attempt;
        nextAttempt.exists = true;

        AttemptLifecycle storage nextLife = _attemptLifecycle[assignmentRef];
        nextLife.rootAssignmentRef = rootRef;
        nextLife.previousAttemptRef = priorRef;
        nextLife.constraintCommitment = rootLife.constraintCommitment;
        nextLife.acceptedDeadline = rootLife.acceptedDeadline;
        nextLife.openedAt = uint64(block.timestamp);
        nextLife.status = AttemptStatus.ACTIVE;
        nextLife.exists = true;
        assignmentForJob[jobId] = assignmentRef;
        attemptCount[jobId] = attempt;

        emit WorkerSnapshotAssigned(
            jobId,
            assignmentRef,
            workerId,
            workerRevision,
            snapshotCommitment
        );
    }

    function authorizedAssignment(
        bytes32 jobId,
        bytes32 matchId,
        address worker,
        bytes32 assignmentRef
    ) external view returns (bool) {
        Assignment storage a = _assignments[assignmentRef];
        AttemptLifecycle storage life = _attemptLifecycle[assignmentRef];
        return a.exists
            && life.exists
            && a.jobId == jobId
            && a.matchId == matchId
            && a.operator == worker
            && a.attempt == 1
            && life.status == AttemptStatus.ACTIVE
            && life.rootAssignmentRef == assignmentRef
            && a.snapshotCommitment != bytes32(0)
            && rootAssignmentForJob[jobId] == assignmentRef
            && assignmentForJob[jobId] == assignmentRef;
    }

    /// @notice Commits a result against the frozen assignment snapshot.
    /// @dev Deliberately does NOT re-read live worker/resource/policy state. Those checks are admission
    /// gates; changing them later must not rewrite or strand an already-running accepted job.
    function commitResult(
        bytes32 jobId,
        bytes32 receiptHash,
        bytes32 outputHash,
        bytes calldata executionSignature
    ) external returns (bytes32 resultCommitment) {
        bytes32 assignmentRef = assignmentForJob[jobId];
        Assignment storage a = _assignments[assignmentRef];
        AttemptLifecycle storage life = _attemptLifecycle[assignmentRef];
        ComputeJobRegistry420.Job memory j = jobs.job(jobId);

        if (
            !a.exists
                || !life.exists
                || life.status != AttemptStatus.ACTIVE
                || a.resultCommitment != bytes32(0)
                || j.status != ComputeJobRegistry420.Status.RUNNING
                || j.assignmentRef != life.rootAssignmentRef
                || receiptHash == bytes32(0)
                || outputHash == bytes32(0)
                || block.timestamp > life.acceptedDeadline
        ) revert InvalidEvidence();

        if (
            !authorization.isAuthorized(
                a.operator,
                authorization.ACTION_SUBMIT_RECEIPT(),
                authorization.scopeJob(jobId),
                0
            )
        ) revert Unauthorized();

        bytes32 executionDigest = _resultExecutionDigest(
            jobId,
            j,
            assignmentRef,
            a,
            receiptHash,
            outputHash
        );
        if (
            usedExecutionAuthorization[executionDigest]
                || ECDSA420.tryRecover(executionDigest, executionSignature) != a.executionSigner
        ) revert Unauthorized();
        usedExecutionAuthorization[executionDigest] = true;

        bytes32 attemptIdentity = keccak256(
            abi.encode(
                life.rootAssignmentRef,
                assignmentRef,
                a.snapshotCommitment,
                a.workerId,
                a.workerRevision,
                a.executionKeyCommitment,
                a.attempt,
                a.operator
            )
        );
        bytes32 resultPayload = keccak256(abi.encode(receiptHash, outputHash));
        resultCommitment = keccak256(
            abi.encode(
                RESULT_DOMAIN,
                block.chainid,
                address(this),
                jobId,
                j.requestId,
                j.manifestHash,
                attemptIdentity,
                resultPayload
            )
        );

        a.resultCommitment = resultCommitment;
        a.receiptHash = receiptHash;
        life.resultCommittedAt = uint64(block.timestamp);
        life.closedAt = uint64(block.timestamp);
        life.transitionRef = resultCommitment;
        life.status = AttemptStatus.RESULT_COMMITTED;

        emit WorkerSnapshotResultCommitted(jobId, assignmentRef, resultCommitment);
        emit WorkerAttemptTransition(
            jobId,
            assignmentRef,
            a.attempt,
            AttemptStatus.ACTIVE,
            AttemptStatus.RESULT_COMMITTED,
            resultCommitment
        );
    }

    /// @notice Synchronizes a live capacity reservation against canonical job state.
    /// @dev Anyone may relay this check; only this contract can mutate the reservation engine.
    function syncCapacity(bytes32 jobId) external {
        bytes32 assignmentRef = assignmentForJob[jobId];
        Assignment storage a = _assignments[assignmentRef];
        AttemptLifecycle storage life = _attemptLifecycle[assignmentRef];
        if (!a.exists || !life.exists || a.reservationId == bytes32(0) || !capacity.isLive(a.reservationId)) {
            revert InvalidEvidence();
        }

        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        bytes32 transitionRef = keccak256(
            abi.encode(
                CAPACITY_TRANSITION_DOMAIN_V1,
                block.chainid,
                address(this),
                jobId,
                assignmentRef,
                a.reservationId,
                j.revision,
                j.status,
                j.resultCommitment,
                j.verificationRef,
                j.settlementRef
            )
        );

        if (
            j.status == ComputeJobRegistry420.Status.RESULT_COMMITTED
                || j.status == ComputeJobRegistry420.Status.VERIFIED
                || j.status == ComputeJobRegistry420.Status.SETTLED
                || j.status == ComputeJobRegistry420.Status.DISPUTED
                || j.status == ComputeJobRegistry420.Status.REFUNDED
        ) {
            capacity.release(a.reservationId, transitionRef);
            return;
        }

        if (j.status == ComputeJobRegistry420.Status.FAILED) {
            capacity.fail(a.reservationId, transitionRef);
            return;
        }

        if (
            j.status == ComputeJobRegistry420.Status.RUNNING
                && life.status == AttemptStatus.ACTIVE
                && block.timestamp > j.deadline
        ) {
            capacity.expire(a.reservationId, transitionRef);
            jobs.recordRunningExpiry(jobId, j.revision, transitionRef);
            life.closedAt = uint64(block.timestamp);
            life.transitionRef = transitionRef;
            life.status = AttemptStatus.EXPIRED;
            emit WorkerAttemptTransition(
                jobId,
                assignmentRef,
                a.attempt,
                AttemptStatus.ACTIVE,
                AttemptStatus.EXPIRED,
                transitionRef
            );
            return;
        }

        if (j.status == ComputeJobRegistry420.Status.EXPIRED) {
            capacity.expire(a.reservationId, transitionRef);
            return;
        }

        revert InvalidEvidence();
    }

    function assignmentExecutionDigest(
        bytes32 jobId,
        bytes32 workerId,
        uint64 workerRevision,
        uint64 expectedJobRevision,
        AdmissionRefs calldata refs
    ) external view returns (bytes32) {
        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        ComputeWorkerRegistry420.Worker memory w = workers.revision(workerId, workerRevision);
        bytes32 snapshotCommitment = _snapshotCommitment(jobId, j, workerId, workerRevision, w, refs);
        return _assignmentExecutionDigest(
            jobId,
            j,
            workerId,
            workerRevision,
            w,
            expectedJobRevision,
            1,
            snapshotCommitment
        );
    }

    function retryExecutionDigest(
        bytes32 jobId,
        bytes32 workerId,
        uint64 workerRevision,
        uint64 expectedJobRevision,
        AdmissionRefs calldata refs
    ) external view returns (bytes32) {
        bytes32 rootRef = rootAssignmentForJob[jobId];
        bytes32 priorRef = assignmentForJob[jobId];
        Assignment storage root = _assignments[rootRef];
        Assignment storage prior = _assignments[priorRef];
        AttemptLifecycle storage rootLife = _attemptLifecycle[rootRef];
        AttemptLifecycle storage priorLife = _attemptLifecycle[priorRef];
        if (
            !root.exists
                || !prior.exists
                || !rootLife.exists
                || !priorLife.exists
                || (priorLife.status != AttemptStatus.FAILED && priorLife.status != AttemptStatus.CANCELLED)
                || !_samePolicyRequirements(root.admission, refs)
        ) revert InvalidEvidence();

        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        if (
            j.status != ComputeJobRegistry420.Status.RUNNING
                || j.revision != expectedJobRevision
                || j.assignmentRef != rootRef
                || j.deadline <= block.timestamp
                || _acceptedConstraintCommitment(jobId, j) != rootLife.constraintCommitment
        ) revert InvalidEvidence();

        ComputeWorkerRegistry420.Worker memory w = workers.revision(workerId, workerRevision);
        uint64 attempt = prior.attempt + 1;
        bytes32 snapshotCommitment = _snapshotCommitment(jobId, j, workerId, workerRevision, w, refs);
        return _assignmentExecutionDigest(
            jobId,
            j,
            workerId,
            workerRevision,
            w,
            expectedJobRevision,
            attempt,
            snapshotCommitment
        );
    }

    function attemptTransitionDigest(
        bytes32 jobId,
        AttemptStatus target,
        bytes32 evidenceRef
    ) external view returns (bytes32) {
        bytes32 assignmentRef = assignmentForJob[jobId];
        Assignment storage a = _assignments[assignmentRef];
        AttemptLifecycle storage life = _attemptLifecycle[assignmentRef];
        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        if (
            !a.exists
                || !life.exists
                || life.status != AttemptStatus.ACTIVE
                || (target != AttemptStatus.FAILED && target != AttemptStatus.CANCELLED)
                || evidenceRef == bytes32(0)
        ) revert InvalidEvidence();
        return _attemptTransitionDigest(jobId, j, assignmentRef, a, life, target, evidenceRef);
    }

    function failAttempt(bytes32 jobId, bytes32 failureRef, bytes calldata executionSignature) external {
        _closeAttempt(jobId, AttemptStatus.FAILED, failureRef, executionSignature);
    }

    /// @notice Cancels only the active execution attempt; it does not cancel/refund the canonical job.
    /// A retry may follow under the unchanged accepted constraints.
    function cancelAttempt(bytes32 jobId, bytes32 cancellationRef, bytes calldata executionSignature) external {
        _closeAttempt(jobId, AttemptStatus.CANCELLED, cancellationRef, executionSignature);
    }

    /// @notice Permissionlessly expires the active attempt and the canonical RUNNING job after deadline.
    function expireAttempt(bytes32 jobId, uint64 expectedJobRevision) external returns (bytes32 expiryRef) {
        bytes32 assignmentRef = assignmentForJob[jobId];
        Assignment storage a = _assignments[assignmentRef];
        AttemptLifecycle storage life = _attemptLifecycle[assignmentRef];
        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        if (
            !a.exists
                || !life.exists
                || life.status != AttemptStatus.ACTIVE
                || j.status != ComputeJobRegistry420.Status.RUNNING
                || j.revision != expectedJobRevision
                || j.assignmentRef != life.rootAssignmentRef
                || block.timestamp <= life.acceptedDeadline
                || !capacity.isLive(a.reservationId)
        ) revert InvalidEvidence();

        expiryRef = keccak256(
            abi.encode(
                CAPACITY_TRANSITION_DOMAIN_V1,
                block.chainid,
                address(this),
                jobId,
                assignmentRef,
                a.reservationId,
                j.revision,
                j.status,
                j.resultCommitment,
                j.verificationRef,
                j.settlementRef
            )
        );

        capacity.expire(a.reservationId, expiryRef);
        jobs.recordRunningExpiry(jobId, expectedJobRevision, expiryRef);
        life.closedAt = uint64(block.timestamp);
        life.transitionRef = expiryRef;
        life.status = AttemptStatus.EXPIRED;
        emit WorkerAttemptTransition(
            jobId,
            assignmentRef,
            a.attempt,
            AttemptStatus.ACTIVE,
            AttemptStatus.EXPIRED,
            expiryRef
        );
    }

    function resultExecutionDigest(bytes32 jobId, bytes32 receiptHash, bytes32 outputHash)
        external
        view
        returns (bytes32)
    {
        bytes32 assignmentRef = assignmentForJob[jobId];
        Assignment storage a = _assignments[assignmentRef];
        if (!a.exists) revert InvalidEvidence();
        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        return _resultExecutionDigest(jobId, j, assignmentRef, a, receiptHash, outputHash);
    }

    function committedResult(bytes32 jobId, bytes32 assignmentRef, bytes32 resultCommitment)
        external
        view
        returns (bool)
    {
        bytes32 latestRef = assignmentForJob[jobId];
        Assignment storage root = _assignments[assignmentRef];
        Assignment storage a = _assignments[latestRef];
        AttemptLifecycle storage rootLife = _attemptLifecycle[assignmentRef];
        AttemptLifecycle storage life = _attemptLifecycle[latestRef];
        return root.exists
            && a.exists
            && rootLife.exists
            && life.exists
            && rootLife.rootAssignmentRef == assignmentRef
            && life.rootAssignmentRef == assignmentRef
            && a.jobId == jobId
            && life.status == AttemptStatus.RESULT_COMMITTED
            && a.snapshotCommitment != bytes32(0)
            && resultCommitment != bytes32(0)
            && a.resultCommitment == resultCommitment
            && a.receiptHash != bytes32(0)
            && life.resultCommittedAt != 0
            && life.resultCommittedAt <= life.acceptedDeadline;
    }

    /// @notice Canonical signed-verdict execution context for the latest result-bearing attempt.
    /// @dev The current CMP-1 fixed-price scope is one canonical unit per job, so unitId == jobId.
    /// Retry provenance is preserved by the latest attemptRef/attempt while the JobRegistry keeps
    /// its immutable root assignment reference.
    function verdictContext(bytes32 jobId) external view returns (
        bytes32 unitId,
        bytes32 attemptRef,
        uint64 attempt,
        address worker,
        bytes32 resultCommitment,
        bytes32 executionEvidenceCommitment
    ) {
        attemptRef = assignmentForJob[jobId];
        Assignment storage a = _assignments[attemptRef];
        AttemptLifecycle storage life = _attemptLifecycle[attemptRef];
        if (!a.exists || !life.exists || a.jobId != jobId
            || life.status != AttemptStatus.RESULT_COMMITTED
            || a.resultCommitment == bytes32(0) || a.receiptHash == bytes32(0)
            || a.snapshotCommitment == bytes32(0)) revert InvalidEvidence();
        unitId = jobId;
        attempt = a.attempt;
        worker = a.operator;
        resultCommitment = a.resultCommitment;
        executionEvidenceCommitment = keccak256(abi.encode(
            RESULT_DOMAIN, jobId, attemptRef, life.rootAssignmentRef, a.workerId,
            a.workerRevision, a.resourceId, a.resourceRevision, a.operator, a.attempt,
            a.snapshotCommitment, a.receiptHash, a.resultCommitment, life.resultCommittedAt
        ));
    }

    function getAssignment(bytes32 assignmentRef) external view returns (Assignment memory a) {
        a = _assignments[assignmentRef];
        if (!a.exists) revert InvalidEvidence();
    }

    function getAttemptLifecycle(bytes32 assignmentRef)
        external
        view
        returns (AttemptLifecycle memory life)
    {
        life = _attemptLifecycle[assignmentRef];
        if (!life.exists) revert InvalidEvidence();
    }

    function _snapshotCommitment(
        bytes32 jobId,
        ComputeJobRegistry420.Job memory j,
        bytes32 workerId,
        uint64 workerRevision,
        ComputeWorkerRegistry420.Worker memory w,
        AdmissionRefs calldata refs
    ) private view returns (bytes32) {
        bytes32 workerExecutionRef = keccak256(
            abi.encode(
                workerId,
                workerRevision,
                w.providerId,
                w.nodeId,
                w.resourceId,
                w.resourceRevision,
                w.operator,
                w.executionSigner,
                w.executionKeyCommitment,
                w.capabilityProfileHash,
                w.jurisdictionHash
            )
        );
        bytes32 admissionRef = keccak256(
            abi.encode(
                refs.capabilityPolicyId,
                refs.capabilityAttestationId,
                refs.trustPolicyId,
                refs.trustReference,
                refs.stakePolicyId,
                refs.stakeReference
            )
        );
        return keccak256(
            abi.encode(
                SNAPSHOT_DOMAIN,
                block.chainid,
                address(this),
                EXECUTION_SIGNING_POLICY_V1,
                jobId,
                j.matchId,
                j.acceptanceRef,
                _acceptedConstraintCommitment(jobId, j),
                workerExecutionRef,
                admissionRef
            )
        );
    }

    function _assignmentExecutionDigest(
        bytes32 jobId,
        ComputeJobRegistry420.Job memory j,
        bytes32 workerId,
        uint64 workerRevision,
        ComputeWorkerRegistry420.Worker memory,
        uint64 expectedJobRevision,
        uint64 attempt,
        bytes32 snapshotCommitment
    ) private view returns (bytes32) {
        return keccak256(
            abi.encode(
                ACCEPT_EXECUTION_DOMAIN_V1,
                block.chainid,
                address(this),
                EXECUTION_SIGNING_POLICY_V1,
                jobId,
                j.matchId,
                j.acceptanceRef,
                expectedJobRevision,
                workerId,
                workerRevision,
                attempt,
                snapshotCommitment
            )
        );
    }

    function _resultExecutionDigest(
        bytes32 jobId,
        ComputeJobRegistry420.Job memory j,
        bytes32 assignmentRef,
        Assignment storage a,
        bytes32 receiptHash,
        bytes32 outputHash
    ) private view returns (bytes32) {
        return keccak256(
            abi.encode(
                RESULT_EXECUTION_DOMAIN_V1,
                block.chainid,
                address(this),
                EXECUTION_SIGNING_POLICY_V1,
                jobId,
                j.requestId,
                j.manifestHash,
                assignmentRef,
                a.snapshotCommitment,
                a.workerId,
                a.workerRevision,
                a.attempt,
                receiptHash,
                outputHash
            )
        );
    }

    function _acceptedConstraintCommitment(bytes32 jobId, ComputeJobRegistry420.Job memory j)
        private
        view
        returns (bytes32)
    {
        bytes32 requestConstraint = keccak256(
            abi.encode(
                j.owner,
                j.requestId,
                j.requestCommitment,
                j.manifestHash,
                j.workloadType,
                j.inputCommitment,
                j.outputSchemaCommitment
            )
        );
        bytes32 acceptedConstraint =
            keccak256(abi.encode(j.fundingRef, j.matchId, j.acceptanceRef, j.deadline));
        return keccak256(
            abi.encode(
                ACCEPTED_CONSTRAINT_DOMAIN_V1,
                block.chainid,
                address(this),
                jobId,
                requestConstraint,
                acceptedConstraint
            )
        );
    }

    function _validatedWorker(
        bytes32 jobId,
        ComputeJobRegistry420.Job memory j,
        bytes32 workerId,
        uint64 workerRevision,
        AdmissionRefs calldata refs
    ) private view returns (ComputeWorkerRegistry420.Worker memory w) {
        if (!workers.isEligible(workerId, workerRevision)) revert InvalidEvidence();
        w = workers.revision(workerId, workerRevision);
        if (!matches.authorizedResource(jobId, j.matchId, j.acceptanceRef, w.resourceId, w.operator)) {
            revert Unauthorized();
        }
        if (
            !authorization.isAuthorized(
                w.operator,
                authorization.ACTION_EXECUTE_ATTEMPT(),
                authorization.scopeJob(jobId),
                0
            )
        ) revert Unauthorized();
        _requireAdmission(workerId, workerRevision, w, refs);
    }

    function _samePolicyRequirements(AdmissionRefs storage original, AdmissionRefs calldata candidate)
        private
        view
        returns (bool)
    {
        return original.capabilityPolicyId == candidate.capabilityPolicyId
            && original.trustPolicyId == candidate.trustPolicyId
            && original.stakePolicyId == candidate.stakePolicyId;
    }

    function _attemptTransitionDigest(
        bytes32 jobId,
        ComputeJobRegistry420.Job memory j,
        bytes32 assignmentRef,
        Assignment storage a,
        AttemptLifecycle storage life,
        AttemptStatus target,
        bytes32 evidenceRef
    ) private view returns (bytes32) {
        bytes32 attemptIdentity = keccak256(
            abi.encode(
                life.rootAssignmentRef,
                assignmentRef,
                life.constraintCommitment,
                a.snapshotCommitment,
                a.workerId,
                a.workerRevision,
                a.executionKeyCommitment,
                a.attempt
            )
        );
        bytes32 jobContext = keccak256(abi.encode(j.requestId, j.manifestHash));
        return keccak256(
            abi.encode(
                ATTEMPT_TRANSITION_DOMAIN_V1,
                block.chainid,
                address(this),
                EXECUTION_SIGNING_POLICY_V1,
                jobId,
                jobContext,
                attemptIdentity,
                target,
                evidenceRef
            )
        );
    }

    function _closeAttempt(
        bytes32 jobId,
        AttemptStatus target,
        bytes32 evidenceRef,
        bytes calldata executionSignature
    ) private {
        bytes32 assignmentRef = assignmentForJob[jobId];
        Assignment storage a = _assignments[assignmentRef];
        AttemptLifecycle storage life = _attemptLifecycle[assignmentRef];
        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        if (
            !a.exists
                || !life.exists
                || life.status != AttemptStatus.ACTIVE
                || (target != AttemptStatus.FAILED && target != AttemptStatus.CANCELLED)
                || evidenceRef == bytes32(0)
                || j.status != ComputeJobRegistry420.Status.RUNNING
                || j.assignmentRef != life.rootAssignmentRef
                || block.timestamp > life.acceptedDeadline
                || !capacity.isLive(a.reservationId)
        ) revert InvalidEvidence();

        if (
            !authorization.isAuthorized(
                a.operator,
                authorization.ACTION_EXECUTE_ATTEMPT(),
                authorization.scopeJob(jobId),
                0
            )
        ) revert Unauthorized();

        bytes32 digest =
            _attemptTransitionDigest(jobId, j, assignmentRef, a, life, target, evidenceRef);
        if (
            usedExecutionAuthorization[digest]
                || ECDSA420.tryRecover(digest, executionSignature) != a.executionSigner
        ) revert Unauthorized();
        usedExecutionAuthorization[digest] = true;

        if (target == AttemptStatus.FAILED) {
            capacity.fail(a.reservationId, digest);
        } else {
            capacity.release(a.reservationId, digest);
        }

        life.closedAt = uint64(block.timestamp);
        life.transitionRef = evidenceRef;
        life.status = target;
        emit WorkerAttemptTransition(
            jobId,
            assignmentRef,
            a.attempt,
            AttemptStatus.ACTIVE,
            target,
            evidenceRef
        );
    }

    function _requireAdmission(
        bytes32 workerId,
        uint64 workerRevision,
        ComputeWorkerRegistry420.Worker memory w,
        AdmissionRefs calldata refs
    ) private view {
        if ((refs.capabilityPolicyId == bytes32(0)) != (refs.capabilityAttestationId == bytes32(0))) {
            revert InvalidEvidence();
        }
        if ((refs.trustPolicyId == bytes32(0)) != (refs.trustReference == bytes32(0))) {
            revert InvalidEvidence();
        }
        if ((refs.stakePolicyId == bytes32(0)) != (refs.stakeReference == bytes32(0))) {
            revert InvalidEvidence();
        }

        if (refs.capabilityPolicyId != bytes32(0)) {
            if (
                address(attestation) == address(0)
                    || !attestation.isAcceptable(
                        refs.capabilityAttestationId,
                        workerId,
                        workerRevision,
                        w.resourceId,
                        w.resourceRevision,
                        w.capabilityProfileHash,
                        w.executionKeyCommitment,
                        refs.capabilityPolicyId
                    )
            ) revert InvalidEvidence();
        }

        if (refs.trustPolicyId != bytes32(0)) {
            if (
                address(workerTrust) == address(0)
                    || !workerTrust.isEligible(
                        workerId,
                        workerRevision,
                        refs.trustPolicyId,
                        true,
                        refs.trustReference
                    )
            ) revert InvalidEvidence();
        }

        if (refs.stakePolicyId != bytes32(0)) {
            if (
                address(workerStake) == address(0)
                    || !workerStake.isEligible(
                        workerId,
                        workerRevision,
                        refs.stakePolicyId,
                        true,
                        refs.stakeReference
                    )
            ) revert InvalidEvidence();
        }
    }
}
