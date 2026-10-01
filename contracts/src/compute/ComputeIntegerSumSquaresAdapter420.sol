// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./IComputeDeterministicVerificationAdapter420.sol";

/// @notice Reference deterministic adapter for the retained bounded sum-of-squares workload.
/// @dev This is one executable profile, not a generic claim that arbitrary GPU/AI workloads are deterministic.
contract ComputeIntegerSumSquaresAdapter420 is IComputeDeterministicVerificationAdapter420 {
    bytes32 public constant ADAPTER_KIND =
        keccak256("420/CMP/VERIFICATION_ADAPTER/DETERMINISTIC/V1");
    bytes32 public constant WORKLOAD_TYPE =
        keccak256("420/CMP/WORKLOAD/INTEGER_SUM_OF_SQUARES/V1");
    bytes32 public constant PROFILE_ID =
        keccak256("420/CMP/PROFILE/INTEGER_SUM_OF_SQUARES/V1");
    bytes32 public constant INPUT_DOMAIN =
        keccak256("420/CMP/INPUT/INTEGER_SUM_OF_SQUARES/V1");
    bytes32 public constant OUTPUT_DOMAIN =
        keccak256("420/CMP/OUTPUT/INTEGER_SUM_OF_SQUARES/V1");
    bytes32 public constant OUTPUT_SCHEMA =
        keccak256("420/CMP/SCHEMA/UINT256_SUM_OF_SQUARES/V1");
    bytes32 public constant EVALUATION_DOMAIN =
        keccak256("420/CMP/DETERMINISTIC/INTEGER_SUM_OF_SQUARES/V1");
    uint64 public constant MAX_ELEMENT = 1_000_000_000;

    error InvalidInput();

    function adapterKind() external pure returns (bytes32) { return ADAPTER_KIND; }
    function workloadType() external pure returns (bytes32) { return WORKLOAD_TYPE; }
    function profileId() external pure returns (bytes32) { return PROFILE_ID; }
    function outputSchemaCommitment() external pure returns (bytes32) { return OUTPUT_SCHEMA; }

    function inputCommitment(bytes calldata inputData) external pure returns (bytes32) {
        uint64[4] memory values = _decodeInput(inputData);
        return keccak256(abi.encode(INPUT_DOMAIN, values));
    }

    function outputCommitment(bytes calldata outputData) external pure returns (bytes32) {
        uint256 value = _decodeOutput(outputData);
        return keccak256(abi.encode(OUTPUT_DOMAIN, value));
    }

    function evaluate(bytes calldata inputData, bytes calldata outputData)
        external pure returns (bool correct, bytes32 expectedOutputCommitment, bytes32 evaluationEvidence)
    {
        uint64[4] memory values = _decodeInput(inputData);
        uint256 claimed = _decodeOutput(outputData);
        uint256 expected;
        for (uint256 i; i < 4; ++i) {
            if (values[i] > MAX_ELEMENT) revert InvalidInput();
            expected += uint256(values[i]) * uint256(values[i]);
        }
        expectedOutputCommitment = keccak256(abi.encode(OUTPUT_DOMAIN, expected));
        correct = claimed == expected;
        evaluationEvidence = keccak256(
            abi.encode(EVALUATION_DOMAIN, values, claimed, expected, correct, expectedOutputCommitment)
        );
    }

    function _decodeInput(bytes calldata inputData) private pure returns (uint64[4] memory values) {
        if (inputData.length != 128) revert InvalidInput();
        values = abi.decode(inputData, (uint64[4]));
        for (uint256 i; i < 4; ++i) if (values[i] > MAX_ELEMENT) revert InvalidInput();
    }

    function _decodeOutput(bytes calldata outputData) private pure returns (uint256 value) {
        if (outputData.length != 32) revert InvalidInput();
        value = abi.decode(outputData, (uint256));
    }
}
