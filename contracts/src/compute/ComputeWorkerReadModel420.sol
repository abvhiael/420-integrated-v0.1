// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ComputeWorkerRegistry420.sol";
import "./ComputeWorkerCapabilityProfile420.sol";
import "./ComputeWorkerCapabilityEligibility420.sol";
import "./ComputeWorkerAttestation420.sol";
import "./ComputeWorkerTrust420.sol";
import "./ComputeWorkerStake420.sol";
import "./ComputeWorkerCapacityReservation420.sol";
import "./ComputeJobWorkerSnapshotEvidence420.sol";

/// @notice Versioned, read-only canonical consumption surface for ComputeMarket worker state.
/// @dev This contract aggregates authoritative public reads only. It owns no state, grants no authority,
///      performs no matching, and may be replaced by compatible off-chain clients that validate the same
///      canonical component graph and schema/domain identifiers.
contract ComputeWorkerReadModel420 is I420System {
    bytes32 public constant READ_MODEL_SCHEMA_V1 =
        keccak256("420Integrated.ComputeMarket.WorkerReadModel.v1");

    struct Components {
        address workers;
        address profiles;
        address capabilityEligibility;
        address attestation;
        address trust;
        address stake;
        address capacity;
        address snapshots;
    }

    struct Domains {
        bytes32 workerIdentity;
        bytes32 capabilityProfile;
        bytes32 attestation;
        bytes32 provenance;
        bytes32 trustReference;
        bytes32 stakeReference;
        bytes32 capacityReservation;
        bytes32 executionAccept;
        bytes32 executionResult;
        bytes32 attemptTransition;
        bytes32 acceptedConstraint;
    }

    struct CapacityView {
        uint256 liveWorkerUnits;
        uint256 liveWorkerRevisionUnits;
        uint256 liveResourceUnits;
        uint256 liveResourceRevisionUnits;
    }

    struct AttemptIndex {
        bytes32 rootAssignmentRef;
        bytes32 latestAssignmentRef;
        uint64 attemptCount;
    }

    struct EligibilityView {
        bool workerEligible;
        bool capabilityEligible;
        bool trustEligible;
        bool stakeEligible;
    }

    ComputeWorkerRegistry420 public immutable workers;
    ComputeWorkerCapabilityProfile420 public immutable profiles;
    ComputeWorkerCapabilityEligibility420 public immutable capabilityEligibility;
    ComputeWorkerAttestation420 public immutable attestation;
    ComputeWorkerTrust420 public immutable workerTrust;
    ComputeWorkerStake420 public immutable workerStake;
    ComputeWorkerCapacityReservation420 public immutable capacity;
    ComputeJobWorkerSnapshotEvidence420 public immutable snapshots;

    error InvalidConfiguration();

    constructor(
        address workers_,
        address profiles_,
        address capabilityEligibility_,
        address attestation_,
        address trust_,
        address stake_,
        address capacity_,
        address snapshots_
    ) {
        if (
            workers_.code.length == 0
                || profiles_.code.length == 0
                || capabilityEligibility_.code.length == 0
                || attestation_.code.length == 0
                || trust_.code.length == 0
                || stake_.code.length == 0
                || capacity_.code.length == 0
                || snapshots_.code.length == 0
        ) revert InvalidConfiguration();

        workers = ComputeWorkerRegistry420(workers_);
        profiles = ComputeWorkerCapabilityProfile420(profiles_);
        capabilityEligibility = ComputeWorkerCapabilityEligibility420(capabilityEligibility_);
        attestation = ComputeWorkerAttestation420(attestation_);
        workerTrust = ComputeWorkerTrust420(trust_);
        workerStake = ComputeWorkerStake420(stake_);
        capacity = ComputeWorkerCapacityReservation420(capacity_);
        snapshots = ComputeJobWorkerSnapshotEvidence420(snapshots_);

        if (
            address(profiles.workers()) != workers_
                || address(capabilityEligibility.workers()) != workers_
                || address(capabilityEligibility.profiles()) != profiles_
                || address(attestation.workers()) != workers_
                || address(workerTrust.workers()) != workers_
                || address(workerStake.workers()) != workers_
                || address(capacity.workers()) != workers_
                || address(snapshots.workers()) != workers_
                || address(snapshots.capacity()) != capacity_
                || address(snapshots.attestation()) != attestation_
                || address(snapshots.workerTrust()) != trust_
                || address(snapshots.workerStake()) != stake_
        ) revert InvalidConfiguration();
    }

    function systemName() external pure returns (string memory) {
        return "ComputeWorkerReadModel420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function schemaVersion() external pure returns (uint32) {
        return 1;
    }

    function components() external view returns (Components memory) {
        return Components({
            workers: address(workers),
            profiles: address(profiles),
            capabilityEligibility: address(capabilityEligibility),
            attestation: address(attestation),
            trust: address(workerTrust),
            stake: address(workerStake),
            capacity: address(capacity),
            snapshots: address(snapshots)
        });
    }

    function domains() external view returns (Domains memory) {
        return Domains({
            workerIdentity: workers.IDENTITY_DOMAIN_V1(),
            capabilityProfile: profiles.PROFILE_DOMAIN_V1(),
            attestation: attestation.ATTESTATION_DOMAIN_V1(),
            provenance: attestation.PROVENANCE_DOMAIN_V1(),
            trustReference: workerTrust.REFERENCE_DOMAIN_V1(),
            stakeReference: workerStake.REFERENCE_DOMAIN_V1(),
            capacityReservation: capacity.RESERVATION_DOMAIN_V1(),
            executionAccept: snapshots.ACCEPT_EXECUTION_DOMAIN_V1(),
            executionResult: snapshots.RESULT_EXECUTION_DOMAIN_V1(),
            attemptTransition: snapshots.ATTEMPT_TRANSITION_DOMAIN_V1(),
            acceptedConstraint: snapshots.ACCEPTED_CONSTRAINT_DOMAIN_V1()
        });
    }

    function currentWorker(bytes32 workerId)
        external
        view
        returns (ComputeWorkerRegistry420.Worker memory)
    {
        return workers.worker(workerId);
    }

    function workerRevision(bytes32 workerId, uint64 revision)
        external
        view
        returns (ComputeWorkerRegistry420.Worker memory)
    {
        return workers.revision(workerId, revision);
    }

    function capabilityProfile(bytes32 workerId, uint64 revision)
        external
        view
        returns (ComputeWorkerCapabilityProfile420.ProfileMeta memory)
    {
        return profiles.profile(workerId, revision);
    }

    function capabilityArchitectures(bytes32 workerId, uint64 revision)
        external
        view
        returns (bytes32[] memory)
    {
        return profiles.architectures(workerId, revision);
    }

    function capabilityCpuClasses(bytes32 workerId, uint64 revision)
        external
        view
        returns (bytes32[] memory)
    {
        return profiles.cpuClasses(workerId, revision);
    }

    function capabilityGpuClasses(bytes32 workerId, uint64 revision)
        external
        view
        returns (bytes32[] memory)
    {
        return profiles.gpuClasses(workerId, revision);
    }

    function capabilitySoftware(bytes32 workerId, uint64 revision)
        external
        view
        returns (bytes32[] memory)
    {
        return profiles.softwareCapabilities(workerId, revision);
    }

    function eligibility(
        bytes32 workerId,
        uint64 workerRevision_,
        ComputeWorkerCapabilityProfile420.Requirements calldata requirements,
        bool requireTrustedAttestation,
        bytes32 attestationPolicyId,
        bytes32 attestationId,
        bytes32 trustPolicyId,
        bool requireTrustReference,
        bytes32 trustReferenceId,
        bytes32 stakePolicyId,
        bool requireStakeReference,
        bytes32 stakeReferenceId
    ) external view returns (EligibilityView memory out) {
        out.workerEligible = workers.isEligible(workerId, workerRevision_);
        out.capabilityEligible = capabilityEligibility.isEligible(
            workerId,
            workerRevision_,
            requirements,
            requireTrustedAttestation,
            attestationPolicyId,
            attestationId
        );
        out.trustEligible = trustPolicyId == bytes32(0)
            ? true
            : workerTrust.isEligible(
                workerId,
                workerRevision_,
                trustPolicyId,
                requireTrustReference,
                trustReferenceId
            );
        out.stakeEligible = stakePolicyId == bytes32(0)
            ? true
            : workerStake.isEligible(
                workerId,
                workerRevision_,
                stakePolicyId,
                requireStakeReference,
                stakeReferenceId
            );
    }

    function attestationCore(bytes32 attestationId)
        external
        view
        returns (ComputeWorkerAttestation420.Attestation memory)
    {
        return attestation.attestation(attestationId);
    }

    function attestationProvenance(bytes32 attestationId)
        external
        view
        returns (ComputeWorkerAttestation420.Provenance memory)
    {
        return attestation.provenance(attestationId);
    }

    function trustReference(bytes32 referenceId)
        external
        view
        returns (ComputeWorkerTrust420.ReputationReference memory)
    {
        return workerTrust.reputationReference(referenceId);
    }

    function stakeReference(bytes32 referenceId)
        external
        view
        returns (ComputeWorkerStake420.StakeReference memory)
    {
        return workerStake.stakeReference(referenceId);
    }

    function capacityUsage(
        bytes32 workerId,
        uint64 workerRevision_,
        bytes32 resourceId,
        uint64 resourceRevision
    ) external view returns (CapacityView memory out) {
        out.liveWorkerUnits = capacity.liveWorkerUnits(workerId);
        out.liveWorkerRevisionUnits = capacity.liveWorkerRevisionUnits(workerId, workerRevision_);
        out.liveResourceUnits = capacity.liveResourceUnits(resourceId);
        out.liveResourceRevisionUnits = capacity.liveResourceRevisionUnits(resourceId, resourceRevision);
    }

    function reservationForJob(bytes32 jobId)
        external
        view
        returns (bytes32 reservationId, ComputeWorkerCapacityReservation420.Reservation memory reservation_)
    {
        reservationId = capacity.reservationForJob(jobId);
        if (reservationId == bytes32(0)) revert InvalidConfiguration();
        reservation_ = capacity.reservation(reservationId);
    }

    function attemptIndex(bytes32 jobId) external view returns (AttemptIndex memory out) {
        out.rootAssignmentRef = snapshots.rootAssignmentForJob(jobId);
        out.latestAssignmentRef = snapshots.assignmentForJob(jobId);
        out.attemptCount = snapshots.attemptCount(jobId);
    }

    function assignment(bytes32 assignmentRef)
        external
        view
        returns (ComputeJobWorkerSnapshotEvidence420.Assignment memory)
    {
        return snapshots.getAssignment(assignmentRef);
    }

    function attemptLifecycle(bytes32 assignmentRef)
        external
        view
        returns (ComputeJobWorkerSnapshotEvidence420.AttemptLifecycle memory)
    {
        return snapshots.getAttemptLifecycle(assignmentRef);
    }
}
