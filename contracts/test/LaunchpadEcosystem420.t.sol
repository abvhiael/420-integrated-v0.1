// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/apps/ProtocolRegistry.sol";
import "../src/apps/Identity420.sol";
import "../src/system/CapabilityRegistry420.sol";
import "../src/launchpad/LaunchpadIds420.sol";
import "../src/launchpad/LaunchpadAuthorization420.sol";
import "../src/launchpad/LaunchpadProjectRegistry420.sol";
import "../src/launchpad/LaunchpadSaleRegistry420.sol";
import "../src/launchpad/LaunchpadAllocationRegistry420.sol";
import "../src/launchpad/LaunchpadCrowdfundingIntegration420.sol";
import "../src/launchpad/LaunchpadRouter420.sol";
import "../src/arbitration/ArbitrationPolicyRegistry420.sol";
import "../src/arbitration/ArbitrationCaseRegistry420.sol";
import "../src/arbitration/ArbitrationRulingRegistry420.sol";
import "../src/pay/PayIds420.sol";
import "../src/pay/InvoiceRegistry420.sol";
import "../src/pay/MerchantRegistry420.sol";
import "../src/pay/PaymentRegistry420.sol";
import "../src/pay/PaymentRouter420.sol";
import "../src/pay/SettlementRouter420.sol";
import "../src/pay/CanonicalPayQuote420.sol";
import "../src/pay/adapters/CanonicalSettlementAdapter420.sol";
import "../src/swap/CanonicalMarketRegistry.sol";
import "../src/swap/CanonicalSwapExecutor420.sol";
import "../src/swap/CanonicalConstantProductPool420.sol";
import "../src/interfaces/genesis/Types420.sol";
import "../src/libraries/GenesisInterfaceIds420.sol";
import "../src/libraries/AppDependencyIds420.sol";
import "./helpers/GenesisMocks420.sol";

interface VmLaunchpadEcosystem420 {
    struct Log { bytes32[] topics; bytes data; address emitter; }
    function prank(address) external;
    function warp(uint256) external;
    function recordLogs() external;
    function getRecordedLogs() external returns (Log[] memory);
}

contract LaunchpadRec5Token420 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount; return true;
    }
    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "balance");
        balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true;
    }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        require(a >= amount && balanceOf[from] >= amount, "allowance");
        allowance[from][msg.sender] = a - amount;
        balanceOf[from] -= amount; balanceOf[to] += amount; return true;
    }
}

/// @notice REC-5 local cross-system qualification. Uses REAL Registry, Identity,
/// Pay, Swap, Arbitration, Launchpad and Capability contracts. Only external
/// Genesis safety/oracle authorities are controlled local test doubles.
/// Wallet caller, Explorer raw logs, Reputation evidence and Notifications
/// presentation are checked without granting any off-chain service authority.
contract LaunchpadEcosystem420Test {
    VmLaunchpadEcosystem420 internal constant vm =
        VmLaunchpadEcosystem420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address internal constant BACKER = address(0xA11CE);
    address internal constant CREATOR = address(0xBEEF);
    address internal constant OTHER = address(0xBAD);
    uint128 internal constant PRINCIPAL = 3 ether;
    // The canonical constant-product pool quotes exactly 3e18 settlement units
    // for this raw-token input against 10_000e18 / 10_000e18 reserves at 10 bps.
    // Launchpad must reject over-delivery as well as under-delivery: Pay's actual
    // settled principal is invoice-bound, not an arbitrary minimum-output quote.
    uint256 internal constant MAX_INPUT = 3_003_904_174_255_279_587;
    bytes32 internal constant ISSUER = keccak256("launchpad issuer");
    bytes32 internal constant PROFILE = keccak256("launchpad backer profile");
    bytes32 internal constant ELIGIBILITY = keccak256("launchpad eligibility");
    bytes32 internal constant MARKET = keccak256("launchpad pay swap market");
    bytes32 internal constant MERCHANT = keccak256("launchpad merchant");
    bytes32 internal constant CFG = keccak256("launchpad rec5 local genesis config");
    bytes32 internal constant META = keccak256("launchpad rec5 metadata");
    bytes32 internal constant MANIFEST = keccak256("launchpad rec5 manifest");
    bytes32 internal constant IFACE = keccak256("launchpad rec5 interface");
    bytes32 internal constant SALE_ASSET = keccak256("launchpad rec5 issuance");

    GenesisMockEnvironment420 internal env;
    ProtocolRegistry internal registry;
    CapabilityRegistry420 internal capabilities;
    LaunchpadAuthorization420 internal authorization;
    LaunchpadProjectRegistry420 internal projects;
    LaunchpadSaleRegistry420 internal sales;
    LaunchpadAllocationRegistry420 internal allocations;
    LaunchpadCrowdfundingIntegration420 internal crowdfunding;
    LaunchpadRouter420 internal launchpadRouter;

    Identity420 internal identity;
    ArbitrationPolicyRegistry420 internal policies;
    ArbitrationCaseRegistry420 internal cases;
    ArbitrationRulingRegistry420 internal rulings;
    PaymentRegistry420 internal payments;
    InvoiceRegistry420 internal invoices;
    MerchantRegistry420 internal merchants;
    PaymentRouter420 internal payRouter;
    SettlementRouter420 internal settlement;
    CanonicalPayQuote420 internal quotes;
    CanonicalMarketRegistry internal markets;
    CanonicalSwapExecutor420 internal swapExecutor;
    CanonicalSettlementAdapter420 internal swapAdapter;
    CanonicalConstantProductPool420 internal pool;
    LaunchpadRec5Token420 internal inputToken;
    LaunchpadRec5Token420 internal settleToken;

    bytes32 internal projectId;
    bytes32 internal saleId;

    function _publish(bytes32 id, address impl) internal {
        registry.registerComponent(id, impl, Types420.Version(1, 0, 0), Types420.Lifecycle.ACTIVE);
        require(registry.resolve(id) == impl && registry.runtimeCodeHash(id) == impl.codehash, "Registry binding");
    }

    function _setupPay() internal {
        inputToken = new LaunchpadRec5Token420();
        settleToken = new LaunchpadRec5Token420();
        payments = new PaymentRegistry420(address(this), address(registry), CFG);
        invoices = new InvoiceRegistry420(address(this), address(registry), CFG);
        merchants = new MerchantRegistry420(address(this), address(registry), CFG);
        payRouter = new PaymentRouter420(address(this), address(registry), CFG);
        settlement = new SettlementRouter420(address(this), address(registry), CFG);
        quotes = new CanonicalPayQuote420(address(this), address(registry), CFG, keccak256("accepted token policy"));
        markets = new CanonicalMarketRegistry(address(this), address(registry), CFG);
        swapExecutor = new CanonicalSwapExecutor420(address(this), address(registry), CFG);
        swapAdapter = new CanonicalSettlementAdapter420(address(this), address(registry), CFG, address(swapExecutor));

        _publish(payments.componentId(), address(payments));
        _publish(invoices.componentId(), address(invoices));
        _publish(merchants.componentId(), address(merchants));
        _publish(payRouter.componentId(), address(payRouter));
        _publish(settlement.componentId(), address(settlement));
        _publish(quotes.componentId(), address(quotes));
        _publish(markets.componentId(), address(markets));
        _publish(swapExecutor.componentId(), address(swapExecutor));
        _publish(swapAdapter.componentId(), address(swapAdapter));

        env.setSettlementAsset(address(inputToken), keccak256("launchpad input asset"), true);
        env.setSettlementAsset(address(settleToken), keccak256("launchpad settlement asset"), true);
        env.health().setMarket(MARKET, true);
        payRouter.setSettlementRouter(address(settlement));
        settlement.setPaymentRouter(address(payRouter));
        payRouter.setSettlementAdapter(address(swapAdapter));
        swapAdapter.setPaymentRouter(address(payRouter));
        swapExecutor.setTrustedCaller(address(swapAdapter), true);
        pool = new CanonicalConstantProductPool420(address(inputToken), address(settleToken), address(swapExecutor), 10);
        inputToken.mint(address(this), 10000 ether);
        settleToken.mint(address(this), 10000 ether);
        inputToken.approve(address(pool), 10000 ether);
        settleToken.approve(address(pool), 10000 ether);
        pool.addLiquidity(10000 ether, 10000 ether, 1, address(this));
        inputToken.mint(BACKER, MAX_INPUT);
        markets.setMarket(MARKET, address(pool), address(inputToken), address(settleToken),
            CanonicalMarketRegistry.Role.CANONICAL_CAD, bytes32(0), true);
        vm.prank(CREATOR);
        merchants.register(MERCHANT, bytes32(0), bytes32(0), CREATOR);
    }

    function _setupIdentityAndArbitration() internal {
        identity = new Identity420(address(this));
        identity.setIssuer(ISSUER, address(this), META, true);
        vm.prank(BACKER);
        identity.createProfile(PROFILE, META);
        identity.issueCredential(keccak256("eligible credential"), ISSUER, PROFILE, ELIGIBILITY, META, 0);
        require(identity.hasValidCredential(PROFILE, ELIGIBILITY), "real Identity credential");
        policies = new ArbitrationPolicyRegistry420(address(this));
        policies.setPolicy(keccak256("420/arbitration/domain/launchpad-crowdfunding/v1"),
            address(this), address(0), 100, 100, 0, true);
        cases = new ArbitrationCaseRegistry420(address(this), address(policies));
        rulings = new ArbitrationRulingRegistry420(address(cases));
        cases.bindRulingRegistry(address(rulings));
    }

    function _setupLaunchpad() internal {
        capabilities = new CapabilityRegistry420();
        authorization = new LaunchpadAuthorization420(address(capabilities));
        projects = new LaunchpadProjectRegistry420(address(this));
        sales = new LaunchpadSaleRegistry420(address(this), address(projects));
        allocations = new LaunchpadAllocationRegistry420(address(authorization), address(sales));
        sales.setController(address(allocations));
        crowdfunding = new LaunchpadCrowdfundingIntegration420(address(allocations), address(payments),
            address(identity), address(cases), address(rulings));
        allocations.setCrowdfundingIntegration(address(crowdfunding));
        launchpadRouter = new LaunchpadRouter420(address(sales), address(allocations));
        capabilities.registerProtocolComponent(LaunchpadIds420.COMPONENT_LAUNCHPAD, address(this));

        registry.registerComponent(LaunchpadIds420.COMPONENT_LAUNCHPAD, address(launchpadRouter),
            Types420.Version(1, 0, 0), Types420.Lifecycle.ACTIVE);
        registry.publishRegisteredService(keccak256("420/service/launchpad/v1"), address(launchpadRouter),
            META, 1, true, ProtocolRegistry.ComponentType.SERVICE, MANIFEST, META, IFACE);

        projectId = projects.canonicalId(CREATOR, address(0x7001), META, SALE_ASSET);
        projects.registerProject(projectId, CREATOR, address(0x7001), META, SALE_ASSET);
        saleId = sales.canonicalId(projectId, address(settleToken), CREATOR, 2 ether, 5 ether,
            5 ether, 10000, 100, 1000, 1001, ELIGIBILITY, bytes32(0));
        sales.createSale(saleId, projectId, address(settleToken), CREATOR, 2 ether, 5 ether,
            5 ether, 10000, 100, 1000, 1001, ELIGIBILITY, bytes32(0));
        crowdfunding.setCampaignMode(saleId, LaunchpadCrowdfundingIntegration420.CampaignMode.REWARD);
        _grant(LaunchpadIds420.ACTION_CONTRIBUTE, 5 ether);
        _grant(LaunchpadIds420.ACTION_CLAIM, 0);
        _grant(LaunchpadIds420.ACTION_REFUND, 5 ether);
        sales.activate(saleId);
        vm.prank(BACKER);
        crowdfunding.bindIdentity(PROFILE);
    }

    function _grant(bytes32 action, uint256 limit) internal {
        capabilities.createGrant(keccak256(abi.encode(saleId, action)), BACKER,
            LaunchpadIds420.COMPONENT_LAUNCHPAD, action, authorization.scopeSale(saleId),
            limit, 0, 0, 0, 0);
    }

    function setUp() public {
        vm.warp(100);
        env = new GenesisMockEnvironment420();
        registry = new ProtocolRegistry(address(this));
        _publish(GenesisInterfaceIds420.GOVERNANCE_AUTHORITY, address(env.governance()));
        _publish(GenesisInterfaceIds420.PAUSE_REGISTRY, address(env.pause()));
        _publish(GenesisInterfaceIds420.CANONICAL_ASSET_REGISTRY, address(env.assets()));
        _publish(GenesisInterfaceIds420.SETTLEMENT_HEALTH, address(env.health()));
        _publish(AppDependencyIds420.SYSTEM_SAFETY, address(env.safety()));
        _publish(AppDependencyIds420.CHAIN_CONTEXT, address(env.chain()));
        _publish(AppDependencyIds420.ASSET_CAPABILITIES, address(env.capabilities()));
        _publish(AppDependencyIds420.REPLAY_PROTECTION, address(env.replay()));
        _setupPay();
        _setupIdentityAndArbitration();
        _setupLaunchpad();
    }

    function _checkout() internal returns (bytes32 paymentId) {
        uint256 nonce = 9;
        vm.prank(BACKER);
        bytes32 invoiceId = crowdfunding.registerContributionIntent(saleId, PRINCIPAL, nonce);
        bytes32 acceptedAssets = quotes.conversionAssetCommitment(
            MARKET, address(inputToken), address(settleToken));
        vm.prank(CREATOR);
        invoices.createInvoice(invoiceId, InvoiceRegistry420.Invoice({
            merchantId: MERCHANT, merchant: CREATOR, metadataHash: bytes32(0), currency: bytes3("CAD"),
            amount: PRINCIPAL, expiresAt: 999, refundUntil: 1100,
            mode: InvoiceRegistry420.Mode.SINGLE_USE, acceptance: InvoiceRegistry420.Acceptance.FINALIZED,
            partialPayments: false, quoteMaxSlippageBps: 42,
            acceptedAssetsHash: acceptedAssets,
            settlementPlanHash: bytes32(0), tipPolicyHash: bytes32(0), active: true
        }));
        uint64 quotedAt = uint64(block.timestamp);
        CanonicalPayQuote420.ConversionRequest memory request_ =
            CanonicalPayQuote420.ConversionRequest(invoiceId, BACKER, nonce, quotedAt,
                MARKET, address(inputToken), address(settleToken), MAX_INPUT, PRINCIPAL);
        CanonicalPayQuote420.ConversionQuote memory quote = quotes.quoteConversion(request_);
        require(quote.swap.quotedSettlementAmount == PRINCIPAL, "Launchpad requires exact canonical Pay settlement");
        vm.prank(BACKER);
        inputToken.approve(address(pool), MAX_INPUT);
        vm.prank(BACKER);
        paymentId = payRouter.payConvertedInvoice(request_, quote.swap.quoteId);
        require(payments.getPayment(paymentId).status == PaymentRegistry420.Status.SETTLED, "real Pay settlement");
        require(invoices.isClosed(invoiceId) && payments.checkoutPaymentForInvoice(invoiceId) == paymentId,
            "Pay invoice and payment identity");
    }

    function _contribute() internal returns (bytes32 paymentId) {
        paymentId = _checkout();
        vm.prank(BACKER);
        allocations.contribute(saleId, PRINCIPAL, paymentId);
        require(allocations.contributed(saleId, BACKER) == PRINCIPAL, "canonical contribution");
    }

    function _assertEvent(VmLaunchpadEcosystem420.Log[] memory logs, address source,
        bytes32 signature, bytes32 indexedSale, uint256 salePosition) internal pure returns (bool) {
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter == source && logs[i].topics.length > salePosition
                && logs[i].topics[0] == signature && logs[i].topics[salePosition] == indexedSale) return true;
        }
        return false;
    }

    function testRealPayWalletIdentityRegistryAndExplorerEvidence() public {
        (address deployed, uint32 version) = registry.resolveActive(keccak256("420/service/launchpad/v1"));
        require(version == 1 && deployed == address(launchpadRouter), "frozen service discovery");
        require(registry.getService(keccak256("420/service/launchpad/v1")).codeHash ==
            address(launchpadRouter).codehash, "runtime codehash");
        vm.recordLogs();
        bytes32 paid = _contribute();
        VmLaunchpadEcosystem420.Log[] memory logs = vm.getRecordedLogs();
        require(_assertEvent(logs, address(payments),
            keccak256("PaymentSet(bytes32,bytes32,uint8)"), paid, 1), "Pay event for Explorer");
        require(_assertEvent(logs, address(allocations),
            keccak256("ContributionRecorded(bytes32,address,uint128,bytes32)"), saleId, 1),
            "Launchpad contribution for Explorer");
        require(_assertEvent(logs, address(crowdfunding),
            keccak256("NotificationPublished(bytes32,bytes32,address,bytes32,bytes32)"), saleId, 2),
            "420Notifications domain event missing");
        require(_assertEvent(logs, address(crowdfunding),
            keccak256("ReputationEvidencePublished(bytes32,bytes32,bytes32,address,bytes32,bytes32)"),
            saleId, 2), "420Reputation domain event missing");
        require(settleToken.balanceOf(CREATOR) == PRINCIPAL, "Pay merchant payout");
        vm.prank(OTHER);
        (bool ok,) = address(allocations).call(abi.encodeCall(allocations.contribute, (saleId, PRINCIPAL, paid)));
        require(!ok, "wrong Wallet account reused another participant payment");
    }

    function testRealPaymentReplayAndCredentialRevocationFailClosed() public {
        bytes32 paid = _contribute();
        vm.prank(BACKER);
        (bool replay,) = address(allocations).call(abi.encodeCall(allocations.contribute, (saleId, PRINCIPAL, paid)));
        require(!replay && sales.sale(saleId).raised == PRINCIPAL, "payment replay or accounting drift");
        identity.revokeCredential(keccak256("eligible credential"));
        require(!identity.hasValidCredential(PROFILE, ELIGIBILITY), "credential still active");
        vm.prank(BACKER);
        (bool nextIntent,) = address(crowdfunding).call(
            abi.encodeCall(crowdfunding.registerContributionIntent, (saleId, uint128(1 ether), uint256(10))));
        require(!nextIntent, "revoked 420Identity still authorized new Pay intent");
    }

    function testRealArbitrationFinalityAndNotificationBoundary() public {
        bytes32 domain = crowdfunding.CROWDFUNDING_DOMAIN();
        bytes32 caseId;
        vm.prank(BACKER);
        caseId = cases.openCase(domain, CREATOR, LaunchpadIds420.COMPONENT_LAUNCHPAD,
            saleId, keccak256("claim"), keccak256("remedy"));
        vm.prank(BACKER);
        crowdfunding.linkDispute(saleId, caseId);
        require(crowdfunding.disputeCase(saleId, BACKER) == caseId, "real arbitration origin");
        vm.prank(BACKER);
        (bool duplicate,) = address(crowdfunding).call(abi.encodeCall(crowdfunding.linkDispute,(saleId,caseId)));
        require(!duplicate, "dispute replay accepted");
        vm.recordLogs();
        rulings.submitRuling(caseId, 1, keccak256("ruling"), keccak256("remedy"), keccak256("panel"));
        vm.warp(202);
        rulings.finalizeRuling(caseId);
        crowdfunding.publishFinalizedDisputeOutcome(saleId, BACKER);
        require(crowdfunding.publishedDisputeOutcome(caseId), "published finality");
        require(_assertEvent(vm.getRecordedLogs(), address(crowdfunding),
            keccak256("NotificationPublished(bytes32,bytes32,address,bytes32,bytes32)"), saleId, 2),
            "ruling notification missing");
    }

    function testRealClaimProducesDeliveryReputationAndNotificationWithoutDoubleClaim() public {
        _contribute();
        vm.warp(1002);
        sales.finalize(saleId);
        bytes32 delivery = keccak256("verified delivery commitment");
        vm.prank(CREATOR);
        crowdfunding.attestDelivery(saleId, BACKER, delivery);
        vm.recordLogs();
        vm.prank(BACKER);
        allocations.claim(saleId, delivery);
        VmLaunchpadEcosystem420.Log[] memory logs = vm.getRecordedLogs();
        require(_assertEvent(logs, address(crowdfunding),
            keccak256("ReputationEvidencePublished(bytes32,bytes32,bytes32,address,bytes32,bytes32)"),
            saleId, 2), "delivery reputation evidence absent");
        require(_assertEvent(logs, address(crowdfunding),
            keccak256("NotificationPublished(bytes32,bytes32,address,bytes32,bytes32)"), saleId, 2),
            "delivery notification absent");
        vm.prank(BACKER);
        (bool repeat,) = address(allocations).call(abi.encodeCall(allocations.claim,(saleId,delivery)));
        require(!repeat && allocations.claimed(saleId,BACKER)>0, "duplicate claim accepted");
    }

    function testRegistryRevocationBlocksCheckoutWithoutRebinding() public {
        vm.prank(BACKER);
        crowdfunding.registerContributionIntent(saleId, PRINCIPAL, 9);
        registry.setComponentLifecycle(PayIds420.INVOICE_REGISTRY, Types420.Lifecycle.PAUSED);
        vm.prank(BACKER);
        (bool accepted,) = address(crowdfunding).call(
            abi.encodeCall(crowdfunding.registerContributionIntent,(saleId, PRINCIPAL, uint256(10))));
        require(!accepted, "disabled Registry invoice accepted");
    }

    function testForeignArbitrationOriginCannotBeLinked() public {
        vm.prank(BACKER);
        bytes32 wrong = cases.openCase(crowdfunding.CROWDFUNDING_DOMAIN(), CREATOR,
            LaunchpadIds420.COMPONENT_LAUNCHPAD, keccak256("another sale"),
            keccak256("claim"), keccak256("remedy"));
        vm.prank(BACKER);
        (bool linked,) = address(crowdfunding).call(abi.encodeCall(crowdfunding.linkDispute,(saleId,wrong)));
        require(!linked && crowdfunding.disputeCase(saleId,BACKER)==bytes32(0), "substituted case accepted");
    }
}
