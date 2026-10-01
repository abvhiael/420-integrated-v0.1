// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ComputeJobRegistry420.sol";
import "./ComputeJobMatchedWorkerEvidence420.sol";
import "./ComputeScientificAdapterRegistry420.sol";

/// @notice Freezes and executes scientific/probabilistic verification protocols against canonical job data.
/// @dev Produces workload-specific validation evidence only; PASS/FAIL/INCONCLUSIVE are not canonical job states.
contract ComputeScientificVerificationRouter420 {
    bytes32 public constant BINDING_DOMAIN =
        keccak256("420/COMPUTE/SCIENTIFIC_ADAPTER_BINDING/V1");
    bytes32 public constant EVALUATION_DOMAIN =
        keccak256("420/COMPUTE/SCIENTIFIC_ADAPTER_EVALUATION/V1");

    struct Binding {
        bytes32 workloadType;
        bytes32 profileId;
        uint64 adapterRevision;
        address adapter;
        bytes32 adapterCodeHash;
        bytes32 outputSchemaCommitment;
        bytes32 protocolCommitment;
        bytes32 sampleSeedCommitment;
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
        bytes32 adapterEvidence;
        bytes32 evaluationRef;
        uint32 sampleCount;
        uint32 coverageBps;
        uint8 outcome;
        bool exists;
    }

    ComputeJobRegistry420 public immutable jobs;
    ComputeScientificAdapterRegistry420 public immutable adapters;
    address public immutable samplingAuthority;

    mapping(bytes32 => Binding) private _binding;
    mapping(bytes32 => Evaluation) private _evaluation;

    error InvalidBinding();
    error InvalidEvidence();
    error Unauthorized();

    event ScientificAdapterBound(
        bytes32 indexed jobId,
        bytes32 indexed profileId,
        uint64 indexed adapterRevision,
        address adapter,
        bytes32 protocolCommitment,
        bytes32 sampleSeedCommitment,
        bytes32 bindingRef
    );
    event ScientificEvaluationRecorded(
        bytes32 indexed jobId,
        bytes32 indexed evaluationRef,
        uint8 outcome,
        uint32 sampleCount,
        uint32 coverageBps,
        bytes32 workerOutputCommitment
    );

    constructor(address jobs_, address adapters_, address samplingAuthority_) {
        if (
            jobs_.code.length == 0 || adapters_.code.length == 0
                || samplingAuthority_ == address(0)
        ) revert InvalidBinding();
        jobs = ComputeJobRegistry420(jobs_);
        adapters = ComputeScientificAdapterRegistry420(adapters_);
        samplingAuthority = samplingAuthority_;
    }

    function binding(bytes32 jobId) external view returns (Binding memory b) {
        b = _binding[jobId];
        if (!b.exists) revert InvalidBinding();
    }

    function evaluation(bytes32 jobId) external view returns (Evaluation memory e) {
        e = _evaluation[jobId];
        if (!e.exists) revert InvalidEvidence();
    }

    /// @notice Freeze an exact scientific protocol and hidden sample-plan commitment before execution.
    /// @dev The dedicated sampling authority is intentionally distinct from the worker/job owner surface.
    function bindAdapter(
        bytes32 jobId,
        bytes32 profileId,
        uint64 adapterRevision,
        bytes32 sampleSeedCommitment_
    ) external returns (bytes32 bindingRef) {
        if (
            msg.sender != samplingAuthority || profileId == bytes32(0)
                || adapterRevision == 0 || sampleSeedCommitment_ == bytes32(0)
                || _binding[jobId].exists
        ) revert Unauthorized();

        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        if (
            j.status != ComputeJobRegistry420.Status.ACCEPTED || j.worker != address(0)
                || j.owner == samplingAuthority
                || j.verificationPolicyId == bytes32(0)
                || j.verificationPolicyRevision == 0
                || j.verificationPolicyCommitment == bytes32(0)
        ) revert InvalidBinding();

        if (!adapters.isCurrentActive(j.workloadType, profileId, adapterRevision))
            revert InvalidBinding();

        ComputeScientificAdapterRegistry420.Route memory r =
            adapters.route(j.workloadType, profileId, adapterRevision);
        if (
            r.adapter.codehash != r.codeHash
                || r.outputSchemaCommitment != j.outputSchemaCommitment
                || r.protocolCommitment == bytes32(0)
        ) revert InvalidBinding();

        bindingRef = keccak256(abi.encode(
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
            r.protocolCommitment,
            sampleSeedCommitment_,
            j.verificationPolicyId,
            j.verificationPolicyRevision,
            j.verificationPolicyCommitment
        ));

        _binding[jobId] = Binding({
            workloadType: j.workloadType,
            profileId: profileId,
            adapterRevision: adapterRevision,
            adapter: r.adapter,
            adapterCodeHash: r.codeHash,
            outputSchemaCommitment: r.outputSchemaCommitment,
            protocolCommitment: r.protocolCommitment,
            sampleSeedCommitment: sampleSeedCommitment_,
            jobRevision: j.revision,
            verificationPolicyId: j.verificationPolicyId,
            verificationPolicyRevision: j.verificationPolicyRevision,
            verificationPolicyCommitment: j.verificationPolicyCommitment,
            bindingRef: bindingRef,
            exists: true
        });

        emit ScientificAdapterBound(
            jobId,
            profileId,
            adapterRevision,
            r.adapter,
            r.protocolCommitment,
            sampleSeedCommitment_,
            bindingRef
        );
    }

    /// @notice Validate exact workload-specific evidence against the worker's actual committed output.
    /// @dev Any caller may relay objective evidence. The committed seed and adapter semantics make the result unique.
    function evaluate(bytes32 jobId, bytes calldata evidenceData)
        external returns (bytes32 evaluationRef, uint8 outcome)
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
                || b.adapter.codehash != b.adapterCodeHash
        ) revert InvalidEvidence();

        ComputeJobMatchedWorkerEvidence420 workerEvidence =
            ComputeJobMatchedWorkerEvidence420(address(jobs.workerEvidence()));
        ComputeJobMatchedWorkerEvidence420.Assignment memory a =
            workerEvidence.getAssignment(j.assignmentRef);
        if (
            !a.exists || a.jobId != jobId || a.worker != j.worker
                || a.worker == samplingAuthority
                || a.resultCommitment != j.resultCommitment
                || a.outputHash == bytes32(0) || a.receiptHash == bytes32(0)
        ) revert InvalidEvidence();

        IComputeScientificVerificationAdapter420 adapter =
            IComputeScientificVerificationAdapter420(b.adapter);
        if (adapter.protocolCommitment() != b.protocolCommitment) revert InvalidEvidence();

        uint32 sampleCount;
        uint32 coverageBps;
        bytes32 adapterEvidence;
        (outcome, sampleCount, coverageBps, adapterEvidence) = adapter.evaluate(
            j.inputCommitment,
            a.outputHash,
            b.sampleSeedCommitment,
            evidenceData
        );
        if (outcome > 2 || sampleCount == 0 || coverageBps > 10_000 || adapterEvidence == bytes32(0))
            revert InvalidEvidence();

        evaluationRef = keccak256(abi.encode(
            EVALUATION_DOMAIN,
            block.chainid,
            address(this),
            jobId,
            b.bindingRef,
            j.resultCommitment,
            a.outputHash,
            adapterEvidence,
            sampleCount,
            coverageBps,
            outcome
        ));

        _evaluation[jobId] = Evaluation({
            bindingRef: b.bindingRef,
            workerResultCommitment: j.resultCommitment,
            workerOutputCommitment: a.outputHash,
            adapterEvidence: adapterEvidence,
            evaluationRef: evaluationRef,
            sampleCount: sampleCount,
            coverageBps: coverageBps,
            outcome: outcome,
            exists: true
        });

        emit ScientificEvaluationRecorded(
            jobId, evaluationRef, outcome, sampleCount, coverageBps, a.outputHash
        );
    }
}
