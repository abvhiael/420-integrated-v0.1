// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface ILaunchpadCrowdfundingIntegration420 {
    function consumeContribution(
        address participant,
        bytes32 saleId,
        uint128 amount,
        bytes32 paymentId
    ) external returns (bool);

    function consumeRefund(
        address participant,
        bytes32 saleId,
        uint128 amount,
        bytes32 refundCommitment
    ) external returns (bool);

    function recordDelivery(
        address participant,
        bytes32 saleId,
        uint128 tokenAmount,
        bytes32 deliveryCommitment
    ) external;
}
