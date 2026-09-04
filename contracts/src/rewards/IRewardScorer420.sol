// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IRewardScorer420 {
    function score(
        bytes32 campaignId,
        bytes32 contributionId,
        address beneficiary,
        bytes32 contentHash
    ) external view returns (uint256 amount);
}
