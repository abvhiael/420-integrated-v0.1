// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ComputeJobRegistry420.sol";
import "./ComputeAcceptedPriceMatch420.sol";
import "./ComputeAuthorization420.sol";
import "./ComputeJobIntegerProfileVerification420.sol";
import "./ComputeEscrowFunding420.sol";
import "../vault/AssetVault420.sol";
import "../vault/VaultAccounting420.sol";

/// @notice CMP-1.2.3 verified earning ledger for the fixed-price paid-compute path.
/// @dev Converts one VERIFIED job into one immutable provider entitlement record.
/// It does not release, claim, withdraw, or otherwise move Vault funds.
contract ComputeVerifiedEntitlement420 is IComputeJobSettlementEvidence420 {
    bytes32 private constant ENTITLEMENT_DOMAIN =
        keccak256("420/COMPUTE/VERIFIED_ENTITLEMENT/FIXED/V1");
    bytes32 private constant CLAIM_DOMAIN =
        keccak256("420/COMPUTE/PROVIDER_CLAIM/FIXED/V1");
    bytes32 private constant PAYOUT_DOMAIN =
        keccak256("420/COMPUTE/PROVIDER_PAYOUT/FIXED/V1");
    bytes32 private constant REFUND_CLAIM_DOMAIN =
        keccak256("420/COMPUTE/PAYER_REFUND_CLAIM/V1");
    bytes32 private constant REFUND_PAYOUT_DOMAIN =
        keccak256("420/COMPUTE/PAYER_REFUND_PAYOUT/V1");

    struct ProviderClaim {
        bytes32 jobId;
        bytes32 entitlementRef;
        bytes32 providerObligationId;
        bytes32 payerResidualObligationId;
        bytes32 claimRef;
        bytes32 payoutRef;
        address beneficiary;
        uint256 amount;
        bool claimable;
        bool paid;
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

    ComputeJobRegistry420 public jobs;
    ComputeAcceptedPriceMatch420 public immutable matches;
    ComputeAuthorization420 public immutable authorization;
    ComputeJobIntegerProfileVerification420 public immutable verification;
    ComputeEscrowFunding420 public immutable funding;
    AssetVault420 public immutable vault;
    VaultAccounting420 public immutable accounting;
    bytes32 public immutable vaultId;
    address public immutable bindingAdmin;

    mapping(bytes32 => Entitlement) private _entitlements;
    mapping(bytes32 => ProviderClaim) private _providerClaims;
    mapping(bytes32 => PayerRefund) private _payerRefunds;
    mapping(bytes32 => bytes32) public entitlementForJob;
    uint256 public totalVerifiedEarned;
    uint256 public totalProviderPaid;
    uint256 public totalPayerRefundPaid;
    bool private entered;

    error InvalidEntitlement();
    error Unauthorized();

    event JobsBound(address indexed jobs);
    event ProviderClaimCreated(bytes32 indexed jobId, bytes32 indexed entitlementRef,
        bytes32 indexed providerObligationId, bytes32 claimRef, bytes32 payerResidualObligationId,
        address beneficiary, uint256 amount);
    event ProviderPaid(bytes32 indexed jobId, bytes32 indexed entitlementRef,
        bytes32 indexed providerObligationId, bytes32 payoutRef, address beneficiary, uint256 amount);
    event PayerRefundClaimable(bytes32 indexed jobId, bytes32 indexed obligationId,
        bytes32 indexed claimRef, address payer, uint256 amount, bool residual);
    event PayerRefundPaid(bytes32 indexed jobId, bytes32 indexed obligationId,
        bytes32 indexed payoutRef, address payer, uint256 amount, bool residual);

    event VerifiedEntitlementFinalized(
        bytes32 indexed jobId,
        bytes32 indexed entitlementRef,
        bytes32 indexed priceReservationRef,
        uint256 earnedAmount,
        address beneficiary,
        bytes32 verificationRef
    );

    constructor(address matches_, address authorization_, address verification_) {
        if (matches_.code.length == 0 || authorization_.code.length == 0
            || verification_.code.length == 0) revert InvalidEntitlement();
        matches = ComputeAcceptedPriceMatch420(matches_);
        authorization = ComputeAuthorization420(authorization_);
        verification = ComputeJobIntegerProfileVerification420(verification_);
        funding = matches.funding();
        vault = funding.vault();
        accounting = funding.accounting();
        vaultId = funding.vaultId();
        if (address(vault).code.length == 0 || address(accounting).code.length == 0
            || vaultId == bytes32(0)) revert InvalidEntitlement();
        bindingAdmin = msg.sender;
    }

    function bindJobs(address jobs_) external {
        if (msg.sender != bindingAdmin || address(jobs) != address(0) || jobs_.code.length == 0)
            revert Unauthorized();
        ComputeJobRegistry420 candidate = ComputeJobRegistry420(jobs_);
        if (address(candidate.settlementEvidence()) != address(this)
            || address(candidate.matchEvidence()) != address(matches)
            || address(candidate.verificationEvidence()) != address(verification)
            || address(matches.jobs()) != jobs_
            || address(verification.jobs()) != jobs_) revert InvalidEntitlement();
        jobs = candidate;
        emit JobsBound(jobs_);
    }

    function finalizeVerifiedEarning(bytes32 jobId, uint64 expectedRevision)
        external returns (bytes32 entitlementRef)
    {
        if (address(jobs) == address(0) || entitlementForJob[jobId] != bytes32(0))
            revert InvalidEntitlement();

        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        if (j.status != ComputeJobRegistry420.Status.VERIFIED
            || j.revision != expectedRevision
            || j.matchId == bytes32(0)
            || j.verificationRef == bytes32(0)
            || j.resultCommitment == bytes32(0)
            || j.verifier == address(0)) revert InvalidEntitlement();

        if (!verification.verified(
            jobId, j.resultCommitment, j.verifier, j.verificationRef, true
        )) revert InvalidEntitlement();
        ComputeJobIndependentVerification420.Decision memory d = verification.decision(j.verificationRef);
        ComputeJobIntegerProfileVerification420.Evaluation memory evaluation =
            verification.evaluation(j.verificationRef);
        if (!d.exists || !d.approved || d.jobId != jobId || d.verifier != j.verifier
            || d.resultCommitment != j.resultCommitment || !evaluation.exists
            || !evaluation.approved || evaluation.jobId != jobId
            || evaluation.workerResultCommitment != j.resultCommitment
            || evaluation.evidenceRef == bytes32(0)) revert InvalidEntitlement();

        bytes32 priceRef = matches.priceReservationForJob(jobId);
        if (priceRef == bytes32(0)) revert InvalidEntitlement();
        ComputeAcceptedPriceMatch420.PriceReservation memory p = matches.priceReservation(priceRef);

        (, , address operator, bool matchExists) = matches.matchParties(j.matchId);
        if (!matchExists || operator == address(0)
            || !verification.independencePolicy().eligible(
                jobId, j.verifier, d.profileId, j.owner, p.payer, operator
            )) revert InvalidEntitlement();

        uint256 earned = p.acceptedAmount;
        if (!p.exists || p.jobId != jobId || p.matchId != j.matchId
            || p.requestId != j.requestId || p.owner != j.owner
            || p.payer == address(0) || p.beneficiary == address(0)
            || p.providerId == bytes32(0) || p.resourceId == bytes32(0)
            || earned == 0 || earned > p.fundedAmount || earned > p.payerMaximum)
            revert InvalidEntitlement();

        if (!authorization.isAuthorized(
            msg.sender,
            authorization.ACTION_SETTLE(),
            authorization.scopeJob(jobId),
            earned
        )) revert Unauthorized();

        entitlementRef = keccak256(abi.encode(
            ENTITLEMENT_DOMAIN,
            block.chainid,
            address(this),
            jobId,
            j.requestId,
            j.matchId,
            priceRef,
            j.verificationRef,
            j.resultCommitment,
            j.verifier,
            p.payer,
            p.providerId,
            p.resourceId,
            p.beneficiary,
            p.pricingPolicyId,
            p.pricingVersion,
            earned
        ));
        if (_entitlements[entitlementRef].exists) revert InvalidEntitlement();

        _entitlements[entitlementRef] = Entitlement({
            jobId: jobId,
            requestId: j.requestId,
            matchId: j.matchId,
            priceReservationRef: priceRef,
            verificationRef: j.verificationRef,
            resultCommitment: j.resultCommitment,
            verifier: j.verifier,
            payer: p.payer,
            providerId: p.providerId,
            resourceId: p.resourceId,
            beneficiary: p.beneficiary,
            pricingPolicyId: p.pricingPolicyId,
            pricingVersion: p.pricingVersion,
            acceptedAmount: p.acceptedAmount,
            earnedAmount: earned,
            fundedAmount: p.fundedAmount,
            payerMaximum: p.payerMaximum,
            finalizedAt: uint64(block.timestamp),
            exists: true
        });
        entitlementForJob[jobId] = entitlementRef;
        totalVerifiedEarned += earned;

        emit VerifiedEntitlementFinalized(
            jobId, entitlementRef, priceRef, earned, p.beneficiary, j.verificationRef
        );
    }

    function createProviderClaim(bytes32 jobId, uint64 expectedRevision)
        external returns (bytes32 claimRef)
    {
        if (entered || address(jobs) == address(0) || _providerClaims[jobId].claimable)
            revert InvalidEntitlement();
        entered = true;
        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        bytes32 entitlementRef = entitlementForJob[jobId];
        Entitlement storage e = _entitlements[entitlementRef];
        if (!e.exists || e.jobId != jobId || j.status != ComputeJobRegistry420.Status.VERIFIED
            || j.revision != expectedRevision || e.verificationRef != j.verificationRef
            || e.resultCommitment != j.resultCommitment) revert InvalidEntitlement();
        _requireActionable(jobId, j, e);
        if (!authorization.isAuthorized(msg.sender, authorization.ACTION_SETTLE(),
            authorization.scopeJob(jobId), e.earnedAmount)) revert Unauthorized();

        VaultAccounting420.AssetAccounting memory beforeA =
            accounting.getAccounting(vaultId, address(0));
        uint256 beforeBalance = address(vault).balance;
        (bytes32 providerObligationId, bytes32 payerResidualObligationId) =
            funding.allocateVerifiedEarning(jobId, entitlementRef, e.beneficiary, e.earnedAmount);

        vault.releaseObligation(
            keccak256(abi.encode(CLAIM_DOMAIN, block.chainid, address(this), vaultId,
                jobId, entitlementRef, providerObligationId)),
            providerObligationId
        );

        VaultAccounting420.Obligation memory provider =
            accounting.getObligation(providerObligationId);
        VaultAccounting420.AssetAccounting memory afterA =
            accounting.getAccounting(vaultId, address(0));
        if (!provider.exists || provider.state != 2 || provider.vaultId != vaultId
            || provider.asset != address(0) || provider.beneficiary != e.beneficiary
            || provider.amount != e.earnedAmount || provider.sourceRef != entitlementRef
            || provider.obligationType != funding.PROVIDER_CLAIM_TYPE()
            || beforeBalance != address(vault).balance
            || beforeA.recordedBalance != afterA.recordedBalance
            || afterA.claimable != beforeA.claimable + e.earnedAmount
            || beforeA.reserved < e.earnedAmount
            || afterA.reserved != beforeA.reserved - e.earnedAmount) revert InvalidEntitlement();

        if (e.fundedAmount > e.earnedAmount) {
            VaultAccounting420.Obligation memory residual =
                accounting.getObligation(payerResidualObligationId);
            if (!residual.exists || residual.state != 1 || residual.vaultId != vaultId
                || residual.asset != address(0) || residual.beneficiary != e.payer
                || residual.amount != e.fundedAmount - e.earnedAmount
                || residual.sourceRef != entitlementRef
                || residual.obligationType != funding.PAYER_RESIDUAL_TYPE()) revert InvalidEntitlement();
        } else if (payerResidualObligationId != bytes32(0)) {
            revert InvalidEntitlement();
        }

        claimRef = keccak256(abi.encode(CLAIM_DOMAIN, block.chainid, address(this), jobId,
            entitlementRef, providerObligationId, payerResidualObligationId,
            e.beneficiary, e.earnedAmount, e.verificationRef));
        _providerClaims[jobId] = ProviderClaim(jobId, entitlementRef, providerObligationId,
            payerResidualObligationId, claimRef, bytes32(0), e.beneficiary,
            e.earnedAmount, true, false);
        emit ProviderClaimCreated(jobId, entitlementRef, providerObligationId,
            claimRef, payerResidualObligationId, e.beneficiary, e.earnedAmount);
        entered = false;
    }

    function claimProvider(bytes32 jobId, uint64 expectedRevision)
        external returns (bytes32 payoutRef)
    {
        if (entered) revert InvalidEntitlement();
        ProviderClaim storage pc = _providerClaims[jobId];
        if (!pc.claimable || pc.paid || msg.sender != pc.beneficiary) revert Unauthorized();
        entered = true;
        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        Entitlement storage e = _entitlements[pc.entitlementRef];
        if (!e.exists || j.status != ComputeJobRegistry420.Status.VERIFIED
            || j.revision != expectedRevision || e.verificationRef != j.verificationRef)
            revert InvalidEntitlement();
        _requireActionable(jobId, j, e);

        uint256 beneficiaryBefore = pc.beneficiary.balance;
        uint256 vaultBefore = address(vault).balance;
        VaultAccounting420.AssetAccounting memory beforeA =
            accounting.getAccounting(vaultId, address(0));

        payoutRef = keccak256(abi.encode(PAYOUT_DOMAIN, block.chainid, address(this),
            jobId, pc.entitlementRef, pc.claimRef, pc.providerObligationId,
            pc.beneficiary, pc.amount, j.verificationRef));
        pc.payoutRef = payoutRef;
        pc.paid = true;
        totalProviderPaid += pc.amount;

        vault.claim(payoutRef, pc.providerObligationId);

        VaultAccounting420.Obligation memory paidObligation =
            accounting.getObligation(pc.providerObligationId);
        VaultAccounting420.AssetAccounting memory afterA =
            accounting.getAccounting(vaultId, address(0));
        if (paidObligation.state != 3 || paidObligation.beneficiary != pc.beneficiary
            || paidObligation.amount != pc.amount
            || pc.beneficiary.balance != beneficiaryBefore + pc.amount
            || address(vault).balance != vaultBefore - pc.amount
            || afterA.recordedBalance != beforeA.recordedBalance - pc.amount
            || afterA.claimable != beforeA.claimable - pc.amount
            || afterA.released != beforeA.released + pc.amount) revert InvalidEntitlement();

        jobs.recordSettlement(jobId, expectedRevision, payoutRef);
        emit ProviderPaid(jobId, pc.entitlementRef, pc.providerObligationId,
            payoutRef, pc.beneficiary, pc.amount);
        entered = false;
    }

    function createTerminalRefundClaim(bytes32 jobId) external returns (bytes32 claimRef) {
        if (entered || _payerRefunds[jobId].claimable) revert InvalidEntitlement();
        entered = true;
        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        if (j.status != ComputeJobRegistry420.Status.CANCELLED
            && j.status != ComputeJobRegistry420.Status.EXPIRED
            && j.status != ComputeJobRegistry420.Status.FAILED) revert InvalidEntitlement();
        if (entitlementForJob[jobId] != bytes32(0) || _providerClaims[jobId].claimable)
            revert InvalidEntitlement();

        claimRef = keccak256(abi.encode(REFUND_CLAIM_DOMAIN, block.chainid, address(this),
            jobId, j.requestId, j.status, j.revision, false));
        (bytes32 obligationId, address payer, uint256 amount) =
            funding.releaseTerminalRefund(jobId, claimRef);
        VaultAccounting420.Obligation memory o = accounting.getObligation(obligationId);
        if (!o.exists || o.state != 2 || o.vaultId != vaultId || o.asset != address(0)
            || o.beneficiary != payer || o.amount != amount || amount == 0)
            revert InvalidEntitlement();

        _payerRefunds[jobId] = PayerRefund(
            jobId, obligationId, claimRef, bytes32(0), payer, amount, false, true, false
        );
        emit PayerRefundClaimable(jobId, obligationId, claimRef, payer, amount, false);
        entered = false;
    }

    function createSettledResidualRefundClaim(bytes32 jobId)
        external returns (bytes32 claimRef)
    {
        if (entered || _payerRefunds[jobId].claimable) revert InvalidEntitlement();
        entered = true;
        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        ProviderClaim storage pc = _providerClaims[jobId];
        if (j.status != ComputeJobRegistry420.Status.SETTLED || !pc.claimable || !pc.paid
            || pc.payerResidualObligationId == bytes32(0)) revert InvalidEntitlement();

        VaultAccounting420.Obligation memory beforeO =
            accounting.getObligation(pc.payerResidualObligationId);
        if (!beforeO.exists || beforeO.state != 1 || beforeO.vaultId != vaultId
            || beforeO.asset != address(0) || beforeO.amount == 0
            || beforeO.obligationType != funding.PAYER_RESIDUAL_TYPE()) revert InvalidEntitlement();

        claimRef = keccak256(abi.encode(REFUND_CLAIM_DOMAIN, block.chainid, address(this),
            jobId, pc.entitlementRef, pc.payerResidualObligationId, beforeO.beneficiary,
            beforeO.amount, true));
        vault.releaseObligation(claimRef, pc.payerResidualObligationId);
        VaultAccounting420.Obligation memory afterO =
            accounting.getObligation(pc.payerResidualObligationId);
        if (afterO.state != 2 || afterO.beneficiary != beforeO.beneficiary
            || afterO.amount != beforeO.amount) revert InvalidEntitlement();

        _payerRefunds[jobId] = PayerRefund(
            jobId, pc.payerResidualObligationId, claimRef, bytes32(0),
            beforeO.beneficiary, beforeO.amount, true, true, false
        );
        emit PayerRefundClaimable(jobId, pc.payerResidualObligationId, claimRef,
            beforeO.beneficiary, beforeO.amount, true);
        entered = false;
    }

    function claimPayerRefund(bytes32 jobId, uint64 expectedRevision)
        external returns (bytes32 payoutRef)
    {
        if (entered) revert InvalidEntitlement();
        PayerRefund storage pr = _payerRefunds[jobId];
        if (!pr.claimable || pr.paid || msg.sender != pr.payer) revert Unauthorized();
        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        if (j.revision != expectedRevision) revert InvalidEntitlement();
        bool settledResidual = pr.residual && j.status == ComputeJobRegistry420.Status.SETTLED;
        bool unsuccessful = !pr.residual && (
            j.status == ComputeJobRegistry420.Status.CANCELLED
            || j.status == ComputeJobRegistry420.Status.EXPIRED
            || j.status == ComputeJobRegistry420.Status.FAILED
        );
        if (!settledResidual && !unsuccessful) revert InvalidEntitlement();

        entered = true;
        uint256 payerBefore = pr.payer.balance;
        uint256 vaultBefore = address(vault).balance;
        VaultAccounting420.AssetAccounting memory beforeA =
            accounting.getAccounting(vaultId, address(0));

        payoutRef = keccak256(abi.encode(REFUND_PAYOUT_DOMAIN, block.chainid, address(this),
            jobId, pr.claimRef, pr.obligationId, pr.payer, pr.amount, pr.residual));
        pr.payoutRef = payoutRef;
        pr.paid = true;
        totalPayerRefundPaid += pr.amount;
        vault.claim(payoutRef, pr.obligationId);

        VaultAccounting420.Obligation memory paidObligation =
            accounting.getObligation(pr.obligationId);
        VaultAccounting420.AssetAccounting memory afterA =
            accounting.getAccounting(vaultId, address(0));
        if (paidObligation.state != 3 || paidObligation.beneficiary != pr.payer
            || paidObligation.amount != pr.amount
            || pr.payer.balance != payerBefore + pr.amount
            || address(vault).balance != vaultBefore - pr.amount
            || afterA.recordedBalance != beforeA.recordedBalance - pr.amount
            || afterA.claimable != beforeA.claimable - pr.amount
            || afterA.released != beforeA.released + pr.amount) revert InvalidEntitlement();

        if (unsuccessful) jobs.recordRefund(jobId, expectedRevision, payoutRef);
        emit PayerRefundPaid(jobId, pr.obligationId, payoutRef, pr.payer, pr.amount, pr.residual);
        entered = false;
    }

    function payerRefund(bytes32 jobId) external view returns (PayerRefund memory pr) {
        pr = _payerRefunds[jobId];
        if (!pr.claimable) revert InvalidEntitlement();
    }

    function refunded(bytes32 jobId, bytes32 refundRef) external view returns (bool) {
        PayerRefund storage pr = _payerRefunds[jobId];
        return pr.claimable && pr.paid && pr.payoutRef == refundRef && refundRef != bytes32(0);
    }

    function providerClaim(bytes32 jobId) external view returns (ProviderClaim memory pc) {
        pc = _providerClaims[jobId];
        if (!pc.claimable) revert InvalidEntitlement();
    }

    function entitlement(bytes32 entitlementRef) external view returns (Entitlement memory e) {
        e = _entitlements[entitlementRef];
        if (!e.exists) revert InvalidEntitlement();
    }

    function verifiedEntitlement(
        bytes32 jobId,
        bytes32 verificationRef,
        bytes32 entitlementRef,
        address beneficiary,
        uint256 earnedAmount
    ) external view returns (bool) {
        Entitlement storage e = _entitlements[entitlementRef];
        return e.exists
            && entitlementForJob[jobId] == entitlementRef
            && e.jobId == jobId
            && e.verificationRef == verificationRef
            && e.beneficiary == beneficiary
            && e.earnedAmount == earnedAmount;
    }

    function settled(bytes32 jobId, bytes32 verificationRef, bytes32 settlementRef)
        external view returns (bool)
    {
        ProviderClaim storage pc = _providerClaims[jobId];
        Entitlement storage e = _entitlements[pc.entitlementRef];
        return pc.claimable && pc.paid && pc.payoutRef == settlementRef
            && settlementRef != bytes32(0) && e.exists
            && e.verificationRef == verificationRef;
    }

    function _requireActionable(bytes32 jobId, ComputeJobRegistry420.Job memory j,
        Entitlement storage e) private view
    {
        if (!verification.verified(jobId, j.resultCommitment, j.verifier,
            j.verificationRef, true)) revert InvalidEntitlement();
        ComputeJobIndependentVerification420.Decision memory d =
            verification.decision(j.verificationRef);
        ComputeJobIntegerProfileVerification420.Evaluation memory evaluation =
            verification.evaluation(j.verificationRef);
        (, , address operator, bool matchExists) = matches.matchParties(j.matchId);
        if (!d.exists || !d.approved || d.jobId != jobId || d.verifier != j.verifier
            || d.resultCommitment != j.resultCommitment || !evaluation.exists
            || !evaluation.approved || evaluation.jobId != jobId
            || evaluation.workerResultCommitment != j.resultCommitment
            || evaluation.evidenceRef == bytes32(0)
            || !matchExists || operator == address(0)
            || !verification.independencePolicy().eligible(
                jobId, j.verifier, d.profileId, j.owner, e.payer, operator
            )) revert InvalidEntitlement();
    }
}
