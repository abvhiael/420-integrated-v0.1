// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IRewardPolicy420 {
    function isEligible(
        bytes32 campaignId,
        bytes32 contributionId,
        address beneficiary,
        uint256 amount
    ) external view returns (bool);
}
