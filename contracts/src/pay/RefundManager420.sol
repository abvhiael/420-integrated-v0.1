// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/GenesisResidentAccess420.sol";
import "../interfaces/genesis/Types420.sol";
import "../interfaces/genesis/ISystemSafety420.sol";
import "./PayIds420.sol";

interface IPaymentRefundAccounting420 {
    function refundAccounting(
        bytes32 paymentId
    )
        external
        view
        returns (
            address payer,
            address settlementAsset,
            uint256 refundableMaximum,
            uint256 authorizedRefunded,
            uint8 status
        );
}

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
    address public paymentRegistry;

    event PaymentRegistrySet(address indexed registry);
    event RefundRecorded(bytes32 indexed refundId, bytes32 indexed paymentId, address settlementAsset, uint256 amount);

    constructor(
        address timelock_,
        address registry_,
        bytes32 genesisConfigHash_
    ) GenesisResidentAccess420(timelock_, registry_, genesisConfigHash_) { }

    function componentId() public pure override returns (bytes32) {
        return PayIds420.REFUND_MANAGER;
    }

    function setPaymentRegistry(
        address registry_
    ) external {
        _requireGenesisGovernance(PayIds420.ACTION_CONFIGURE);
        require(registry_ != address(0) && registry_.code.length != 0, "payment registry");
        paymentRegistry = registry_;
        emit PaymentRegistrySet(registry_);
    }

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
            PayIds420.ACTION_REFUND, ISystemSafety420.ActionClass.SAFE_WHEN_PAUSED, Types420.Direction.NONE
        );
        require(paymentRegistry != address(0) && paymentRegistry.code.length != 0, "payment registry");
        _canonicalSettlementAsset(settlementAsset);
        require(refundId != bytes32(0) && refunds[refundId].paymentId == bytes32(0), "invalid/exists");
        require(paymentId != bytes32(0) && recipient != address(0) && amount > 0, "invalid");

        (
            address canonicalPayer,
            address canonicalSettlementAsset,
            uint256 canonicalMaximum,
            uint256 authorizedRefunded,
            uint8 status
        ) = IPaymentRefundAccounting420(paymentRegistry).refundAccounting(paymentId);

        require(canonicalPayer == recipient, "refund recipient");
        require(canonicalSettlementAsset == settlementAsset, "settlement asset");
        require(canonicalMaximum == refundableMaximum, "refund maximum");
        require(status == 6 || status == 7, "refund not authorized");
        require(refundedByPayment[paymentId] + amount <= authorizedRefunded, "refund exceeds authorized");
        require(refundedByPayment[paymentId] + amount <= canonicalMaximum, "refund exceeds payment");

        refundedByPayment[paymentId] += amount;
        refunds[refundId] =
            Refund(paymentId, settlementAsset, recipient, amount, reasonHash, uint64(block.timestamp));
        emit RefundRecorded(refundId, paymentId, settlementAsset, amount);
    }
}
