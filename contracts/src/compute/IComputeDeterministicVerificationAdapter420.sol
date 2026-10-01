// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Pure/read-only deterministic verification semantics for one exact workload/profile.
/// @dev Adapters do not mutate jobs, select verifiers, publish policies, settle, move funds or grant authority.
interface IComputeDeterministicVerificationAdapter420 {
    function adapterKind() external view returns (bytes32);
    function workloadType() external view returns (bytes32);
    function profileId() external view returns (bytes32);
    function outputSchemaCommitment() external view returns (bytes32);

    /// @notice Reproduce the canonical committed input from its full preimage.
    function inputCommitment(bytes calldata inputData) external view returns (bytes32);

    /// @notice Reproduce the canonical worker output commitment from its full preimage.
    function outputCommitment(bytes calldata outputData) external view returns (bytes32);

    /// @notice Independently recompute the expected output under this exact deterministic profile.
    /// @return correct Whether outputData is exactly correct for inputData.
    /// @return expectedOutputCommitment Canonical commitment for the independently computed expected output.
    /// @return evaluationEvidence Commitment to the deterministic computation transcript/semantics.
    function evaluate(bytes calldata inputData, bytes calldata outputData)
        external view returns (bool correct, bytes32 expectedOutputCommitment, bytes32 evaluationEvidence);
}
