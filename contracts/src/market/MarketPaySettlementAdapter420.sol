// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./OrderRegistry420.sol";
import "../pay/PaymentRegistry420.sol";
import "../pay/InvoiceRegistry420.sol";
import "../pay/MerchantRegistry420.sol";

/// @notice Permissionless submission of canonical Pay evidence to governance-approved Market authority.
/// @dev No custody, financial finalization authority, mutable dependencies or privileged web reporter.
contract MarketPaySettlementAdapter420 {
    bytes32 public constant DOMAIN = keccak256("420/MARKET/PAY_ORDER_INVOICE/V1");
    OrderRegistry420 public immutable orders;
    PaymentRegistry420 public immutable payments;
    InvoiceRegistry420 public immutable invoices;
    MerchantRegistry420 public immutable merchants;
    uint256 public immutable deploymentChainId;
    mapping(bytes32 => bytes32) public orderPayment;
    mapping(bytes32 => bytes32) public paymentOrder;
    mapping(bytes32 => bool) public refundReported;

    error InvalidDependency();
    error InvalidEvidence();
    error InvalidChain();
    error AlreadyReported();
    event PaymentReported(bytes32 indexed orderId, bytes32 indexed paymentId);
    event RefundReported(bytes32 indexed orderId, bytes32 indexed paymentId);

    constructor(
        address orders_,
        address payments_,
        address invoices_,
        address merchants_
    ) {
        if (
            orders_.code.length == 0 || payments_.code.length == 0 || invoices_.code.length == 0
                || merchants_.code.length == 0
        ) revert InvalidDependency();
        orders = OrderRegistry420(orders_);
        payments = PaymentRegistry420(payments_);
        invoices = InvoiceRegistry420(invoices_);
        merchants = MerchantRegistry420(merchants_);
        deploymentChainId = block.chainid;
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    /// @notice Seller must issue a single-use Pay invoice at this exact domain-separated ID.
    function invoiceIdForOrder(
        bytes32 orderId
    ) public view returns (bytes32) {
        OrderRegistry420.Order memory o = orders.getOrder(orderId);
        if (orderId == bytes32(0) || o.buyer == address(0)) revert InvalidEvidence();
        return keccak256(
            abi.encode(
                DOMAIN,
                deploymentChainId,
                address(this),
                address(orders),
                address(payments),
                address(invoices),
                orderId,
                o.listingId,
                o.listingRevision,
                o.buyer,
                o.seller,
                o.quantity,
                o.paymentAsset,
                o.totalAmount,
                o.settlementAdapterId
            )
        );
    }

    function _evidence(
        bytes32 orderId,
        bytes32 paymentId
    ) private view returns (OrderRegistry420.Order memory o, PaymentRegistry420.Payment memory p) {
        if (block.chainid != deploymentChainId) revert InvalidChain();
        o = orders.getOrder(orderId);
        p = payments.getPayment(paymentId);
        InvoiceRegistry420.Invoice memory i = invoices.getInvoice(p.invoiceId);
        if (
            paymentId == bytes32(0) || p.invoiceId != invoiceIdForOrder(orderId) || p.payer != o.buyer
                || p.merchant != o.seller || p.settlementAsset != o.paymentAsset || p.settlementAmount != o.totalAmount
                || p.receiptHash == bytes32(0) || i.merchant != o.seller || i.amount != o.totalAmount || !i.active
                || i.currency != "420" || i.mode != InvoiceRegistry420.Mode.SINGLE_USE || i.partialPayments
                || i.acceptance == InvoiceRegistry420.Acceptance.FAST
                || invoices.paidAmount(p.invoiceId) != o.totalAmount || !invoices.isClosed(p.invoiceId)
        ) {
            revert InvalidEvidence();
        }
    }

    function reportPayment(
        bytes32 orderId,
        bytes32 paymentId
    ) external {
        if (orderPayment[orderId] != bytes32(0) || paymentOrder[paymentId] != bytes32(0)) revert AlreadyReported();
        (OrderRegistry420.Order memory o, PaymentRegistry420.Payment memory p) = _evidence(orderId, paymentId);
        (address controller,,,, bool active,) = merchants.merchants(invoices.getInvoice(p.invoiceId).merchantId);
        if (
            o.status != OrderRegistry420.Status.CREATED || p.status != PaymentRegistry420.Status.SETTLED
                || p.refundedAmount != 0 || controller != o.seller || !active
        ) revert InvalidEvidence();
        orderPayment[orderId] = paymentId;
        paymentOrder[paymentId] = orderId;
        emit PaymentReported(orderId, paymentId);
        orders.recordPayment(orderId, paymentId);
    }

    function reportRefund(
        bytes32 orderId
    ) external {
        bytes32 paymentId = orderPayment[orderId];
        if (paymentId == bytes32(0) || refundReported[orderId]) revert InvalidEvidence();
        (, PaymentRegistry420.Payment memory p) = _evidence(orderId, paymentId);
        if (p.status != PaymentRegistry420.Status.REFUNDED || p.refundedAmount != p.settlementAmount + p.tipAmount) {
            revert InvalidEvidence();
        }
        refundReported[orderId] = true;
        emit RefundReported(orderId, paymentId);
        orders.recordRefund(orderId, paymentId);
    }
}
