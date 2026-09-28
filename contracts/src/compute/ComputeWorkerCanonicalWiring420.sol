// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ComputeJobRegistry420.sol";
import "./ComputeJobWorkerSnapshotEvidence420.sol";
import "./ComputeWorkerRegistry420.sol";
import "./ComputeWorkerAttestation420.sol";
import "./ComputeWorkerTrust420.sol";
import "./ComputeWorkerStake420.sol";

/// @notice Immutable, chain-specific CMP-1.3 deployment wiring audit record.
/// @dev This contract does not deploy, publish, upgrade, or grant authority. It only fails closed
/// when the supplied WorkerRegistry deployment graph differs from the qualified graph/hash set.
contract ComputeWorkerCanonicalWiring420 {
    struct CodeHashes {
        bytes32 jobs;
        bytes32 workerEvidence;
        bytes32 workers;
        bytes32 attestation;
        bytes32 trust;
        bytes32 stake;
    }

    ComputeJobRegistry420 public immutable canonicalJobs;
    ComputeJobWorkerSnapshotEvidence420 public immutable canonicalWorkerEvidence;
    ComputeWorkerRegistry420 public immutable canonicalWorkers;
    ComputeWorkerAttestation420 public immutable canonicalAttestation;
    ComputeWorkerTrust420 public immutable canonicalTrust;
    ComputeWorkerStake420 public immutable canonicalStake;
    uint256 public immutable expectedChainId;
    address public immutable expectedGovernance;

    bytes32 public immutable expectedJobsCodeHash;
    bytes32 public immutable expectedWorkerEvidenceCodeHash;
    bytes32 public immutable expectedWorkersCodeHash;
    bytes32 public immutable expectedAttestationCodeHash;
    bytes32 public immutable expectedTrustCodeHash;
    bytes32 public immutable expectedStakeCodeHash;

    error InvalidWiring();

    constructor(
        address jobs_,
        address workerEvidence_,
        address workers_,
        address attestation_,
        address trust_,
        address stake_,
        address governance_,
        CodeHashes memory hashes_
    ) {
        if (
            jobs_ == address(0)
                || workerEvidence_ == address(0)
                || workers_ == address(0)
                || attestation_ == address(0)
                || trust_ == address(0)
                || stake_ == address(0)
                || governance_ == address(0)
                || hashes_.jobs == bytes32(0)
                || hashes_.workerEvidence == bytes32(0)
                || hashes_.workers == bytes32(0)
                || hashes_.attestation == bytes32(0)
                || hashes_.trust == bytes32(0)
                || hashes_.stake == bytes32(0)
        ) revert InvalidWiring();

        canonicalJobs = ComputeJobRegistry420(jobs_);
        canonicalWorkerEvidence = ComputeJobWorkerSnapshotEvidence420(workerEvidence_);
        canonicalWorkers = ComputeWorkerRegistry420(workers_);
        canonicalAttestation = ComputeWorkerAttestation420(attestation_);
        canonicalTrust = ComputeWorkerTrust420(trust_);
        canonicalStake = ComputeWorkerStake420(stake_);
        expectedChainId = block.chainid;
        expectedGovernance = governance_;

        expectedJobsCodeHash = hashes_.jobs;
        expectedWorkerEvidenceCodeHash = hashes_.workerEvidence;
        expectedWorkersCodeHash = hashes_.workers;
        expectedAttestationCodeHash = hashes_.attestation;
        expectedTrustCodeHash = hashes_.trust;
        expectedStakeCodeHash = hashes_.stake;

        assertWiring();
    }

    function assertWiring() public view {
        ComputeJobRegistry420 j = canonicalJobs;
        ComputeJobWorkerSnapshotEvidence420 e = canonicalWorkerEvidence;
        ComputeWorkerRegistry420 w = canonicalWorkers;
        ComputeWorkerAttestation420 a = canonicalAttestation;
        ComputeWorkerTrust420 t = canonicalTrust;
        ComputeWorkerStake420 s = canonicalStake;

        if (
            block.chainid != expectedChainId
                || address(j).codehash != expectedJobsCodeHash
                || address(e).codehash != expectedWorkerEvidenceCodeHash
                || address(w).codehash != expectedWorkersCodeHash
                || address(a).codehash != expectedAttestationCodeHash
                || address(t).codehash != expectedTrustCodeHash
                || address(s).codehash != expectedStakeCodeHash
        ) revert InvalidWiring();

        if (
            address(j.workerEvidence()) != address(e)
                || address(j.matchEvidence()) != address(e.matches())
                || address(e.jobs()) != address(j)
                || e.matches().jobs() != address(j)
                || address(e.workers()) != address(w)
                || address(w.authorization()) != address(e.authorization())
                || address(e.attestation()) != address(a)
                || address(e.workerTrust()) != address(t)
                || address(e.workerStake()) != address(s)
                || address(e.authorization()) == address(0)
        ) revert InvalidWiring();

        if (
            address(a.workers()) != address(w)
                || address(t.workers()) != address(w)
                || address(s.workers()) != address(w)
                || a.governanceTimelock() != expectedGovernance
                || t.governanceTimelock() != expectedGovernance
                || s.governanceTimelock() != expectedGovernance
        ) revert InvalidWiring();

        if (
            address(w.resources()) == address(0)
                || address(w.nodes()) == address(0)
                || address(w.providers()) == address(0)
        ) revert InvalidWiring();
    }

    function graphHash() external view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("420Integrated.ComputeMarket.WorkerGraph.v1"),
                expectedChainId,
                address(canonicalJobs),
                address(canonicalWorkerEvidence),
                address(canonicalWorkers),
                address(canonicalAttestation),
                address(canonicalTrust),
                address(canonicalStake),
                address(canonicalWorkerEvidence.matches()),
                address(canonicalWorkerEvidence.authorization()),
                address(canonicalWorkers.resources()),
                address(canonicalWorkers.nodes()),
                address(canonicalWorkers.providers()),
                expectedGovernance,
                expectedJobsCodeHash,
                expectedWorkerEvidenceCodeHash,
                expectedWorkersCodeHash,
                expectedAttestationCodeHash,
                expectedTrustCodeHash,
                expectedStakeCodeHash
            )
        );
    }
}
