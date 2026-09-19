// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IAI420 {
    function createRequest(
        bytes32 jobId,
        bytes32 modelVersionId,
        bytes32 workloadClass,
        bytes32 requestHash,
        bytes32 privacyPolicyId,
        bytes32 verificationProfileId,
        uint256 maxSpend,
        uint64 deadline
    ) external;

    function bindComputeRequest(bytes32 aiJobId, bytes32 computeRequestId) external;

    function bindComputeMatch(
        bytes32 aiJobId,
        bytes32 computeMatchId,
        bytes32 computeJobId,
        bytes32 aiProviderId
    ) external;

    function sync(bytes32 aiJobId) external;
}
