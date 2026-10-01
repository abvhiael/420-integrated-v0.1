// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Workload-specific scientific/probabilistic validation semantics.
/// @dev Adapters validate bounded evidence under an explicit protocol. They do not select verifiers,
/// mutate jobs, move funds, settle, slash, or claim that sampled validation equals full recomputation.
interface IComputeScientificVerificationAdapter420 {
    function workloadType() external view returns (bytes32);
    function profileId() external view returns (bytes32);
    function outputSchemaCommitment() external view returns (bytes32);
    function protocolCommitment() external view returns (bytes32);

    /// @notice Evaluate objective workload-specific evidence against the canonical job commitments.
    /// @return outcome 0=INCONCLUSIVE, 1=PASS, 2=FAIL.
    /// @return sampleCount Number of authenticated observations consumed by the protocol.
    /// @return coverageBps Sample coverage of the committed population, in basis points.
    /// @return evaluationEvidence Commitment to the exact validation transcript and protocol result.
    function evaluate(
        bytes32 jobInputCommitment,
        bytes32 workerOutputCommitment,
        bytes32 sampleSeedCommitment,
        bytes calldata evidenceData
    ) external view returns (
        uint8 outcome,
        uint32 sampleCount,
        uint32 coverageBps,
        bytes32 evaluationEvidence
    );
}
