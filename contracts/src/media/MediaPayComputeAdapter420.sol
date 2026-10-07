// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../compute/ICompute420.sol";

interface IMediaSettlementCanonical420 {
    function confirmVaultFunding(
        bytes32 jobId,
        address payer,
        bytes32 operatorId,
        address beneficiary,
        bytes32 vaultRef,
        bytes32 fundingRef,
        uint256 amount
    ) external;

    function releaseCanonical(
        bytes32 jobId,
        address beneficiary,
        uint256 settledAmount,
        bytes32 settlementRef
    ) external;

    function refundCanonical(bytes32 jobId, bytes32 refundRef, uint256 refundedAmount) external;
}

interface IMediaJobPayCompute420 {
    function settlementTerms(bytes32 jobId)
        external
        view
        returns (address payer, bytes32 operatorId, address beneficiary, uint256 maxSpend, uint8 status);
}

interface IMediaOperatorPayCompute420 {
    function operatorAccountOf(bytes32 operatorId) external view returns (address);
    function computeProviderRefOf(bytes32 operatorId) external view returns (bytes32);
}

interface IMediaPayRegistry420 {
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

interface IMediaComputeJob420 {
    struct Job {
        address owner;
        bytes32 requestId;
        bytes32 requestCommitment;
        bytes32 manifestHash;
        bytes32 workloadType;
        bytes32 inputCommitment;
        bytes32 outputSchemaCommitment;
        bytes32 matchId;
        bytes32 fundingRef;
        bytes32 acceptanceRef;
        bytes32 assignmentRef;
        address worker;
        bytes32 resultCommitment;
        address verifier;
        bytes32 verificationRef;
        bytes32 settlementRef;
        bytes32 verificationPolicyId;
        bytes32 verificationPolicyCommitment;
        uint32 verificationPolicyRevision;
        uint64 deadline;
        uint64 revision;
        uint8 status;
    }
    function job(bytes32 jobId) external view returns (Job memory);
}

interface IMediaComputeFunding420 {
    struct Credit {
        bytes32 requestId;
        address owner;
        address payer;
        uint256 deposited;
        uint256 maximumSpend;
        uint64 deadline;
        bytes32 obligationId;
        bool exists;
        bool refunded;
        bool allocated;
        uint256 earnedAllocated;
        bytes32 providerObligationId;
        bytes32 payerResidualObligationId;
        bytes32 disputeRefundObligationId;
    }
    function credit(bytes32 jobId) external view returns (Credit memory);
    function funded(bytes32 jobId, address owner, bytes32 fundingRef) external view returns (bool);
}

interface IMediaComputeMatch420 {
    struct Match {
        bytes32 jobId;
        bytes32 requestId;
        bytes32 manifestHash;
        bytes32 offerId;
        bytes32 resourceId;
        bytes32 providerId;
        bytes32 nodeId;
        uint64 resourceRevision;
        address owner;
        address operator;
        bytes32 priceReservationRef;
        bytes32 acceptanceRef;
        bool exists;
    }
    struct PriceReservation {
        bytes32 jobId;
        bytes32 matchId;
        bytes32 offerId;
        bytes32 requestId;
        address owner;
        address payer;
        bytes32 providerId;
        bytes32 resourceId;
        uint64 resourceRevision;
        address beneficiary;
        bytes32 pricingPolicyId;
        uint32 pricingVersion;
        uint256 acceptedAmount;
        uint256 fundedAmount;
        uint256 payerMaximum;
        bytes32 disputePolicyId;
        uint32 disputePolicyVersion;
        uint64 challengeWindow;
        uint64 responseWindow;
        uint64 decisionWindow;
        uint64 appealWindow;
        uint64 acceptedAt;
        bool exists;
    }
    function getMatch(bytes32 matchId) external view returns (Match memory);
    function priceReservationForJob(bytes32 jobId) external view returns (bytes32);
    function priceReservation(bytes32 priceRef) external view returns (PriceReservation memory);
}

interface IMediaComputeProvider420 {
    struct Provider {
        address registrant;
        address operator;
        address settlementAccount;
        bytes32 manifestHash;
        bytes32 securityReference;
        uint64 createdAt;
        uint64 revision;
        uint8 status;
    }
    function provider(bytes32 providerId) external view returns (Provider memory);
}

interface IMediaComputeEntitlement420 {
    struct Entitlement {
        bytes32 jobId;
        bytes32 requestId;
        bytes32 matchId;
        bytes32 priceReservationRef;
        bytes32 verificationRef;
        bytes32 resultCommitment;
        address verifier;
        address payer;
        bytes32 providerId;
        bytes32 resourceId;
        address beneficiary;
        bytes32 pricingPolicyId;
        uint32 pricingVersion;
        uint256 acceptedAmount;
        uint256 earnedAmount;
        uint256 fundedAmount;
        uint256 payerMaximum;
        uint64 finalizedAt;
        bool exists;
    }
    struct PayerRefund {
        bytes32 jobId;
        bytes32 obligationId;
        bytes32 claimRef;
        bytes32 payoutRef;
        address payer;
        uint256 amount;
        bool residual;
        bool claimable;
        bool paid;
    }
    function entitlementForJob(bytes32 jobId) external view returns (bytes32);
    function entitlement(bytes32 entitlementRef) external view returns (Entitlement memory);
    function settled(bytes32 jobId, bytes32 verificationRef, bytes32 settlementRef) external view returns (bool);
    function refunded(bytes32 jobId, bytes32 refundRef) external view returns (bool);
    function payerRefund(bytes32 jobId) external view returns (PayerRefund memory);
}

/// @notice Canonical 420Media boundary to 420Pay and ComputeMarket.
/// @dev This contract never custodies or transfers value. It only mirrors already-canonical
/// Pay/Compute evidence into MediaSettlement420 after exact payer/operator/beneficiary checks.
contract MediaPayComputeAdapter420 is I420System {
    bytes32 private constant PAY_FUNDING_DOMAIN = keccak256("420/MEDIA/PAY/FUNDING/V1");

    uint8 private constant MEDIA_JOB_ACCEPTED = 2;
    uint8 private constant PAY_SETTLED = 5;
    uint8 private constant PAY_REFUNDED = 6;
    uint8 private constant PAY_PARTIALLY_REFUNDED = 7;
    uint8 private constant COMPUTE_ACCEPTED = 4;
    uint8 private constant COMPUTE_SETTLED = 8;
    uint8 private constant COMPUTE_REFUNDED = 13;
    uint8 private constant COMPUTE_PROVIDER_ACTIVE = 2;

    enum Mode { NONE, PAY, COMPUTE }

    struct Binding {
        Mode mode;
        bytes32 externalRef;
        bytes32 graphHash;
        bytes32 providerId;
        bytes32 resourceId;
        address payer;
        address beneficiary;
        uint256 fundedCeiling;
        bool closed;
    }

    IMediaSettlementCanonical420 public immutable settlement;
    IMediaJobPayCompute420 public immutable jobs;
    IMediaOperatorPayCompute420 public immutable operators;
    IMediaPayRegistry420 public immutable payRegistry;
    ICompute420 public immutable computeRouter;
    IMediaComputeJob420 public immutable computeJobs;
    IMediaComputeFunding420 public immutable computeFunding;
    IMediaComputeMatch420 public immutable computeMatches;
    IMediaComputeProvider420 public immutable computeProviders;
    IMediaComputeEntitlement420 public immutable computeEntitlements;

    mapping(bytes32 => Binding) private _bindings;
    mapping(bytes32 => bool) public consumedPayment;

    error InvalidDependency();
    error InvalidBinding();
    error BindingExists();
    error Replay();
    error EvidenceMismatch();
    error WrongState();

    event PayFundingBound(bytes32 indexed mediaJobId, bytes32 indexed paymentId, uint256 amount, address payer, address beneficiary);
    event ComputeFundingBound(bytes32 indexed mediaJobId, bytes32 indexed computeJobId, bytes32 indexed providerId, bytes32 resourceId, uint256 amount);
    event CanonicalSettlementObserved(bytes32 indexed mediaJobId, bytes32 indexed externalRef, uint256 settledAmount);
    event CanonicalRefundObserved(bytes32 indexed mediaJobId, bytes32 indexed externalRef, uint256 refundedAmount);

    constructor(
        address settlement_,
        address jobs_,
        address operators_,
        address payRegistry_,
        address computeRouter_
    ) {
        address[5] memory deps = [settlement_, jobs_, operators_, payRegistry_, computeRouter_];
        for (uint256 i; i < deps.length; ++i) {
            if (deps[i] == address(0) || deps[i].code.length == 0) revert InvalidDependency();
        }
        settlement = IMediaSettlementCanonical420(settlement_);
        jobs = IMediaJobPayCompute420(jobs_);
        operators = IMediaOperatorPayCompute420(operators_);
        payRegistry = IMediaPayRegistry420(payRegistry_);
        computeRouter = ICompute420(computeRouter_);

        address computeJobs_ = computeRouter.jobRegistry();
        address computeFunding_ = computeRouter.fundingAdapter();
        address computeMatches_ = computeRouter.matchRegistry();
        address computeProviders_ = computeRouter.providerRegistry();
        address computeEntitlements_ = computeRouter.settlementAdapter();
        if (
            computeRouter.componentGraphHash() == bytes32(0)
                || computeJobs_.code.length == 0 || computeFunding_.code.length == 0
                || computeMatches_.code.length == 0 || computeProviders_.code.length == 0
                || computeEntitlements_.code.length == 0
        ) revert InvalidDependency();

        computeJobs = IMediaComputeJob420(computeJobs_);
        computeFunding = IMediaComputeFunding420(computeFunding_);
        computeMatches = IMediaComputeMatch420(computeMatches_);
        computeProviders = IMediaComputeProvider420(computeProviders_);
        computeEntitlements = IMediaComputeEntitlement420(computeEntitlements_);
    }

    function systemName() external pure returns (string memory) { return "MediaPayComputeAdapter420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function bindPayFunding(bytes32 mediaJobId, bytes32 paymentId) external {
        if (paymentId == bytes32(0) || consumedPayment[paymentId]) revert Replay();
        if (_bindings[mediaJobId].mode != Mode.NONE) revert BindingExists();

        (address payer, bytes32 operatorId, address beneficiary, uint256 maxSpend, uint8 mediaStatus) =
            jobs.settlementTerms(mediaJobId);
        if (mediaStatus != MEDIA_JOB_ACCEPTED || payer == address(0) || beneficiary == address(0)) revert WrongState();

        (
            bytes32 invoiceId,
            address canonicalPayer,
            address merchant,
            ,
            ,
            ,
            uint256 settlementAmount,
            ,
            ,
            bytes32 receiptHash,
            ,
            uint256 refundedAmount,
            uint8 payStatus
        ) = payRegistry.payments(paymentId);

        if (
            invoiceId == bytes32(0) || payStatus != PAY_SETTLED || receiptHash == bytes32(0)
                || canonicalPayer != payer || merchant != beneficiary
                || settlementAmount == 0 || settlementAmount > maxSpend || refundedAmount != 0
        ) revert EvidenceMismatch();

        bytes32 vaultRef = keccak256(abi.encode(PAY_FUNDING_DOMAIN, block.chainid, address(this), paymentId, receiptHash));
        consumedPayment[paymentId] = true;
        _bindings[mediaJobId] = Binding({
            mode: Mode.PAY,
            externalRef: paymentId,
            graphHash: bytes32(0),
            providerId: bytes32(0),
            resourceId: bytes32(0),
            payer: payer,
            beneficiary: beneficiary,
            fundedCeiling: settlementAmount,
            closed: false
        });

        settlement.confirmVaultFunding(
            mediaJobId, payer, operatorId, beneficiary, vaultRef, paymentId, settlementAmount
        );
        emit PayFundingBound(mediaJobId, paymentId, settlementAmount, payer, beneficiary);
    }

    function observePaySettlement(bytes32 mediaJobId) external {
        Binding storage b = _binding(mediaJobId, Mode.PAY);
        if (b.closed) revert Replay();

        (
            ,
            address payer,
            address merchant,
            ,
            ,
            ,
            uint256 settlementAmount,
            ,
            ,
            bytes32 receiptHash,
            ,
            uint256 refundedAmount,
            uint8 status
        ) = payRegistry.payments(b.externalRef);

        if (
            status != PAY_SETTLED || receiptHash == bytes32(0) || refundedAmount != 0
                || payer != b.payer || merchant != b.beneficiary || settlementAmount != b.fundedCeiling
        ) revert EvidenceMismatch();

        b.closed = true;
        settlement.releaseCanonical(mediaJobId, b.beneficiary, b.fundedCeiling, b.externalRef);
        emit CanonicalSettlementObserved(mediaJobId, b.externalRef, b.fundedCeiling);
    }

    function observePayRefund(bytes32 mediaJobId) external {
        Binding storage b = _binding(mediaJobId, Mode.PAY);
        if (b.closed) revert Replay();

        (
            ,
            address payer,
            address merchant,
            ,
            ,
            ,
            uint256 settlementAmount,
            ,
            ,
            ,
            ,
            uint256 refundedAmount,
            uint8 status
        ) = payRegistry.payments(b.externalRef);

        if (
            (status != PAY_REFUNDED && status != PAY_PARTIALLY_REFUNDED)
                || payer != b.payer || merchant != b.beneficiary
                || settlementAmount != b.fundedCeiling || refundedAmount < b.fundedCeiling
        ) revert EvidenceMismatch();

        b.closed = true;
        settlement.refundCanonical(mediaJobId, b.externalRef, refundedAmount);
        emit CanonicalRefundObserved(mediaJobId, b.externalRef, refundedAmount);
    }

    function bindComputeFunding(bytes32 mediaJobId, bytes32 computeJobId, bytes32 expectedGraphHash) external {
        if (computeJobId == bytes32(0) || expectedGraphHash == bytes32(0)) revert InvalidBinding();
        if (_bindings[mediaJobId].mode != Mode.NONE) revert BindingExists();
        if (computeRouter.componentGraphHash() != expectedGraphHash) revert EvidenceMismatch();

        (address payer, bytes32 operatorId, address beneficiary, uint256 maxSpend, uint8 mediaStatus) =
            jobs.settlementTerms(mediaJobId);
        if (mediaStatus != MEDIA_JOB_ACCEPTED || payer == address(0) || beneficiary == address(0)) revert WrongState();

        IMediaComputeJob420.Job memory j = computeJobs.job(computeJobId);
        if (
            j.status != COMPUTE_ACCEPTED || j.owner != payer || j.matchId == bytes32(0)
                || j.fundingRef == bytes32(0) || j.requestId == bytes32(0)
        ) revert EvidenceMismatch();

        IMediaComputeFunding420.Credit memory c = computeFunding.credit(computeJobId);
        if (
            !c.exists || c.refunded || c.allocated || c.owner != payer || c.payer != payer
                || c.requestId != j.requestId || c.deposited == 0 || c.maximumSpend == 0
                || c.maximumSpend > maxSpend || c.obligationId == bytes32(0)
                || !computeFunding.funded(computeJobId, payer, j.fundingRef)
        ) revert EvidenceMismatch();

        IMediaComputeMatch420.Match memory m = computeMatches.getMatch(j.matchId);
        bytes32 priceRef = computeMatches.priceReservationForJob(computeJobId);
        if (priceRef == bytes32(0)) revert EvidenceMismatch();
        IMediaComputeMatch420.PriceReservation memory p = computeMatches.priceReservation(priceRef);

        if (
            !m.exists || !p.exists || m.jobId != computeJobId || p.jobId != computeJobId
                || p.matchId != j.matchId || m.requestId != j.requestId || p.requestId != j.requestId
                || p.payer != payer || p.owner != payer
                || p.providerId == bytes32(0) || p.resourceId == bytes32(0)
                || m.providerId != p.providerId || m.resourceId != p.resourceId
                || p.beneficiary != beneficiary || p.acceptedAmount == 0
                || p.acceptedAmount > maxSpend || p.acceptedAmount > c.deposited
                || p.payerMaximum > maxSpend || p.fundedAmount > maxSpend
        ) revert EvidenceMismatch();

        bytes32 mediaComputeProvider = operators.computeProviderRefOf(operatorId);
        if (
            mediaComputeProvider == bytes32(0) || mediaComputeProvider != p.providerId
                || operators.operatorAccountOf(operatorId) != m.operator
        ) revert EvidenceMismatch();

        IMediaComputeProvider420.Provider memory provider = computeProviders.provider(p.providerId);
        if (
            provider.status != COMPUTE_PROVIDER_ACTIVE || provider.operator != m.operator
                || provider.settlementAccount != beneficiary
        ) revert EvidenceMismatch();

        _bindings[mediaJobId] = Binding({
            mode: Mode.COMPUTE,
            externalRef: computeJobId,
            graphHash: expectedGraphHash,
            providerId: p.providerId,
            resourceId: p.resourceId,
            payer: payer,
            beneficiary: beneficiary,
            fundedCeiling: p.acceptedAmount,
            closed: false
        });

        settlement.confirmVaultFunding(
            mediaJobId, payer, operatorId, beneficiary, c.obligationId, computeJobId, p.acceptedAmount
        );
        emit ComputeFundingBound(mediaJobId, computeJobId, p.providerId, p.resourceId, p.acceptedAmount);
    }

    function observeComputeSettlement(bytes32 mediaJobId) external {
        Binding storage b = _binding(mediaJobId, Mode.COMPUTE);
        if (b.closed) revert Replay();
        _requireGraph(b);

        IMediaComputeJob420.Job memory j = computeJobs.job(b.externalRef);
        if (j.status != COMPUTE_SETTLED || j.settlementRef == bytes32(0) || j.verificationRef == bytes32(0)) {
            revert WrongState();
        }

        bytes32 entitlementRef = computeEntitlements.entitlementForJob(b.externalRef);
        if (entitlementRef == bytes32(0)) revert EvidenceMismatch();
        IMediaComputeEntitlement420.Entitlement memory e = computeEntitlements.entitlement(entitlementRef);
        if (
            !e.exists || e.jobId != b.externalRef || e.requestId != j.requestId
                || e.matchId != j.matchId || e.payer != b.payer
                || e.providerId != b.providerId || e.resourceId != b.resourceId
                || e.beneficiary != b.beneficiary || e.acceptedAmount != b.fundedCeiling
                || e.earnedAmount == 0 || e.earnedAmount > b.fundedCeiling
                || e.verificationRef != j.verificationRef
                || !computeEntitlements.settled(b.externalRef, j.verificationRef, j.settlementRef)
        ) revert EvidenceMismatch();

        b.closed = true;
        settlement.releaseCanonical(mediaJobId, b.beneficiary, e.earnedAmount, j.settlementRef);
        emit CanonicalSettlementObserved(mediaJobId, j.settlementRef, e.earnedAmount);
    }

    function observeComputeRefund(bytes32 mediaJobId) external {
        Binding storage b = _binding(mediaJobId, Mode.COMPUTE);
        if (b.closed) revert Replay();
        _requireGraph(b);

        IMediaComputeJob420.Job memory j = computeJobs.job(b.externalRef);
        if (
            j.status != COMPUTE_REFUNDED || j.settlementRef == bytes32(0)
                || !computeEntitlements.refunded(b.externalRef, j.settlementRef)
        ) revert WrongState();

        IMediaComputeEntitlement420.PayerRefund memory pr = computeEntitlements.payerRefund(b.externalRef);
        if (
            !pr.claimable || !pr.paid || pr.residual || pr.payer != b.payer
                || pr.payoutRef != j.settlementRef || pr.amount < b.fundedCeiling
        ) revert EvidenceMismatch();

        b.closed = true;
        settlement.refundCanonical(mediaJobId, j.settlementRef, pr.amount);
        emit CanonicalRefundObserved(mediaJobId, j.settlementRef, pr.amount);
    }

    function binding(bytes32 mediaJobId) external view returns (Binding memory) {
        Binding memory b = _bindings[mediaJobId];
        if (b.mode == Mode.NONE) revert InvalidBinding();
        return b;
    }

    function _binding(bytes32 mediaJobId, Mode expected) private view returns (Binding storage b) {
        b = _bindings[mediaJobId];
        if (b.mode != expected) revert InvalidBinding();
    }

    function _requireGraph(Binding storage b) private view {
        if (b.graphHash == bytes32(0) || computeRouter.componentGraphHash() != b.graphHash) {
            revert EvidenceMismatch();
        }
    }
}
