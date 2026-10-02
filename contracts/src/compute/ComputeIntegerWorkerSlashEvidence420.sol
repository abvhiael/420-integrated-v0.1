// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../interfaces/IComputeObjectiveSlashEvidence420.sol";
import "./ComputeJobIntegerProfileVerification420.sol";
import "./ComputeJobWorkerSnapshotEvidence420.sol";
import "./ComputeJobRegistry420.sol";

/// @notice Objective worker misconduct evidence for the deterministic integer profile.
/// @dev A generic FAILED job is never enough. This adapter requires the canonical independently
///      evaluated committed-output mismatch recorded by the deterministic profile verifier.
contract ComputeIntegerWorkerSlashEvidence420 is I420System, IComputeObjectiveSlashEvidence420 {
    bytes32 public constant VIOLATION_CODE =
        keccak256("420/CMP/SLASH/WORKER/DETERMINISTIC_COMMITTED_OUTPUT_MISMATCH/V1");
    bytes32 public constant MISCONDUCT_DOMAIN =
        keccak256("420Integrated.ComputeMarket.WorkerSlashMisconduct.v1");
    bytes32 public constant EVIDENCE_DOMAIN =
        keccak256("420Integrated.ComputeMarket.WorkerSlashEvidence.v1");

    ComputeJobIntegerProfileVerification420 public immutable verification;

    error InvalidEvidence();

    constructor(address verification_) {
        if (verification_.code.length == 0) revert InvalidEvidence();
        verification = ComputeJobIntegerProfileVerification420(verification_);
    }

    function systemName() external pure returns (string memory) {
        return "ComputeIntegerWorkerSlashEvidence420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function slashEvidence(bytes32 decisionRef)
        external
        view
        returns (Evidence memory evidence)
    {
        ComputeJobIntegerProfileVerification420.Evaluation memory e =
            verification.evaluation(decisionRef);
        if (
            !e.exists
                || e.approved
                || e.claimedOutput == e.expectedOutput
                || e.evidenceRef == bytes32(0)
                || e.workerResultCommitment == bytes32(0)
        ) revert InvalidEvidence();

        ComputeJobRegistry420 jobs = verification.jobs();
        ComputeJobRegistry420.Job memory j = jobs.job(e.jobId);
        if (
            j.status != ComputeJobRegistry420.Status.FAILED
                || j.assignmentRef == bytes32(0)
                || j.resultCommitment != e.workerResultCommitment
                || verification.decisionForJob(e.jobId) != decisionRef
        ) revert InvalidEvidence();

        ComputeJobWorkerSnapshotEvidence420 workerEvidence =
            ComputeJobWorkerSnapshotEvidence420(address(jobs.workerEvidence()));
        ComputeJobWorkerSnapshotEvidence420.Assignment memory a =
            workerEvidence.getAssignment(j.assignmentRef);

        if (
            !a.exists
                || a.jobId != e.jobId
                || a.workerId == bytes32(0)
                || a.operator == address(0)
                || a.resultCommitment != e.workerResultCommitment
                || a.admission.stakePolicyId == bytes32(0)
                || a.admission.stakeReference == bytes32(0)
        ) revert InvalidEvidence();

        bytes32 misconductKey = keccak256(
            abi.encode(
                MISCONDUCT_DOMAIN,
                block.chainid,
                address(this),
                address(verification),
                e.jobId,
                j.assignmentRef,
                a.workerId,
                a.workerRevision,
                a.attempt,
                e.workerResultCommitment,
                e.workerOutputHash,
                e.receiptHash,
                decisionRef,
                e.evidenceRef
            )
        );

        bytes32 evidenceCommitment = keccak256(
            abi.encode(
                EVIDENCE_DOMAIN,
                e.evidenceRef,
                e.inputCommitment,
                e.workerResultCommitment,
                e.workerOutputHash,
                e.receiptHash,
                e.claimedOutput,
                e.expectedOutput,
                e.appointmentRef
            )
        );

        evidence = Evidence({
            subjectKind: 1,
            subjectRef: a.workerId,
            subjectAccount: a.operator,
            stakePolicyId: a.admission.stakePolicyId,
            verificationPolicyId: j.verificationPolicyId,
            verificationPolicyRevision: j.verificationPolicyRevision,
            verificationPolicyCommitment: j.verificationPolicyCommitment,
            violationCode: VIOLATION_CODE,
            misconductKey: misconductKey,
            evidenceCommitment: evidenceCommitment,
            evidenceAt: 0,
            finalObjective: true
        });
    }
}
