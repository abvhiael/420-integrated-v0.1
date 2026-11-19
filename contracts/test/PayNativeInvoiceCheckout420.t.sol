// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/pay/PaymentRouter420.sol";
import "./helpers/GenesisMocks420.sol";

interface VmNativeInvoiceCheckout420 {
    function prank(address) external;
    function deal(address, uint256) external;
    function warp(uint256) external;
    function getBlockTimestamp() external view returns (uint256);
}

contract PayNativeInvoiceCheckout420Test {
    VmNativeInvoiceCheckout420 private constant vm =
        VmNativeInvoiceCheckout420(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 private constant ASSET_POLICY = keccak256("native 420 accepted asset policy");
    bytes32 private constant INVOICE = keccak256("invoice");
    bytes32 private constant MERCHANT = keccak256("merchant");
    address private constant CONTROLLER = address(0x4200);
    address private constant PAYER = address(0x4201);
    address private constant PAYOUT = address(0x4202);
    uint256 private constant PRICE = 3 ether;

    GenesisMockEnvironment420 private env;
    InvoiceRegistry420 private invoices;
    MerchantRegistry420 private merchants;
    PaymentRegistry420 private payments;
    PaymentRouter420 private router;
    SettlementRouter420 private settlement;
    CanonicalPayQuote420 private quotes;

    function setUp() public {
        env = new GenesisMockEnvironment420();
        address registry = address(env.registry());
        bytes32 cfg = keccak256("pay native checkout qualification");
        invoices = new InvoiceRegistry420(address(this), registry, cfg);
        merchants = new MerchantRegistry420(address(this), registry, cfg);
        payments = new PaymentRegistry420(address(this), registry, cfg);
        router = new PaymentRouter420(address(this), registry, cfg);
        settlement = new SettlementRouter420(address(this), registry, cfg);
        quotes = new CanonicalPayQuote420(address(this), registry, cfg, ASSET_POLICY);
        env.registerResident(address(invoices), invoices.componentId());
        env.registerResident(address(merchants), merchants.componentId());
        env.registerResident(address(payments), payments.componentId());
        env.registerResident(address(router), router.componentId());
        env.registerResident(address(settlement), settlement.componentId());
        env.registerResident(address(quotes), quotes.componentId());
        env.setSettlementAsset(address(0), keccak256("native asset"), true);
        router.setSettlementRouter(address(settlement));
        settlement.setPaymentRouter(address(router));
        vm.prank(CONTROLLER);
        merchants.register(MERCHANT, bytes32(0), bytes32(0), PAYOUT);
        vm.prank(CONTROLLER);
        invoices.createInvoice(INVOICE, InvoiceRegistry420.Invoice({
            merchantId: MERCHANT, merchant: CONTROLLER, metadataHash: bytes32(0), currency: bytes3("420"),
            amount: PRICE, expiresAt: uint64(block.timestamp + 120), refundUntil: uint64(block.timestamp + 240),
            mode: InvoiceRegistry420.Mode.SINGLE_USE, acceptance: InvoiceRegistry420.Acceptance.FINALIZED,
            partialPayments: false, quoteMaxSlippageBps: 0, acceptedAssetsHash: ASSET_POLICY,
            settlementPlanHash: bytes32(0), tipPolicyHash: bytes32(0), active: true
        }));
        vm.deal(PAYER, PRICE * 2);
    }

    function testQuoteAndAtomicCheckoutAtInclusiveDeadline() public {
        uint64 at = uint64(vm.getBlockTimestamp());
        CanonicalPayQuote420.NativeQuote memory q = quotes.quoteNative(INVOICE, PAYER, 1, at);
        IFeeQuote420.FeeQuote memory fees = quotes.feeQuote(q.quoteId, abi.encode(INVOICE, PAYER, uint256(1), at));
        require(q.amount == PRICE && q.recipient == PAYOUT && fees.expiresAt == at + 42);
        require(fees.protocolFee == 0 && fees.conversionFee == 0 && fees.providerFee == 0);
        uint256 before = PAYOUT.balance;
        vm.warp(at + 42);
        vm.prank(PAYER);
        bytes32 paymentId = router.payNativeInvoice{value: PRICE}(INVOICE, 1, at, q.quoteId);
        PaymentRegistry420.Payment memory payment = payments.getPayment(paymentId);
        require(PAYOUT.balance - before == PRICE && invoices.closed(INVOICE) && invoices.paidAmount(INVOICE) == PRICE);
        require(payment.status == PaymentRegistry420.Status.SETTLED && payment.invoiceId == INVOICE);
        require(payment.payer == PAYER && payment.merchant == CONTROLLER && payment.receiptHash != bytes32(0));
        require(router.consumedPaymentAuthorization(paymentId) && router.usedCheckoutNonces(PAYER, 1));
        vm.prank(PAYER);
        (bool ok,) = address(router).call{value: PRICE}(
            abi.encodeCall(router.payNativeInvoice, (INVOICE, 1, at, q.quoteId))
        );
        require(!ok && PAYOUT.balance - before == PRICE, "duplicate checkout");
    }

    function testRevertingDeliveryRollsBackInvoiceAndPaymentState() public {
        vm.prank(CONTROLLER);
        merchants.schedulePayout(MERCHANT, address(this), bytes32(0), uint64(block.timestamp));
        uint64 at = uint64(vm.getBlockTimestamp());
        CanonicalPayQuote420.NativeQuote memory q = quotes.quoteNative(INVOICE, PAYER, 1, at);
        bytes32 expected = payments.derivePaymentId(
            INVOICE, PAYER, CONTROLLER, address(0), PRICE, address(0), PRICE, q.quoteId, 1
        );
        vm.prank(PAYER);
        (bool ok,) = address(router).call{value: PRICE}(
            abi.encodeCall(router.payNativeInvoice, (INVOICE, 1, at, q.quoteId))
        );
        require(!ok && !invoices.closed(INVOICE) && invoices.paidAmount(INVOICE) == 0);
        require(!router.consumedPaymentAuthorization(expected) && !router.usedCheckoutNonces(PAYER, 1));
        require(payments.getPayment(expected).status == PaymentRegistry420.Status.NONE);
        require(PAYER.balance == PRICE * 2);
    }

    function testExpiredQuoteAndChangedPayoutFailBeforeDelivery() public {
        uint64 at = uint64(vm.getBlockTimestamp());
        CanonicalPayQuote420.NativeQuote memory q = quotes.quoteNative(INVOICE, PAYER, 1, at);
        vm.prank(CONTROLLER);
        merchants.schedulePayout(MERCHANT, address(0x4203), bytes32(0), at);
        vm.prank(PAYER);
        (bool changed,) = address(router).call{value: PRICE}(abi.encodeCall(router.payNativeInvoice, (INVOICE, 1, at, q.quoteId)));
        require(!changed && !invoices.closed(INVOICE), "changed payout");
        CanonicalPayQuote420.NativeQuote memory replacement = quotes.quoteNative(INVOICE, PAYER, 1, at);
        vm.warp(at + 43);
        vm.prank(PAYER);
        (bool stale,) = address(router).call{value: PRICE}(
            abi.encodeCall(router.payNativeInvoice, (INVOICE, 1, at, replacement.quoteId))
        );
        require(!stale && !router.usedCheckoutNonces(PAYER, 1) && PAYER.balance == PRICE * 2, "stale quote");
    }
}
