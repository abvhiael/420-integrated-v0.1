// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Pure, versioned identity derivation for accepted ComputeMarket work.
/// @dev The caller MUST resolve job/manifest/plan/assignment against canonical
/// registries. This library validates shape and encoding, not registry authority.
library ComputeIds420 {
    error InvalidComputeIdentity();

    bytes32 internal constant UNIT_DOMAIN_V1 = keccak256("420Integrated.ComputeMarket.WorkUnit.v1");
    bytes32 internal constant ATTEMPT_DOMAIN_V1 = keccak256("420Integrated.ComputeMarket.WorkAttempt.v1");
    uint32 internal constant SCHEMA_VERSION_V1 = 1;

    struct WorkUnitV1 {
        bytes32 jobId;
        bytes32 manifestHash;
        bytes32 partitionSchemeId;
        uint32 partitionSchemeVersion;
        bytes32 partitionPlanHash;
        uint32 partitionCount;
        uint32 replicationFactor;
        uint32 partitionIndex;
        uint32 replicaIndex;
    }

    /// @notice Produce one unit ID for one partition/replica of the frozen plan.
    /// @dev All 11 static values are encoded with abi.encode, NEVER packed.
    /// The policy layer must separately bound partitionCount*replicationFactor.
    function workUnitId(uint256 chainId, WorkUnitV1 memory plan) internal pure returns (bytes32) {
        if (
            chainId == 0 || plan.jobId == bytes32(0) || plan.manifestHash == bytes32(0)
                || plan.partitionSchemeId == bytes32(0) || plan.partitionSchemeVersion == 0
                || plan.partitionPlanHash == bytes32(0) || plan.partitionCount == 0
                || plan.replicationFactor == 0 || plan.partitionIndex >= plan.partitionCount
                || plan.replicaIndex >= plan.replicationFactor
        ) revert InvalidComputeIdentity();

        return keccak256(
            abi.encode(
                UNIT_DOMAIN_V1,
                chainId,
                SCHEMA_VERSION_V1,
                plan.jobId,
                plan.manifestHash,
                plan.partitionSchemeId,
                plan.partitionSchemeVersion,
                plan.partitionPlanHash,
                plan.partitionCount,
                plan.replicationFactor,
                plan.partitionIndex,
                plan.replicaIndex
            )
        );
    }

    /// @notice A retry is a fresh attempt of the SAME payable unit.
    /// @dev The authorized attempt registry must allocate monotonically increasing
    /// nonces and enforce uniqueness; this pure library cannot reserve a nonce.
    function attemptId(uint256 chainId, bytes32 unitId, uint64 attemptNonce) internal pure returns (bytes32) {
        if (chainId == 0 || unitId == bytes32(0) || attemptNonce == 0) revert InvalidComputeIdentity();
        return keccak256(abi.encode(ATTEMPT_DOMAIN_V1, chainId, SCHEMA_VERSION_V1, unitId, attemptNonce));
    }
}
