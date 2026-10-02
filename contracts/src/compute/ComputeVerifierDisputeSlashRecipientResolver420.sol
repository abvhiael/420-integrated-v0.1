// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../interfaces/IComputeSlashRecipientResolver420.sol";

interface IComputeSlashDistributionDisputes420 {
    struct VerificationReview {
        bytes32 disputeId;
        bytes32 jobId;
        bytes32 verificationRef;
        bytes32 resultCommitment;
        address verifier;
        bytes32 verificationPolicyId;
        uint32 verificationPolicyRevision;
        bytes32 verificationPolicyCommitment;
        bytes32 groundsCode;
        bytes32 evidenceCommitment;
        bytes32 responseCommitment;
        bytes32 decisionCommitment;
        bytes32 appealCommitment;
        bytes32 appealDecisionCommitment;
        bytes32 resolutionRef;
        address claimant;
        address respondent;
        address initialAdjudicator;
        address appealAdjudicator;
        uint64 openedAt;
        uint64 responseDeadline;
        uint64 decisionDeadline;
        uint64 appealDeadline;
        uint64 appealDecisionDeadline;
        uint8 status;
        bool holdActive;
        bool appealed;
        bool appealResolved;
        bool providerWins;
        bool finalDisposition;
        bool adverseToOriginalVerification;
    }

    function verificationReview(bytes32 disputeId)
        external
        view
        returns (VerificationReview memory review);

    function entitlements() external view returns (address);
}

interface IComputeSlashDistributionEntitlements420 {
    function disputeSnapshot(bytes32 jobId) external view returns (
        bytes32 entitlementRef,
        bytes32 claimRef,
        bytes32 providerObligationId,
        bytes32 payerResidualObligationId,
        address payer,
        address beneficiary,
        uint256 providerAmount,
        uint256 residualAmount,
        uint64 claimCreatedAt,
        bool claimExists,
        bool paid
    );
}

/// @notice Objective harmed-payer/challenger recipient resolution for verifier-error disputes.
/// @dev Replacement-worker routing is intentionally not invented here; policies requiring it must
///      use a resolver that can prove a canonical replacement worker.
contract ComputeVerifierDisputeSlashRecipientResolver420
    is I420System, IComputeSlashRecipientResolver420
{
    bytes32 public constant OBJECTIVE_VERIFIER_ERROR_GROUND =
        keccak256("420/CMP/DISPUTE/GROUND/VERIFIER_OBJECTIVE_ERROR/V1");

    IComputeSlashDistributionDisputes420 public immutable disputes;
    address public immutable verifierEvidenceAdapter;
    address public immutable canonicalEntitlements;
    bytes32 public immutable canonicalEntitlementsCodeHash;

    error InvalidResolution();

    constructor(address disputes_, address verifierEvidenceAdapter_) {
        if (disputes_.code.length == 0 || verifierEvidenceAdapter_.code.length == 0) {
            revert InvalidResolution();
        }
        disputes = IComputeSlashDistributionDisputes420(disputes_);
        verifierEvidenceAdapter = verifierEvidenceAdapter_;

        address entitlements_ = disputes.entitlements();
        if (entitlements_.code.length == 0) revert InvalidResolution();
        canonicalEntitlements = entitlements_;
        canonicalEntitlementsCodeHash = entitlements_.codehash;
    }

    function systemName() external pure returns (string memory) {
        return "ComputeVerifierDisputeSlashRecipientResolver420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function resolve(
        bytes32,
        bytes32 evidenceRef,
        address evidenceAdapter,
        bytes32,
        address subjectAccount
    ) external view returns (Recipients memory recipients) {
        if (
            evidenceRef == bytes32(0)
                || evidenceAdapter != verifierEvidenceAdapter
                || subjectAccount == address(0)
        ) revert InvalidResolution();

        IComputeSlashDistributionDisputes420.VerificationReview memory r =
            disputes.verificationReview(evidenceRef);
        if (
            !r.finalDisposition
                || !r.adverseToOriginalVerification
                || r.providerWins
                || r.groundsCode != OBJECTIVE_VERIFIER_ERROR_GROUND
                || r.verifier != subjectAccount
                || r.claimant == address(0)
                || r.jobId == bytes32(0)
        ) revert InvalidResolution();

        address entitlements = disputes.entitlements();
        if (
            entitlements != canonicalEntitlements
                || entitlements.code.length == 0
                || entitlements.codehash != canonicalEntitlementsCodeHash
        ) revert InvalidResolution();

        (
            bytes32 entitlementRef,
            bytes32 claimRef,
            ,
            ,
            address payer,
            ,
            ,
            ,
            ,
            bool claimExists,
            bool paid
        ) = IComputeSlashDistributionEntitlements420(entitlements).disputeSnapshot(r.jobId);

        if (
            entitlementRef == bytes32(0)
                || claimRef == bytes32(0)
                || payer == address(0)
                || !claimExists
                || paid
        ) revert InvalidResolution();

        recipients.harmedPayer = payer;
        recipients.challenger = r.claimant;
        recipients.replacementWorker = address(0);
    }
}
