// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/interfaces/genesis/IIdentityCredential420.sol";
import "../src/launchpad/LaunchpadAuthorization420.sol";
import "../src/launchpad/LaunchpadProjectRegistry420.sol";
import "../src/launchpad/LaunchpadSaleRegistry420.sol";
import "../src/launchpad/LaunchpadAllocationRegistry420.sol";
import "../src/launchpad/LaunchpadCrowdfundingIntegration420.sol";

interface VmLaunchpadCrowdfunding420 {
    function warp(
        uint256
    ) external;

    function prank(
        address
    ) external;

    function expectRevert(
        bytes4
    ) external;
}

contract MockCrowdfundingCapabilities420 is ICapabilityRegistry420 {
    bool internal allowed = true;

    function setAllowed(
        bool value
    ) external {
        allowed = value;
    }

    function grant(
        bytes32
    ) external pure override returns (CapabilityGrant memory g) {
        return g;
    }

    function isAuthorized(
        address,
        bytes32,
        bytes32,
        bytes32,
        uint256
    ) external view override returns (bool) {
        return allowed;
    }
}

contract MockLaunchpadPay420 is ILaunchpadPaymentRegistry420 {
    struct PaymentData {
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
        uint8 status;
    }

    mapping(bytes32 => PaymentData) internal records;
    mapping(bytes32 => address) public merchantOf;
    mapping(bytes32 => uint64) public expiresAtOf;
    mapping(bytes32 => bytes32) public checkoutPaymentForInvoice;
    mapping(bytes32 => bool) public isClosed;
    mapping(bytes32 => uint8) public invoiceMode;

    function getInvoice(bytes32 invoiceId) external view returns (ILaunchpadInvoice420.Invoice memory invoice) {
        invoice.merchant = merchantOf[invoiceId];
        invoice.expiresAt = expiresAtOf[invoiceId];
        invoice.mode = invoiceMode[invoiceId];
        invoice.active = true;
    }

    function setInvoiceMode(bytes32 invoiceId, uint8 mode) external { invoiceMode[invoiceId] = mode; }
    function setCheckout(bytes32 invoiceId, bytes32 paymentId) external { checkoutPaymentForInvoice[invoiceId] = paymentId; }
    mapping(bytes32 => uint256) public deliveredByPayment;

    function registry() external view returns (address) { return address(this); }
    function paymentRegistry() external view returns (address) { return address(this); }
    function resolve(bytes32) external view returns (address) { return address(this); }
    function runtimeCodeHash(bytes32) external view returns (bytes32) { return address(this).codehash; }

    function setInvoice(bytes32 paymentId, bytes32 invoiceId, uint64 expiry) external {
        records[paymentId].invoiceId = invoiceId;
        merchantOf[invoiceId] = records[paymentId].merchant;
        expiresAtOf[invoiceId] = expiry;
        checkoutPaymentForInvoice[invoiceId] = paymentId;
        isClosed[invoiceId] = true;
    }

    function setDelivered(bytes32 paymentId, uint256 amount) external {
        deliveredByPayment[paymentId] = amount;
    }

    function setTip(bytes32 paymentId, uint256 amount) external {
        records[paymentId].tipAmount = amount;
    }

    function setPayment(
        bytes32 paymentId,
        address payer,
        address merchant,
        address settlementAsset,
        uint256 settlementAmount,
        uint8 status,
        uint256 refundedAmount
    ) external {
        records[paymentId] = PaymentData({
            invoiceId: records[paymentId].invoiceId == bytes32(0)
                ? keccak256(abi.encode("invoice", paymentId)) : records[paymentId].invoiceId,
            payer: payer,
            merchant: merchant,
            inputAsset: settlementAsset,
            inputAmount: settlementAmount,
            settlementAsset: settlementAsset,
            settlementAmount: settlementAmount,
            quoteId: bytes32(0),
            payerNonce: uint256(paymentId),
            receiptHash: keccak256(abi.encode("receipt", paymentId)),
            tipAmount: 0,
            refundedAmount: refundedAmount,
            status: status
        });
    }

    function payments(
        bytes32 paymentId
    )
        external
        view
        override
        returns (
            bytes32 invoiceId,
            address payer,
            address merchant,
            address inputAsset,
            uint256 inputAmount,
            address settlementAsset,
            uint256 settlementAmount,
            bytes32 quoteId,
            uint256 payerNonce,
            bytes32 receiptHash,
            uint256 tipAmount,
            uint256 refundedAmount,
            uint8 status
        )
    {
        PaymentData memory payment = records[paymentId];
        return (
            payment.invoiceId,
            payment.payer,
            payment.merchant,
            payment.inputAsset,
            payment.inputAmount,
            payment.settlementAsset,
            payment.settlementAmount,
            payment.quoteId,
            payment.payerNonce,
            payment.receiptHash,
            payment.tipAmount,
            payment.refundedAmount,
            payment.status
        );
    }
}

contract MockLaunchpadIdentity420 is ILaunchpadIdentity420 {
    struct ProfileData {
        address controller;
        bool active;
    }

    mapping(bytes32 => ProfileData) internal profileRecords;
    mapping(bytes32 => mapping(bytes32 => bool)) internal validCredential;

    function setProfile(
        bytes32 profileId,
        address controller,
        bool active
    ) external {
        profileRecords[profileId] = ProfileData(controller, active);
    }

    function setCredential(
        bytes32 profileId,
        bytes32 credentialType,
        bool valid
    ) external {
        validCredential[profileId][credentialType] = valid;
    }

    function profiles(
        bytes32 profileId
    )
        external
        view
        override
        returns (
            address controller,
            address pendingController,
            bytes32 metadataHash,
            bytes32 primaryName,
            uint64 createdAt,
            uint64 updatedAt,
            bool active
        )
    {
        ProfileData memory profile = profileRecords[profileId];
        return (profile.controller, address(0), bytes32(0), bytes32(0), 1, 1, profile.active);
    }

    function credential(
        bytes32
    ) external pure override returns (CredentialView memory view_) {
        return view_;
    }

    function hasValidCredential(
        bytes32 subjectId,
        bytes32 credentialType
    ) external view override returns (bool) {
        return validCredential[subjectId][credentialType];
    }
}

contract MockLaunchpadArbitrationCases420 is ILaunchpadArbitrationCases420 {
    struct CaseData {
        address claimant;
        address respondent;
        bytes32 domainId;
        bytes32 originComponentId;
        bytes32 originObjectId;
        uint8 state;
        uint8 round;
    }

    mapping(bytes32 => CaseData) internal records;

    function setCase(
        bytes32 caseId,
        address claimant,
        address respondent,
        bytes32 domainId,
        bytes32 originComponentId,
        bytes32 originObjectId,
        uint8 state,
        uint8 round
    ) external {
        records[caseId] = CaseData(claimant, respondent, domainId, originComponentId, originObjectId, state, round);
    }

    function caseOrigin(
        bytes32 caseId
    )
        external
        view
        override
        returns (
            address claimant,
            address respondent,
            bytes32 domainId,
            bytes32 originComponentId,
            bytes32 originObjectId,
            uint8 state
        )
    {
        CaseData memory record = records[caseId];
        return (
            record.claimant,
            record.respondent,
            record.domainId,
            record.originComponentId,
            record.originObjectId,
            record.state
        );
    }

    function caseRound(
        bytes32 caseId
    ) external view override returns (uint8) {
        return records[caseId].round;
    }
}

contract MockLaunchpadArbitrationRulings420 is ILaunchpadArbitrationRulings420 {
    address internal immutable caseRegistry;
    mapping(bytes32 => mapping(uint8 => Ruling)) internal records;

    constructor(
        address cases_
    ) {
        caseRegistry = cases_;
    }

    function cases() external view override returns (address) {
        return caseRegistry;
    }

    function setRuling(
        bytes32 caseId,
        uint8 round,
        uint32 outcomeCode,
        bytes32 rulingHash,
        bytes32 remedyCommitment
    ) external {
        records[caseId][round] = Ruling({
            outcomeCode: outcomeCode,
            rulingHash: rulingHash,
            remedyCommitment: remedyCommitment,
            panelCommitment: keccak256("panel"),
            resolver: address(this),
            ruledAt: uint64(block.timestamp),
            exists: true
        });
    }

    function getRuling(
        bytes32 caseId,
        uint8 round
    ) external view override returns (Ruling memory) {
        return records[caseId][round];
    }
}

contract LaunchpadCrowdfundingIntegration420Test {
    VmLaunchpadCrowdfunding420 internal constant vm =
        VmLaunchpadCrowdfunding420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    address internal constant PAYMENT_ASSET = address(0x420);
    address internal constant SALE_ASSET = address(0x7001);
    address internal constant RECEIVER = address(0xBEEF);

    bytes32 internal constant ELIGIBILITY = keccak256("launchpad/eligibility/backer/v1");
    bytes32 internal constant PROFILE_ALICE = keccak256("profile/alice");

    MockCrowdfundingCapabilities420 internal caps;
    MockLaunchpadPay420 internal pay;
    MockLaunchpadIdentity420 internal identity;
    MockLaunchpadArbitrationCases420 internal cases;
    MockLaunchpadArbitrationRulings420 internal rulings;
    LaunchpadProjectRegistry420 internal projects;
    LaunchpadSaleRegistry420 internal sales;
    LaunchpadAllocationRegistry420 internal allocations;
    LaunchpadCrowdfundingIntegration420 internal integration;

    bytes32 internal projectId;
    bytes32 internal saleId;

    function setUp() public {
        caps = new MockCrowdfundingCapabilities420();
        pay = new MockLaunchpadPay420();
        identity = new MockLaunchpadIdentity420();
        cases = new MockLaunchpadArbitrationCases420();
        rulings = new MockLaunchpadArbitrationRulings420(address(cases));

        LaunchpadAuthorization420 authorization = new LaunchpadAuthorization420(address(caps));
        projects = new LaunchpadProjectRegistry420(address(this));
        sales = new LaunchpadSaleRegistry420(address(this), address(projects));
        allocations = new LaunchpadAllocationRegistry420(address(authorization), address(sales));
        sales.setController(address(allocations));

        projectId =
            projects.canonicalId(address(this), SALE_ASSET, keccak256("project/meta"), keccak256("project/issuance"));
        projects.registerProject(
            projectId, address(this), SALE_ASSET, keccak256("project/meta"), keccak256("project/issuance")
        );

        saleId = sales.canonicalId(
            projectId, PAYMENT_ASSET, RECEIVER, 500, 1000, 600, 10000, 10, 20, 30, ELIGIBILITY, bytes32(0)
        );
        sales.createSale(
            saleId, projectId, PAYMENT_ASSET, RECEIVER, 500, 1000, 600, 10000, 10, 20, 30, ELIGIBILITY, bytes32(0)
        );

        integration = new LaunchpadCrowdfundingIntegration420(
            address(allocations), address(pay), address(identity), address(cases), address(rulings)
        );
        allocations.setCrowdfundingIntegration(address(integration));
        integration.setCampaignMode(saleId, LaunchpadCrowdfundingIntegration420.CampaignMode.REWARD);

        identity.setProfile(PROFILE_ALICE, ALICE, true);
        identity.setCredential(PROFILE_ALICE, ELIGIBILITY, true);
        vm.prank(ALICE);
        integration.bindIdentity(PROFILE_ALICE);
    }

    function testOnlyApprovedGenesisCampaignModesAreRepresentable() public {
        bytes32 donation =
            _createModeSale(LaunchpadCrowdfundingIntegration420.CampaignMode.DONATION, bytes32(uint256(1)));
        bytes32 community =
            _createModeSale(LaunchpadCrowdfundingIntegration420.CampaignMode.COMMUNITY_PROJECT, bytes32(uint256(2)));
        bytes32 preorder =
            _createModeSale(LaunchpadCrowdfundingIntegration420.CampaignMode.PRODUCT_PREORDER, bytes32(uint256(3)));

        require(
            integration.campaignMode(saleId) == LaunchpadCrowdfundingIntegration420.CampaignMode.REWARD, "reward mode"
        );
        require(
            integration.campaignMode(donation) == LaunchpadCrowdfundingIntegration420.CampaignMode.DONATION,
            "donation mode"
        );
        require(
            integration.campaignMode(community) == LaunchpadCrowdfundingIntegration420.CampaignMode.COMMUNITY_PROJECT,
            "community mode"
        );
        require(
            integration.campaignMode(preorder) == LaunchpadCrowdfundingIntegration420.CampaignMode.PRODUCT_PREORDER,
            "preorder mode"
        );

        sales.activate(donation);
        sales.activate(community);
        sales.activate(preorder);
        vm.warp(43);

        bytes32 donationPayment = keccak256("payment/donation");
        bytes32 communityPayment = keccak256("payment/community");
        bytes32 preorderPayment = keccak256("payment/preorder");
        pay.setPayment(donationPayment, ALICE, RECEIVER, PAYMENT_ASSET, 100, 5, 0);
        _bindPayment(donation, donationPayment, 100);
        pay.setPayment(communityPayment, ALICE, RECEIVER, PAYMENT_ASSET, 100, 5, 0);
        _bindPayment(community, communityPayment, 100);
        pay.setPayment(preorderPayment, ALICE, RECEIVER, PAYMENT_ASSET, 100, 5, 0);
        _bindPayment(preorder, preorderPayment, 100);

        vm.prank(ALICE);
        allocations.contribute(donation, 100, donationPayment);
        vm.prank(ALICE);
        allocations.contribute(community, 100, communityPayment);
        vm.prank(ALICE);
        allocations.contribute(preorder, 100, preorderPayment);

        require(allocations.contributed(donation, ALICE) == 100, "donation contribution");
        require(allocations.contributed(community, ALICE) == 100, "community contribution");
        require(allocations.contributed(preorder, ALICE) == 100, "preorder contribution");

        vm.expectRevert(LaunchpadCrowdfundingIntegration420.InvalidCampaignMode.selector);
        integration.setCampaignMode(saleId, LaunchpadCrowdfundingIntegration420.CampaignMode.DONATION);
    }

    function testCrowdfundingIntegrationIsOneShotGovernanceBinding() public {
        vm.expectRevert(LaunchpadAllocationRegistry420.InvalidIntegration.selector);
        allocations.setCrowdfundingIntegration(address(integration));

        vm.prank(ALICE);
        vm.expectRevert(LaunchpadAllocationRegistry420.UnauthorizedAction.selector);
        allocations.setCrowdfundingIntegration(address(0x1234));
    }

    function testCannotBindIntegrationToForeignAllocationGraph() public {
        LaunchpadSaleRegistry420 otherSales = new LaunchpadSaleRegistry420(address(this), address(projects));
        LaunchpadAllocationRegistry420 other = new LaunchpadAllocationRegistry420(
            address(allocations.authorization()), address(otherSales)
        );
        otherSales.setController(address(other));
        vm.expectRevert(LaunchpadAllocationRegistry420.InvalidIntegration.selector);
        other.setCrowdfundingIntegration(address(integration));
    }

    function testCannotBindAfterOpaqueV1Contribution() public {
        LaunchpadSaleRegistry420 otherSales = new LaunchpadSaleRegistry420(address(this), address(projects));
        LaunchpadAllocationRegistry420 other = new LaunchpadAllocationRegistry420(
            address(allocations.authorization()), address(otherSales)
        );
        otherSales.setController(address(other));
        otherSales.createSale(
            saleId, projectId, PAYMENT_ASSET, RECEIVER, 500, 1000, 600, 10000, 10, 20, 30, ELIGIBILITY, bytes32(0)
        );
        otherSales.activate(saleId);
        vm.warp(10);
        vm.prank(ALICE);
        other.contribute(saleId, 100, keccak256("opaque-payment"));
        LaunchpadCrowdfundingIntegration420 newIntegration = new LaunchpadCrowdfundingIntegration420(
            address(other), address(pay), address(identity), address(cases), address(rulings)
        );
        vm.expectRevert(LaunchpadAllocationRegistry420.InvalidIntegration.selector);
        other.setCrowdfundingIntegration(address(newIntegration));
        require(other.crowdfundingIntegration() == address(0), "late integration bound");
        require(other.contributed(saleId, ALICE) == 100, "base contribution damaged");
    }

    function testSettledPayAndIdentityAreRequiredForContribution() public {
        sales.activate(saleId);
        vm.warp(10);

        bytes32 paymentId = keccak256("payment/settled");
        pay.setPayment(paymentId, ALICE, RECEIVER, PAYMENT_ASSET, 500, 5, 0);
        _bindPayment(saleId, paymentId, 500);

        vm.prank(ALICE);
        allocations.contribute(saleId, 500, paymentId);

        require(allocations.contributed(saleId, ALICE) == 500, "canonical contribution");
        require(integration.usedPaymentId(paymentId), "payment replay lock");
        require(integration.profileAtSale(saleId, ALICE) == PROFILE_ALICE, "identity frozen");
    }

    function testContributionRejectsUnsettledWrongPartyAssetAndAmount() public {
        sales.activate(saleId);
        vm.warp(10);

        bytes32 unsettled = keccak256("payment/unsettled");
        pay.setPayment(unsettled, ALICE, RECEIVER, PAYMENT_ASSET, 100, 4, 0);
        vm.prank(ALICE);
        vm.expectRevert(LaunchpadCrowdfundingIntegration420.InvalidSettlement.selector);
        allocations.contribute(saleId, 100, unsettled);

        bytes32 wrongPayer = keccak256("payment/wrong-payer");
        pay.setPayment(wrongPayer, BOB, RECEIVER, PAYMENT_ASSET, 100, 5, 0);
        vm.prank(ALICE);
        vm.expectRevert(LaunchpadCrowdfundingIntegration420.InvalidSettlement.selector);
        allocations.contribute(saleId, 100, wrongPayer);

        bytes32 wrongMerchant = keccak256("payment/wrong-merchant");
        pay.setPayment(wrongMerchant, ALICE, BOB, PAYMENT_ASSET, 100, 5, 0);
        vm.prank(ALICE);
        vm.expectRevert(LaunchpadCrowdfundingIntegration420.InvalidSettlement.selector);
        allocations.contribute(saleId, 100, wrongMerchant);

        bytes32 wrongAsset = keccak256("payment/wrong-asset");
        pay.setPayment(wrongAsset, ALICE, RECEIVER, address(0x999), 100, 5, 0);
        vm.prank(ALICE);
        vm.expectRevert(LaunchpadCrowdfundingIntegration420.InvalidSettlement.selector);
        allocations.contribute(saleId, 100, wrongAsset);

        bytes32 wrongAmount = keccak256("payment/wrong-amount");
        pay.setPayment(wrongAmount, ALICE, RECEIVER, PAYMENT_ASSET, 101, 5, 0);
        vm.prank(ALICE);
        vm.expectRevert(LaunchpadCrowdfundingIntegration420.InvalidSettlement.selector);
        allocations.contribute(saleId, 100, wrongAmount);
    }

    function testContributionRejectsMissingOrInvalidIdentityEligibility() public {
        sales.activate(saleId);
        vm.warp(10);
        bytes32 paymentId = keccak256("payment/identity");
        pay.setPayment(paymentId, BOB, RECEIVER, PAYMENT_ASSET, 100, 5, 0);

        vm.prank(BOB);
        vm.expectRevert(LaunchpadCrowdfundingIntegration420.InvalidIdentity.selector);
        allocations.contribute(saleId, 100, paymentId);

        bytes32 profileBob = keccak256("profile/bob");
        identity.setProfile(profileBob, BOB, true);
        vm.prank(BOB);
        integration.bindIdentity(profileBob);

        vm.prank(BOB);
        vm.expectRevert(LaunchpadCrowdfundingIntegration420.InvalidIdentity.selector);
        allocations.contribute(saleId, 100, paymentId);
    }

    function testPaymentReplayIsRejectedAcrossContributionAttempts() public {
        sales.activate(saleId);
        vm.warp(10);
        bytes32 paymentId = keccak256("payment/replay");
        pay.setPayment(paymentId, ALICE, RECEIVER, PAYMENT_ASSET, 100, 5, 0);
        _bindPayment(saleId, paymentId, 100);

        vm.prank(ALICE);
        allocations.contribute(saleId, 100, paymentId);

        vm.prank(ALICE);
        vm.expectRevert(LaunchpadCrowdfundingIntegration420.Replay.selector);
        allocations.contribute(saleId, 100, paymentId);
    }

    function testCanonicalRefundBatchRequiredBeforeLaunchpadRefundRecord() public {
        sales.activate(saleId);
        vm.warp(10);

        bytes32 paymentA = keccak256("payment/refund/a");
        bytes32 paymentB = keccak256("payment/refund/b");
        pay.setPayment(paymentA, ALICE, RECEIVER, PAYMENT_ASSET, 200, 5, 0);
        _bindPayment(saleId, paymentA, 200);
        pay.setPayment(paymentB, ALICE, RECEIVER, PAYMENT_ASSET, 200, 5, 0);
        _bindPayment(saleId, paymentB, 200);

        vm.prank(ALICE);
        allocations.contribute(saleId, 200, paymentA);
        vm.prank(ALICE);
        allocations.contribute(saleId, 200, paymentB);

        vm.warp(21);
        sales.finalize(saleId);

        vm.prank(ALICE);
        vm.expectRevert(LaunchpadCrowdfundingIntegration420.InvalidRefund.selector);
        integration.prepareRefund(saleId);

        pay.setPayment(paymentA, ALICE, RECEIVER, PAYMENT_ASSET, 200, 6, 200);
        pay.setPayment(paymentB, ALICE, RECEIVER, PAYMENT_ASSET, 200, 6, 200);

        // Canonical authorization and a partially delivered refund are insufficient.
        vm.prank(ALICE);
        vm.expectRevert(LaunchpadCrowdfundingIntegration420.InvalidRefund.selector);
        integration.prepareRefund(saleId);
        pay.setDelivered(paymentA, 100);
        pay.setDelivered(paymentB, 200);
        require(integration.reconcileRecordedRefund(paymentA) == 100, "partial delivered principal");
        require(integration.reconcileRecordedRefund(paymentA) == 100, "idempotent partial reconciliation");
        require(integration.reconciledSaleRefundPrincipal(saleId) == 100, "partial accounting doubled");
        vm.prank(ALICE);
        vm.expectRevert(LaunchpadCrowdfundingIntegration420.InvalidRefund.selector);
        integration.prepareRefund(saleId);
        pay.setDelivered(paymentA, 200);

        vm.prank(ALICE);
        bytes32 refundCommitment = integration.prepareRefund(saleId);

        // Verify the second phase checks the live canonical delivery ledger again.
        pay.setDelivered(paymentA, 100);
        vm.prank(ALICE);
        vm.expectRevert(LaunchpadCrowdfundingIntegration420.InvalidRefund.selector);
        allocations.recordRefund(saleId, refundCommitment);
        pay.setDelivered(paymentA, 200);

        vm.prank(ALICE);
        allocations.recordRefund(saleId, refundCommitment);

        require(allocations.refunded(saleId, ALICE), "refund recorded");
        require(integration.usedRefundCommitment(refundCommitment), "refund replay lock");
        require(integration.reconciledSaleRefundPrincipal(saleId) == 400, "delivered aggregate");
        require(integration.reconciledParticipantRefundPrincipal(saleId, ALICE) == 400, "participant aggregate");
    }

    function testSuccessfulClaimPublishesReplayProtectedDeliveryEvidence() public {
        sales.activate(saleId);
        vm.warp(10);
        bytes32 paymentId = keccak256("payment/delivery");
        pay.setPayment(paymentId, ALICE, RECEIVER, PAYMENT_ASSET, 500, 5, 0);
        _bindPayment(saleId, paymentId, 500);

        vm.prank(ALICE);
        allocations.contribute(saleId, 500, paymentId);

        vm.warp(21);
        sales.finalize(saleId);
        vm.warp(30);

        bytes32 delivery = keccak256("delivery/reward");
        vm.prank(ALICE);
        vm.expectRevert(LaunchpadCrowdfundingIntegration420.InvalidDelivery.selector);
        allocations.claim(saleId, delivery);
        vm.prank(ALICE);
        vm.expectRevert(LaunchpadCrowdfundingIntegration420.InvalidDelivery.selector);
        integration.attestDelivery(saleId, ALICE, delivery);

        integration.attestDelivery(saleId, ALICE, delivery);
        vm.prank(ALICE);
        allocations.claim(saleId, delivery);

        require(integration.usedDeliveryCommitment(delivery), "delivery replay lock");
        require(allocations.claimed(saleId, ALICE) == 10000, "allocation claimed");
        vm.prank(ALICE);
        vm.expectRevert(LaunchpadAllocationRegistry420.NotClaimable.selector);
        allocations.claim(saleId, delivery);
    }

    function testDisputeMustMatchCanonicalArbitrationOriginAndProjectController() public {
        bytes32 caseId = keccak256("case/launchpad");
        cases.setCase(
            caseId,
            ALICE,
            address(this),
            integration.CROWDFUNDING_DOMAIN(),
            keccak256("420/COMPONENT/LAUNCHPAD/V1"),
            saleId,
            1,
            0
        );

        vm.prank(ALICE);
        integration.linkDispute(saleId, caseId);
        require(integration.disputeCase(saleId, ALICE) == caseId, "case linked");

        bytes32 wrongCase = keccak256("case/wrong-origin");
        cases.setCase(
            wrongCase,
            BOB,
            address(this),
            integration.CROWDFUNDING_DOMAIN(),
            keccak256("420/COMPONENT/LAUNCHPAD/V1"),
            keccak256("other-sale"),
            1,
            0
        );

        vm.prank(BOB);
        vm.expectRevert(LaunchpadCrowdfundingIntegration420.InvalidDispute.selector);
        integration.linkDispute(saleId, wrongCase);
    }

    function testFinalizedDisputeOutcomePublishesOnceWithoutExecutingRemedy() public {
        bytes32 caseId = keccak256("case/final");
        cases.setCase(
            caseId,
            ALICE,
            address(this),
            integration.CROWDFUNDING_DOMAIN(),
            keccak256("420/COMPONENT/LAUNCHPAD/V1"),
            saleId,
            1,
            0
        );
        vm.prank(ALICE);
        integration.linkDispute(saleId, caseId);

        cases.setCase(
            caseId,
            ALICE,
            address(this),
            integration.CROWDFUNDING_DOMAIN(),
            keccak256("420/COMPONENT/LAUNCHPAD/V1"),
            saleId,
            3,
            0
        );
        rulings.setRuling(caseId, 0, 1, keccak256("ruling/final"), keccak256("remedy/refund-or-cancel-review"));

        integration.publishFinalizedDisputeOutcome(saleId, ALICE);
        require(integration.publishedDisputeOutcome(caseId), "ruling published");

        vm.expectRevert(LaunchpadCrowdfundingIntegration420.DisputeOutcomeUnavailable.selector);
        integration.publishFinalizedDisputeOutcome(saleId, ALICE);

        require(
            sales.sale(saleId).state == LaunchpadSaleRegistry420.State.SCHEDULED,
            "arbitration cannot cancel sale directly"
        );
    }

    function testPublicationRechecksCanonicalOriginAndRejectsStaleRound() public {
        bytes32 caseId = keccak256("case/recheck");
        bytes32 domain = integration.CROWDFUNDING_DOMAIN();
        bytes32 component = keccak256("420/COMPONENT/LAUNCHPAD/V1");
        bytes32 rulingHash = keccak256("ruling/recheck");
        bytes32 remedy = keccak256("remedy/recheck");
        cases.setCase(caseId, ALICE, address(this), domain, component, saleId, 1, 0);
        vm.prank(ALICE);
        integration.linkDispute(saleId, caseId);

        // A ruled but nonfinal case must not publish an outcome.
        rulings.setRuling(caseId, 0, 1, rulingHash, remedy);
        cases.setCase(caseId, ALICE, address(this), domain, component, saleId, 2, 0);
        vm.expectRevert(LaunchpadCrowdfundingIntegration420.DisputeOutcomeUnavailable.selector);
        integration.publishFinalizedDisputeOutcome(saleId, ALICE);

        // Wrong origin, domain, respondent and claimant must each fail at the
        // consumption boundary, even if the case was previously linked.
        cases.setCase(caseId, ALICE, address(this), domain, component, keccak256("wrong-sale"), 3, 0);
        vm.expectRevert(LaunchpadCrowdfundingIntegration420.DisputeOutcomeUnavailable.selector);
        integration.publishFinalizedDisputeOutcome(saleId, ALICE);
        cases.setCase(caseId, ALICE, address(this), keccak256("wrong-domain"), component, saleId, 3, 0);
        vm.expectRevert(LaunchpadCrowdfundingIntegration420.DisputeOutcomeUnavailable.selector);
        integration.publishFinalizedDisputeOutcome(saleId, ALICE);
        cases.setCase(caseId, ALICE, BOB, domain, component, saleId, 3, 0);
        vm.expectRevert(LaunchpadCrowdfundingIntegration420.DisputeOutcomeUnavailable.selector);
        integration.publishFinalizedDisputeOutcome(saleId, ALICE);
        cases.setCase(caseId, BOB, address(this), domain, component, saleId, 3, 0);
        vm.expectRevert(LaunchpadCrowdfundingIntegration420.DisputeOutcomeUnavailable.selector);
        integration.publishFinalizedDisputeOutcome(saleId, ALICE);
        cases.setCase(caseId, ALICE, address(this), domain, keccak256("wrong-component"), saleId, 3, 0);
        vm.expectRevert(LaunchpadCrowdfundingIntegration420.DisputeOutcomeUnavailable.selector);
        integration.publishFinalizedDisputeOutcome(saleId, ALICE);

        cases.setCase(caseId, ALICE, address(this), domain, component, saleId, 3, 1);
        // Ruling for round zero is stale following an appeal.
        vm.expectRevert(LaunchpadCrowdfundingIntegration420.DisputeOutcomeUnavailable.selector);
        integration.publishFinalizedDisputeOutcome(saleId, ALICE);

        rulings.setRuling(caseId, 1, 1, rulingHash, bytes32(0));
        vm.expectRevert(LaunchpadCrowdfundingIntegration420.DisputeOutcomeUnavailable.selector);
        integration.publishFinalizedDisputeOutcome(saleId, ALICE);
        rulings.setRuling(caseId, 1, 1, rulingHash, remedy);
        integration.publishFinalizedDisputeOutcome(saleId, ALICE);
        require(integration.publishedDisputeOutcome(caseId), "current finalized round published");
        vm.expectRevert(LaunchpadCrowdfundingIntegration420.DisputeOutcomeUnavailable.selector);
        integration.publishFinalizedDisputeOutcome(saleId, ALICE);
    }

    function testRegisteredCampaignInvoiceCannotBeSubstituted() public {
        bytes32 other = sales.canonicalId(
            projectId, PAYMENT_ASSET, RECEIVER, 500, 1000, 600, 10000, 10, 20, 30, ELIGIBILITY, bytes32(uint256(9))
        );
        sales.createSale(
            other, projectId, PAYMENT_ASSET, RECEIVER, 500, 1000, 600, 10000, 10, 20, 30,
            ELIGIBILITY, bytes32(uint256(9))
        );
        integration.setCampaignMode(other, LaunchpadCrowdfundingIntegration420.CampaignMode.REWARD);
        sales.activate(other);
        sales.activate(saleId);
        vm.warp(10);
        bytes32 paymentId = keccak256("payment/unrelated");
        pay.setPayment(paymentId, ALICE, RECEIVER, PAYMENT_ASSET, 100, 5, 0);
        vm.prank(ALICE);
        vm.expectRevert(LaunchpadCrowdfundingIntegration420.InvalidSettlement.selector);
        allocations.contribute(saleId, 100, paymentId);

        _bindPayment(saleId, paymentId, 100);
        vm.prank(ALICE);
        vm.expectRevert(LaunchpadCrowdfundingIntegration420.InvalidSettlement.selector);
        allocations.contribute(other, 100, paymentId);
        require(sales.sale(other).raised == 0 && !integration.usedPaymentId(paymentId), "substitution changed state");
        vm.prank(ALICE);
        allocations.contribute(saleId, 100, paymentId);
        require(sales.sale(saleId).raised == 100, "original campaign not recorded");
    }

    function testInvoiceMustBeSingleUseAndLinkedToFundedCheckout() public {
        sales.activate(saleId);
        vm.warp(10);
        bytes32 paymentId = keccak256("payment/funded-checkout");
        pay.setPayment(paymentId, ALICE, RECEIVER, PAYMENT_ASSET, 100, 5, 0);
        _bindPayment(saleId, paymentId, 100);
        bytes32 invoiceId = integration.invoiceIdFor(saleId, ALICE, 100, uint256(paymentId));
        pay.setInvoiceMode(invoiceId, 1);
        vm.prank(ALICE);
        vm.expectRevert(LaunchpadCrowdfundingIntegration420.InvalidSettlement.selector);
        allocations.contribute(saleId, 100, paymentId);
        pay.setInvoiceMode(invoiceId, 0);
        pay.setCheckout(invoiceId, keccak256("unrelated-payment"));
        vm.prank(ALICE);
        vm.expectRevert(LaunchpadCrowdfundingIntegration420.InvalidSettlement.selector);
        allocations.contribute(saleId, 100, paymentId);
        pay.setCheckout(invoiceId, paymentId);
        vm.prank(ALICE);
        allocations.contribute(saleId, 100, paymentId);
        require(allocations.contributed(saleId, ALICE) == 100, "canonical checkout not accepted");
    }

    function testFuzzDeliveredRefundPrincipalConservation(uint128 rawTip, uint128 rawDelivered) public {
        sales.activate(saleId);
        vm.warp(10);
        bytes32 paymentId = keccak256("payment/refund-fuzz");
        uint128 principal = 100;
        pay.setPayment(paymentId, ALICE, RECEIVER, PAYMENT_ASSET, principal, 5, 0);
        _bindPayment(saleId, paymentId, principal);
        vm.prank(ALICE);
        allocations.contribute(saleId, principal, paymentId);

        uint256 tip = uint256(rawTip) % 101;
        uint256 maximum = uint256(principal) + tip;
        uint256 delivered = uint256(rawDelivered) % (maximum + 1);
        pay.setPayment(paymentId, ALICE, RECEIVER, PAYMENT_ASSET, principal, 6, maximum);
        pay.setTip(paymentId, tip);
        pay.setDelivered(paymentId, delivered);
        uint128 expected = delivered > tip ? uint128(delivered - tip) : 0;
        require(integration.reconcileRecordedRefund(paymentId) == expected, "conservative principal");
        require(integration.reconcileRecordedRefund(paymentId) == expected, "idempotent retry");
        require(integration.reconciledSaleRefundPrincipal(saleId) == expected, "aggregate conservation");
        require(expected <= principal, "excess principal");
        require(sales.sale(saleId).raised == principal, "gross history mutated");
        pay.setDelivered(paymentId, maximum + 1);
        vm.expectRevert(LaunchpadCrowdfundingIntegration420.InvalidRefund.selector);
        integration.reconcileRecordedRefund(paymentId);
        require(integration.reconciledSaleRefundPrincipal(saleId) == expected, "invalid refund mutated aggregate");
    }

    function testFuzzInvoiceBindingSeparatesAmountsAndNonces(uint128 raw, uint256 nonce) public view {
        uint128 amount = uint128(uint256(raw) % 599 + 1);
        bytes32 first = integration.invoiceIdFor(saleId, ALICE, amount, nonce);
        require(first != integration.invoiceIdFor(saleId, ALICE, amount + 1, nonce), "amount collision");
        require(first != integration.invoiceIdFor(saleId, BOB, amount, nonce), "payer collision");
        require(first != integration.invoiceIdFor(saleId, ALICE, amount, nonce ^ 1), "nonce collision");
    }

    function testUnallocatedPaymentRefundRecoveryDoesNotIncreaseRaised() public {
        sales.activate(saleId);
        vm.warp(10);
        bytes32 paymentId = keccak256("payment/late");
        pay.setPayment(paymentId, ALICE, RECEIVER, PAYMENT_ASSET, 200, 5, 0);
        _bindPayment(saleId, paymentId, 200);
        vm.warp(21);
        sales.finalize(saleId);
        vm.prank(ALICE);
        vm.expectRevert(LaunchpadAllocationRegistry420.InvalidContribution.selector);
        allocations.contribute(saleId, 200, paymentId);
        pay.setPayment(paymentId, ALICE, RECEIVER, PAYMENT_ASSET, 200, 6, 210);
        pay.setTip(paymentId, 10);
        pay.setDelivered(paymentId, 200);
        vm.prank(ALICE);
        vm.expectRevert(LaunchpadCrowdfundingIntegration420.InvalidRefund.selector);
        integration.reconcileUnallocatedRefund(saleId, paymentId);
        pay.setDelivered(paymentId, 210);
        vm.prank(ALICE);
        integration.reconcileUnallocatedRefund(saleId, paymentId);
        require(integration.unallocatedRefundRecorded(paymentId), "missing recovery");
        require(sales.sale(saleId).raised == 0 && allocations.contributed(saleId, ALICE) == 0, "false contribution");
        vm.prank(ALICE);
        vm.expectRevert(LaunchpadCrowdfundingIntegration420.Replay.selector);
        integration.reconcileUnallocatedRefund(saleId, paymentId);
    }

    function testRefundAuthorizedAfterSuccessCannotAlsoClaim() public {
        sales.activate(saleId);
        vm.warp(10);
        bytes32 paymentId = keccak256("payment/claim-refund");
        pay.setPayment(paymentId, ALICE, RECEIVER, PAYMENT_ASSET, 500, 5, 0);
        _bindPayment(saleId, paymentId, 500);
        vm.prank(ALICE);
        allocations.contribute(saleId, 500, paymentId);
        vm.warp(21);
        sales.finalize(saleId);
        vm.warp(30);
        bytes32 delivery = keccak256("attested/claim-refund");
        integration.attestDelivery(saleId, ALICE, delivery);
        pay.setPayment(paymentId, ALICE, RECEIVER, PAYMENT_ASSET, 500, 7, 1);
        vm.prank(ALICE);
        vm.expectRevert(LaunchpadCrowdfundingIntegration420.InvalidDelivery.selector);
        allocations.claim(saleId, delivery);
        require(allocations.claimed(saleId, ALICE) == 0, "claim mutation survived revert");
    }

    function _bindPayment(bytes32 campaign, bytes32 paymentId, uint128 amount) private {
        vm.prank(ALICE);
        bytes32 invoiceId = integration.registerContributionIntent(campaign, amount, uint256(paymentId));
        pay.setInvoice(paymentId, invoiceId, sales.sale(campaign).endsAt);
    }

    function _createModeSale(
        LaunchpadCrowdfundingIntegration420.CampaignMode mode,
        bytes32 liquidityCommitment
    ) private returns (bytes32 createdSaleId) {
        uint64 startsAt = 40 + uint64(uint256(liquidityCommitment));
        uint64 endsAt = startsAt + 10;
        uint64 claimStartsAt = endsAt + 10;
        createdSaleId = sales.canonicalId(
            projectId,
            PAYMENT_ASSET,
            RECEIVER,
            100,
            200,
            200,
            1000,
            startsAt,
            endsAt,
            claimStartsAt,
            ELIGIBILITY,
            liquidityCommitment
        );
        sales.createSale(
            createdSaleId,
            projectId,
            PAYMENT_ASSET,
            RECEIVER,
            100,
            200,
            200,
            1000,
            startsAt,
            endsAt,
            claimStartsAt,
            ELIGIBILITY,
            liquidityCommitment
        );
        integration.setCampaignMode(createdSaleId, mode);
    }
}
