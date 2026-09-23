// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ComputeJobRegistry420.sol";
import "./ComputeAuthorization420.sol";

/// @notice A real account holding a current job-scoped verifier capability
/// submits its own immutable decision in an on-chain transaction. This verifies
/// decision provenance, NOT that the computed output is objectively correct.
/// Independent verifier selection/profile and proof engines belong to CMP-1.4.
contract ComputeJobVerifierEvidence420 is IComputeJobVerificationEvidence420 {
    bytes32 private constant DECISION_DOMAIN = keccak256("420/COMPUTE/VERIFIER_DECISION/V1");
    struct Decision {
        bytes32 jobId;
        bytes32 assignmentRef;
        bytes32 resultCommitment;
        bytes32 evidenceHash;
        address verifier;
        bool approved;
        bool exists;
    }
    ComputeJobRegistry420 public jobs;
    ComputeAuthorization420 public immutable authorization;
    address public immutable bindingAdmin;
    mapping(bytes32 => Decision) public decision;
    mapping(bytes32 => bytes32) public decisionForJob;
    error Unauthorized();
    error InvalidEvidence();
    event JobRegistryBound(address indexed registry);
    event DecisionSubmitted(bytes32 indexed jobId, bytes32 indexed decisionRef, address indexed verifier,
        bytes32 resultCommitment, bool approved);

    constructor(address authorization_) {
        if (authorization_.code.length == 0) revert InvalidEvidence();
        authorization = ComputeAuthorization420(authorization_);
        bindingAdmin = msg.sender;
    }

    /// @notice Resolve constructor circularity once; no subsequent authority rotation.
    function bindJobs(address jobs_) external {
        if (msg.sender != bindingAdmin || address(jobs) != address(0) || jobs_.code.length == 0)
            revert Unauthorized();
        if (address(ComputeJobRegistry420(jobs_).verificationEvidence()) != address(this)) revert InvalidEvidence();
        jobs = ComputeJobRegistry420(jobs_);
        emit JobRegistryBound(jobs_);
    }

    /// @dev Cannot designate another account as the verifier; msg.sender is the signer.
    function submitDecision(bytes32 jobId, uint64 expectedRevision, bytes32 evidenceHash, bool approved)
        external returns (bytes32 decisionRef) {
        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        if (j.status != ComputeJobRegistry420.Status.RESULT_COMMITTED || j.revision != expectedRevision
            || j.resultCommitment == bytes32(0) || j.assignmentRef == bytes32(0)
            || evidenceHash == bytes32(0) || decisionForJob[jobId] != bytes32(0)) revert InvalidEvidence();
        if (msg.sender == j.owner || msg.sender == j.worker || msg.sender == address(0)) revert Unauthorized();
        if (!authorization.isAuthorized(msg.sender, authorization.ACTION_VERIFY_RESULT(),
                authorization.scopeJob(jobId), 0)) revert Unauthorized();
        decisionRef = keccak256(abi.encode(DECISION_DOMAIN, block.chainid, address(this),
            jobId, j.assignmentRef, j.resultCommitment, msg.sender, evidenceHash, approved));
        decision[decisionRef] = Decision(jobId, j.assignmentRef, j.resultCommitment,
            evidenceHash, msg.sender, approved, true);
        decisionForJob[jobId] = decisionRef;
        jobs.recordVerification(jobId, expectedRevision, msg.sender, decisionRef, approved);
        emit DecisionSubmitted(jobId, decisionRef, msg.sender, j.resultCommitment, approved);
    }

    function verified(bytes32 jobId, bytes32 resultCommitment, address verifier, bytes32 decisionRef, bool approved)
        external view returns (bool) {
        Decision storage d = decision[decisionRef];
        return d.exists && d.jobId == jobId && d.resultCommitment == resultCommitment
            && d.verifier == verifier && d.approved == approved && d.evidenceHash != bytes32(0)
            && d.assignmentRef != bytes32(0) && decisionForJob[jobId] == decisionRef;
    }
}
