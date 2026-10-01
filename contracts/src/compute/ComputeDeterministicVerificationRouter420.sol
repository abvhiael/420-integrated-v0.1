// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ComputeJobRegistry420.sol";
import "./ComputeJobMatchedWorkerEvidence420.sol";
import "./ComputeDeterministicAdapterRegistry420.sol";

/// @notice Freezes and executes deterministic verification adapters against canonical committed job data.
/// @dev Produces deterministic evaluation evidence only. It does not submit a verdict or mutate job/settlement state.
contract ComputeDeterministicVerificationRouter420 {
    bytes32 public constant BINDING_DOMAIN =
        keccak256("420/COMPUTE/DETERMINISTIC_ADAPTER_BINDING/V1");
    bytes32 public constant EVALUATION_DOMAIN =
        keccak256("420/COMPUTE/DETERMINISTIC_ADAPTER_EVALUATION/V1");

    struct Binding {
        bytes32 workloadType;
        bytes32 profileId;
        uint64 adapterRevision;
        address adapter;
        bytes32 adapterCodeHash;
        bytes32 outputSchemaCommitment;
        uint64 jobRevision;
        bytes32 verificationPolicyId;
        uint32 verificationPolicyRevision;
        bytes32 verificationPolicyCommitment;
        bytes32 bindingRef;
        bool exists;
    }

    struct Evaluation {
        bytes32 bindingRef;
        bytes32 workerResultCommitment;
        bytes32 workerOutputCommitment;
        bytes32 expectedOutputCommitment;
        bytes32 adapterEvidence;
        bytes32 evaluationRef;
        bool correct;
        bool exists;
    }

    ComputeJobRegistry420 public immutable jobs;
    ComputeDeterministicAdapterRegistry420 public immutable adapters;

    mapping(bytes32 => Binding) private _binding;
    mapping(bytes32 => Evaluation) private _evaluation;

    error InvalidBinding();
    error InvalidEvidence();
    error Unauthorized();

    event DeterministicAdapterBound(
        bytes32 indexed jobId,
        bytes32 indexed profileId,
        uint64 indexed adapterRevision,
        address adapter,
        bytes32 bindingRef
    );
    event DeterministicEvaluationRecorded(
        bytes32 indexed jobId,
        bytes32 indexed evaluationRef,
        bool correct,
        bytes32 workerOutputCommitment,
        bytes32 expectedOutputCommitment
    );

    constructor(address jobs_, address adapters_) {
        if (jobs_.code.length == 0 || adapters_.code.length == 0) revert InvalidBinding();
        jobs = ComputeJobRegistry420(jobs_);
        adapters = ComputeDeterministicAdapterRegistry420(adapters_);
    }

    function binding(bytes32 jobId) external view returns (Binding memory b) {
        b = _binding[jobId];
        if (!b.exists) revert InvalidBinding();
    }

    function evaluation(bytes32 jobId) external view returns (Evaluation memory e) {
        e = _evaluation[jobId];
        if (!e.exists) revert InvalidEvidence();
    }

    /// @notice Freeze the exact current deterministic route while the job is ACCEPTED and before execution.
    function bindAdapter(bytes32 jobId, bytes32 profileId, uint64 adapterRevision)
        external returns (bytes32 bindingRef)
    {
        if (profileId == bytes32(0) || adapterRevision == 0 || _binding[jobId].exists)
            revert InvalidBinding();

        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        if (
            msg.sender != j.owner || j.status != ComputeJobRegistry420.Status.ACCEPTED
                || j.worker != address(0) || j.verificationPolicyId == bytes32(0)
                || j.verificationPolicyRevision == 0 || j.verificationPolicyCommitment == bytes32(0)
        ) revert Unauthorized();

        if (!adapters.isCurrentActive(j.workloadType, profileId, adapterRevision))
            revert InvalidBinding();

        ComputeDeterministicAdapterRegistry420.Route memory r =
            adapters.route(j.workloadType, profileId, adapterRevision);
        if (
            r.adapter.codehash != r.codeHash
                || r.outputSchemaCommitment != j.outputSchemaCommitment
        ) revert InvalidBinding();

        bindingRef = keccak256(
            abi.encode(
                BINDING_DOMAIN,
                block.chainid,
                address(this),
                jobId,
                j.revision,
                j.workloadType,
                profileId,
                adapterRevision,
                r.adapter,
                r.codeHash,
                r.outputSchemaCommitment,
                j.verificationPolicyId,
                j.verificationPolicyRevision,
                j.verificationPolicyCommitment
            )
        );

        _binding[jobId] = Binding({
            workloadType: j.workloadType,
            profileId: profileId,
            adapterRevision: adapterRevision,
            adapter: r.adapter,
            adapterCodeHash: r.codeHash,
            outputSchemaCommitment: r.outputSchemaCommitment,
            jobRevision: j.revision,
            verificationPolicyId: j.verificationPolicyId,
            verificationPolicyRevision: j.verificationPolicyRevision,
            verificationPolicyCommitment: j.verificationPolicyCommitment,
            bindingRef: bindingRef,
            exists: true
        });

        emit DeterministicAdapterBound(jobId, profileId, adapterRevision, r.adapter, bindingRef);
    }

    /// @notice Independently recompute and bind evidence to the worker's actual committed output.
    function evaluate(bytes32 jobId, bytes calldata inputData, bytes calldata outputData)
        external returns (bytes32 evaluationRef, bool correct)
    {
        Binding memory b = _binding[jobId];
        if (!b.exists || _evaluation[jobId].exists) revert InvalidBinding();

        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        if (
            j.status != ComputeJobRegistry420.Status.RESULT_COMMITTED
                || j.resultCommitment == bytes32(0)
                || j.workloadType != b.workloadType
                || j.outputSchemaCommitment != b.outputSchemaCommitment
                || j.verificationPolicyId != b.verificationPolicyId
                || j.verificationPolicyRevision != b.verificationPolicyRevision
                || j.verificationPolicyCommitment != b.verificationPolicyCommitment
        ) revert InvalidEvidence();

        if (b.adapter.codehash != b.adapterCodeHash) revert InvalidEvidence();

        IComputeDeterministicVerificationAdapter420 adapter =
            IComputeDeterministicVerificationAdapter420(b.adapter);
        bytes32 recomputedInput = adapter.inputCommitment(inputData);
        bytes32 recomputedOutput = adapter.outputCommitment(outputData);
        if (recomputedInput != j.inputCommitment || recomputedOutput == bytes32(0))
            revert InvalidEvidence();

        ComputeJobMatchedWorkerEvidence420 workerEvidence =
            ComputeJobMatchedWorkerEvidence420(address(jobs.workerEvidence()));
        ComputeJobMatchedWorkerEvidence420.Assignment memory a =
            workerEvidence.getAssignment(j.assignmentRef);
        if (
            !a.exists || a.jobId != jobId || a.worker != j.worker
                || a.resultCommitment != j.resultCommitment
                || a.outputHash != recomputedOutput || a.receiptHash == bytes32(0)
        ) revert InvalidEvidence();

        bytes32 expectedOutputCommitment;
        bytes32 adapterEvidence;
        (correct, expectedOutputCommitment, adapterEvidence) =
            adapter.evaluate(inputData, outputData);
        if (expectedOutputCommitment == bytes32(0) || adapterEvidence == bytes32(0))
            revert InvalidEvidence();

        evaluationRef = keccak256(
            abi.encode(
                EVALUATION_DOMAIN,
                block.chainid,
                address(this),
                jobId,
                b.bindingRef,
                j.resultCommitment,
                recomputedOutput,
                expectedOutputCommitment,
                adapterEvidence,
                correct
            )
        );

        _evaluation[jobId] = Evaluation({
            bindingRef: b.bindingRef,
            workerResultCommitment: j.resultCommitment,
            workerOutputCommitment: recomputedOutput,
            expectedOutputCommitment: expectedOutputCommitment,
            adapterEvidence: adapterEvidence,
            evaluationRef: evaluationRef,
            correct: correct,
            exists: true
        });

        emit DeterministicEvaluationRecorded(
            jobId, evaluationRef, correct, recomputedOutput, expectedOutputCommitment
        );
    }
}
