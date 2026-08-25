
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IPaymentRegistry420 {
    function recordFinalized(
        bytes32 paymentId,
        bytes32 invoiceId,
        bytes32 receiptHash,
        address settlementAsset,
        uint256 settlementAmount,
        uint256 tipAmount
    ) external;
}
