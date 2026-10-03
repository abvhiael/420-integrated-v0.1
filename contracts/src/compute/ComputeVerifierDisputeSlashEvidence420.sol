// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../interfaces/IComputeObjectiveSlashEvidence420.sol";

interface IComputeVerifierDisputeReview420 {
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
}

/// @notice Converts a narrowly defined, independently adjudicated verifier-error dispute
///         into objective slash evidence. A generic payer win, timeout or allegation is insufficient.
contract ComputeVerifierDisputeSlashEvidence420 is I420System, IComputeObjectiveSlashEvidence420 {
    uint8 private constant CASE_FINAL = 5;

    bytes32 public constant VIOLATION_CODE =
        keccak256("420/CMP/SLASH/VERIFIER/OBJECTIVE_ADJUDICATED_ERROR/V1");
    bytes32 public constant MISCONDUCT_DOMAIN =
        keccak256("420Integrated.ComputeMarket.VerifierSlashMisconduct.v1");
    bytes32 public constant EVIDENCE_DOMAIN =
        keccak256("420Integrated.ComputeMarket.VerifierSlashEvidence.v1");
    bytes32 public constant OBJECTIVE_VERIFIER_ERROR_GROUND =
        keccak256("420/CMP/DISPUTE/GROUND/VERIFIER_OBJECTIVE_ERROR/V1");

    IComputeVerifierDisputeReview420 public immutable disputes;

    error InvalidEvidence();

    constructor(address disputes_) {
        if (disputes_.code.length == 0) revert InvalidEvidence();
        disputes = IComputeVerifierDisputeReview420(disputes_);
    }

    function systemName() external pure returns (string memory) {
        return "ComputeVerifierDisputeSlashEvidence420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function slashEvidence(bytes32 disputeId)
        external
        view
        returns (Evidence memory evidence)
    {
        IComputeVerifierDisputeReview420.VerificationReview memory r =
            disputes.verificationReview(disputeId);

        bool adjudicated = r.status == CASE_FINAL
            && r.finalDisposition
            && !r.holdActive
            && r.adverseToOriginalVerification
            && !r.providerWins
            && r.groundsCode == OBJECTIVE_VERIFIER_ERROR_GROUND
            && r.verifier != address(0)
            && r.verificationRef != bytes32(0)
            && r.resultCommitment != bytes32(0)
            && r.evidenceCommitment != bytes32(0)
            && r.decisionCommitment != bytes32(0)
            && r.resolutionRef != bytes32(0)
            && r.initialAdjudicator != address(0);

        if (
            r.appealed
                && (
                    !r.appealResolved
                        || r.appealAdjudicator == address(0)
                        || r.appealAdjudicator == r.initialAdjudicator
                        || r.appealDecisionCommitment == bytes32(0)
                )
        ) adjudicated = false;

        if (!adjudicated) revert InvalidEvidence();

        bytes32 misconductKey = keccak256(
            abi.encode(
                MISCONDUCT_DOMAIN,
                block.chainid,
                address(this),
                address(disputes),
                disputeId,
                r.jobId,
                r.verificationRef,
                r.resultCommitment,
                r.verifier,
                r.verificationPolicyId,
                r.verificationPolicyRevision,
                r.verificationPolicyCommitment,
                r.resolutionRef
            )
        );

        bytes32 evidenceCommitment = keccak256(
            abi.encode(
                EVIDENCE_DOMAIN,
                disputeId,
                r.groundsCode,
                r.evidenceCommitment,
                r.responseCommitment,
                r.decisionCommitment,
                r.appealCommitment,
                r.appealDecisionCommitment,
                r.resolutionRef,
                r.initialAdjudicator,
                r.appealAdjudicator
            )
        );

        evidence = Evidence({
            subjectKind: 2,
            subjectRef: bytes32(uint256(uint160(r.verifier))),
            subjectAccount: r.verifier,
            stakePolicyId: bytes32(0),
            verificationPolicyId: r.verificationPolicyId,
            verificationPolicyRevision: r.verificationPolicyRevision,
            verificationPolicyCommitment: r.verificationPolicyCommitment,
            violationCode: VIOLATION_CODE,
            misconductKey: misconductKey,
            evidenceCommitment: evidenceCommitment,
            evidenceAt: r.openedAt,
            finalObjective: true
        });
    }
}
