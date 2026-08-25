// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/GenesisResidentAccess420.sol";
import "../interfaces/genesis/Types420.sol";
import "../interfaces/genesis/ISystemSafety420.sol";
import "./PayIds420.sol";

contract RefundManager420 is GenesisResidentAccess420 {
    struct Refund {
        bytes32 paymentId;
        address settlementAsset;
        address recipient;
        uint256 amount;
        bytes32 reasonHash;
        uint64 createdAt;
    }

    mapping(bytes32 => Refund) public refunds;
    mapping(bytes32 => uint256) public refundedByPayment;

    event RefundRecorded(bytes32 indexed refundId, bytes32 indexed paymentId, address settlementAsset, uint256 amount);

    constructor(address timelock_, address registry_, bytes32 genesisConfigHash_)
        GenesisResidentAccess420(timelock_, registry_, genesisConfigHash_)
    {}

    function componentId() public pure override returns (bytes32) { return PayIds420.REFUND_MANAGER; }

    function recordRefund(
        bytes32 refundId,
        bytes32 paymentId,
        address settlementAsset,
        address recipient,
        uint256 amount,
        uint256 refundableMaximum,
        bytes32 reasonHash
    ) external {
        _requireGenesisGovernance(PayIds420.ACTION_REFUND);
        _requireOperational(
            PayIds420.ACTION_REFUND,
            ISystemSafety420.ActionClass.SAFE_WHEN_PAUSED,
            Types420.Direction.NONE
        );
        _canonicalSettlementAsset(settlementAsset);
        require(refundId != bytes32(0) && refunds[refundId].paymentId == bytes32(0), "invalid/exists");
        require(paymentId != bytes32(0) && recipient != address(0) && amount > 0, "invalid");
        require(refundedByPayment[paymentId] + amount <= refundableMaximum, "refund exceeds payment");
        refundedByPayment[paymentId] += amount;
        refunds[refundId] = Refund(
            paymentId,
            settlementAsset,
            recipient,
            amount,
            reasonHash,
            uint64(block.timestamp)
        );
        emit RefundRecorded(refundId, paymentId, settlementAsset, amount);
    }
}
