// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/GenesisResidentAccess420.sol";
import "../interfaces/genesis/Types420.sol";
import "../interfaces/genesis/ISystemSafety420.sol";
import "./PayIds420.sol";

contract PaymentRegistry420 is GenesisResidentAccess420 {
    bytes32 public constant PAYMENT_DOMAIN = keccak256("420/APP/420PAY_PAYMENT_ID");

    enum Status {
        NONE,
        SUBMITTED,
        INCLUDED,
        CERTIFIED,
        FINALIZED,
        SETTLED,
        REFUNDED,
        PARTIALLY_REFUNDED,
        FAILED
    }

    struct Payment {
        bytes32 invoiceId;
        address payer;
        address merchant;
        address inputAsset;
        uint256 inputAmount;
        address settlementAsset;
        uint256 settlementAmount;
        bytes32 quoteId;
        uint256 payerNonce;
        bytes32 receiptHash;
        uint256 tipAmount;
        uint256 refundedAmount;
        Status status;
    }

    mapping(bytes32 => Payment) public payments;
    mapping(bytes32 => bytes32) public checkoutPaymentForInvoice;
    event PaymentSet(bytes32 indexed paymentId, bytes32 indexed invoiceId, Status status);

    constructor(
        address timelock_,
        address registry_,
        bytes32 genesisConfigHash_
    ) GenesisResidentAccess420(timelock_, registry_, genesisConfigHash_) { }

    function componentId() public pure override returns (bytes32) {
        return PayIds420.PAYMENT_REGISTRY;
    }

    function getPayment(bytes32 paymentId) external view returns (Payment memory) { return payments[paymentId]; }

    function derivePaymentId(
        bytes32 invoiceId,
        address payer,
        address merchant,
        address inputAsset,
        uint256 inputAmount,
        address settlementAsset,
        uint256 settlementAmount,
        bytes32 quoteId,
        uint256 payerNonce
    ) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                PAYMENT_DOMAIN,
                invoiceId,
                payer,
                merchant,
                inputAsset,
                inputAmount,
                settlementAsset,
                settlementAmount,
                quoteId,
                payerNonce
            )
        );
    }

    function recordIncluded(
        bytes32 paymentId
    ) external {
        _requireGenesisGovernance(PayIds420.ACTION_MARK_PAID);
        _requireOperational(
            PayIds420.ACTION_MARK_PAID, ISystemSafety420.ActionClass.SAFE_WHEN_PAUSED, Types420.Direction.NONE
        );
        Payment storage p = payments[paymentId];
        require(p.status == Status.SUBMITTED, "invalid inclusion state");
        p.status = Status.INCLUDED;
        emit PaymentSet(paymentId, p.invoiceId, p.status);
    }

    function recordCertified(
        bytes32 paymentId
    ) external {
        _requireGenesisGovernance(PayIds420.ACTION_MARK_PAID);
        _requireOperational(
            PayIds420.ACTION_MARK_PAID, ISystemSafety420.ActionClass.SAFE_WHEN_PAUSED, Types420.Direction.NONE
        );
        Payment storage p = payments[paymentId];
        require(p.status == Status.INCLUDED, "invalid certification state");
        p.status = Status.CERTIFIED;
        emit PaymentSet(paymentId, p.invoiceId, p.status);
    }

    function recordFinalized(
        bytes32 paymentId,
        bytes32 invoiceId,
        bytes32 receiptHash,
        address settlementAsset,
        uint256 settlementAmount,
        uint256 tipAmount
    ) external {
        _requireGenesisGovernance(PayIds420.ACTION_MARK_PAID);
        _requireOperational(
            PayIds420.ACTION_MARK_PAID, ISystemSafety420.ActionClass.SAFE_WHEN_PAUSED, Types420.Direction.NONE
        );
        Payment storage p = payments[paymentId];
        require(
            p.status == Status.SUBMITTED || p.status == Status.INCLUDED || p.status == Status.CERTIFIED,
            "invalid finalization state"
        );
        require(
            p.invoiceId == invoiceId && p.settlementAsset == settlementAsset && p.settlementAmount == settlementAmount,
            "mismatch"
        );
        p.receiptHash = receiptHash;
        p.tipAmount = tipAmount;
        p.status = Status.FINALIZED;
        emit PaymentSet(paymentId, invoiceId, p.status);
    }

    function createPayment(
        bytes32 invoiceId,
        address payer,
        address merchant,
        address inputAsset,
        uint256 inputAmount,
        address settlementAsset,
        uint256 settlementAmount,
        bytes32 quoteId,
        uint256 payerNonce
    ) external returns (bytes32 paymentId) {
        require(payer != address(0), "payer");
        if (msg.sender != payer) _requireGenesisGovernance(PayIds420.ACTION_SETTLE);
        _requireOperational(
            PayIds420.ACTION_SETTLE, ISystemSafety420.ActionClass.NORMAL_ONLY, Types420.Direction.INBOUND
        );
        require(invoiceId != bytes32(0) && merchant != address(0), "party");
        require(inputAmount > 0 && settlementAmount > 0, "amount");
        _canonicalSettlementAsset(settlementAsset);
        paymentId = derivePaymentId(
            invoiceId, payer, merchant, inputAsset, inputAmount, settlementAsset, settlementAmount, quoteId, payerNonce
        );
        require(payments[paymentId].status == Status.NONE, "duplicate");
        payments[paymentId] = Payment(
            invoiceId,
            payer,
            merchant,
            inputAsset,
            inputAmount,
            settlementAsset,
            settlementAmount,
            quoteId,
            payerNonce,
            bytes32(0),
            0,
            0,
            Status.SUBMITTED
        );
        emit PaymentSet(paymentId, invoiceId, Status.SUBMITTED);
    }

    function recordInvoiceCheckout(
        bytes32 invoiceId, address payer, address merchant, address inputAsset, uint256 inputAmount,
        address settlementAsset, uint256 settlementAmount, bytes32 quoteId, uint256 payerNonce
    ) external returns (bytes32 paymentId) {
        return _recordInvoiceCheckout(invoiceId, payer, merchant, inputAsset, inputAmount,
            settlementAsset, settlementAmount, quoteId, payerNonce, 0);
    }

    function recordNativeCheckoutWithTip(
        bytes32 invoiceId, address payer, address merchant, uint256 principal, uint256 tip, bytes32 quoteId, uint256 nonce
    ) external returns (bytes32 paymentId) {
        return _recordInvoiceCheckout(invoiceId, payer, merchant, address(0), principal + tip,
            address(0), principal, quoteId, nonce, tip);
    }

    function _recordInvoiceCheckout(
        bytes32 invoiceId, address payer, address merchant, address inputAsset, uint256 inputAmount,
        address settlementAsset, uint256 settlementAmount, bytes32 quoteId, uint256 payerNonce, uint256 tip
    ) private returns (bytes32 paymentId) {
        require(msg.sender == _resolveRequired(PayIds420.PAYMENT_ROUTER), "checkout router");
        _requireOperational(
            PayIds420.ACTION_SETTLE, ISystemSafety420.ActionClass.NORMAL_ONLY, Types420.Direction.INBOUND
        );
        require(invoiceId != bytes32(0) && payer != address(0) && merchant != address(0), "checkout parties");
        require(inputAmount > 0 && settlementAmount > 0 && quoteId != bytes32(0) && payerNonce != 0, "checkout terms");
        _canonicalSettlementAsset(settlementAsset);
        paymentId = derivePaymentId(invoiceId, payer, merchant, inputAsset, inputAmount, settlementAsset, settlementAmount, quoteId, payerNonce);
        require(payments[paymentId].status == Status.NONE, "duplicate");
        bytes32 receipt = keccak256(abi.encode(block.chainid, address(this), paymentId));
        payments[paymentId] = Payment(
            invoiceId, payer, merchant, inputAsset, inputAmount, settlementAsset, settlementAmount, quoteId, payerNonce, receipt, tip, 0,
            Status.SETTLED
        );
        checkoutPaymentForInvoice[invoiceId] = paymentId;
        emit PaymentSet(paymentId, invoiceId, Status.SETTLED);
    }

    function recordSettled(
        bytes32 paymentId
    ) external {
        _requireGenesisGovernance(PayIds420.ACTION_SETTLE);
        _requireOperational(
            PayIds420.ACTION_SETTLE, ISystemSafety420.ActionClass.SAFE_WHEN_PAUSED, Types420.Direction.NONE
        );
        Payment storage p = payments[paymentId];
        require(p.status == Status.FINALIZED, "invalid settlement state");
        p.status = Status.SETTLED;
        emit PaymentSet(paymentId, p.invoiceId, p.status);
    }

    function recordFailed(
        bytes32 paymentId
    ) external {
        _requireGenesisGovernance(PayIds420.ACTION_MARK_PAID);
        _requireOperational(
            PayIds420.ACTION_MARK_PAID, ISystemSafety420.ActionClass.SAFE_WHEN_PAUSED, Types420.Direction.NONE
        );
        Payment storage p = payments[paymentId];
        require(
            p.status == Status.SUBMITTED || p.status == Status.INCLUDED || p.status == Status.CERTIFIED,
            "invalid failure state"
        );
        p.status = Status.FAILED;
        emit PaymentSet(paymentId, p.invoiceId, p.status);
    }

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
            Status status
        )
    {
        Payment storage p = payments[paymentId];
        require(p.status != Status.NONE, "unknown payment");
        payer = p.payer;
        settlementAsset = p.settlementAsset;
        refundableMaximum = p.settlementAmount + p.tipAmount;
        authorizedRefunded = p.refundedAmount;
        status = p.status;
    }

    function applyRefund(
        bytes32 paymentId,
        uint256 amount,
        bool complete
    ) external {
        _requireGenesisGovernance(PayIds420.ACTION_REFUND);
        _requireOperational(
            PayIds420.ACTION_REFUND, ISystemSafety420.ActionClass.SAFE_WHEN_PAUSED, Types420.Direction.NONE
        );
        _applyRefund(paymentId, amount, complete);
    }

    function applyMerchantRefund(bytes32 paymentId, uint256 amount) external {
        require(msg.sender == _resolveRequired(PayIds420.REFUND_MANAGER), "refund manager");
        require(payments[paymentId].status == Status.SETTLED || payments[paymentId].status == Status.PARTIALLY_REFUNDED,
            "payment not settled");
        _requireOperational(
            PayIds420.ACTION_REFUND, ISystemSafety420.ActionClass.NORMAL_ONLY, Types420.Direction.OUTBOUND
        );
        _applyRefund(paymentId, amount, false);
    }

    function _applyRefund(bytes32 paymentId, uint256 amount, bool complete) private {
        Payment storage p = payments[paymentId];
        require(
            p.status == Status.FINALIZED || p.status == Status.SETTLED || p.status == Status.PARTIALLY_REFUNDED,
            "not refundable"
        );
        require(amount > 0 && p.refundedAmount + amount <= p.settlementAmount + p.tipAmount, "excess");
        p.refundedAmount += amount;
        bool fullyRefunded = p.refundedAmount == p.settlementAmount + p.tipAmount;
        require(!complete || fullyRefunded, "complete mismatch");
        p.status = fullyRefunded ? Status.REFUNDED : Status.PARTIALLY_REFUNDED;
        emit PaymentSet(paymentId, p.invoiceId, p.status);
    }
}
