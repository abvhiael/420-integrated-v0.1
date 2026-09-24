// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ComputeJobIntegerProfileVerification420.sol";
import "./ComputeJobPayerCustody420.sol";

/// @notice Immutable, chain-specific audit record of an intended CMP-1.1.4 installation.
/// @dev Does not deploy, publish or certify an installation. Runtime code hashes must
/// be independently reviewed before their expected values are supplied here.
contract ComputeJobCanonicalWiring420 {
    ComputeJobRegistry420 public immutable canonicalJobs;
    ComputeJobIntegerProfileVerification420 public immutable canonicalVerification;
    ComputeVerifierIndependencePolicy420 public immutable canonicalPolicy;
    address public immutable expectedGovernance;
    address public immutable expectedAttestor;
    address public immutable expectedSelector;
    uint64 public immutable expectedPolicyEpoch;
    uint256 public immutable expectedChainId;
    bytes32 public immutable expectedJobCodeHash;
    bytes32 public immutable expectedVerificationCodeHash;
    bytes32 public immutable expectedPolicyCodeHash;
    error InvalidWiring();

    constructor(address jobs_, address verification_, address policy_,
        address governance_, address attestor_, address selector_, uint64 epoch_,
        bytes32 jobCodeHash_, bytes32 verificationCodeHash_, bytes32 policyCodeHash_) {
        if (jobs_ == address(0) || verification_ == address(0) || policy_ == address(0)
            || governance_ == address(0) || attestor_ == address(0) || selector_ == address(0)
            || epoch_ == 0 || jobCodeHash_ == bytes32(0) || verificationCodeHash_ == bytes32(0)
            || policyCodeHash_ == bytes32(0)) revert InvalidWiring();
        canonicalJobs = ComputeJobRegistry420(jobs_);
        canonicalVerification = ComputeJobIntegerProfileVerification420(verification_);
        canonicalPolicy = ComputeVerifierIndependencePolicy420(policy_);
        expectedGovernance = governance_;
        expectedAttestor = attestor_;
        expectedSelector = selector_;
        expectedPolicyEpoch = epoch_;
        expectedChainId = block.chainid;
        expectedJobCodeHash = jobCodeHash_;
        expectedVerificationCodeHash = verificationCodeHash_;
        expectedPolicyCodeHash = policyCodeHash_;
        assertWiring();
    }

    /// @notice Recheck code hashes, one-time bindings, upstream dependencies, profile and roles.
    /// @dev An authority rotation or policy-epoch change fails closed.
    function assertWiring() public view {
        ComputeJobRegistry420 j = canonicalJobs;
        ComputeJobIntegerProfileVerification420 v = canonicalVerification;
        ComputeVerifierIndependencePolicy420 p = canonicalPolicy;
        ComputeJobAcceptedMatch420 m = ComputeJobAcceptedMatch420(address(j.matchEvidence()));
        ComputeJobMatchedWorkerEvidence420 w = ComputeJobMatchedWorkerEvidence420(address(j.workerEvidence()));
        ComputeJobPayerCustody420 c = ComputeJobPayerCustody420(payable(address(j.fundingEvidence())));
        if (block.chainid != expectedChainId || address(j).codehash != expectedJobCodeHash
            || address(v).codehash != expectedVerificationCodeHash
            || address(p).codehash != expectedPolicyCodeHash
            || address(j.verificationEvidence()) != address(v)
            || address(v.jobs()) != address(j) || address(v.independencePolicy()) != address(p)
            || !v.approvedProfile(v.PROFILE_ID())
            || address(v.matches()) != address(m) || address(v.authorization()) == address(0)
            || address(m.authorization()) != address(v.authorization())
            || address(m.jobs()) != address(j) || address(w.jobs()) != address(j)
            || address(w.matches()) != address(m) || address(w.authorization()) != address(v.authorization())
            || address(c.jobs()) != address(j) || address(c.requests()) != address(j.requestEvidence())
            || address(j.requestEvidence()) == address(0) || address(j.settlementEvidence()) == address(0)
            || p.governance() != expectedGovernance || p.identityAttestor() != expectedAttestor
            || p.verifierSelector() != expectedSelector || p.policyEpoch() != expectedPolicyEpoch)
            revert InvalidWiring();
    }
}
