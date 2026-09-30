// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ComputeJobRegistry420.sol";
import "./ComputeJobWorkerSnapshotEvidence420.sol";
import "./ComputeAuthorization420.sol";
import "./ComputeWorkerRegistry420.sol";
import "./ComputeWorkerCapabilityProfile420.sol";
import "./ComputeWorkerAttestedEligibility420.sol";
import "./ComputeWorkerCapabilityEligibility420.sol";
import "./ComputeWorkerAttestation420.sol";
import "./ComputeWorkerTrust420.sol";
import "./ComputeWorkerStake420.sol";
import "./ComputeWorkerCapacityReservation420.sol";
import "./ComputeWorkerReadModel420.sol";

/// @notice CMP-1.3.15 immutable release-candidate wiring audit record.
/// @dev This contract grants no authority and performs no publication, deployment, custody, matching,
/// settlement, staking, slashing, verification, or governance action. It only fails closed when the
/// supplied WorkerRegistry release graph differs from the repository-qualified graph/hash set.
contract ComputeWorkerReleaseCandidateWiring420 {
    struct CodeHashes {
        bytes32 jobs;
        bytes32 workerEvidence;
        bytes32 authorization;
        bytes32 workers;
        bytes32 profiles;
        bytes32 attestedEligibility;
        bytes32 capabilityEligibility;
        bytes32 attestation;
        bytes32 trust;
        bytes32 stake;
        bytes32 capacity;
        bytes32 readModel;
    }

    ComputeJobRegistry420 public immutable canonicalJobs;
    ComputeJobWorkerSnapshotEvidence420 public immutable canonicalWorkerEvidence;
    ComputeAuthorization420 public immutable canonicalAuthorization;
    ComputeWorkerRegistry420 public immutable canonicalWorkers;
    ComputeWorkerCapabilityProfile420 public immutable canonicalProfiles;
    ComputeWorkerAttestedEligibility420 public immutable canonicalAttestedEligibility;
    ComputeWorkerCapabilityEligibility420 public immutable canonicalCapabilityEligibility;
    ComputeWorkerAttestation420 public immutable canonicalAttestation;
    ComputeWorkerTrust420 public immutable canonicalTrust;
    ComputeWorkerStake420 public immutable canonicalStake;
    ComputeWorkerCapacityReservation420 public immutable canonicalCapacity;
    ComputeWorkerReadModel420 public immutable canonicalReadModel;

    uint256 public immutable expectedChainId;
    address public immutable expectedGovernance;

    bytes32 public immutable expectedJobsCodeHash;
    bytes32 public immutable expectedWorkerEvidenceCodeHash;
    bytes32 public immutable expectedAuthorizationCodeHash;
    bytes32 public immutable expectedWorkersCodeHash;
    bytes32 public immutable expectedProfilesCodeHash;
    bytes32 public immutable expectedAttestedEligibilityCodeHash;
    bytes32 public immutable expectedCapabilityEligibilityCodeHash;
    bytes32 public immutable expectedAttestationCodeHash;
    bytes32 public immutable expectedTrustCodeHash;
    bytes32 public immutable expectedStakeCodeHash;
    bytes32 public immutable expectedCapacityCodeHash;
    bytes32 public immutable expectedReadModelCodeHash;

    error InvalidWiring();

    constructor(
        address jobs_,
        address workerEvidence_,
        address authorization_,
        address workers_,
        address profiles_,
        address attestedEligibility_,
        address capabilityEligibility_,
        address attestation_,
        address trust_,
        address stake_,
        address capacity_,
        address readModel_,
        address governance_,
        CodeHashes memory hashes_
    ) {
        if (
            jobs_ == address(0)
                || workerEvidence_ == address(0)
                || authorization_ == address(0)
                || workers_ == address(0)
                || profiles_ == address(0)
                || attestedEligibility_ == address(0)
                || capabilityEligibility_ == address(0)
                || attestation_ == address(0)
                || trust_ == address(0)
                || stake_ == address(0)
                || capacity_ == address(0)
                || readModel_ == address(0)
                || governance_ == address(0)
                || hashes_.jobs == bytes32(0)
                || hashes_.workerEvidence == bytes32(0)
                || hashes_.authorization == bytes32(0)
                || hashes_.workers == bytes32(0)
                || hashes_.profiles == bytes32(0)
                || hashes_.attestedEligibility == bytes32(0)
                || hashes_.capabilityEligibility == bytes32(0)
                || hashes_.attestation == bytes32(0)
                || hashes_.trust == bytes32(0)
                || hashes_.stake == bytes32(0)
                || hashes_.capacity == bytes32(0)
                || hashes_.readModel == bytes32(0)
        ) revert InvalidWiring();

        canonicalJobs = ComputeJobRegistry420(jobs_);
        canonicalWorkerEvidence = ComputeJobWorkerSnapshotEvidence420(workerEvidence_);
        canonicalAuthorization = ComputeAuthorization420(authorization_);
        canonicalWorkers = ComputeWorkerRegistry420(workers_);
        canonicalProfiles = ComputeWorkerCapabilityProfile420(profiles_);
        canonicalAttestedEligibility = ComputeWorkerAttestedEligibility420(attestedEligibility_);
        canonicalCapabilityEligibility = ComputeWorkerCapabilityEligibility420(capabilityEligibility_);
        canonicalAttestation = ComputeWorkerAttestation420(attestation_);
        canonicalTrust = ComputeWorkerTrust420(trust_);
        canonicalStake = ComputeWorkerStake420(stake_);
        canonicalCapacity = ComputeWorkerCapacityReservation420(capacity_);
        canonicalReadModel = ComputeWorkerReadModel420(readModel_);

        expectedChainId = block.chainid;
        expectedGovernance = governance_;

        expectedJobsCodeHash = hashes_.jobs;
        expectedWorkerEvidenceCodeHash = hashes_.workerEvidence;
        expectedAuthorizationCodeHash = hashes_.authorization;
        expectedWorkersCodeHash = hashes_.workers;
        expectedProfilesCodeHash = hashes_.profiles;
        expectedAttestedEligibilityCodeHash = hashes_.attestedEligibility;
        expectedCapabilityEligibilityCodeHash = hashes_.capabilityEligibility;
        expectedAttestationCodeHash = hashes_.attestation;
        expectedTrustCodeHash = hashes_.trust;
        expectedStakeCodeHash = hashes_.stake;
        expectedCapacityCodeHash = hashes_.capacity;
        expectedReadModelCodeHash = hashes_.readModel;

        assertWiring();
    }

    function assertWiring() public view {
        if (
            block.chainid != expectedChainId
                || address(canonicalJobs).codehash != expectedJobsCodeHash
                || address(canonicalWorkerEvidence).codehash != expectedWorkerEvidenceCodeHash
                || address(canonicalAuthorization).codehash != expectedAuthorizationCodeHash
                || address(canonicalWorkers).codehash != expectedWorkersCodeHash
                || address(canonicalProfiles).codehash != expectedProfilesCodeHash
                || address(canonicalAttestedEligibility).codehash != expectedAttestedEligibilityCodeHash
                || address(canonicalCapabilityEligibility).codehash != expectedCapabilityEligibilityCodeHash
                || address(canonicalAttestation).codehash != expectedAttestationCodeHash
                || address(canonicalTrust).codehash != expectedTrustCodeHash
                || address(canonicalStake).codehash != expectedStakeCodeHash
                || address(canonicalCapacity).codehash != expectedCapacityCodeHash
                || address(canonicalReadModel).codehash != expectedReadModelCodeHash
        ) revert InvalidWiring();

        if (
            address(canonicalJobs.workerEvidence()) != address(canonicalWorkerEvidence)
                || address(canonicalJobs.matchEvidence()) != address(canonicalWorkerEvidence.matches())
                || address(canonicalWorkerEvidence.jobs()) != address(canonicalJobs)
                || canonicalWorkerEvidence.matches().jobs() != address(canonicalJobs)
                || address(canonicalWorkerEvidence.authorization()) != address(canonicalAuthorization)
                || address(canonicalWorkers.authorization()) != address(canonicalAuthorization)
                || address(canonicalWorkerEvidence.workers()) != address(canonicalWorkers)
                || address(canonicalWorkerEvidence.attestation()) != address(canonicalAttestation)
                || address(canonicalWorkerEvidence.workerTrust()) != address(canonicalTrust)
                || address(canonicalWorkerEvidence.workerStake()) != address(canonicalStake)
                || address(canonicalWorkerEvidence.capacity()) != address(canonicalCapacity)
                || canonicalCapacity.controller() != address(canonicalWorkerEvidence)
        ) revert InvalidWiring();

        if (
            address(canonicalProfiles.workers()) != address(canonicalWorkers)
                || address(canonicalProfiles.resources()) != address(canonicalWorkers.resources())
                || address(canonicalAttestedEligibility.workers()) != address(canonicalWorkers)
                || address(canonicalAttestedEligibility.attestations()) != address(canonicalAttestation)
                || address(canonicalCapabilityEligibility.workers()) != address(canonicalWorkers)
                || address(canonicalCapabilityEligibility.profiles()) != address(canonicalProfiles)
                || address(canonicalCapabilityEligibility.attestedEligibility()) != address(canonicalAttestedEligibility)
        ) revert InvalidWiring();

        if (
            address(canonicalAttestation.workers()) != address(canonicalWorkers)
                || address(canonicalTrust.workers()) != address(canonicalWorkers)
                || address(canonicalStake.workers()) != address(canonicalWorkers)
                || address(canonicalCapacity.workers()) != address(canonicalWorkers)
                || address(canonicalCapacity.resources()) != address(canonicalWorkers.resources())
                || canonicalAttestation.governanceTimelock() != expectedGovernance
                || canonicalTrust.governanceTimelock() != expectedGovernance
                || canonicalStake.governanceTimelock() != expectedGovernance
        ) revert InvalidWiring();

        if (
            address(canonicalReadModel.workers()) != address(canonicalWorkers)
                || address(canonicalReadModel.profiles()) != address(canonicalProfiles)
                || address(canonicalReadModel.capabilityEligibility()) != address(canonicalCapabilityEligibility)
                || address(canonicalReadModel.attestation()) != address(canonicalAttestation)
                || address(canonicalReadModel.workerTrust()) != address(canonicalTrust)
                || address(canonicalReadModel.workerStake()) != address(canonicalStake)
                || address(canonicalReadModel.capacity()) != address(canonicalCapacity)
                || address(canonicalReadModel.snapshots()) != address(canonicalWorkerEvidence)
        ) revert InvalidWiring();

        if (
            address(canonicalWorkers.resources()) == address(0)
                || address(canonicalWorkers.nodes()) == address(0)
                || address(canonicalWorkers.providers()) == address(0)
        ) revert InvalidWiring();
    }

    function graphHash() external view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("420Integrated.ComputeMarket.WorkerReleaseCandidateGraph.v1"),
                expectedChainId,
                address(canonicalJobs),
                address(canonicalWorkerEvidence),
                address(canonicalAuthorization),
                address(canonicalWorkers),
                address(canonicalProfiles),
                address(canonicalAttestedEligibility),
                address(canonicalCapabilityEligibility),
                address(canonicalAttestation),
                address(canonicalTrust),
                address(canonicalStake),
                address(canonicalCapacity),
                address(canonicalReadModel),
                address(canonicalWorkerEvidence.matches()),
                address(canonicalWorkers.resources()),
                address(canonicalWorkers.nodes()),
                address(canonicalWorkers.providers()),
                expectedGovernance,
                expectedJobsCodeHash,
                expectedWorkerEvidenceCodeHash,
                expectedAuthorizationCodeHash,
                expectedWorkersCodeHash,
                expectedProfilesCodeHash,
                expectedAttestedEligibilityCodeHash,
                expectedCapabilityEligibilityCodeHash,
                expectedAttestationCodeHash,
                expectedTrustCodeHash,
                expectedStakeCodeHash,
                expectedCapacityCodeHash,
                expectedReadModelCodeHash
            )
        );
    }
}
