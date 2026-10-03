// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../accounts/ECDSA420.sol";
import "../interfaces/I420System.sol";
import "../interfaces/IComputeObjectiveSlashEvidence420.sol";

interface IComputeWorkerConflictSnapshot420 {
    struct AdmissionRefs {
        bytes32 capabilityPolicyId;
        bytes32 capabilityAttestationId;
        bytes32 trustPolicyId;
        bytes32 trustReference;
        bytes32 stakePolicyId;
        bytes32 stakeReference;
    }

    struct Assignment {
        bytes32 jobId;
        bytes32 matchId;
        bytes32 acceptanceRef;
        bytes32 workerId;
        uint64 workerRevision;
        bytes32 providerId;
        bytes32 nodeId;
        bytes32 resourceId;
        uint64 resourceRevision;
        address operator;
        address executionSigner;
        bytes32 executionKeyCommitment;
        bytes32 capabilityProfileHash;
        bytes32 jurisdictionHash;
        AdmissionRefs admission;
        bytes32 snapshotCommitment;
        bytes32 reservationId;
        uint64 attempt;
        bytes32 resultCommitment;
        bytes32 receiptHash;
        bool exists;
    }

    function assignmentForJob(bytes32 jobId) external view returns (bytes32);
    function getAssignment(bytes32 assignmentRef) external view returns (Assignment memory);
    function resultExecutionDigest(bytes32 jobId, bytes32 receiptHash, bytes32 outputHash)
        external
        view
        returns (bytes32);
}

/// @notice Permissionless proof of conflicting worker-signed result commitments for one canonical attempt.
/// @dev Two distinct result digests signed by the frozen execution signer are objective equivocation evidence.
///      This contract records evidence only and cannot slash or move collateral.
contract ComputeWorkerConflictingResultSlashEvidence420
    is I420System, IComputeObjectiveSlashEvidence420
{
    bytes32 public constant VIOLATION_CODE =
        keccak256("420/CMP/SLASH/WORKER/CONFLICTING_SIGNED_RESULTS/V1");
    bytes32 public constant MISCONDUCT_DOMAIN =
        keccak256("420Integrated.ComputeMarket.WorkerConflictingResultMisconduct.v1");
    bytes32 public constant EVIDENCE_DOMAIN =
        keccak256("420Integrated.ComputeMarket.WorkerConflictingResultEvidence.v1");

    struct Record {
        bytes32 jobId;
        bytes32 assignmentRef;
        bytes32 workerId;
        address operator;
        bytes32 stakePolicyId;
        uint64 workerRevision;
        uint64 attempt;
        bytes32 firstDigest;
        bytes32 secondDigest;
        bytes32 misconductKey;
        bytes32 evidenceCommitment;
        uint64 recordedAt;
        bool exists;
    }

    IComputeWorkerConflictSnapshot420 public immutable snapshots;
    mapping(bytes32 => Record) private _records;
    mapping(bytes32 => bytes32) public evidenceForMisconduct;

    error InvalidEvidence();
    error Replay();

    event ConflictingWorkerResultEvidenceRecorded(
        bytes32 indexed evidenceRef,
        bytes32 indexed misconductKey,
        bytes32 indexed workerId,
        address operator,
        bytes32 jobId,
        bytes32 assignmentRef,
        uint64 attempt
    );

    constructor(address snapshots_) {
        if (snapshots_.code.length == 0) revert InvalidEvidence();
        snapshots = IComputeWorkerConflictSnapshot420(snapshots_);
    }

    function systemName() external pure returns (string memory) {
        return "ComputeWorkerConflictingResultSlashEvidence420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function submit(
        bytes32 jobId,
        bytes32 firstReceiptHash,
        bytes32 firstOutputHash,
        bytes calldata firstSignature,
        bytes32 secondReceiptHash,
        bytes32 secondOutputHash,
        bytes calldata secondSignature
    ) external returns (bytes32 evidenceRef) {
        if (
            jobId == bytes32(0)
                || firstReceiptHash == bytes32(0)
                || firstOutputHash == bytes32(0)
                || secondReceiptHash == bytes32(0)
                || secondOutputHash == bytes32(0)
                || (
                    firstReceiptHash == secondReceiptHash
                        && firstOutputHash == secondOutputHash
                )
        ) revert InvalidEvidence();

        bytes32 assignmentRef = snapshots.assignmentForJob(jobId);
        if (assignmentRef == bytes32(0)) revert InvalidEvidence();
        IComputeWorkerConflictSnapshot420.Assignment memory a =
            snapshots.getAssignment(assignmentRef);
        if (
            !a.exists
                || a.jobId != jobId
                || a.workerId == bytes32(0)
                || a.operator == address(0)
                || a.executionSigner == address(0)
                || a.admission.stakePolicyId == bytes32(0)
                || a.admission.stakeReference == bytes32(0)
                || a.attempt == 0
        ) revert InvalidEvidence();

        bytes32 firstDigest =
            snapshots.resultExecutionDigest(jobId, firstReceiptHash, firstOutputHash);
        bytes32 secondDigest =
            snapshots.resultExecutionDigest(jobId, secondReceiptHash, secondOutputHash);
        if (firstDigest == secondDigest) revert InvalidEvidence();

        if (
            ECDSA420.tryRecover(firstDigest, firstSignature) != a.executionSigner
                || ECDSA420.tryRecover(secondDigest, secondSignature) != a.executionSigner
        ) revert InvalidEvidence();

        bytes32 misconductKey = keccak256(
            abi.encode(
                MISCONDUCT_DOMAIN,
                block.chainid,
                address(this),
                address(snapshots),
                jobId,
                assignmentRef,
                a.workerId,
                a.workerRevision,
                a.attempt,
                a.executionSigner
            )
        );
        if (evidenceForMisconduct[misconductKey] != bytes32(0)) revert Replay();

        bytes32 low = firstDigest;
        bytes32 high = secondDigest;
        if (high < low) {
            low = secondDigest;
            high = firstDigest;
        }
        bytes32 evidenceCommitment = keccak256(
            abi.encode(
                EVIDENCE_DOMAIN,
                jobId,
                assignmentRef,
                a.workerId,
                a.workerRevision,
                a.attempt,
                low,
                high,
                a.snapshotCommitment,
                a.admission.stakePolicyId,
                a.admission.stakeReference
            )
        );
        evidenceRef = keccak256(
            abi.encode(
                EVIDENCE_DOMAIN,
                block.chainid,
                address(this),
                misconductKey,
                evidenceCommitment
            )
        );
        if (_records[evidenceRef].exists) revert Replay();

        _records[evidenceRef] = Record({
            jobId: jobId,
            assignmentRef: assignmentRef,
            workerId: a.workerId,
            operator: a.operator,
            stakePolicyId: a.admission.stakePolicyId,
            workerRevision: a.workerRevision,
            attempt: a.attempt,
            firstDigest: low,
            secondDigest: high,
            misconductKey: misconductKey,
            evidenceCommitment: evidenceCommitment,
            recordedAt: uint64(block.timestamp),
            exists: true
        });
        evidenceForMisconduct[misconductKey] = evidenceRef;

        emit ConflictingWorkerResultEvidenceRecorded(
            evidenceRef,
            misconductKey,
            a.workerId,
            a.operator,
            jobId,
            assignmentRef,
            a.attempt
        );
    }

    function slashEvidence(bytes32 evidenceRef)
        external
        view
        returns (Evidence memory evidence)
    {
        Record memory r = _records[evidenceRef];
        if (!r.exists) revert InvalidEvidence();

        evidence = Evidence({
            subjectKind: 1,
            subjectRef: r.workerId,
            subjectAccount: r.operator,
            stakePolicyId: r.stakePolicyId,
            verificationPolicyId: bytes32(0),
            verificationPolicyRevision: 0,
            verificationPolicyCommitment: bytes32(0),
            violationCode: VIOLATION_CODE,
            misconductKey: r.misconductKey,
            evidenceCommitment: r.evidenceCommitment,
            evidenceAt: r.recordedAt,
            finalObjective: true
        });
    }

    function record(bytes32 evidenceRef) external view returns (Record memory r) {
        r = _records[evidenceRef];
        if (!r.exists) revert InvalidEvidence();
    }
}
