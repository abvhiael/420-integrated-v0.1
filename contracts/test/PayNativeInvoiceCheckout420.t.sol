// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/pay/PaymentRouter420.sol";
import "./helpers/GenesisMocks420.sol";
import "./PayAudit4SettlementAndAccounting420.t.sol";
import "../src/apps/ProtocolRegistry.sol";
import "../src/pay/adapters/CanonicalSettlementAdapter420.sol";
import "../src/swap/CanonicalMarketRegistry.sol";
import "../src/swap/CanonicalConstantProductPool420.sol";
import "../src/swap/CanonicalSwapExecutor420.sol";

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
    ProtocolRegistry private registry;
    bytes32 private constant CFG = keccak256("pay native checkout qualification");
    InvoiceRegistry420 private invoices;
    MerchantRegistry420 private merchants;
    PaymentRegistry420 private payments;
    PaymentRouter420 private router;
    SettlementRouter420 private settlement;
    CanonicalPayQuote420 private quotes;

    function setUp() public {
        env = new GenesisMockEnvironment420();
        registry = new ProtocolRegistry(address(this));
        _publish(GenesisInterfaceIds420.GOVERNANCE_AUTHORITY, address(env.governance()));
        _publish(GenesisInterfaceIds420.PAUSE_REGISTRY, address(env.pause()));
        _publish(GenesisInterfaceIds420.CANONICAL_ASSET_REGISTRY, address(env.assets()));
        _publish(AppDependencyIds420.SYSTEM_SAFETY, address(env.safety()));
        _publish(AppDependencyIds420.CHAIN_CONTEXT, address(env.chain()));
        _publish(AppDependencyIds420.ASSET_CAPABILITIES, address(env.capabilities()));
        _publish(GenesisInterfaceIds420.SETTLEMENT_HEALTH, address(env.health()));
        _publish(AppDependencyIds420.REPLAY_PROTECTION, address(env.replay()));
        invoices = new InvoiceRegistry420(address(this), address(registry), CFG);
        merchants = new MerchantRegistry420(address(this), address(registry), CFG);
        payments = new PaymentRegistry420(address(this), address(registry), CFG);
        router = new PaymentRouter420(address(this), address(registry), CFG);
        settlement = new SettlementRouter420(address(this), address(registry), CFG);
        quotes = new CanonicalPayQuote420(address(this), address(registry), CFG, ASSET_POLICY);
        _publish(invoices.componentId(), address(invoices));
        _publish(merchants.componentId(), address(merchants));
        _publish(payments.componentId(), address(payments));
        _publish(router.componentId(), address(router));
        _publish(settlement.componentId(), address(settlement));
        _publish(quotes.componentId(), address(quotes));
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

    function _publish(bytes32 id, address implementation) private {
        registry.registerComponent(id, implementation, Types420.Version(1, 0, 0), Types420.Lifecycle.ACTIVE);
        Types420.ContractRef memory ref = registry.component(id);
        require(ref.implementation == implementation && ref.runtimeCodeHash == implementation.codehash);
        require(registry.isActive(id) && registry.resolve(id) == implementation);
    }

    function testConversionGatesAndAtomicAccounting() public {
        address reg = address(registry);
        CanonicalMarketRegistry markets = new CanonicalMarketRegistry(address(this), reg, CFG);
        CanonicalSwapExecutor420 executor = new CanonicalSwapExecutor420(address(this), reg, CFG);
        CanonicalSettlementAdapter420 adapter = new CanonicalSettlementAdapter420(address(this), reg, CFG, address(executor));
        _publish(markets.componentId(), address(markets));
        _publish(executor.componentId(), address(executor));
        _publish(adapter.componentId(), address(adapter));
        executor.setTrustedCaller(address(adapter), true);
        adapter.setPaymentRouter(address(router));
        router.setSettlementAdapter(address(adapter));

        PayAudit4Token420 input = new PayAudit4Token420();
        PayAudit4Token420 target = new PayAudit4Token420();
        CanonicalConstantProductPool420 pool = new CanonicalConstantProductPool420(
            address(input), address(target), address(executor), 10
        );
        input.mint(address(this), 10000 ether);
        target.mint(address(this), 10000 ether);
        input.approve(address(pool), 10000 ether);
        target.approve(address(pool), 10000 ether);
        pool.addLiquidity(10000 ether, 10000 ether, 1, address(this));
        input.mint(PAYER, 4 ether);
        bytes32 market = keccak256("checkout canonical market");
        env.setSettlementAsset(address(input), keccak256("checkout input asset"), true);
        env.setSettlementAsset(address(target), keccak256("checkout target asset"), true);
        markets.setMarket(market, address(pool), address(input), address(target), CanonicalMarketRegistry.Role.CANONICAL_CAD,
            bytes32(0), true);
        env.health().setMarket(market, true);
        bytes32 invoice = keccak256("conversion invoice");
        bytes32 policy = quotes.conversionAssetCommitment(market, address(input), address(target));
        vm.prank(CONTROLLER);
        invoices.createInvoice(invoice, InvoiceRegistry420.Invoice({
            merchantId: MERCHANT, merchant: CONTROLLER, metadataHash: bytes32(0), currency: bytes3("CAD"),
            amount: PRICE, expiresAt: uint64(block.timestamp + 120), refundUntil: uint64(block.timestamp + 240),
            mode: InvoiceRegistry420.Mode.SINGLE_USE, acceptance: InvoiceRegistry420.Acceptance.FINALIZED,
            partialPayments: false, quoteMaxSlippageBps: 42,
            acceptedAssetsHash: policy,
            settlementPlanHash: bytes32(0), tipPolicyHash: bytes32(0), active: true
        }));
        CanonicalPayQuote420.ConversionRequest memory request_ = CanonicalPayQuote420.ConversionRequest(
            invoice, PAYER, 9, uint64(vm.getBlockTimestamp()), market, address(input), address(target), 4 ether, PRICE
        );
        CanonicalPayQuote420.ConversionQuote memory q = quotes.quoteConversion(request_);
        IFeeQuote420.FeeQuote memory fee = quotes.feeQuote(q.swap.quoteId, abi.encode(request_));
        require(fee.conversionFee == 4 ether / 1000 && fee.protocolFee == 0);
        env.health().setMarket(market, false);
        (bool healthy,) = address(quotes).staticcall(abi.encodeCall(quotes.quoteConversion, (request_)));
        require(!healthy, "unhealthy market quoted");
        env.health().setMarket(market, true);

        vm.prank(PAYER);
        (bool executed,) = address(router).call(abi.encodeCall(router.payConvertedInvoice, (request_, q.swap.quoteId)));
        require(!executed && !invoices.closed(invoice) && invoices.paidAmount(invoice) == 0);
        require(!router.usedCheckoutNonces(PAYER, 9) && !adapter.consumedQuote(q.swap.quoteId));
        require(input.balanceOf(PAYER) == 4 ether && target.balanceOf(PAYOUT) == 0);

        vm.prank(PAYER);
        input.approve(address(pool), 4 ether);
        vm.prank(PAYER);
        bytes32 id = router.payConvertedInvoice(request_, q.swap.quoteId);
        require(invoices.closed(invoice) && invoices.paidAmount(invoice) == PRICE);
        require(target.balanceOf(PAYOUT) == q.swap.quotedSettlementAmount && input.balanceOf(PAYER) == 0);
        PaymentRegistry420.Payment memory payment = payments.getPayment(id);
        require(payment.status == PaymentRegistry420.Status.SETTLED && payment.invoiceId == invoice);
        require(payment.inputAsset == address(input) && payment.settlementAsset == address(target));
        require(payment.inputAmount == 4 ether && payment.settlementAmount == target.balanceOf(PAYOUT));
    }
}
