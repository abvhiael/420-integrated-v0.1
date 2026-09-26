// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ComputeJobRegistry420.sol";
import "./ComputeAcceptedPriceMatch420.sol";
import "./ComputeAuthorization420.sol";
import "./ComputeJobIntegerProfileVerification420.sol";

/// @notice CMP-1.2.3 verified earning ledger for the fixed-price paid-compute path.
/// @dev Converts one VERIFIED job into one immutable provider entitlement record.
/// It does not release, claim, withdraw, or otherwise move Vault funds.
contract ComputeVerifiedEntitlement420 is IComputeJobSettlementEvidence420 {
    bytes32 private constant ENTITLEMENT_DOMAIN =
        keccak256("420/COMPUTE/VERIFIED_ENTITLEMENT/FIXED/V1");

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
    address public immutable bindingAdmin;

    mapping(bytes32 => Entitlement) private _entitlements;
    mapping(bytes32 => bytes32) public entitlementForJob;
    uint256 public totalVerifiedEarned;

    error InvalidEntitlement();
    error Unauthorized();

    event JobsBound(address indexed jobs);
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

    /// @dev CMP-1.2.3 does not make provider funds claimable and therefore cannot
    /// satisfy the job registry's SETTLED transition. CMP-1.2.4 will close that gate.
    function settled(bytes32, bytes32, bytes32) external pure returns (bool) {
        return false;
    }
}
