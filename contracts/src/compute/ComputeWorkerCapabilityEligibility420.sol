// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ComputeWorkerCapabilityProfile420.sol";
import "./ComputeWorkerAttestedEligibility420.sol";

/// @notice Full CMP-1.3.3 new-admission predicate: worker state + detailed capability match +
///         optional CMP-1.3.2 trusted capability attestation.
/// @dev No custody, matching, verifier, settlement, staking or slashing authority is granted here.
contract ComputeWorkerCapabilityEligibility420 is I420System {
    ComputeWorkerRegistry420 public immutable workers;
    ComputeWorkerCapabilityProfile420 public immutable profiles;
    ComputeWorkerAttestedEligibility420 public immutable attestedEligibility;

    error InvalidConfiguration();

    constructor(address capabilityProfiles_, address attestedEligibility_) {
        if (
            capabilityProfiles_ == address(0)
                || capabilityProfiles_.code.length == 0
                || attestedEligibility_ == address(0)
                || attestedEligibility_.code.length == 0
        ) revert InvalidConfiguration();

        profiles = ComputeWorkerCapabilityProfile420(capabilityProfiles_);
        attestedEligibility = ComputeWorkerAttestedEligibility420(attestedEligibility_);
        workers = profiles.workers();

        if (address(attestedEligibility.workers()) != address(workers)) revert InvalidConfiguration();
    }

    function systemName() external pure returns (string memory) {
        return "ComputeWorkerCapabilityEligibility420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function isEligible(
        bytes32 workerId,
        uint64 workerRevision,
        ComputeWorkerCapabilityProfile420.Requirements calldata requirements,
        bool requireTrustedAttestation,
        bytes32 attestationPolicyId,
        bytes32 attestationId
    ) external view returns (bool) {
        if (!profiles.matches(workerId, workerRevision, requirements)) return false;

        return attestedEligibility.isEligible(
            workerId,
            workerRevision,
            requireTrustedAttestation,
            attestationPolicyId,
            attestationId
        );
    }
}
