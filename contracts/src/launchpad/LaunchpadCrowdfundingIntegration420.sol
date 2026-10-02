// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../interfaces/genesis/IIdentityCredential420.sol";
import "./LaunchpadAllocationRegistry420.sol";
import "./LaunchpadIds420.sol";
import "./LaunchpadProjectRegistry420.sol";
import "./LaunchpadSaleRegistry420.sol";

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
    uint8 private constant PAY_STATUS_SETTLED = 5;
    uint8 private constant PAY_STATUS_REFUNDED = 6;
    uint8 private constant PAY_STATUS_PARTIALLY_REFUNDED = 7;
    uint8 private constant ARBITRATION_STATE_FINALIZED = 3;
    uint256 public constant MAX_PAYMENT_REFERENCES_PER_SALE = 32;

    bytes32 public constant CROWDFUNDING_DOMAIN =
        keccak256("420/arbitration/domain/launchpad-crowdfunding/v1");
    bytes32 public constant REFUND_BATCH_DOMAIN =
        keccak256("420/launchpad/crowdfunding/refund-batch/v1");
    bytes32 public constant NOTIFICATION_DOMAIN =
        keccak256("420/launchpad/crowdfunding/notification/v1");
    bytes32 public constant REPUTATION_KIND_CONTRIBUTION =
        keccak256("420/reputation/crowdfunding/contribution/v1");
    bytes32 public constant REPUTATION_KIND_REWARD_DELIVERY =
        keccak256("420/reputation/crowdfunding/reward-delivery/v1");
    bytes32 public constant NOTIFY_CONTRIBUTION =
        keccak256("420/notifications/launchpad/contribution/v1");
    bytes32 public constant NOTIFY_REFUND =
        keccak256("420/notifications/launchpad/refund/v1");
    bytes32 public constant NOTIFY_DELIVERY =
        keccak256("420/notifications/launchpad/delivery/v1");
    bytes32 public constant NOTIFY_DISPUTE =
        keccak256("420/notifications/launchpad/dispute/v1");
    bytes32 public constant NOTIFY_RULING =
        keccak256("420/notifications/launchpad/ruling/v1");

    LaunchpadAllocationRegistry420 public immutable allocations;
    LaunchpadSaleRegistry420 public immutable sales;
    LaunchpadProjectRegistry420 public immutable projects;
    ILaunchpadPaymentRegistry420 public immutable paymentRegistry;
    ILaunchpadIdentity420 public immutable identity;
    ILaunchpadArbitrationCases420 public immutable arbitrationCases;
    ILaunchpadArbitrationRulings420 public immutable arbitrationRulings;

    mapping(address => bytes32) public profileByParticipant;
    mapping(bytes32 => mapping(address => bytes32)) public profileAtSale;
    mapping(bytes32 => bool) public usedPaymentId;
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
    error InvalidSettlement();
    error Replay();
    error TooManyPaymentReferences();
    error InvalidRefund();
    error InvalidDelivery();
    error InvalidDispute();
    error DisputeOutcomeUnavailable();

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
        bytes32 indexed saleId,
        address indexed participant,
        bytes32 indexed refundCommitment,
        uint128 amount
    );
    event RefundSettlementBound(
        bytes32 indexed saleId,
        address indexed participant,
        bytes32 indexed refundCommitment,
        uint128 amount
    );
    event DeliveryEvidenceBound(
        bytes32 indexed saleId,
        address indexed participant,
        bytes32 indexed deliveryCommitment,
        uint128 tokenAmount
    );
    event DisputeLinked(
        bytes32 indexed saleId,
        address indexed participant,
        bytes32 indexed caseId
    );
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
        allocations = LaunchpadAllocationRegistry420(allocations_);
        sales = allocations.sales();
        projects = sales.projects();
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

    function bindIdentity(
        bytes32 profileId
    ) external {
        (address controller,,,,,, bool active) = identity.profiles(profileId);
        if (profileId == bytes32(0) || controller != msg.sender || !active) revert InvalidIdentity();
        profileByParticipant[msg.sender] = profileId;
        emit IdentityBound(msg.sender, profileId);
    }

    function consumeContribution(
        address participant,
        bytes32 saleId,
        uint128 amount,
        bytes32 paymentId
    ) external onlyAllocations returns (bool) {
        if (paymentId == bytes32(0) || usedPaymentId[paymentId]) revert Replay();

        LaunchpadSaleRegistry420.Sale memory sale_ = sales.sale(saleId);
        bytes32 profileId = profileByParticipant[participant];
        if (profileId == bytes32(0)) revert InvalidIdentity();
        (address controller,,,,,, bool active) = identity.profiles(profileId);
        if (
            controller != participant || !active
                || !identity.hasValidCredential(profileId, sale_.eligibilityPolicyHash)
        ) revert InvalidIdentity();

        bytes32 frozenProfile = profileAtSale[saleId][participant];
        if (frozenProfile == bytes32(0)) {
            profileAtSale[saleId][participant] = profileId;
        } else if (frozenProfile != profileId) {
            revert InvalidIdentity();
        }

        (
            ,
            address payer,
            address merchant,
            ,
            ,
            address settlementAsset,
            uint256 settlementAmount,
            ,
            ,
            bytes32 receiptHash,
            ,
            ,
            uint8 status
        ) = paymentRegistry.payments(paymentId);

        if (
            status != PAY_STATUS_SETTLED || payer != participant || merchant != sale_.proceedsReceiver
                || settlementAsset != sale_.paymentAsset || settlementAmount != amount
                || receiptHash == bytes32(0)
        ) revert InvalidSettlement();

        bytes32[] storage refs = _paymentIds[saleId][participant];
        if (refs.length >= MAX_PAYMENT_REFERENCES_PER_SALE) revert TooManyPaymentReferences();

        usedPaymentId[paymentId] = true;
        contributionAmountByPayment[paymentId] = amount;
        refs.push(paymentId);

        emit ContributionSettlementBound(saleId, participant, paymentId, profileId, amount, receiptHash);
        _publishReputation(
            paymentId,
            saleId,
            sale_.projectId,
            participant,
            profileId,
            REPUTATION_KIND_CONTRIBUTION
        );
        _publishNotification(saleId, participant, NOTIFY_CONTRIBUTION, paymentId);
        return true;
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
            (
                ,
                address payer,
                ,
                ,
                ,
                ,
                ,
                ,
                ,
                ,
                ,
                uint256 refundedAmount,
                uint8 status
            ) = paymentRegistry.payments(paymentId);
            uint128 contributionAmount = contributionAmountByPayment[paymentId];
            if (
                payer != msg.sender
                    || (status != PAY_STATUS_REFUNDED && status != PAY_STATUS_PARTIALLY_REFUNDED)
                    || refundedAmount < contributionAmount
            ) revert InvalidRefund();
            canonicalRefundedContribution += contributionAmount;
        }

        uint128 paid = allocations.contributed(saleId, msg.sender);
        if (paid == 0 || canonicalRefundedContribution != paid) revert InvalidRefund();

        refundCommitment =
            keccak256(abi.encode(REFUND_BATCH_DOMAIN, saleId, msg.sender, refs));
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
            refundCommitment == bytes32(0)
                || preparedRefundCommitment[saleId][participant] != refundCommitment
                || usedRefundCommitment[refundCommitment]
                || amount != allocations.contributed(saleId, participant)
        ) revert InvalidRefund();

        usedRefundCommitment[refundCommitment] = true;
        delete preparedRefundCommitment[saleId][participant];

        emit RefundSettlementBound(saleId, participant, refundCommitment, amount);
        _publishNotification(saleId, participant, NOTIFY_REFUND, refundCommitment);
        return true;
    }

    function recordDelivery(
        address participant,
        bytes32 saleId,
        uint128 tokenAmount,
        bytes32 deliveryCommitment
    ) external onlyAllocations {
        if (
            deliveryCommitment == bytes32(0) || usedDeliveryCommitment[deliveryCommitment]
                || tokenAmount == 0
        ) revert InvalidDelivery();

        LaunchpadSaleRegistry420.Sale memory sale_ = sales.sale(saleId);
        if (sale_.state != LaunchpadSaleRegistry420.State.SUCCEEDED) revert InvalidDelivery();

        bytes32 profileId = profileAtSale[saleId][participant];
        if (profileId == bytes32(0)) revert InvalidIdentity();

        usedDeliveryCommitment[deliveryCommitment] = true;
        emit DeliveryEvidenceBound(saleId, participant, deliveryCommitment, tokenAmount);
        _publishReputation(
            deliveryCommitment,
            saleId,
            sale_.projectId,
            participant,
            profileId,
            REPUTATION_KIND_REWARD_DELIVERY
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
            claimant != msg.sender || respondent != project_.controller
                || domainId != CROWDFUNDING_DOMAIN
                || originComponentId != LaunchpadIds420.COMPONENT_LAUNCHPAD
                || originObjectId != saleId || state == 0
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
        ILaunchpadArbitrationRulings420.Ruling memory ruling =
            arbitrationRulings.getRuling(caseId, round);
        if (!ruling.exists || ruling.outcomeCode == 0 || ruling.rulingHash == bytes32(0)) {
            revert DisputeOutcomeUnavailable();
        }

        publishedDisputeOutcome[caseId] = true;
        emit DisputeOutcomePublished(
            saleId,
            participant,
            caseId,
            ruling.outcomeCode,
            ruling.rulingHash,
            ruling.remedyCommitment
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
        emit ReputationEvidencePublished(
            evidenceRef,
            saleId,
            projectId,
            participant,
            profileId,
            interactionKind
        );
    }

    function _publishNotification(
        bytes32 saleId,
        address participant,
        bytes32 eventType,
        bytes32 sourceRef
    ) private {
        bytes32 eventId =
            keccak256(abi.encode(NOTIFICATION_DOMAIN, saleId, participant, eventType, sourceRef));
        if (publishedNotification[eventId]) revert Replay();
        publishedNotification[eventId] = true;
        emit NotificationPublished(eventId, saleId, participant, eventType, sourceRef);
    }
}
