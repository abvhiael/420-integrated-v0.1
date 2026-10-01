// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ComputeJobRegistry420.sol";
import "./ComputeJobIntegerProfileVerification420.sol";
import "./ComputeVerifierRegistry420.sol";
import "./ComputeVerifierCapabilityRegistry420.sol";
import "./ComputePolicyRegistry420.sol";
import "./ComputeVerifierIndependencePolicy420.sol";
import "./ComputeIndependentVerifierSelector420.sol";
import "./ComputeReplicatedVerification420.sol";
import "./ComputeDeterministicAdapterRegistry420.sol";
import "./ComputeDeterministicVerificationRouter420.sol";
import "./ComputeScientificAdapterRegistry420.sol";
import "./ComputeScientificVerificationRouter420.sol";
import "./ComputeDisputeResolution420.sol";

/// @notice CMP-1.4.11 immutable verifier release-candidate graph audit record.
/// @dev Grants no authority and performs no deployment/publication/custody/settlement/slashing action.
///      It only fails closed if the supplied verifier release graph, authority bindings or runtime hashes drift.
contract ComputeVerifierReleaseCandidateWiring420 {
    struct CodeHashes {
        bytes32 jobs;
        bytes32 boundedVerifier;
        bytes32 verifierRegistry;
        bytes32 capabilityRegistry;
        bytes32 policyRegistry;
        bytes32 independencePolicy;
        bytes32 selector;
        bytes32 replicated;
        bytes32 deterministicRegistry;
        bytes32 deterministicRouter;
        bytes32 scientificRegistry;
        bytes32 scientificRouter;
        bytes32 dispute;
    }

    ComputeJobRegistry420 public immutable jobs;
    ComputeJobIntegerProfileVerification420 public immutable boundedVerifier;
    ComputeVerifierRegistry420 public immutable verifierRegistry;
    ComputeVerifierCapabilityRegistry420 public immutable capabilityRegistry;
    ComputePolicyRegistry420 public immutable policyRegistry;
    ComputeVerifierIndependencePolicy420 public immutable independencePolicy;
    ComputeIndependentVerifierSelector420 public immutable selector;
    ComputeReplicatedVerification420 public immutable replicated;
    ComputeDeterministicAdapterRegistry420 public immutable deterministicRegistry;
    ComputeDeterministicVerificationRouter420 public immutable deterministicRouter;
    ComputeScientificAdapterRegistry420 public immutable scientificRegistry;
    ComputeScientificVerificationRouter420 public immutable scientificRouter;
    ComputeDisputeResolution420 public immutable dispute;

    uint256 public immutable expectedChainId;
    address public immutable expectedGovernance;
    address public immutable expectedIdentityAttestor;
    address public immutable expectedSelectionAuthority;
    address public immutable expectedSamplingAuthority;

    CodeHashes private _hashes;

    error InvalidWiring();

    constructor(
        address jobs_,
        address boundedVerifier_,
        address verifierRegistry_,
        address capabilityRegistry_,
        address policyRegistry_,
        address independencePolicy_,
        address selector_,
        address replicated_,
        address deterministicRegistry_,
        address deterministicRouter_,
        address scientificRegistry_,
        address scientificRouter_,
        address dispute_,
        address governance_,
        address identityAttestor_,
        address selectionAuthority_,
        address samplingAuthority_,
        CodeHashes memory hashes_
    ) {
        if (
            jobs_.code.length == 0 || boundedVerifier_.code.length == 0
                || verifierRegistry_.code.length == 0 || capabilityRegistry_.code.length == 0
                || policyRegistry_.code.length == 0 || independencePolicy_.code.length == 0
                || selector_.code.length == 0 || replicated_.code.length == 0
                || deterministicRegistry_.code.length == 0 || deterministicRouter_.code.length == 0
                || scientificRegistry_.code.length == 0 || scientificRouter_.code.length == 0
                || dispute_.code.length == 0 || governance_ == address(0)
                || identityAttestor_ == address(0) || selectionAuthority_ == address(0)
                || samplingAuthority_ == address(0)
        ) revert InvalidWiring();

        if (
            hashes_.jobs == bytes32(0) || hashes_.boundedVerifier == bytes32(0)
                || hashes_.verifierRegistry == bytes32(0) || hashes_.capabilityRegistry == bytes32(0)
                || hashes_.policyRegistry == bytes32(0) || hashes_.independencePolicy == bytes32(0)
                || hashes_.selector == bytes32(0) || hashes_.replicated == bytes32(0)
                || hashes_.deterministicRegistry == bytes32(0) || hashes_.deterministicRouter == bytes32(0)
                || hashes_.scientificRegistry == bytes32(0) || hashes_.scientificRouter == bytes32(0)
                || hashes_.dispute == bytes32(0)
        ) revert InvalidWiring();

        jobs = ComputeJobRegistry420(jobs_);
        boundedVerifier = ComputeJobIntegerProfileVerification420(boundedVerifier_);
        verifierRegistry = ComputeVerifierRegistry420(verifierRegistry_);
        capabilityRegistry = ComputeVerifierCapabilityRegistry420(capabilityRegistry_);
        policyRegistry = ComputePolicyRegistry420(policyRegistry_);
        independencePolicy = ComputeVerifierIndependencePolicy420(independencePolicy_);
        selector = ComputeIndependentVerifierSelector420(selector_);
        replicated = ComputeReplicatedVerification420(replicated_);
        deterministicRegistry = ComputeDeterministicAdapterRegistry420(deterministicRegistry_);
        deterministicRouter = ComputeDeterministicVerificationRouter420(deterministicRouter_);
        scientificRegistry = ComputeScientificAdapterRegistry420(scientificRegistry_);
        scientificRouter = ComputeScientificVerificationRouter420(scientificRouter_);
        dispute = ComputeDisputeResolution420(dispute_);

        expectedChainId = block.chainid;
        expectedGovernance = governance_;
        expectedIdentityAttestor = identityAttestor_;
        expectedSelectionAuthority = selectionAuthority_;
        expectedSamplingAuthority = samplingAuthority_;
        _hashes = hashes_;

        assertWiring();
    }

    function codeHashes() external view returns (CodeHashes memory) { return _hashes; }

    function assertWiring() public view {
        CodeHashes memory h = _hashes;
        if (
            block.chainid != expectedChainId
                || address(jobs).codehash != h.jobs
                || address(boundedVerifier).codehash != h.boundedVerifier
                || address(verifierRegistry).codehash != h.verifierRegistry
                || address(capabilityRegistry).codehash != h.capabilityRegistry
                || address(policyRegistry).codehash != h.policyRegistry
                || address(independencePolicy).codehash != h.independencePolicy
                || address(selector).codehash != h.selector
                || address(replicated).codehash != h.replicated
                || address(deterministicRegistry).codehash != h.deterministicRegistry
                || address(deterministicRouter).codehash != h.deterministicRouter
                || address(scientificRegistry).codehash != h.scientificRegistry
                || address(scientificRouter).codehash != h.scientificRouter
                || address(dispute).codehash != h.dispute
        ) revert InvalidWiring();

        if (
            address(jobs.verificationEvidence()) != address(boundedVerifier)
                || address(boundedVerifier.jobs()) != address(jobs)
                || address(boundedVerifier.independencePolicy()) != address(independencePolicy)
                || address(capabilityRegistry.verifiers()) != address(verifierRegistry)
        ) revert InvalidWiring();

        if (
            verifierRegistry.governanceTimelock() != expectedGovernance
                || capabilityRegistry.governanceTimelock() != expectedGovernance
                || policyRegistry.governanceTimelock() != expectedGovernance
                || deterministicRegistry.governanceTimelock() != expectedGovernance
                || scientificRegistry.governanceTimelock() != expectedGovernance
                || independencePolicy.governance() != expectedGovernance
                || independencePolicy.identityAttestor() != expectedIdentityAttestor
                || independencePolicy.verifierSelector() != address(selector)
        ) revert InvalidWiring();

        if (
            address(selector.jobs()) != address(jobs)
                || address(selector.verifiers()) != address(verifierRegistry)
                || address(selector.capabilities()) != address(capabilityRegistry)
                || address(selector.independencePolicy()) != address(independencePolicy)
                || selector.selectionAuthority() != expectedSelectionAuthority
                || address(replicated.selector()) != address(selector)
                || address(replicated.jobs()) != address(jobs)
                || address(replicated.verifiers()) != address(verifierRegistry)
                || address(replicated.capabilities()) != address(capabilityRegistry)
                || address(replicated.independencePolicy()) != address(independencePolicy)
                || replicated.selectionAuthority() != expectedSelectionAuthority
        ) revert InvalidWiring();

        if (
            address(deterministicRouter.jobs()) != address(jobs)
                || address(deterministicRouter.adapters()) != address(deterministicRegistry)
                || address(scientificRouter.jobs()) != address(jobs)
                || address(scientificRouter.adapters()) != address(scientificRegistry)
                || scientificRouter.samplingAuthority() != expectedSamplingAuthority
        ) revert InvalidWiring();

        if (
            address(dispute.independencePolicy()) != address(independencePolicy)
                || address(dispute.jobs()) != address(0) && address(dispute.jobs()) != address(jobs)
        ) revert InvalidWiring();
    }

    function graphHash() external view returns (bytes32) {
        CodeHashes memory h = _hashes;
        return keccak256(abi.encode(
            keccak256("420Integrated.ComputeMarket.VerifierReleaseCandidateGraph.v1"),
            expectedChainId,
            address(jobs),
            address(boundedVerifier),
            address(verifierRegistry),
            address(capabilityRegistry),
            address(policyRegistry),
            address(independencePolicy),
            address(selector),
            address(replicated),
            address(deterministicRegistry),
            address(deterministicRouter),
            address(scientificRegistry),
            address(scientificRouter),
            address(dispute),
            expectedGovernance,
            expectedIdentityAttestor,
            expectedSelectionAuthority,
            expectedSamplingAuthority,
            h
        ));
    }
}
