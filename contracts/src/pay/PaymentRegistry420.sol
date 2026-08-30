// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/GenesisResidentAccess420.sol";
import "../interfaces/genesis/Types420.sol";
import "../interfaces/genesis/ISystemSafety420.sol";
import "./PayIds420.sol";

contract PaymentRegistry420 is GenesisResidentAccess420 {
    bytes32 public constant PAYMENT_DOMAIN = keccak256("420/APP/420PAY_PAYMENT_ID");

    enum Status { NONE, SUBMITTED, INCLUDED, CERTIFIED, FINALIZED, SETTLED, REFUNDED, PARTIALLY_REFUNDED, FAILED }

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
    event PaymentSet(bytes32 indexed paymentId, bytes32 indexed invoiceId, Status status);

    constructor(address timelock_, address registry_, bytes32 genesisConfigHash_)
        GenesisResidentAccess420(timelock_, registry_, genesisConfigHash_)
    {}

    function componentId() public pure override returns (bytes32) { return PayIds420.PAYMENT_REGISTRY; }

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
            PayIds420.ACTION_MARK_PAID,
            ISystemSafety420.ActionClass.SAFE_WHEN_PAUSED,
            Types420.Direction.NONE
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
        _requireGenesisGovernance(PayIds420.ACTION_SETTLE);
        _requireOperational(
            PayIds420.ACTION_SETTLE,
            ISystemSafety420.ActionClass.NORMAL_ONLY,
            Types420.Direction.INBOUND
        );
        require(invoiceId != bytes32(0) && payer != address(0) && merchant != address(0), "party");
        require(inputAmount > 0 && settlementAmount > 0, "amount");
        _canonicalSettlementAsset(settlementAsset);
        paymentId = derivePaymentId(
            invoiceId,
            payer,
            merchant,
            inputAsset,
            inputAmount,
            settlementAsset,
            settlementAmount,
            quoteId,
            payerNonce
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

    function applyRefund(bytes32 paymentId, uint256 amount, bool complete) external {
        _requireGenesisGovernance(PayIds420.ACTION_REFUND);
        _requireOperational(
            PayIds420.ACTION_REFUND,
            ISystemSafety420.ActionClass.SAFE_WHEN_PAUSED,
            Types420.Direction.NONE
        );
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
