// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ComputeJobIntegerProfileVerification420.sol";
import "./ComputeJobPayerCustody420.sol";

/// @notice Immutable, chain-specific audit record of an intended CMP-1.1.4 deployment.
/// @dev This does NOT deploy, register, publish, or certify an installation. Governance must
/// independently verify the configured addresses, runtime code hashes, off-chain identity
/// reviews, capability registrar and authorized grants before considering production use.
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

    /// @notice Recheck all immutable canonical references and mutable role/profile gates.
    /// A role rotation or policy-epoch change fails closed until a new reviewed record is made.
    function assertWiring() public view {
        ComputeJobRegistry420 j = canonicalJobs;
        ComputeJobIntegerProfileVerification420 v = canonicalVerification;
        ComputeVerifierIndependencePolicy420 p = canonicalPolicy;
        if (block.chainid != expectedChainId || address(j).codehash != expectedJobCodeHash
            || address(v).codehash != expectedVerificationCodeHash
            || address(p).codehash != expectedPolicyCodeHash
            || address(j.verificationEvidence()) != address(v)
            || address(v.jobs()) != address(j)
            || address(v.independencePolicy()) != address(p)
            || !v.approvedProfile(v.PROFILE_ID())
            || address(v.matches()) != address(j.matchEvidence())
            || address(v.authorization()) == address(0)
            || address(v.matches().authorization()) != address(v.authorization())
            || address(j.requestEvidence()) == address(0)
            || address(j.fundingEvidence()) == address(0)
            || address(j.workerEvidence()) == address(0)
            || address(j.settlementEvidence()) == address(0)
            || address(j.matchEvidence().jobs()) != address(j)
            || address(j.workerEvidence().jobs()) != address(j)
            || address(j.workerEvidence().matches()) != address(j.matchEvidence())
            || address(j.workerEvidence().authorization()) != address(v.authorization())
            || address(j.fundingEvidence().jobs()) != address(j)
            || address(j.fundingEvidence().requests()) != address(j.requestEvidence())
            || p.governance() != expectedGovernance
            || p.identityAttestor() != expectedAttestor
            || p.verifierSelector() != expectedSelector
            || p.policyEpoch() != expectedPolicyEpoch) revert InvalidWiring();
    }
}
