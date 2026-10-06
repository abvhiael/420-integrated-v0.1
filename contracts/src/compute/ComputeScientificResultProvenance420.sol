// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ComputeJobRegistry420.sol";
import "../interfaces/I420System.sol";

interface IComputeScientificWorkerEvidence420 {
    function jobs() external view returns (address);
    function verdictContext(bytes32 jobId) external view returns (
        bytes32 unitId,
        bytes32 attemptRef,
        uint64 attempt,
        address worker,
        bytes32 resultCommitment,
        bytes32 executionEvidenceCommitment
    );
}

/// @notice Read-only adapter that exposes canonical result/verification context for CMP-4.6.
/// @dev It composes existing JobRegistry + worker evidence; it owns no result or verifier state.
contract ComputeScientificResultSource420 is I420System {
    struct CanonicalResultContext {
        bytes32 unitId;
        bytes32 attemptRef;
        uint64 attempt;
        address worker;
        bytes32 resultCommitment;
        bytes32 executionEvidenceCommitment;
        bytes32 manifestHash;
        bytes32 inputCommitment;
        bytes32 outputSchemaCommitment;
        bytes32 fundingRef;
        bytes32 verificationStrategyCommitment;
        uint64 deadline;
        address verifier;
        bytes32 verificationRef;
        bool verificationRecorded;
    }

    ComputeJobRegistry420 public immutable jobs;
    IComputeScientificWorkerEvidence420 public immutable workerEvidence;

    error InvalidSource();
    error InvalidContext();

    constructor(address jobs_, address workerEvidence_) {
        if (jobs_.code.length == 0 || workerEvidence_.code.length == 0) revert InvalidSource();
        jobs = ComputeJobRegistry420(jobs_);
        workerEvidence = IComputeScientificWorkerEvidence420(workerEvidence_);
        if (workerEvidence.jobs() != jobs_) revert InvalidSource();
    }

    function systemName() external pure returns (string memory) {
        return "ComputeScientificResultSource420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function context(bytes32 jobId) external view returns (CanonicalResultContext memory c) {
        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        (
            c.unitId,
            c.attemptRef,
            c.attempt,
            c.worker,
            c.resultCommitment,
            c.executionEvidenceCommitment
        ) = workerEvidence.verdictContext(jobId);

        if (
            c.unitId == bytes32(0) || c.attemptRef == bytes32(0) || c.attempt == 0
                || c.worker == address(0) || c.resultCommitment == bytes32(0)
                || c.executionEvidenceCommitment == bytes32(0)
                || c.unitId != jobId || j.resultCommitment != c.resultCommitment
                || j.manifestHash == bytes32(0) || j.inputCommitment == bytes32(0)
                || j.outputSchemaCommitment == bytes32(0) || j.fundingRef == bytes32(0)
                || j.verificationPolicyCommitment == bytes32(0) || j.deadline == 0
        ) revert InvalidContext();

        c.manifestHash = j.manifestHash;
        c.inputCommitment = j.inputCommitment;
        c.outputSchemaCommitment = j.outputSchemaCommitment;
        c.fundingRef = j.fundingRef;
        c.verificationStrategyCommitment = j.verificationPolicyCommitment;
        c.deadline = j.deadline;
        c.verifier = j.verifier;
        c.verificationRef = j.verificationRef;
        c.verificationRecorded = j.verifier != address(0) && j.verificationRef != bytes32(0);
    }
}

interface IComputeScientificResultSource420 {
    function systemName() external view returns (string memory);
    function protocolVersion() external view returns (uint32);
    function context(bytes32 jobId)
        external
        view
        returns (ComputeScientificResultSource420.CanonicalResultContext memory);
}

/// @notice CMP-4.6 immutable scientific result-provenance overlay.
/// @dev Records only commitments/references already backed by canonical Compute result and verification state.
contract ComputeScientificResultProvenance420 is I420System {
    bytes32 public constant SCIENTIFIC_UNIT_DOMAIN_V1 =
        keccak256("420Integrated.ComputeMarket.ScientificWorkUnit.v1");
    bytes32 public constant PROVENANCE_DOMAIN =
        keccak256("420/COMPUTE/SCIENTIFIC_RESULT_PROVENANCE/V1");

    struct ScientificBinding {
        bytes32 researchProjectCommitment;
        bytes32 executableContainerCommitment;
        bytes32 parametersCommitment;
        bytes32 resourceClass;
    }

    struct Provenance {
        bytes32 jobId;
        bytes32 unitId;
        bytes32 scientificWorkUnitCommitment;
        bytes32 attemptRef;
        uint64 attempt;
        address worker;
        bytes32 resultCommitment;
        bytes32 executionEvidenceCommitment;
        address verifier;
        bytes32 verificationRef;
        bytes32 outputSchemaCommitment;
        uint64 recordedAt;
        bool exists;
    }

    IComputeScientificResultSource420 public immutable source;
    mapping(bytes32 => Provenance) private _provenance;
    mapping(bytes32 => bytes32) public provenanceForJob;

    error InvalidSource();
    error InvalidProvenance();
    error ConflictingProvenance();

    event ScientificResultProvenanceRecorded(
        bytes32 indexed provenanceId,
        bytes32 indexed jobId,
        bytes32 indexed scientificWorkUnitCommitment,
        bytes32 resultCommitment,
        bytes32 verificationRef
    );

    constructor(IComputeScientificResultSource420 source_) {
        address sourceAddress = address(source_);
        if (sourceAddress == address(0) || sourceAddress.code.length == 0) revert InvalidSource();
        if (
            keccak256(bytes(source_.systemName()))
                != keccak256(bytes("ComputeScientificResultSource420"))
                || source_.protocolVersion() != 1
        ) revert InvalidSource();
        source = source_;
    }

    function systemName() external pure returns (string memory) {
        return "ComputeScientificResultProvenance420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function recordProvenance(
        bytes32 jobId,
        bytes32 expectedScientificWorkUnitCommitment,
        ScientificBinding calldata binding
    ) external returns (bytes32 provenanceId) {
        if (
            jobId == bytes32(0) || expectedScientificWorkUnitCommitment == bytes32(0)
                || binding.researchProjectCommitment == bytes32(0)
                || binding.executableContainerCommitment == bytes32(0)
                || binding.parametersCommitment == bytes32(0)
                || binding.resourceClass == bytes32(0)
        ) revert InvalidProvenance();

        ComputeScientificResultSource420.CanonicalResultContext memory c = source.context(jobId);
        if (
            !c.verificationRecorded || c.verifier == address(0) || c.verificationRef == bytes32(0)
                || c.resultCommitment == bytes32(0) || c.executionEvidenceCommitment == bytes32(0)
        ) revert InvalidProvenance();

        bytes32 scientific = keccak256(
            abi.encode(
                SCIENTIFIC_UNIT_DOMAIN_V1,
                uint32(1),
                block.chainid,
                c.unitId,
                binding.researchProjectCommitment,
                c.manifestHash,
                binding.executableContainerCommitment,
                c.inputCommitment,
                binding.parametersCommitment,
                binding.resourceClass,
                c.outputSchemaCommitment,
                c.verificationStrategyCommitment,
                c.deadline,
                c.fundingRef
            )
        );
        if (scientific != expectedScientificWorkUnitCommitment) revert InvalidProvenance();

        provenanceId = keccak256(
            abi.encode(
                PROVENANCE_DOMAIN,
                block.chainid,
                address(this),
                address(source),
                jobId,
                c.unitId,
                scientific,
                c.attemptRef,
                c.attempt,
                c.worker,
                c.resultCommitment,
                c.executionEvidenceCommitment,
                c.verifier,
                c.verificationRef,
                c.outputSchemaCommitment
            )
        );

        bytes32 existing = provenanceForJob[jobId];
        if (existing != bytes32(0)) {
            if (existing != provenanceId) revert ConflictingProvenance();
            return existing;
        }

        _provenance[provenanceId] = Provenance({
            jobId: jobId,
            unitId: c.unitId,
            scientificWorkUnitCommitment: scientific,
            attemptRef: c.attemptRef,
            attempt: c.attempt,
            worker: c.worker,
            resultCommitment: c.resultCommitment,
            executionEvidenceCommitment: c.executionEvidenceCommitment,
            verifier: c.verifier,
            verificationRef: c.verificationRef,
            outputSchemaCommitment: c.outputSchemaCommitment,
            recordedAt: uint64(block.timestamp),
            exists: true
        });
        provenanceForJob[jobId] = provenanceId;

        emit ScientificResultProvenanceRecorded(
            provenanceId, jobId, scientific, c.resultCommitment, c.verificationRef
        );
    }

    function provenance(bytes32 provenanceId) external view returns (Provenance memory p) {
        p = _provenance[provenanceId];
        if (!p.exists) revert InvalidProvenance();
    }

    /// @notice Rechecks that canonical result/verification context still matches the immutable record.
    /// @dev This does not re-verify scientific correctness; it only detects source/context drift.
    function isCanonical(bytes32 provenanceId) external view returns (bool) {
        Provenance memory p = _provenance[provenanceId];
        if (!p.exists) return false;

        try source.context(p.jobId) returns (
            ComputeScientificResultSource420.CanonicalResultContext memory c
        ) {
            return c.verificationRecorded
                && c.unitId == p.unitId
                && c.attemptRef == p.attemptRef
                && c.attempt == p.attempt
                && c.worker == p.worker
                && c.resultCommitment == p.resultCommitment
                && c.executionEvidenceCommitment == p.executionEvidenceCommitment
                && c.verifier == p.verifier
                && c.verificationRef == p.verificationRef
                && c.outputSchemaCommitment == p.outputSchemaCommitment;
        } catch {
            return false;
        }
    }
}
