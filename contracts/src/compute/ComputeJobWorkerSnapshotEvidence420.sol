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

    struct AdmissionRefs {
        bytes32 capabilityPolicyId;
        bytes32 capabilityAttestationId;
        bytes32 trustPolicyId;
        bytes32 trustReference;
        bytes32 stakePolicyId;
        bytes32 stakeReference;
    }

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
    mapping(bytes32 => bytes32) public assignmentForJob;
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
        if (address(jobs) == address(0) || assignmentForJob[jobId] != bytes32(0)) {
            revert InvalidEvidence();
        }

        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        if (
            j.status != ComputeJobRegistry420.Status.ACCEPTED
                || j.revision != expectedJobRevision
                || j.matchId == bytes32(0)
                || j.acceptanceRef == bytes32(0)
                || j.deadline <= block.timestamp
                || !workers.isEligible(workerId, workerRevision)
        ) revert InvalidEvidence();

        ComputeWorkerRegistry420.Worker memory w = workers.revision(workerId, workerRevision);

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

        uint64 attempt = 1;
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

        // Capacity reservation is part of the same transaction as canonical assignment.
        // Any later failure (including JobRegistry transition failure) reverts the reservation and counters.
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

        _assignments[assignmentRef] = Assignment({
            jobId: jobId,
            matchId: j.matchId,
            acceptanceRef: j.acceptanceRef,
            workerId: workerId,
            workerRevision: workerRevision,
            providerId: w.providerId,
            nodeId: w.nodeId,
            resourceId: w.resourceId,
            resourceRevision: w.resourceRevision,
            operator: w.operator,
            executionSigner: w.executionSigner,
            executionKeyCommitment: w.executionKeyCommitment,
            capabilityProfileHash: w.capabilityProfileHash,
            jurisdictionHash: w.jurisdictionHash,
            admission: refs,
            snapshotCommitment: snapshotCommitment,
            reservationId: reservationId,
            attempt: attempt,
            resultCommitment: bytes32(0),
            receiptHash: bytes32(0),
            exists: true
        });
        assignmentForJob[jobId] = assignmentRef;

        jobs.assignWorker(jobId, expectedJobRevision, w.operator, assignmentRef);

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
        return a.exists
            && a.jobId == jobId
            && a.matchId == matchId
            && a.operator == worker
            && a.attempt == 1
            && a.snapshotCommitment != bytes32(0)
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
        ComputeJobRegistry420.Job memory j = jobs.job(jobId);

        if (
            !a.exists
                || a.resultCommitment != bytes32(0)
                || j.status != ComputeJobRegistry420.Status.RUNNING
                || j.assignmentRef != assignmentRef
                || receiptHash == bytes32(0)
                || outputHash == bytes32(0)
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

        resultCommitment = keccak256(
            abi.encode(
                RESULT_DOMAIN,
                block.chainid,
                address(this),
                jobId,
                j.requestId,
                j.manifestHash,
                assignmentRef,
                a.snapshotCommitment,
                a.workerId,
                a.workerRevision,
                a.executionKeyCommitment,
                a.attempt,
                a.operator,
                receiptHash,
                outputHash
            )
        );

        a.resultCommitment = resultCommitment;
        a.receiptHash = receiptHash;
        emit WorkerSnapshotResultCommitted(jobId, assignmentRef, resultCommitment);
    }

    /// @notice Synchronizes a live capacity reservation against canonical job state.
    /// @dev Anyone may relay this check; only this contract can mutate the reservation engine.
    function syncCapacity(bytes32 jobId) external {
        bytes32 assignmentRef = assignmentForJob[jobId];
        Assignment storage a = _assignments[assignmentRef];
        if (!a.exists || a.reservationId == bytes32(0) || !capacity.isLive(a.reservationId)) {
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
            j.status == ComputeJobRegistry420.Status.EXPIRED
                || (j.status == ComputeJobRegistry420.Status.RUNNING && block.timestamp > j.deadline)
        ) {
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
        Assignment storage a = _assignments[assignmentRef];
        return a.exists
            && a.jobId == jobId
            && assignmentForJob[jobId] == assignmentRef
            && a.snapshotCommitment != bytes32(0)
            && resultCommitment != bytes32(0)
            && a.resultCommitment == resultCommitment
            && a.receiptHash != bytes32(0);
    }

    function getAssignment(bytes32 assignmentRef) external view returns (Assignment memory a) {
        a = _assignments[assignmentRef];
        if (!a.exists) revert InvalidEvidence();
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
