// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/pay/InvoiceRegistry420.sol";
import "../src/pay/PaymentRegistry420.sol";
import "../src/pay/PaymentRouter420.sol";
import "../src/pay/SettlementRouter420.sol";
import "../src/pay/GasSponsor420.sol";
import "../src/pay/MerchantRegistry420.sol";
import "../src/interfaces/ICanonicalSettlement420.sol";
import "./helpers/GenesisMocks420.sol";

interface VmPayFocused420 {
    function prank(address) external;
    function warp(uint256) external;
}

contract RevertingPaySettlement420 is ICanonicalSettlement420 {
    function quote(bytes32, address, address, uint256) external pure returns (Quote memory) { revert(); }
    function execute(Quote calldata, address, address, uint256) external payable returns (uint256, uint256) {
        revert("adapter failure");
    }
}

contract ReenteringPaySettlement420 is ICanonicalSettlement420 {
    PaymentRouter420 public immutable router;
    bool public reentrySucceeded;

    constructor(PaymentRouter420 router_) { router = router_; }
    function quote(bytes32, address, address, uint256) external pure returns (Quote memory) { revert(); }

    function execute(Quote calldata q, address payer, address recipient, uint256 invoiceSettlementAmount)
        external payable returns (uint256, uint256)
    {
        PaymentRouter420.PayerLimits memory limits = PaymentRouter420.PayerLimits({
            maxInputAmount: q.inputAmount,
            maxGasCost420: 0,
            maxSlippageBps: q.slippageBps,
            maxTip: 0,
            maxConversionFee: q.conversionFee,
            maxProtocolFee: 0,
            quoteTimestamp: q.quotedAt
        });
        (reentrySucceeded,) = address(router).call(
            abi.encodeWithSelector(
                router.executeSwapSettlement.selector,
                keccak256(abi.encode("reentry", q.quoteId)),
                q,
                payer,
                recipient,
                invoiceSettlementAmount,
                limits,
                0,
                0
            )
        );
        return (q.inputAmount, invoiceSettlementAmount);
    }
}

contract PayFocusedHardening420Test {
    VmPayFocused420 internal constant vm = VmPayFocused420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    address internal constant SETTLEMENT = address(0xCA420);
    bytes32 internal constant ASSET_ID = keccak256("CADC");
    bytes32 internal constant MARKET_ID = keccak256("420/CADC");
    bytes32 internal constant OPERATION = keccak256("420PAY/SPONSORED_PAYMENT");

    function _invoice(address merchant, InvoiceRegistry420.Mode mode, bool allowPartial)
        internal view returns (InvoiceRegistry420.Invoice memory i)
    {
        i = InvoiceRegistry420.Invoice({
            merchantId: keccak256(abi.encode(merchant)),
            merchant: merchant,
            metadataHash: bytes32(0),
            currency: bytes3("CAD"),
            amount: 100,
            expiresAt: uint64(block.timestamp + 100),
            refundUntil: uint64(block.timestamp + 200),
            mode: mode,
            acceptance: InvoiceRegistry420.Acceptance.FINALIZED,
            partialPayments: allowPartial,
            quoteMaxSlippageBps: 42,
            acceptedAssetsHash: keccak256("420,CADC,USDC"),
            settlementPlanHash: keccak256("settlement"),
            tipPolicyHash: bytes32(0),
            active: true
        });
    }

    function _quote(uint256 inputAmount, uint256 minimumSettlementAmount)
        internal view returns (ICanonicalSettlement420.Quote memory q)
    {
        q = ICanonicalSettlement420.Quote({
            quoteId: keccak256("quote"),
            marketId: MARKET_ID,
            inputAsset: address(0x420),
            settlementAsset: SETTLEMENT,
            inputAmount: inputAmount,
            minimumSettlementAmount: minimumSettlementAmount,
            quotedSettlementAmount: minimumSettlementAmount,
            conversionFee: 0,
            slippageBps: 0,
            quotedAt: uint64(block.timestamp)
        });
    }

    function _routerSetup() internal returns (GenesisMockEnvironment420 env, PaymentRouter420 router) {
        env = new GenesisMockEnvironment420();
        router = new PaymentRouter420(address(this), address(env.registry()), keccak256("pay-focused"));
        env.registerResident(address(router), router.componentId());
        env.setSettlementAsset(SETTLEMENT, ASSET_ID, true);
        env.health().setMarket(MARKET_ID, true);
        env.fees().set(0, 0, false);
    }

    function testInvoiceReplayExpiryAndPartialDefaultDeny() public {
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        InvoiceRegistry420 invoices = new InvoiceRegistry420(address(this), address(env.registry()), keccak256("invoice-hardening"));
        env.registerResident(address(invoices), invoices.componentId());

        bytes32 singleId = keccak256("single");
        invoices.createInvoice(singleId, _invoice(address(this), InvoiceRegistry420.Mode.SINGLE_USE, false));
        invoices.markPaid(singleId, 100);
        (bool replayOk,) = address(invoices).call(abi.encodeWithSelector(invoices.markPaid.selector, singleId, 100));
        require(!replayOk, "single-use replay accepted");

        bytes32 multiId = keccak256("multi");
        invoices.createInvoice(multiId, _invoice(address(this), InvoiceRegistry420.Mode.MULTI_USE, false));
        (bool fragmentOk,) = address(invoices).call(abi.encodeWithSelector(invoices.markPaid.selector, multiId, 50));
        require(!fragmentOk, "partial payment accepted by default");
        invoices.markPaid(multiId, 100);
        invoices.markPaid(multiId, 100);
        require(invoices.paidAmount(multiId) == 200, "multi-use full payments broken");

        bytes32 expiredId = keccak256("expired");
        InvoiceRegistry420.Invoice memory expiring = _invoice(address(this), InvoiceRegistry420.Mode.SINGLE_USE, false);
        uint64 expiry = expiring.expiresAt;
        invoices.createInvoice(expiredId, expiring);
        vm.warp(uint256(expiry) + 1);
        (bool expiredOk,) = address(invoices).call(abi.encodeWithSelector(invoices.markPaid.selector, expiredId, 100));
        require(!expiredOk, "expired invoice settled");
    }

    function testInvoiceCurrencyAssetAndDomainValidation() public {
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        InvoiceRegistry420 invoices = new InvoiceRegistry420(address(this), address(env.registry()), keccak256("invoice-policy"));
        env.registerResident(address(invoices), invoices.componentId());

        InvoiceRegistry420.Invoice memory badCurrency = _invoice(address(this), InvoiceRegistry420.Mode.SINGLE_USE, false);
        badCurrency.currency = bytes3("EUR");
        (bool currencyOk,) = address(invoices).call(abi.encodeWithSelector(invoices.createInvoice.selector, keccak256("bad-currency"), badCurrency));
        require(!currencyOk, "unsupported currency accepted");

        InvoiceRegistry420.Invoice memory noAssets = _invoice(address(this), InvoiceRegistry420.Mode.SINGLE_USE, false);
        noAssets.acceptedAssetsHash = bytes32(0);
        (bool assetsOk,) = address(invoices).call(abi.encodeWithSelector(invoices.createInvoice.selector, keccak256("no-assets"), noAssets));
        require(!assetsOk, "empty accepted-assets commitment accepted");
        require(invoices.supportedCurrency(bytes3("CAD")), "CAD rejected");
        require(invoices.supportedCurrency(bytes3("USD")), "USD rejected");
        require(invoices.supportedCurrency(bytes3("420")), "420 rejected");

        InvoiceRegistry420.Invoice memory i = _invoice(address(this), InvoiceRegistry420.Mode.SINGLE_USE, false);
        bytes32 rootA = invoices.invoiceSigningRoot(keccak256("invoice-a"), i);
        bytes32 rootB = invoices.invoiceSigningRoot(keccak256("invoice-b"), i);
        require(rootA != rootB, "invoice id not bound");
        i.amount = 101;
        require(rootA != invoices.invoiceSigningRoot(keccak256("invoice-a"), i), "amount not bound");
        require(invoices.INVOICE_DOMAIN() != keccak256("420/APP/420PAY_PAYMENT_ID"), "cross-domain collision");
    }

    function testPaymentAssetLifecycleAndAccountingConservation() public {
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        PaymentRegistry420 payments = new PaymentRegistry420(address(this), address(env.registry()), keccak256("payment-hardening"));
        env.registerResident(address(payments), payments.componentId());

        (bool unsupportedOk,) = address(payments).call(
            abi.encodeWithSelector(payments.createPayment.selector, keccak256("i"), ALICE, BOB, address(0x420), 100, SETTLEMENT, 84, keccak256("q"), 1)
        );
        require(!unsupportedOk, "unsupported settlement asset accepted");

        env.setSettlementAsset(SETTLEMENT, ASSET_ID, true);
        bytes32 invoiceId = keccak256("invoice-refund");
        bytes32 paymentId = payments.createPayment(invoiceId, ALICE, BOB, address(0x420), 100, SETTLEMENT, 84, keccak256("quote"), 2);
        (bool earlyRefundOk,) = address(payments).call(abi.encodeWithSelector(payments.applyRefund.selector, paymentId, 1, false));
        require(!earlyRefundOk, "unfinalized payment refunded");

        payments.recordFinalized(paymentId, invoiceId, keccak256("receipt"), SETTLEMENT, 84, 6);
        (bool duplicateFinalizeOk,) = address(payments).call(
            abi.encodeWithSelector(payments.recordFinalized.selector, paymentId, invoiceId, keccak256("receipt2"), SETTLEMENT, 84, 6)
        );
        require(!duplicateFinalizeOk, "duplicate finalization accepted");

        payments.applyRefund(paymentId, 40, false);
        payments.applyRefund(paymentId, 50, true);
        (,,,,,,,,,,, uint256 refunded, PaymentRegistry420.Status status) = payments.payments(paymentId);
        require(refunded == 90, "refund accounting mismatch");
        require(status == PaymentRegistry420.Status.REFUNDED, "refund terminal state");
        (bool excessOk,) = address(payments).call(abi.encodeWithSelector(payments.applyRefund.selector, paymentId, 1, false));
        require(!excessOk, "refund exceeded settlement plus tip");

        bytes32 p1 = payments.derivePaymentId(invoiceId, ALICE, BOB, address(0x420), 100, SETTLEMENT, 84, keccak256("q"), 11);
        bytes32 p2 = payments.derivePaymentId(invoiceId, ALICE, BOB, address(0x420), 100, SETTLEMENT, 84, keccak256("q"), 12);
        require(p1 != p2, "payer nonce not bound");
    }

    function testSplitRoundingAndRecipientLimitConserveAmount() public {
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        SettlementRouter420 settlement = new SettlementRouter420(address(this), address(env.registry()), keccak256("split"));
        uint16[] memory bps = new uint16[](3);
        bps[0] = 3333; bps[1] = 3333; bps[2] = 3334;
        uint256[] memory amounts = settlement.splitAmounts(101, bps, 0);
        require(amounts[0] + amounts[1] + amounts[2] == 101, "rounding lost value");

        address[] memory recipients = new address[](9);
        uint16[] memory tooMany = new uint16[](9);
        for (uint256 x; x < 9; x++) { recipients[x] = address(uint160(x + 1)); tooMany[x] = 1111; }
        (bool ok,) = address(settlement).call(abi.encodeWithSelector(settlement.validateSplit.selector, recipients, tooMany, uint8(0)));
        require(!ok, "recipient limit bypassed");
    }

    function testMerchantAndGasSponsorAuthorityIsolation() public {
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        MerchantRegistry420 merchants = new MerchantRegistry420(address(this), address(env.registry()), keccak256("merchant-auth"));
        env.registerResident(address(merchants), merchants.componentId());
        bytes32 merchantId = keccak256("merchant");
        vm.prank(ALICE);
        merchants.register(merchantId, keccak256("profile"), bytes32(0), ALICE);
        vm.prank(BOB);
        (bool merchantOk,) = address(merchants).call(abi.encodeWithSelector(merchants.schedulePayout.selector, merchantId, BOB, bytes32(0), uint64(block.timestamp)));
        require(!merchantOk, "non-controller changed payout");

        GasSponsor420 sponsor = new GasSponsor420(address(this), address(env.registry()), keccak256("gas-sponsor"));
        env.registerResident(address(sponsor), sponsor.componentId());
        sponsor.setOperation(OPERATION, true);
        (bool funded,) = address(sponsor).call{value: 1 ether}("");
        require(funded, "funding failed");
        vm.prank(ALICE);
        (bool unauthorizedOk,) = address(sponsor).call(
            abi.encodeWithSelector(sponsor.recordSponsored.selector, ALICE, merchantId, OPERATION, 100000, 0.01 ether, true, false)
        );
        require(!unauthorizedOk, "non-governance sponsorship accepted");
        sponsor.recordSponsored(ALICE, merchantId, OPERATION, 100000, 0.01 ether, true, false);
        sponsor.recordSponsored(ALICE, merchantId, OPERATION, 100000, 0.01 ether, true, false);
        (bool thirdOk,) = address(sponsor).call(
            abi.encodeWithSelector(sponsor.recordSponsored.selector, ALICE, merchantId, OPERATION, 100000, 0.01 ether, true, false)
        );
        require(!thirdOk, "wallet success cap bypassed");
    }

    function testOracleAdapterAndReentrancyFailClosed() public {
        (GenesisMockEnvironment420 env, PaymentRouter420 router) = _routerSetup();
        RevertingPaySettlement420 revertingAdapter = new RevertingPaySettlement420();
        router.setSettlementAdapter(address(revertingAdapter));
        PaymentRouter420.PayerLimits memory limits = PaymentRouter420.PayerLimits(100, 0, 0, 0, 0, 0, uint64(block.timestamp));
        ICanonicalSettlement420.Quote memory q = _quote(100, 84);

        env.health().setMarket(MARKET_ID, false);
        (bool unhealthyOk,) = address(router).call(
            abi.encodeWithSelector(router.executeSwapSettlement.selector, keccak256("unhealthy"), q, ALICE, BOB, 84, limits, 0, 0)
        );
        require(!unhealthyOk, "unhealthy market accepted");

        env.health().setMarket(MARKET_ID, true);
        env.fees().set(0, 0, true);
        (bool staleOk,) = address(router).call(
            abi.encodeWithSelector(router.executeSwapSettlement.selector, keccak256("stale"), q, ALICE, BOB, 84, limits, 0, 0)
        );
        require(!staleOk, "stale fee quote accepted");

        env.fees().set(0, 0, false);
        bytes32 failedId = keccak256("adapter-failure");
        (bool adapterOk,) = address(router).call(
            abi.encodeWithSelector(router.executeSwapSettlement.selector, failedId, q, ALICE, BOB, 84, limits, 0, 0)
        );
        require(!adapterOk, "adapter failure accepted");
        require(!router.consumedPaymentAuthorization(failedId), "authorization consumed on revert");

        ReenteringPaySettlement420 reentrant = new ReenteringPaySettlement420(router);
        router.setSettlementAdapter(address(reentrant));
        router.executeSwapSettlement(keccak256("outer"), q, ALICE, BOB, 84, limits, 0, 0);
        require(!reentrant.reentrySucceeded(), "adapter gained reentrant settlement authority");
    }
}
