// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/market/MarketPaySettlementAdapter420.sol";
import "../src/market/MarketPolicyRegistry420.sol";
import "../src/market/ListingRegistry420.sol";
import "../src/market/InventoryReservation420.sol";
import "./helpers/GenesisMocks420.sol";

interface VmCommerce420 {
    function prank(
        address
    ) external;
    function expectRevert() external;
    function chainId(
        uint256
    ) external;
}

contract MarketPaySettlementAdapter420Test {
    VmCommerce420 constant vm = VmCommerce420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant BUYER = address(0xB0B);
    address constant SELLER = address(0x5E11);
    address constant ASSET = address(0x420);
    bytes32 constant ORDER = keccak256("order");
    bytes32 constant LISTING = keccak256("listing");
    bytes32 constant ADAPTER = keccak256("adapter");
    bytes32 constant MERCHANT = keccak256("merchant");
    GenesisMockEnvironment420 env;
    MarketPolicyRegistry420 policy;
    ListingRegistry420 listings;
    InventoryReservation420 inventory;
    OrderRegistry420 orders;
    PaymentRegistry420 payments;
    InvoiceRegistry420 invoices;
    MerchantRegistry420 merchants;
    MarketPaySettlementAdapter420 reporter;
    bytes32 invoiceId;

    function setUp() public {
        env = new GenesisMockEnvironment420();
        payments = new PaymentRegistry420(address(this), address(env.registry()), keccak256("genesis"));
        invoices = new InvoiceRegistry420(address(this), address(env.registry()), keccak256("genesis"));
        merchants = new MerchantRegistry420(address(this), address(env.registry()), keccak256("genesis"));
        env.registerResident(address(payments), payments.componentId());
        env.registerResident(address(invoices), invoices.componentId());
        env.registerResident(address(merchants), merchants.componentId());
        env.setSettlementAsset(ASSET, keccak256("420"), true);
        vm.prank(SELLER);
        merchants.register(MERCHANT, bytes32(0), bytes32(0), SELLER);
        policy = new MarketPolicyRegistry420(address(this));
        listings = new ListingRegistry420(address(policy));
        inventory = new InventoryReservation420(address(this), address(listings));
        orders = new OrderRegistry420(address(listings), address(policy), address(inventory));
        inventory.bindOrderRegistry(address(orders));
        reporter = new MarketPaySettlementAdapter420(
            address(orders), address(payments), address(invoices), address(merchants)
        );
        policy.setPolicy(keccak256("policy"), bytes32(0), bytes32(0), 0, true);
        policy.setSettlementAdapter(ADAPTER, address(reporter), keccak256("pay"), bytes32(0), true);
        vm.prank(SELLER);
        listings.createListing(
            LISTING,
            bytes32(0),
            keccak256("420/MARKET/ITEM/PHYSICAL_GOOD/V1"),
            keccak256("item"),
            bytes32(0),
            keccak256("policy"),
            keccak256("420/MARKET/SALE/FIXED_PRICE/V1"),
            ADAPTER,
            ASSET,
            100,
            5,
            0
        );
        vm.prank(BUYER);
        orders.createOrder(ORDER, LISTING, 1, 1, ASSET, 100);
        invoiceId = reporter.invoiceIdForOrder(ORDER);
        InvoiceRegistry420.Invoice memory i;
        i.merchantId = MERCHANT;
        i.merchant = SELLER;
        i.currency = bytes3("420");
        i.amount = 100;
        i.expiresAt = uint64(block.timestamp + 1000);
        i.refundUntil = uint64(block.timestamp + 2000);
        i.mode = InvoiceRegistry420.Mode.SINGLE_USE;
        i.acceptance = InvoiceRegistry420.Acceptance.FINALIZED;
        i.acceptedAssetsHash = keccak256("420");
        vm.prank(SELLER);
        invoices.createInvoice(invoiceId, i);
    }

    function _payment(
        bytes32 inv,
        address buyer,
        address seller,
        uint256 amount,
        uint256 nonce
    ) internal returns (bytes32) {
        return payments.createPayment(inv, buyer, seller, ASSET, 100, ASSET, amount, bytes32(0), nonce);
    }

    function _settle(
        bytes32 id,
        bytes32 inv,
        uint256 amount
    ) internal {
        payments.recordFinalized(id, inv, keccak256("receipt"), ASSET, amount, 0);
        payments.recordSettled(id);
    }

    function _ready() internal returns (bytes32 id) {
        id = _payment(invoiceId, BUYER, SELLER, 100, 1);
        _settle(id, invoiceId, 100);
        invoices.markPaid(invoiceId, 100);
    }

    function testCanonicalPaymentAndFullRefundReleaseStock() public {
        bytes32 id = _ready();
        vm.prank(address(0x123));
        reporter.reportPayment(ORDER, id);
        require(orders.orderStatus(ORDER) == OrderRegistry420.Status.PAID, "paid");
        payments.applyRefund(id, 100, true);
        reporter.reportRefund(ORDER);
        require(orders.orderStatus(ORDER) == OrderRegistry420.Status.REFUNDED, "refund");
        require(inventory.available(LISTING) == 5 && inventory.conserved(LISTING), "stock");
    }

    function testPartialRefundNeverReleasesStock() public {
        bytes32 id = _ready();
        reporter.reportPayment(ORDER, id);
        payments.applyRefund(id, 40, false);
        vm.expectRevert();
        reporter.reportRefund(ORDER);
        require(inventory.available(LISTING) == 4 && inventory.conserved(LISTING), "stock");
        payments.applyRefund(id, 60, true);
        reporter.reportRefund(ORDER);
    }

    function testRejectUnfinalizedPayment() public {
        bytes32 id = _payment(invoiceId, BUYER, SELLER, 100, 1);
        invoices.markPaid(invoiceId, 100);
        vm.expectRevert();
        reporter.reportPayment(ORDER, id);
    }

    function testRejectFinalizedButUnsettledPayment() public {
        bytes32 id = _payment(invoiceId, BUYER, SELLER, 100, 1);
        payments.recordFinalized(id, invoiceId, keccak256("receipt"), ASSET, 100, 0);
        invoices.markPaid(invoiceId, 100);
        vm.expectRevert();
        reporter.reportPayment(ORDER, id);
    }

    function testRejectUnpaidInvoice() public {
        bytes32 id = _payment(invoiceId, BUYER, SELLER, 100, 1);
        _settle(id, invoiceId, 100);
        vm.expectRevert();
        reporter.reportPayment(ORDER, id);
    }

    function testRejectWrongBuyer() public {
        bytes32 id = _payment(invoiceId, address(0xBAD), SELLER, 100, 1);
        _settle(id, invoiceId, 100);
        invoices.markPaid(invoiceId, 100);
        vm.expectRevert();
        reporter.reportPayment(ORDER, id);
    }

    function testRejectWrongMerchant() public {
        bytes32 id = _payment(invoiceId, BUYER, address(0xBAD), 100, 1);
        _settle(id, invoiceId, 100);
        invoices.markPaid(invoiceId, 100);
        vm.expectRevert();
        reporter.reportPayment(ORDER, id);
    }

    function testRejectWrongAmount() public {
        bytes32 id = _payment(invoiceId, BUYER, SELLER, 99, 1);
        _settle(id, invoiceId, 99);
        invoices.markPaid(invoiceId, 100);
        vm.expectRevert();
        reporter.reportPayment(ORDER, id);
    }

    function testRejectWrongInvoice() public {
        bytes32 inv = keccak256("wrong");
        bytes32 id = _payment(inv, BUYER, SELLER, 100, 1);
        _settle(id, inv, 100);
        invoices.markPaid(invoiceId, 100);
        vm.expectRevert();
        reporter.reportPayment(ORDER, id);
    }

    function testRevokedReporterRollsBackReplayState() public {
        bytes32 id = _ready();
        policy.setSettlementAdapter(ADAPTER, address(reporter), bytes32(0), bytes32(0), false);
        vm.expectRevert();
        reporter.reportPayment(ORDER, id);
        require(reporter.orderPayment(ORDER) == bytes32(0) && reporter.paymentOrder(id) == bytes32(0), "rollback");
        policy.setSettlementAdapter(ADAPTER, address(reporter), bytes32(0), bytes32(0), true);
        reporter.reportPayment(ORDER, id);
    }

    function testDuplicatePaymentAndRefundRejected() public {
        bytes32 id = _ready();
        reporter.reportPayment(ORDER, id);
        vm.expectRevert();
        reporter.reportPayment(ORDER, id);
        payments.applyRefund(id, 100, true);
        reporter.reportRefund(ORDER);
        vm.expectRevert();
        reporter.reportRefund(ORDER);
    }

    function testCancelledOrderRejectsPayment() public {
        bytes32 id = _ready();
        vm.prank(BUYER);
        orders.cancelOrder(ORDER);
        vm.expectRevert();
        reporter.reportPayment(ORDER, id);
        require(inventory.available(LISTING) == 5, "stock");
    }

    function testInactiveMerchantRejectsPaymentButAllowsRefund() public {
        bytes32 id = _ready();
        merchants.setStatus(MERCHANT, MerchantRegistry420.Status.REGISTERED, false);
        vm.expectRevert();
        reporter.reportPayment(ORDER, id);
        merchants.setStatus(MERCHANT, MerchantRegistry420.Status.REGISTERED, true);
        reporter.reportPayment(ORDER, id);
        merchants.setStatus(MERCHANT, MerchantRegistry420.Status.REGISTERED, false);
        payments.applyRefund(id, 100, true);
        reporter.reportRefund(ORDER);
    }

    function testChainMismatchRejected() public {
        bytes32 id = _ready();
        vm.chainId(block.chainid + 1);
        vm.expectRevert();
        reporter.reportPayment(ORDER, id);
    }

    function testRefundBeforePaymentRejected() public {
        vm.expectRevert();
        reporter.reportRefund(ORDER);
    }

    function testCompletedOrderCannotReleaseStock() public {
        bytes32 id = _ready();
        reporter.reportPayment(ORDER, id);
        vm.prank(SELLER);
        orders.recordFulfillment(ORDER, keccak256("fulfilment"));
        vm.prank(BUYER);
        orders.completeOrder(ORDER);
        payments.applyRefund(id, 100, true);
        vm.expectRevert();
        reporter.reportRefund(ORDER);
        require(inventory.available(LISTING) == 4 && inventory.conserved(LISTING), "sold stock");
    }

    function _alternateInvoice(
        InvoiceRegistry420.Invoice memory i
    ) internal {
        reporter = new MarketPaySettlementAdapter420(
            address(orders), address(payments), address(invoices), address(merchants)
        );
        policy.setSettlementAdapter(ADAPTER, address(reporter), bytes32(0), bytes32(0), true);
        invoiceId = reporter.invoiceIdForOrder(ORDER);
        vm.prank(SELLER);
        invoices.createInvoice(invoiceId, i);
    }

    function testRejectFastAcceptance() public {
        InvoiceRegistry420.Invoice memory i = invoices.getInvoice(invoiceId);
        i.acceptance = InvoiceRegistry420.Acceptance.FAST;
        _alternateInvoice(i);
        bytes32 id = _ready();
        vm.expectRevert();
        reporter.reportPayment(ORDER, id);
    }

    function testRejectMultiUseInvoice() public {
        InvoiceRegistry420.Invoice memory i = invoices.getInvoice(invoiceId);
        i.mode = InvoiceRegistry420.Mode.MULTI_USE;
        _alternateInvoice(i);
        bytes32 id = _ready();
        vm.expectRevert();
        reporter.reportPayment(ORDER, id);
    }

    function testRejectPartialInvoiceMode() public {
        InvoiceRegistry420.Invoice memory i = invoices.getInvoice(invoiceId);
        i.mode = InvoiceRegistry420.Mode.PARTIAL_PAYMENT;
        i.partialPayments = true;
        _alternateInvoice(i);
        bytes32 id = _ready();
        vm.expectRevert();
        reporter.reportPayment(ORDER, id);
    }

    function testRejectForeignCurrencyInvoice() public {
        InvoiceRegistry420.Invoice memory i = invoices.getInvoice(invoiceId);
        i.currency = bytes3("CAD");
        _alternateInvoice(i);
        bytes32 id = _ready();
        vm.expectRevert();
        reporter.reportPayment(ORDER, id);
    }

    function testRejectMissingReceipt() public {
        bytes32 id = _payment(invoiceId, BUYER, SELLER, 100, 1);
        payments.recordFinalized(id, invoiceId, bytes32(0), ASSET, 100, 0);
        payments.recordSettled(id);
        invoices.markPaid(invoiceId, 100);
        vm.expectRevert();
        reporter.reportPayment(ORDER, id);
    }

    function testTipsMustAlsoBeFullyRefunded() public {
        bytes32 id = _payment(invoiceId, BUYER, SELLER, 100, 1);
        payments.recordFinalized(id, invoiceId, keccak256("receipt"), ASSET, 100, 10);
        payments.recordSettled(id);
        invoices.markPaid(invoiceId, 100);
        reporter.reportPayment(ORDER, id);
        payments.applyRefund(id, 100, false);
        vm.expectRevert();
        reporter.reportRefund(ORDER);
        payments.applyRefund(id, 10, true);
        reporter.reportRefund(ORDER);
    }

    function testUnknownOrderAndEOADependencyRejected() public {
        vm.expectRevert();
        reporter.invoiceIdForOrder(keccak256("unknown"));
        vm.expectRevert();
        new MarketPaySettlementAdapter420(BUYER, address(payments), address(invoices), address(merchants));
    }

    function testSecondPaymentCannotReplaceBinding() public {
        bytes32 id = _ready();
        reporter.reportPayment(ORDER, id);
        bytes32 other = _payment(invoiceId, BUYER, SELLER, 100, 2);
        _settle(other, invoiceId, 100);
        vm.expectRevert();
        reporter.reportPayment(ORDER, other);
        require(reporter.orderPayment(ORDER) == id, "binding");
    }

    function testWrongSettlementAssetRejected() public {
        address other = address(0x421);
        env.setSettlementAsset(other, keccak256("other"), true);
        bytes32 id = payments.createPayment(invoiceId, BUYER, SELLER, ASSET, 100, other, 100, bytes32(0), 1);
        payments.recordFinalized(id, invoiceId, keccak256("receipt"), other, 100, 0);
        payments.recordSettled(id);
        invoices.markPaid(invoiceId, 100);
        vm.expectRevert();
        reporter.reportPayment(ORDER, id);
    }

    function testSwapInputCanDifferFromPinnedSettlementOutput() public {
        bytes32 id = payments.createPayment(
            invoiceId, BUYER, SELLER, address(0xCA420), 250, ASSET, 100, keccak256("quote"), 1
        );
        _settle(id, invoiceId, 100);
        invoices.markPaid(invoiceId, 100);
        reporter.reportPayment(ORDER, id);
        require(orders.orderStatus(ORDER) == OrderRegistry420.Status.PAID, "swap output");
    }

    function testOtherOrderCannotReusePayment() public {
        bytes32 id = _ready();
        bytes32 other = keccak256("other-order");
        vm.prank(BUYER);
        orders.createOrder(other, LISTING, 1, 1, ASSET, 100);
        vm.expectRevert();
        reporter.reportPayment(other, id);
        reporter.reportPayment(ORDER, id);
        vm.expectRevert();
        reporter.reportPayment(other, id);
    }

    function testDisputedOrderRefundsAndRevocationRollsBackRefundFlag() public {
        bytes32 id = _ready();
        reporter.reportPayment(ORDER, id);
        vm.prank(BUYER);
        orders.disputeOrder(ORDER, keccak256("dispute"));
        payments.applyRefund(id, 100, true);
        policy.setSettlementAdapter(ADAPTER, address(reporter), bytes32(0), bytes32(0), false);
        vm.expectRevert();
        reporter.reportRefund(ORDER);
        require(!reporter.refundReported(ORDER), "rollback");
        policy.setSettlementAdapter(ADAPTER, address(reporter), bytes32(0), bytes32(0), true);
        reporter.reportRefund(ORDER);
        require(inventory.conserved(LISTING), "stock");
    }

    function testFuzzPartialRefundConservesReservation(
        uint8 value
    ) public {
        uint256 amount = 1 + uint256(value) % 99;
        bytes32 id = _ready();
        reporter.reportPayment(ORDER, id);
        payments.applyRefund(id, amount, false);
        vm.expectRevert();
        reporter.reportRefund(ORDER);
        require(inventory.available(LISTING) == 4 && inventory.conserved(LISTING), "partial stock");
        payments.applyRefund(id, 100 - amount, true);
        reporter.reportRefund(ORDER);
        require(inventory.available(LISTING) == 5 && inventory.conserved(LISTING), "full stock");
    }
}
