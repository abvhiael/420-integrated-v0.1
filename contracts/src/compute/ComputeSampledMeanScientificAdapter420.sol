// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./IComputeScientificVerificationAdapter420.sol";

/// @notice Reference scientific adapter: fixed-size authenticated sampling of a committed dataset mean.
/// @dev This protocol intentionally samples four committed observations instead of recomputing the full dataset.
///      PASS is evidence that the sampled test passed under this exact protocol, not proof of exact global equality.
contract ComputeSampledMeanScientificAdapter420 is IComputeScientificVerificationAdapter420 {
    bytes32 public constant WORKLOAD_TYPE =
        keccak256("420/CMP/WORKLOAD/SAMPLED_DATASET_MEAN/V1");
    bytes32 public constant PROFILE_ID =
        keccak256("420/CMP/PROFILE/SCIENTIFIC_SAMPLED_MEAN/V1");
    bytes32 public constant OUTPUT_SCHEMA =
        keccak256("420/CMP/SCHEMA/UINT256_DATASET_MEAN/V1");
    bytes32 public constant INPUT_DOMAIN =
        keccak256("420/CMP/INPUT/SAMPLED_DATASET/V1");
    bytes32 public constant OUTPUT_DOMAIN =
        keccak256("420/CMP/OUTPUT/SAMPLED_DATASET_MEAN/V1");
    bytes32 public constant LEAF_DOMAIN =
        keccak256("420/CMP/DATASET/LEAF/V1");
    bytes32 public constant SEED_DOMAIN =
        keccak256("420/CMP/SCIENTIFIC/SAMPLE_SEED/V1");
    bytes32 public constant SAMPLE_DOMAIN =
        keccak256("420/CMP/SCIENTIFIC/SAMPLE_INDEX/V1");
    bytes32 public constant PROTOCOL_DOMAIN =
        keccak256("420/CMP/SCIENTIFIC/SAMPLED_MEAN_PROTOCOL/V1");
    bytes32 public constant EVIDENCE_DOMAIN =
        keccak256("420/CMP/SCIENTIFIC/SAMPLED_MEAN_EVIDENCE/V1");

    uint8 public constant OUTCOME_INCONCLUSIVE = 0;
    uint8 public constant OUTCOME_PASS = 1;
    uint8 public constant OUTCOME_FAIL = 2;
    uint32 public constant REQUIRED_SAMPLES = 4;
    uint32 public constant MIN_DATASET_SIZE = 16;
    uint32 public constant TOLERANCE_BPS = 500;
    uint32 public constant MAX_RANGE_BPS = 2500;
    uint64 public constant MAX_VALUE = 1_000_000_000;

    error InvalidEvidence();

    function workloadType() external pure returns (bytes32) { return WORKLOAD_TYPE; }
    function profileId() external pure returns (bytes32) { return PROFILE_ID; }
    function outputSchemaCommitment() external pure returns (bytes32) { return OUTPUT_SCHEMA; }

    function protocolCommitment() public pure returns (bytes32) {
        return keccak256(abi.encode(
            PROTOCOL_DOMAIN,
            WORKLOAD_TYPE,
            PROFILE_ID,
            OUTPUT_SCHEMA,
            REQUIRED_SAMPLES,
            MIN_DATASET_SIZE,
            TOLERANCE_BPS,
            MAX_RANGE_BPS,
            MAX_VALUE
        ));
    }

    function inputCommitment(bytes32 datasetRoot, uint32 elementCount)
        public pure returns (bytes32)
    {
        if (datasetRoot == bytes32(0) || elementCount < MIN_DATASET_SIZE) revert InvalidEvidence();
        return keccak256(abi.encode(INPUT_DOMAIN, datasetRoot, elementCount));
    }

    function outputCommitment(uint256 claimedMean) public pure returns (bytes32) {
        return keccak256(abi.encode(OUTPUT_DOMAIN, claimedMean));
    }

    function sampleSeedCommitment(bytes32 seed) public pure returns (bytes32) {
        if (seed == bytes32(0)) revert InvalidEvidence();
        return keccak256(abi.encode(SEED_DOMAIN, seed));
    }

    /// @notice Deterministically derive one unique sample index from a committed seed.
    /// @dev Collision resolution is deterministic linear probing; elementCount >= 16 bounds this loop.
    function sampleIndex(bytes32 seed, uint32 elementCount, uint8 ordinal)
        public pure returns (uint32)
    {
        if (seed == bytes32(0) || elementCount < MIN_DATASET_SIZE || ordinal >= REQUIRED_SAMPLES)
            revert InvalidEvidence();

        uint32[4] memory selected;
        for (uint8 i; i <= ordinal; ++i) {
            uint32 candidate =
                uint32(uint256(keccak256(abi.encode(SAMPLE_DOMAIN, seed, i))) % elementCount);
            bool collision = true;
            while (collision) {
                collision = false;
                for (uint8 j; j < i; ++j) {
                    if (selected[j] == candidate) {
                        candidate = candidate + 1 == elementCount ? 0 : candidate + 1;
                        collision = true;
                        break;
                    }
                }
            }
            selected[i] = candidate;
        }
        return selected[ordinal];
    }

    /// @param evidenceData abi.encode(seed,datasetRoot,elementCount,indices,values,proofs,claimedMean)
    function evaluate(
        bytes32 jobInputCommitment,
        bytes32 workerOutputCommitment,
        bytes32 committedSeed,
        bytes calldata evidenceData
    ) external pure returns (
        uint8 outcome,
        uint32 sampleCount,
        uint32 coverageBps,
        bytes32 evaluationEvidence
    ) {
        (
            bytes32 seed,
            bytes32 datasetRoot,
            uint32 elementCount,
            uint32[] memory indices,
            uint64[] memory values,
            bytes32[][] memory proofs,
            uint256 claimedMean
        ) = abi.decode(
            evidenceData,
            (bytes32,bytes32,uint32,uint32[],uint64[],bytes32[][],uint256)
        );

        if (
            seed == bytes32(0) || datasetRoot == bytes32(0)
                || elementCount < MIN_DATASET_SIZE
                || indices.length != REQUIRED_SAMPLES
                || values.length != REQUIRED_SAMPLES
                || proofs.length != REQUIRED_SAMPLES
                || inputCommitment(datasetRoot, elementCount) != jobInputCommitment
                || sampleSeedCommitment(seed) != committedSeed
                || outputCommitment(claimedMean) != workerOutputCommitment
        ) revert InvalidEvidence();

        uint256 sum;
        uint64 minValue = type(uint64).max;
        uint64 maxValue;
        for (uint8 i; i < REQUIRED_SAMPLES; ++i) {
            uint32 expectedIndex = sampleIndex(seed, elementCount, i);
            uint64 value = values[i];
            if (indices[i] != expectedIndex || value > MAX_VALUE) revert InvalidEvidence();
            if (!_verifyLeaf(datasetRoot, expectedIndex, value, proofs[i])) revert InvalidEvidence();
            sum += uint256(value);
            if (value < minValue) minValue = value;
            if (value > maxValue) maxValue = value;
        }

        sampleCount = REQUIRED_SAMPLES;
        coverageBps = uint32((uint256(REQUIRED_SAMPLES) * 10_000) / elementCount);
        uint256 sampleMean = sum / REQUIRED_SAMPLES;
        uint256 rangeBps;
        if (sampleMean == 0) {
            rangeBps = maxValue == 0 ? 0 : 10_000;
        } else {
            rangeBps = (uint256(maxValue - minValue) * 10_000) / sampleMean;
        }

        uint256 deviation = claimedMean > sampleMean
            ? claimedMean - sampleMean
            : sampleMean - claimedMean;
        uint256 deviationBps;
        if (sampleMean == 0) {
            deviationBps = claimedMean == 0 ? 0 : 10_000;
        } else {
            deviationBps = (deviation * 10_000) / sampleMean;
        }

        if (rangeBps > MAX_RANGE_BPS) {
            outcome = OUTCOME_INCONCLUSIVE;
        } else if (deviationBps <= TOLERANCE_BPS) {
            outcome = OUTCOME_PASS;
        } else {
            outcome = OUTCOME_FAIL;
        }

        evaluationEvidence = keccak256(abi.encode(
            EVIDENCE_DOMAIN,
            protocolCommitment(),
            jobInputCommitment,
            workerOutputCommitment,
            committedSeed,
            datasetRoot,
            elementCount,
            keccak256(abi.encode(indices)),
            keccak256(abi.encode(values)),
            claimedMean,
            sampleMean,
            deviationBps,
            rangeBps,
            outcome
        ));
        if (evaluationEvidence == bytes32(0)) revert InvalidEvidence();
    }

    function _verifyLeaf(bytes32 root, uint32 index, uint64 value, bytes32[] memory proof)
        private pure returns (bool)
    {
        bytes32 hash = keccak256(abi.encode(LEAF_DOMAIN, index, value));
        uint256 cursor = index;
        for (uint256 i; i < proof.length; ++i) {
            bytes32 sibling = proof[i];
            hash = (cursor & 1) == 0
                ? keccak256(abi.encodePacked(hash, sibling))
                : keccak256(abi.encodePacked(sibling, hash));
            cursor >>= 1;
        }
        return hash == root;
    }
}
