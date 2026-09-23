// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ComputeJobPolicyEnforcedVerification420.sol";
import "./ComputeJobMatchedWorkerEvidence420.sol";

/// @notice Profile v1: bounded four-element integer sum of squares.
/// @dev A reproducible computation profile, NOT GPU execution or general ML correctness proof.
/// Accepted input: four unsigned integers, each <= 1e9. The output is their exact
/// uint256 sum of squares. The input and output use versioned abi.encode commitments.
/// This adapter checks independently against the worker's immutable, assigned result
/// commitment, binds evaluation evidence to the EIP-712 verdict digest and advances
/// the canonical registry only when the signed verdict agrees with the calculation.
contract ComputeJobIntegerProfileVerification420 is ComputeJobPolicyEnforcedVerification420 {
    bytes32 public constant PROFILE_ID = keccak256("420/CMP/PROFILE/INTEGER_SUM_OF_SQUARES/V1");
    bytes32 public constant WORKLOAD_TYPE = keccak256("420/CMP/WORKLOAD/INTEGER_SUM_OF_SQUARES/V1");
    bytes32 public constant INPUT_DOMAIN = keccak256("420/CMP/INPUT/INTEGER_SUM_OF_SQUARES/V1");
    bytes32 public constant OUTPUT_DOMAIN = keccak256("420/CMP/OUTPUT/INTEGER_SUM_OF_SQUARES/V1");
    bytes32 public constant OUTPUT_SCHEMA = keccak256("420/CMP/SCHEMA/UINT256_SUM_OF_SQUARES/V1");
    bytes32 public constant EVIDENCE_DOMAIN = keccak256("420/CMP/EVALUATION/INTEGER_SUM_OF_SQUARES/V1");
    bytes32 private constant RESULT_DOMAIN = keccak256("420/COMPUTE/STRICT_RESULT/V1");
    uint64 public constant MAX_ELEMENT = 1_000_000_000;

    struct Evaluation {
        bytes32 decisionRef;
        bytes32 evidenceRef;
        bytes32 jobId;
        bytes32 inputCommitment;
        bytes32 workerResultCommitment;
        bytes32 workerOutputHash;
        bytes32 receiptHash;
        uint256 claimedOutput;
        uint256 expectedOutput;
        bool approved;
        bool exists;
    }

    mapping(bytes32 => Evaluation) private _evaluationByDecision;
    event IntegerEvaluationRecorded(bytes32 indexed jobId, bytes32 indexed decisionRef,
        bytes32 indexed evidenceRef, bool approved);

    constructor(address matches_, address authorization_, address policy_)
        ComputeJobPolicyEnforcedVerification420(matches_, authorization_, policy_) {}

    /// @dev Block the inherited signature-only entrypoint, including for negative verdicts.
    function submitVerdict(Verdict calldata, bytes calldata)
        public pure override returns (bytes32) { revert InvalidEvidence(); }

    function expectedResult(uint64[4] calldata values) public pure returns (uint256 sum) {
        for (uint256 i; i < 4; ++i) {
            if (values[i] > MAX_ELEMENT) revert InvalidEvidence();
            sum += uint256(values[i]) * uint256(values[i]);
        }
    }

    function inputHash(uint64[4] calldata values) public pure returns (bytes32) {
        return keccak256(abi.encode(INPUT_DOMAIN, values));
    }

    function outputHash(uint256 value) public pure returns (bytes32) {
        return keccak256(abi.encode(OUTPUT_DOMAIN, value));
    }

    /// @notice Independently evaluate a committed worker output and submit the signed verdict.
    /// @param values Full committed input; no requester or worker supplied expected answer is trusted.
    /// @param claimedOutput Full worker output preimage, checked against the committed receipt.
    /// @param receiptHash Worker receipt preimage hash included in the assigned result commitment.
    function submitEvaluatedVerdict(Verdict calldata v, bytes calldata signature,
        uint64[4] calldata values, uint256 claimedOutput, bytes32 receiptHash)
        external returns (bytes32 decisionRef, bytes32 evidenceRef)
    {
        if (address(jobs) == address(0) || v.profileId != PROFILE_ID || receiptHash == bytes32(0))
            revert InvalidEvidence();
        ComputeJobRegistry420.Job memory j = jobs.job(v.jobId);
        if (j.workloadType != WORKLOAD_TYPE || j.outputSchemaCommitment != OUTPUT_SCHEMA
            || j.inputCommitment != inputHash(values) || j.resultCommitment != v.resultCommitment
            || j.assignmentRef != v.assignmentRef) revert InvalidEvidence();

        // Check the COMPLETE worker result preimage rather than only comparing a caller's numbers.
        ComputeJobMatchedWorkerEvidence420 workerEvidence =
            ComputeJobMatchedWorkerEvidence420(address(jobs.workerEvidence()));
        ComputeJobMatchedWorkerEvidence420.Assignment memory a = workerEvidence.getAssignment(j.assignmentRef);
        bytes32 workerOutputHash = outputHash(claimedOutput);
        bytes32 committed = keccak256(abi.encode(RESULT_DOMAIN, block.chainid, address(workerEvidence),
            v.jobId, j.requestId, j.manifestHash, a.matchId, a.acceptanceRef, j.assignmentRef,
            a.resourceId, a.attempt, a.worker, receiptHash, workerOutputHash));
        if (!a.exists || a.jobId != v.jobId || a.resultCommitment != committed
            || a.receiptHash != receiptHash || committed != j.resultCommitment) revert InvalidEvidence();

        uint256 expected = expectedResult(values);
        bool correct = claimedOutput == expected;
        if (v.approved != correct) revert InvalidEvidence();
        // A signed verdict is bound to the exact result and profile. Evidence is deterministically
        // committed to the verdict digest, including the independently recomputed expected value.
        bytes32 digest = verdictDigest(v);
        evidenceRef = keccak256(abi.encode(EVIDENCE_DOMAIN, digest, v.jobId,
            j.inputCommitment, committed, workerOutputHash, receiptHash, claimedOutput, expected, correct));
        if (evidenceRef == bytes32(0) || _evaluationByDecision[digest].exists) revert InvalidEvidence();
        // This call enforces appointed verifier independence, canonical capability and signature.
        // A revert rolls back the evaluation record and all state changes atomically.
        decisionRef = super.submitVerdict(v, signature);
        if (decisionRef != digest) revert InvalidEvidence();
        _evaluationByDecision[decisionRef] = Evaluation(decisionRef, evidenceRef, v.jobId,
            j.inputCommitment, committed, workerOutputHash, receiptHash, claimedOutput,
            expected, correct, true);
        emit IntegerEvaluationRecorded(v.jobId, decisionRef, evidenceRef, correct);
    }

    function evaluation(bytes32 decisionRef) external view returns (Evaluation memory e) {
        e = _evaluationByDecision[decisionRef];
        if (!e.exists) revert InvalidEvidence();
    }
}
