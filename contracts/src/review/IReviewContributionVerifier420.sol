// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IReviewContributionVerifier420 {
    function verifyContribution(
        bytes32 contributionType,
        bytes32 sourceId,
        address beneficiary,
        bytes32 evidenceHash
    ) external view returns (bool);
}
