// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface ICompute420 {
    function createRequest(
        bytes32 requestId,
        bytes32 workloadClass,
        bytes32 resourceRequirementId,
        bytes32 inputCommitment,
        uint256 maxSpend420,
        uint64 deadline,
        bytes32 privacyPolicyId,
        bytes32 verificationProfileId,
        bytes32 providerConstraintHash
    ) external;

    function acceptMatch(bytes32 matchId, bytes32 requestId, bytes32 offerId, uint128 acceptedUnits)
        external
        returns (uint256 quotedAmount420);

    function createJob(bytes32 jobId, bytes32 matchId) external;
}
