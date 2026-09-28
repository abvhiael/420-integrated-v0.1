// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ComputeWorkerAttestation420.sol";

/// @notice Composes canonical worker state with optional independent capability-attestation requirements.
/// @dev This is an admission predicate only. It moves no funds and grants no execution, verification,
///      settlement, governance, staking, or slashing authority.
contract ComputeWorkerAttestedEligibility420 is I420System {
    ComputeWorkerRegistry420 public immutable workers;
    ComputeWorkerAttestation420 public immutable attestations;

    error InvalidConfiguration();

    constructor(address workerRegistry_, address attestationRegistry_) {
        if (
            workerRegistry_ == address(0)
                || workerRegistry_.code.length == 0
                || attestationRegistry_ == address(0)
                || attestationRegistry_.code.length == 0
        ) revert InvalidConfiguration();

        workers = ComputeWorkerRegistry420(workerRegistry_);
        attestations = ComputeWorkerAttestation420(attestationRegistry_);
        if (address(attestations.workers()) != workerRegistry_) revert InvalidConfiguration();
    }

    function systemName() external pure returns (string memory) { return "ComputeWorkerAttestedEligibility420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    /// @notice New-admission eligibility for an exact current worker revision.
    /// @param requireAttestation False permits the base CMP-1.3.1 worker predicate; true requires exact evidence.
    function isEligible(
        bytes32 workerId,
        uint64 workerRevision,
        bool requireAttestation,
        bytes32 policyId,
        bytes32 attestationId
    ) external view returns (bool) {
        if (!workers.isEligible(workerId, workerRevision)) return false;
        if (!requireAttestation) return true;
        if (policyId == bytes32(0) || attestationId == bytes32(0)) return false;

        ComputeWorkerRegistry420.Worker memory w = workers.worker(workerId);
        return attestations.isAcceptable(
            attestationId,
            workerId,
            workerRevision,
            w.resourceId,
            w.resourceRevision,
            w.capabilityProfileHash,
            w.executionKeyCommitment,
            policyId
        );
    }
}
