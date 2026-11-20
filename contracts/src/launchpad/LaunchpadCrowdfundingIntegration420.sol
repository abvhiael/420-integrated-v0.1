// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../interfaces/genesis/IIdentityCredential420.sol";
import "./LaunchpadAllocationRegistry420.sol";
import "./LaunchpadIds420.sol";
import "./LaunchpadProjectRegistry420.sol";
import "./LaunchpadSaleRegistry420.sol";
import "../pay/PayIds420.sol";

interface ILaunchpadPaymentRegistry420 {
    function payments(
        bytes32 paymentId
    )
        external
        view
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
        );
}

interface ILaunchpadPayAuthority420 {
    function registry() external view returns (address);
    function checkoutPaymentForInvoice(bytes32 invoiceId) external view returns (bytes32);
}

interface ILaunchpadPayRegistryResolver420 {
    function resolve(bytes32 componentId) external view returns (address);
    function runtimeCodeHash(bytes32 componentId) external view returns (bytes32);
}

interface ILaunchpadInvoice420 {
    struct Invoice {
        bytes32 merchantId;
        address merchant;
        bytes32 metadataHash;
        bytes3 currency;
        uint256 amount;
        uint64 expiresAt;
        uint64 refundUntil;
        uint8 mode;
        uint8 acceptance;
        bool partialPayments;
        uint16 quoteMaxSlippageBps;
        bytes32 acceptedAssetsHash;
        bytes32 settlementPlanHash;
        bytes32 tipPolicyHash;
        bool active;
    }
    function merchantOf(bytes32 invoiceId) external view returns (address);
    function getInvoice(bytes32 invoiceId) external view returns (Invoice memory);
    function isClosed(bytes32 invoiceId) external view returns (bool);
}

interface ILaunchpadRefundDelivery420 {
    function paymentRegistry() external view returns (address);
    function deliveredByPayment(bytes32 paymentId) external view returns (uint256);
}

interface ILaunchpadIdentity420 is IIdentityCredential420 {
    function profiles(
        bytes32 profileId
    )
        external
        view
        returns (
            address controller,
            address pendingController,
            bytes32 metadataHash,
            bytes32 primaryName,
            uint64 createdAt,
            uint64 updatedAt,
            bool active
        );
}

interface ILaunchpadArbitrationCases420 {
    function caseOrigin(
        bytes32 caseId
    )
        external
        view
        returns (
            address claimant,
            address respondent,
            bytes32 domainId,
            bytes32 originComponentId,
            bytes32 originObjectId,
            uint8 state
        );

    function caseRound(
        bytes32 caseId
    ) external view returns (uint8);
}

interface ILaunchpadArbitrationRulings420 {
    struct Ruling {
        uint32 outcomeCode;
        bytes32 rulingHash;
        bytes32 remedyCommitment;
        bytes32 panelCommitment;
        address resolver;
        uint64 ruledAt;
        bool exists;
    }

    function cases() external view returns (address);

    function getRuling(
        bytes32 caseId,
        uint8 round
    ) external view returns (Ruling memory);
}

contract LaunchpadCrowdfundingIntegration420 is I420System {
    enum CampaignMode {
        NONE,
        REWARD,
        DONATION,
        COMMUNITY_PROJECT,
        PRODUCT_PREORDER
    }

    uint8 private constant PAY_STATUS_SETTLED = 5;
    uint8 private constant PAY_STATUS_REFUNDED = 6;
    uint8 private constant PAY_STATUS_PARTIALLY_REFUNDED = 7;
    uint8 private constant ARBITRATION_STATE_FINALIZED = 3;
    uint256 public constant MAX_PAYMENT_REFERENCES_PER_SALE = 32;

    bytes32 public constant CROWDFUNDING_DOMAIN = keccak256("420/arbitration/domain/launchpad-crowdfunding/v1");
    bytes32 public constant REFUND_BATCH_DOMAIN = keccak256("420/launchpad/crowdfunding/refund-batch/v1");
    bytes32 public constant NOTIFICATION_DOMAIN = keccak256("420/launchpad/crowdfunding/notification/v1");
    bytes32 public constant REPUTATION_KIND_CONTRIBUTION = keccak256("420/reputation/crowdfunding/contribution/v1");
    bytes32 public constant REPUTATION_KIND_REWARD_DELIVERY =
        keccak256("420/reputation/crowdfunding/reward-delivery/v1");
    bytes32 public constant NOTIFY_CONTRIBUTION = keccak256("420/notifications/launchpad/contribution/v1");
    bytes32 public constant NOTIFY_REFUND = keccak256("420/notifications/launchpad/refund/v1");
    bytes32 public constant NOTIFY_DELIVERY = keccak256("420/notifications/launchpad/delivery/v1");
    bytes32 public constant NOTIFY_DISPUTE = keccak256("420/notifications/launchpad/dispute/v1");
    bytes32 public constant NOTIFY_RULING = keccak256("420/notifications/launchpad/ruling/v1");

    LaunchpadAllocationRegistry420 public immutable allocations;
    LaunchpadSaleRegistry420 public immutable sales;
    LaunchpadProjectRegistry420 public immutable projects;
    ILaunchpadPaymentRegistry420 public immutable paymentRegistry;
    ILaunchpadIdentity420 public immutable identity;
    ILaunchpadArbitrationCases420 public immutable arbitrationCases;
    ILaunchpadArbitrationRulings420 public immutable arbitrationRulings;

    mapping(bytes32 => CampaignMode) public campaignMode;
    mapping(address => bytes32) public profileByParticipant;
    mapping(bytes32 => mapping(address => bytes32)) public profileAtSale;
    mapping(bytes32 => bool) public usedPaymentId;
    mapping(bytes32 => bool) public registeredContributionIntent;
    mapping(bytes32 => bool) public usedInvoiceId;
    mapping(bytes32 => bool) public unallocatedRefundRecorded;
    mapping(bytes32 => bytes32) public recordedPaymentSale;
    mapping(bytes32 => address) public recordedPaymentParticipant;
    mapping(bytes32 => uint128) public reconciledRefundPrincipal;
    mapping(bytes32 => uint128) public reconciledSaleRefundPrincipal;
    mapping(bytes32 => mapping(address => uint128)) public reconciledParticipantRefundPrincipal;
    mapping(bytes32 => mapping(address => bytes32)) public deliveryAttestation;
    mapping(bytes32 => bool) public attestedDeliveryCommitment;
    mapping(bytes32 => uint128) public contributionAmountByPayment;
    mapping(bytes32 => mapping(address => bytes32[])) private _paymentIds;
    mapping(bytes32 => mapping(address => bytes32)) public preparedRefundCommitment;
    mapping(bytes32 => bool) public usedRefundCommitment;
    mapping(bytes32 => bool) public usedDeliveryCommitment;
    mapping(bytes32 => mapping(address => bytes32)) public disputeCase;
    mapping(bytes32 => bool) public publishedDisputeOutcome;
    mapping(bytes32 => bool) public publishedNotification;
    mapping(bytes32 => bool) public publishedReputationEvidence;

    error ZeroAddress();
    error OnlyAllocationRegistry();
    error InvalidIdentity();
    error InvalidCampaignMode();
    error InvalidSettlement();
    error Replay();
    error TooManyPaymentReferences();
    error InvalidRefund();
    error InvalidDelivery();
    error InvalidDispute();
    error DisputeOutcomeUnavailable();

    event CampaignModeSet(bytes32 indexed saleId, CampaignMode mode);
    event ContributionIntentRegistered(
        bytes32 indexed saleId, address indexed participant, bytes32 indexed invoiceId, uint128 amount, uint256 nonce
    );
    event UnallocatedRefundReconciled(
        bytes32 indexed saleId, address indexed participant, bytes32 indexed paymentId, uint128 amount
    );
    event DeliveryAttested(bytes32 indexed saleId, address indexed participant, bytes32 indexed deliveryCommitment);
    event RecordedRefundReconciled(
        bytes32 indexed saleId, address indexed participant, bytes32 indexed paymentId,
        uint128 principalDelivered, uint128 principalDelta
    );
    event IdentityBound(address indexed participant, bytes32 indexed profileId);
    event ContributionSettlementBound(
        bytes32 indexed saleId,
        address indexed participant,
        bytes32 indexed paymentId,
        bytes32 profileId,
        uint128 amount,
        bytes32 receiptHash
    );
    event RefundBatchPrepared(
        bytes32 indexed saleId, address indexed participant, bytes32 indexed refundCommitment, uint128 amount
    );
    event RefundSettlementBound(
        bytes32 indexed saleId, address indexed participant, bytes32 indexed refundCommitment, uint128 amount
    );
    event DeliveryEvidenceBound(
        bytes32 indexed saleId, address indexed participant, bytes32 indexed deliveryCommitment, uint128 tokenAmount
    );
    event DisputeLinked(bytes32 indexed saleId, address indexed participant, bytes32 indexed caseId);
    event DisputeOutcomePublished(
        bytes32 indexed saleId,
        address indexed participant,
        bytes32 indexed caseId,
        uint32 outcomeCode,
        bytes32 rulingHash,
        bytes32 remedyCommitment
    );
    event ReputationEvidencePublished(
        bytes32 indexed evidenceRef,
        bytes32 indexed saleId,
        bytes32 indexed projectId,
        address participant,
        bytes32 participantProfileId,
        bytes32 interactionKind
    );
    event NotificationPublished(
        bytes32 indexed eventId,
        bytes32 indexed saleId,
        address indexed participant,
        bytes32 eventType,
        bytes32 sourceRef
    );

    constructor(
        address allocations_,
        address paymentRegistry_,
        address identity_,
        address arbitrationCases_,
        address arbitrationRulings_
    ) {
        if (
            allocations_ == address(0) || paymentRegistry_ == address(0) || identity_ == address(0)
                || arbitrationCases_ == address(0) || arbitrationRulings_ == address(0)
        ) revert ZeroAddress();
        if (
            allocations_.code.length == 0 || paymentRegistry_.code.length == 0 || identity_.code.length == 0
                || arbitrationCases_.code.length == 0 || arbitrationRulings_.code.length == 0
        ) revert ZeroAddress();
        allocations = LaunchpadAllocationRegistry420(allocations_);
        sales = allocations.sales();
        projects = sales.projects();
        if (sales.controller() != allocations_) revert OnlyAllocationRegistry();
        paymentRegistry = ILaunchpadPaymentRegistry420(paymentRegistry_);
        identity = ILaunchpadIdentity420(identity_);
        arbitrationCases = ILaunchpadArbitrationCases420(arbitrationCases_);
        arbitrationRulings = ILaunchpadArbitrationRulings420(arbitrationRulings_);
        if (ILaunchpadArbitrationRulings420(arbitrationRulings_).cases() != arbitrationCases_) {
            revert InvalidDispute();
        }
    }

    modifier onlyAllocations() {
        if (msg.sender != address(allocations)) revert OnlyAllocationRegistry();
        _;
    }

    function systemName() external pure returns (string memory) {
        return "LaunchpadCrowdfundingIntegration420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function setCampaignMode(
        bytes32 saleId,
        CampaignMode mode
    ) external {
        if (msg.sender != sales.governanceTimelock()) revert InvalidCampaignMode();
        LaunchpadSaleRegistry420.Sale memory sale_ = sales.sale(saleId);
        if (
            mode == CampaignMode.NONE || campaignMode[saleId] != CampaignMode.NONE
                || sale_.state != LaunchpadSaleRegistry420.State.SCHEDULED
        ) revert InvalidCampaignMode();
        campaignMode[saleId] = mode;
        emit CampaignModeSet(saleId, mode);
    }

    function bindIdentity(
        bytes32 profileId
    ) external {
        (address controller,,,,,, bool active) = identity.profiles(profileId);
        if (profileId == bytes32(0) || controller != msg.sender || !active) revert InvalidIdentity();
        profileByParticipant[msg.sender] = profileId;
        emit IdentityBound(msg.sender, profileId);
    }

    /// @notice The Pay invoice ID is deployment-, chain-, campaign-, participant-, amount- and nonce-specific.
    function invoiceIdFor(bytes32 saleId, address participant, uint128 amount, uint256 nonce)
        public view returns (bytes32)
    {
        return keccak256(abi.encode("420/LAUNCHPAD/CONTRIBUTION/INVOICE/V1", block.chainid, address(this),
            saleId, participant, amount, nonce));
    }

    function _payComponent(bytes32 componentId) private view returns (address implementation) {
        address registry = ILaunchpadPayAuthority420(address(paymentRegistry)).registry();
        if (registry.code.length == 0) revert InvalidSettlement();
        ILaunchpadPayRegistryResolver420 resolver = ILaunchpadPayRegistryResolver420(registry);
        if (resolver.resolve(PayIds420.PAYMENT_REGISTRY) != address(paymentRegistry)
            || resolver.runtimeCodeHash(PayIds420.PAYMENT_REGISTRY) != address(paymentRegistry).codehash) {
            revert InvalidSettlement();
        }
        implementation = resolver.resolve(componentId);
        if (implementation.code.length == 0 || resolver.runtimeCodeHash(componentId) != implementation.codehash) {
            revert InvalidSettlement();
        }
    }

    /// @notice Preflight before merchant invoice creation. This is NOT a capacity reservation or payment.
    function registerContributionIntent(bytes32 saleId, uint128 amount, uint256 nonce)
        external returns (bytes32 invoiceId)
    {
        LaunchpadSaleRegistry420.Sale memory sale_ = sales.sale(saleId);
        bytes32 profileId = profileByParticipant[msg.sender];
        (address controller,,,,,, bool active) = identity.profiles(profileId);
        if (profileId == bytes32(0) || controller != msg.sender || !active
            || !identity.hasValidCredential(profileId, sale_.eligibilityPolicyHash)) revert InvalidIdentity();
        if (profileAtSale[saleId][msg.sender] != bytes32(0) && profileAtSale[saleId][msg.sender] != profileId) {
            revert InvalidIdentity();
        }
        if (allocations.crowdfundingIntegration() != address(this) || campaignMode[saleId] == CampaignMode.NONE
            || sale_.state != LaunchpadSaleRegistry420.State.ACTIVE || block.timestamp < sale_.startsAt
            || block.timestamp > sale_.endsAt || amount == 0 || nonce == 0
            || uint256(allocations.contributed(saleId, msg.sender)) + amount > sale_.perWalletCap
            || uint256(sale_.raised) + amount > sale_.hardCap
            || _paymentIds[saleId][msg.sender].length >= MAX_PAYMENT_REFERENCES_PER_SALE
            || !allocations.authorization().isAuthorized(msg.sender, saleId, LaunchpadIds420.ACTION_CONTRIBUTE, amount)) {
            revert InvalidSettlement();
        }
        invoiceId = invoiceIdFor(saleId, msg.sender, amount, nonce);
        if (registeredContributionIntent[invoiceId]) revert Replay();
        // Reject pre-existing invoices: the participant must authorize these campaign terms before checkout.
        if (ILaunchpadInvoice420(_payComponent(PayIds420.INVOICE_REGISTRY)).merchantOf(invoiceId) != address(0)) {
            revert InvalidSettlement();
        }
        registeredContributionIntent[invoiceId] = true;
        emit ContributionIntentRegistered(saleId, msg.sender, invoiceId, amount, nonce);
    }

    function _verifyInvoice(
        bytes32 invoiceId, bytes32 paymentId, bytes32 saleId, address participant, uint128 amount, uint256 nonce,
        LaunchpadSaleRegistry420.Sale memory sale_
    ) private view {
        if (nonce == 0 || invoiceId != invoiceIdFor(saleId, participant, amount, nonce)
            || !registeredContributionIntent[invoiceId]) revert InvalidSettlement();
        ILaunchpadInvoice420 invoices = ILaunchpadInvoice420(_payComponent(PayIds420.INVOICE_REGISTRY));
        ILaunchpadInvoice420.Invoice memory invoice = invoices.getInvoice(invoiceId);
        if (invoice.merchant != sale_.proceedsReceiver || invoice.expiresAt < sale_.startsAt
            || invoice.expiresAt > sale_.endsAt || invoice.mode != 0 || invoice.partialPayments
            || !invoices.isClosed(invoiceId)
            || ILaunchpadPayAuthority420(address(paymentRegistry)).checkoutPaymentForInvoice(invoiceId) != paymentId) {
            revert InvalidSettlement();
        }
    }

    function consumeContribution(
        address participant,
        bytes32 saleId,
        uint128 amount,
        bytes32 paymentId
    ) external onlyAllocations returns (bool) {
        if (paymentId == bytes32(0) || usedPaymentId[paymentId]) revert Replay();

        LaunchpadSaleRegistry420.Sale memory sale_ = sales.sale(saleId);
        if (campaignMode[saleId] == CampaignMode.NONE) revert InvalidCampaignMode();
        bytes32 profileId = profileByParticipant[participant];
        if (profileId == bytes32(0)) revert InvalidIdentity();
        (address controller,,,,,, bool active) = identity.profiles(profileId);
        if (
            controller != participant || !active || !identity.hasValidCredential(profileId, sale_.eligibilityPolicyHash)
        ) revert InvalidIdentity();

        bytes32 frozenProfile = profileAtSale[saleId][participant];
        if (frozenProfile == bytes32(0)) {
            profileAtSale[saleId][participant] = profileId;
        } else if (frozenProfile != profileId) {
            revert InvalidIdentity();
        }

        (
            bytes32 invoiceId,
            address payer,
            address merchant,,,
            address settlementAsset,
            uint256 settlementAmount,,
            uint256 payerNonce,
            bytes32 receiptHash,,
            uint256 authorizedRefunded,
            uint8 status
        ) = paymentRegistry.payments(paymentId);

        if (
            status != PAY_STATUS_SETTLED || payer != participant || merchant != sale_.proceedsReceiver
                || settlementAsset != sale_.paymentAsset || settlementAmount != amount || receiptHash == bytes32(0)
                || authorizedRefunded != 0
        ) revert InvalidSettlement();

        _verifyInvoice(invoiceId, paymentId, saleId, participant, amount, payerNonce, sale_);
        if (usedInvoiceId[invoiceId]) revert Replay();

        bytes32[] storage refs = _paymentIds[saleId][participant];
        if (refs.length >= MAX_PAYMENT_REFERENCES_PER_SALE) revert TooManyPaymentReferences();

        usedPaymentId[paymentId] = true;
        usedInvoiceId[invoiceId] = true;
        contributionAmountByPayment[paymentId] = amount;
        recordedPaymentSale[paymentId] = saleId;
        recordedPaymentParticipant[paymentId] = participant;
        refs.push(paymentId);

        emit ContributionSettlementBound(saleId, participant, paymentId, profileId, amount, receiptHash);
        _publishReputation(paymentId, saleId, sale_.projectId, participant, profileId, REPUTATION_KIND_CONTRIBUTION);
        _publishNotification(saleId, participant, NOTIFY_CONTRIBUTION, paymentId);
        return true;
    }

    /// @notice Canonical refund progress. Principal delivery is conservative because Pay does
    /// not distinguish principal and tip refunds: assume the tip is delivered first.
    function refundProgress(bytes32 paymentId, address participant, uint128 principal)
        public view returns (uint256 authorized, uint256 delivered, uint128 principalDelivered)
    {
        (, address payer,,,,, uint256 settlementAmount,,,, uint256 tip, uint256 authorized_, uint8 status) =
            paymentRegistry.payments(paymentId);
        if (payer != participant || settlementAmount != principal || principal == 0
            || (status != PAY_STATUS_SETTLED && status != PAY_STATUS_REFUNDED
                && status != PAY_STATUS_PARTIALLY_REFUNDED)) revert InvalidRefund();
        ILaunchpadRefundDelivery420 refunds = ILaunchpadRefundDelivery420(_payComponent(PayIds420.REFUND_MANAGER));
        if (refunds.paymentRegistry() != address(paymentRegistry)) revert InvalidRefund();
        uint256 required = uint256(principal) + tip;
        authorized = authorized_;
        delivered = refunds.deliveredByPayment(paymentId);
        if (authorized > required || delivered > authorized
            || (status == PAY_STATUS_SETTLED && authorized != 0)
            || (status == PAY_STATUS_REFUNDED && authorized != required)
            || (status == PAY_STATUS_PARTIALLY_REFUNDED && (authorized == 0 || authorized >= required))) {
            revert InvalidRefund();
        }
        if (delivered > tip) principalDelivered = uint128(delivered - tip);
    }

    function _refundDelivered(bytes32 paymentId, address participant, uint128 principal)
        private view returns (bool)
    {
        (,, uint128 principalDelivered) = refundProgress(paymentId, participant, principal);
        return principalDelivered == principal;
    }

    /// @notice Records only newly delivered principal. Gross V1 contribution/raised history is not rewritten.
    /// This is a reconciliation checkpoint; current refundProgress remains the canonical live read.
    function reconcileRecordedRefund(bytes32 paymentId) public returns (uint128 principalDelivered) {
        uint128 principal = contributionAmountByPayment[paymentId];
        address participant = recordedPaymentParticipant[paymentId];
        bytes32 saleId = recordedPaymentSale[paymentId];
        if (principal == 0 || participant == address(0)) revert InvalidRefund();
        (,, principalDelivered) = refundProgress(paymentId, participant, principal);
        uint128 prior = reconciledRefundPrincipal[paymentId];
        if (principalDelivered < prior) revert InvalidRefund();
        uint128 delta = principalDelivered - prior;
        if (delta != 0) {
            reconciledRefundPrincipal[paymentId] = principalDelivered;
            reconciledSaleRefundPrincipal[saleId] += delta;
            reconciledParticipantRefundPrincipal[saleId][participant] += delta;
            emit RecordedRefundReconciled(saleId, participant, paymentId, principalDelivered, delta);
        }
    }

    /// @notice Reconcile a paid intent which never became a contribution (e.g. cap exhausted).
    /// This records evidence only; the actual refund must already be delivered by 420Pay.
    function reconcileUnallocatedRefund(bytes32 saleId, bytes32 paymentId) external {
        if (paymentId == bytes32(0) || usedPaymentId[paymentId]) revert Replay();
        LaunchpadSaleRegistry420.Sale memory sale_ = sales.sale(saleId);
        (bytes32 invoiceId, address payer, address merchant,,, address asset, uint256 amount,,
            uint256 nonce, bytes32 receiptHash,,,) = paymentRegistry.payments(paymentId);
        if (payer != msg.sender || merchant != sale_.proceedsReceiver || asset != sale_.paymentAsset
            || amount == 0 || amount > type(uint128).max || receiptHash == bytes32(0)) revert InvalidRefund();
        _verifyInvoice(invoiceId, paymentId, saleId, payer, uint128(amount), nonce, sale_);
        if (!_refundDelivered(paymentId, payer, uint128(amount))) revert InvalidRefund();
        usedPaymentId[paymentId] = true;
        unallocatedRefundRecorded[paymentId] = true;
        emit UnallocatedRefundReconciled(saleId, payer, paymentId, uint128(amount));
    }

    function prepareRefund(
        bytes32 saleId
    ) external returns (bytes32 refundCommitment) {
        LaunchpadSaleRegistry420.Sale memory sale_ = sales.sale(saleId);
        if (
            sale_.state != LaunchpadSaleRegistry420.State.FAILED
                && sale_.state != LaunchpadSaleRegistry420.State.CANCELLED
        ) revert InvalidRefund();

        bytes32[] storage refs = _paymentIds[saleId][msg.sender];
        uint256 length = refs.length;
        if (length == 0) revert InvalidRefund();

        uint256 canonicalRefundedContribution;
        for (uint256 i = 0; i < length; ++i) {
            bytes32 paymentId = refs[i];
            uint128 contributionAmount = contributionAmountByPayment[paymentId];
            if (!_refundDelivered(paymentId, msg.sender, contributionAmount)) revert InvalidRefund();
            reconcileRecordedRefund(paymentId);
            canonicalRefundedContribution += contributionAmount;
        }

        uint128 paid = allocations.contributed(saleId, msg.sender);
        if (paid == 0 || canonicalRefundedContribution != paid) revert InvalidRefund();

        refundCommitment = keccak256(abi.encode(REFUND_BATCH_DOMAIN, saleId, msg.sender, refs));
        if (usedRefundCommitment[refundCommitment]) revert Replay();
        preparedRefundCommitment[saleId][msg.sender] = refundCommitment;
        emit RefundBatchPrepared(saleId, msg.sender, refundCommitment, paid);
    }

    function consumeRefund(
        address participant,
        bytes32 saleId,
        uint128 amount,
        bytes32 refundCommitment
    ) external onlyAllocations returns (bool) {
        if (
            refundCommitment == bytes32(0) || preparedRefundCommitment[saleId][participant] != refundCommitment
                || usedRefundCommitment[refundCommitment] || amount != allocations.contributed(saleId, participant)
        ) revert InvalidRefund();

        bytes32[] storage refs = _paymentIds[saleId][participant];
        if (refs.length == 0) revert InvalidRefund();
        for (uint256 i = 0; i < refs.length; ++i) {
            if (!_refundDelivered(refs[i], participant, contributionAmountByPayment[refs[i]])) revert InvalidRefund();
            reconcileRecordedRefund(refs[i]);
        }
        usedRefundCommitment[refundCommitment] = true;
        delete preparedRefundCommitment[saleId][participant];

        emit RefundSettlementBound(saleId, participant, refundCommitment, amount);
        _publishNotification(saleId, participant, NOTIFY_REFUND, refundCommitment);
        return true;
    }

    /// @notice Project controller attestation followed by participant acknowledgement.
    /// Neither this attestation nor the subsequent claim proves independent physical delivery.
    function attestDelivery(bytes32 saleId, address participant, bytes32 commitment) external {
        LaunchpadSaleRegistry420.Sale memory sale_ = sales.sale(saleId);
        if (projects.project(sale_.projectId).controller != msg.sender
            || sale_.state != LaunchpadSaleRegistry420.State.SUCCEEDED
            || allocations.contributed(saleId, participant) == 0 || commitment == bytes32(0)
            || deliveryAttestation[saleId][participant] != bytes32(0)
            || attestedDeliveryCommitment[commitment]) revert InvalidDelivery();
        deliveryAttestation[saleId][participant] = commitment;
        attestedDeliveryCommitment[commitment] = true;
        emit DeliveryAttested(saleId, participant, commitment);
    }

    function recordDelivery(
        address participant,
        bytes32 saleId,
        uint128 tokenAmount,
        bytes32 deliveryCommitment
    ) external onlyAllocations {
        if (deliveryCommitment == bytes32(0) || usedDeliveryCommitment[deliveryCommitment] || tokenAmount == 0
            || deliveryAttestation[saleId][participant] != deliveryCommitment) {
            revert InvalidDelivery();
        }

        LaunchpadSaleRegistry420.Sale memory sale_ = sales.sale(saleId);
        if (sale_.state != LaunchpadSaleRegistry420.State.SUCCEEDED) revert InvalidDelivery();

        bytes32 profileId = profileAtSale[saleId][participant];
        if (profileId == bytes32(0)) revert InvalidIdentity();

        // A refunded or refund-authorized payment cannot also back a reward claim.
        _payComponent(PayIds420.PAYMENT_REGISTRY);
        bytes32[] storage refs = _paymentIds[saleId][participant];
        if (refs.length == 0) revert InvalidDelivery();
        for (uint256 i = 0; i < refs.length; ++i) {
            (,,,,,,,,,,, uint256 authorized, uint8 status) = paymentRegistry.payments(refs[i]);
            if (authorized != 0 || status != PAY_STATUS_SETTLED) revert InvalidDelivery();
        }
        usedDeliveryCommitment[deliveryCommitment] = true;
        emit DeliveryEvidenceBound(saleId, participant, deliveryCommitment, tokenAmount);
        _publishReputation(
            deliveryCommitment, saleId, sale_.projectId, participant, profileId, REPUTATION_KIND_REWARD_DELIVERY
        );
        _publishNotification(saleId, participant, NOTIFY_DELIVERY, deliveryCommitment);
    }

    function linkDispute(
        bytes32 saleId,
        bytes32 caseId
    ) external {
        if (caseId == bytes32(0) || disputeCase[saleId][msg.sender] != bytes32(0)) {
            revert InvalidDispute();
        }

        LaunchpadSaleRegistry420.Sale memory sale_ = sales.sale(saleId);
        LaunchpadProjectRegistry420.Project memory project_ = projects.project(sale_.projectId);
        (
            address claimant,
            address respondent,
            bytes32 domainId,
            bytes32 originComponentId,
            bytes32 originObjectId,
            uint8 state
        ) = arbitrationCases.caseOrigin(caseId);

        if (
            claimant != msg.sender || respondent != project_.controller || domainId != CROWDFUNDING_DOMAIN
                || originComponentId != LaunchpadIds420.COMPONENT_LAUNCHPAD || originObjectId != saleId || state == 0
        ) revert InvalidDispute();

        disputeCase[saleId][msg.sender] = caseId;
        emit DisputeLinked(saleId, msg.sender, caseId);
        _publishNotification(saleId, msg.sender, NOTIFY_DISPUTE, caseId);
    }

    function publishFinalizedDisputeOutcome(
        bytes32 saleId,
        address participant
    ) external {
        bytes32 caseId = disputeCase[saleId][participant];
        if (caseId == bytes32(0) || publishedDisputeOutcome[caseId]) {
            revert DisputeOutcomeUnavailable();
        }

        (,,,,, uint8 state) = arbitrationCases.caseOrigin(caseId);
        if (state != ARBITRATION_STATE_FINALIZED) revert DisputeOutcomeUnavailable();

        uint8 round = arbitrationCases.caseRound(caseId);
        ILaunchpadArbitrationRulings420.Ruling memory ruling = arbitrationRulings.getRuling(caseId, round);
        if (!ruling.exists || ruling.outcomeCode == 0 || ruling.rulingHash == bytes32(0)) {
            revert DisputeOutcomeUnavailable();
        }

        publishedDisputeOutcome[caseId] = true;
        emit DisputeOutcomePublished(
            saleId, participant, caseId, ruling.outcomeCode, ruling.rulingHash, ruling.remedyCommitment
        );
        _publishNotification(saleId, participant, NOTIFY_RULING, caseId);
    }

    function paymentIds(
        bytes32 saleId,
        address participant
    ) external view returns (bytes32[] memory) {
        return _paymentIds[saleId][participant];
    }

    function _publishReputation(
        bytes32 evidenceRef,
        bytes32 saleId,
        bytes32 projectId,
        address participant,
        bytes32 profileId,
        bytes32 interactionKind
    ) private {
        bytes32 key = keccak256(
            abi.encode(
                "420/LAUNCHPAD/REPUTATION/EVIDENCE/V1",
                evidenceRef,
                saleId,
                projectId,
                participant,
                profileId,
                interactionKind
            )
        );
        if (publishedReputationEvidence[key]) revert Replay();
        publishedReputationEvidence[key] = true;
        emit ReputationEvidencePublished(evidenceRef, saleId, projectId, participant, profileId, interactionKind);
    }

    function _publishNotification(
        bytes32 saleId,
        address participant,
        bytes32 eventType,
        bytes32 sourceRef
    ) private {
        bytes32 eventId = keccak256(abi.encode(NOTIFICATION_DOMAIN, saleId, participant, eventType, sourceRef));
        if (publishedNotification[eventId]) revert Replay();
        publishedNotification[eventId] = true;
        emit NotificationPublished(eventId, saleId, participant, eventType, sourceRef);
    }
}
