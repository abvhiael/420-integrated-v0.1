// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeVerifierReleaseCandidateWiring420.sol";
import "../src/system/CapabilityRegistry420.sol";

contract RCVerifierCommonEvidence420 is
    IComputeJobRequestEvidence420,
    IComputeJobFundingEvidence420,
    IComputeJobWorkerEvidence420,
    IComputeJobSettlementEvidence420,
    IComputeJobRefundEvidence420
{
    function validRequest(bytes32,address,bytes32,bytes32,bytes32,bytes32,bytes32,uint64) external pure returns (bool) { return true; }
    function funded(bytes32,address,bytes32) external pure returns (bool) { return true; }
    function authorizedAssignment(bytes32,bytes32,address,bytes32) external pure returns (bool) { return true; }
    function committedResult(bytes32,bytes32,bytes32) external pure returns (bool) { return true; }
    function settled(bytes32,bytes32,bytes32) external pure returns (bool) { return true; }
    function refunded(bytes32,bytes32) external pure returns (bool) { return true; }
    function fundingTerms(bytes32) external pure returns (address payer, uint256 maxSpend) {
        return (address(0xBEEF), 1 ether);
    }
}

contract RCVerifierMatchMock420 is IComputeJobMatchEvidence420, IComputeAcceptedMatchRuntime420 {
    address public override jobs;
    function setJobs(address jobs_) external { jobs = jobs_; }
    function matched(bytes32,bytes32,bytes32,bytes32) external pure returns (bool) { return true; }
    function accepted(bytes32,bytes32,bytes32) external pure returns (bool) { return true; }
    function authorizedResource(bytes32,bytes32,bytes32,bytes32,address) external pure returns (bool) { return true; }
    function matchParties(bytes32) external pure returns (bytes32,address,address,bool) {
        return (bytes32(0),address(0xA11CE),address(0xC0FFEE),true);
    }
}

contract RCVerifierDummy420 {}

contract ComputeVerifierReleaseCandidateWiring420Test {
    address private constant GOV = address(0x420);
    address private constant ATTESTOR = address(0x421);
    address private constant PLACEHOLDER_SELECTOR = address(0x422);
    address private constant SELECTION_AUTHORITY = address(0x423);
    address private constant SAMPLING_AUTHORITY = address(0x424);

    CapabilityRegistry420 private caps;
    ComputeAuthorization420 private authorization;
    RCVerifierCommonEvidence420 private common;
    RCVerifierMatchMock420 private matches;
    ComputeVerifierIndependencePolicy420 private independence;
    ComputeJobIntegerProfileVerification420 private boundedVerifier;
    ComputeJobRegistry420 private jobs;
    ComputeVerifierRegistry420 private verifierRegistry;
    ComputeVerifierCapabilityRegistry420 private capabilityRegistry;
    ComputePolicyRegistry420 private policyRegistry;
    ComputeIndependentVerifierSelector420 private selector;
    ComputeReplicatedVerification420 private replicated;
    ComputeDeterministicAdapterRegistry420 private deterministicRegistry;
    ComputeDeterministicVerificationRouter420 private deterministicRouter;
    ComputeScientificAdapterRegistry420 private scientificRegistry;
    ComputeScientificVerificationRouter420 private scientificRouter;
    ComputeDisputeResolution420 private dispute;

    function setUp() public {
        caps = new CapabilityRegistry420();
        authorization = new ComputeAuthorization420(address(caps));
        common = new RCVerifierCommonEvidence420();
        matches = new RCVerifierMatchMock420();
        independence = new ComputeVerifierIndependencePolicy420(GOV, ATTESTOR, PLACEHOLDER_SELECTOR);
        boundedVerifier = new ComputeJobIntegerProfileVerification420(
            address(matches), address(authorization), address(independence)
        );

        jobs = new ComputeJobRegistry420(
            address(common),
            address(common),
            address(matches),
            address(common),
            address(boundedVerifier),
            address(common)
        );
        matches.setJobs(address(jobs));
        boundedVerifier.bindJobs(address(jobs));

        verifierRegistry = new ComputeVerifierRegistry420(GOV);
        capabilityRegistry = new ComputeVerifierCapabilityRegistry420(address(verifierRegistry), GOV);
        policyRegistry = new ComputePolicyRegistry420(GOV);

        selector = new ComputeIndependentVerifierSelector420(
            address(jobs),
            address(matches),
            address(verifierRegistry),
            address(capabilityRegistry),
            address(independence),
            SELECTION_AUTHORITY
        );

        vmPrank(GOV);
        independence.setAuthorities(ATTESTOR, address(selector));

        replicated = new ComputeReplicatedVerification420(address(selector));
        deterministicRegistry = new ComputeDeterministicAdapterRegistry420(GOV);
        deterministicRouter = new ComputeDeterministicVerificationRouter420(
            address(jobs), address(deterministicRegistry)
        );
        scientificRegistry = new ComputeScientificAdapterRegistry420(GOV);
        scientificRouter = new ComputeScientificVerificationRouter420(
            address(jobs), address(scientificRegistry), SAMPLING_AUTHORITY
        );

        RCVerifierDummy420 dummyMatch = new RCVerifierDummy420();
        RCVerifierDummy420 dummyAuth = new RCVerifierDummy420();
        dispute = new ComputeDisputeResolution420(
            address(dummyMatch), address(dummyAuth), address(independence)
        );
    }

    interface Vm {
        function prank(address) external;
    }

    function vmPrank(address who) private {
        Vm(address(uint160(uint256(keccak256("hevm cheat code"))))).prank(who);
    }

    function _hashes() private view returns (ComputeVerifierReleaseCandidateWiring420.CodeHashes memory h) {
        h = ComputeVerifierReleaseCandidateWiring420.CodeHashes({
            jobs: address(jobs).codehash,
            boundedVerifier: address(boundedVerifier).codehash,
            verifierRegistry: address(verifierRegistry).codehash,
            capabilityRegistry: address(capabilityRegistry).codehash,
            policyRegistry: address(policyRegistry).codehash,
            independencePolicy: address(independence).codehash,
            selector: address(selector).codehash,
            replicated: address(replicated).codehash,
            deterministicRegistry: address(deterministicRegistry).codehash,
            deterministicRouter: address(deterministicRouter).codehash,
            scientificRegistry: address(scientificRegistry).codehash,
            scientificRouter: address(scientificRouter).codehash,
            dispute: address(dispute).codehash
        });
    }

    function _deploy(
        address selector_,
        address deterministicRouter_,
        address governance_,
        ComputeVerifierReleaseCandidateWiring420.CodeHashes memory h
    ) private returns (ComputeVerifierReleaseCandidateWiring420) {
        return new ComputeVerifierReleaseCandidateWiring420(
            address(jobs),
            address(boundedVerifier),
            address(verifierRegistry),
            address(capabilityRegistry),
            address(policyRegistry),
            address(independence),
            selector_,
            address(replicated),
            address(deterministicRegistry),
            deterministicRouter_,
            address(scientificRegistry),
            address(scientificRouter),
            address(dispute),
            governance_,
            ATTESTOR,
            SELECTION_AUTHORITY,
            SAMPLING_AUTHORITY,
            h
        );
    }

    function testExactVerifierReleaseGraphPasses() public {
        ComputeVerifierReleaseCandidateWiring420 wiring =
            _deploy(address(selector), address(deterministicRouter), GOV, _hashes());
        wiring.assertWiring();
        require(wiring.graphHash() != bytes32(0), "graph hash missing");
    }

    function testWrongVerifierRegistryRuntimeHashFailsClosed() public {
        ComputeVerifierReleaseCandidateWiring420.CodeHashes memory h = _hashes();
        h.verifierRegistry = keccak256("wrong-verifier-registry");
        try this.deployExternal(address(selector), address(deterministicRouter), GOV, h) {
            revert("wrong verifier registry hash accepted");
        } catch {}
    }

    function testMismatchedDeterministicRouterFailsClosed() public {
        ComputeDeterministicAdapterRegistry420 otherRegistry =
            new ComputeDeterministicAdapterRegistry420(GOV);
        ComputeDeterministicVerificationRouter420 otherRouter =
            new ComputeDeterministicVerificationRouter420(address(jobs), address(otherRegistry));

        ComputeVerifierReleaseCandidateWiring420.CodeHashes memory h = _hashes();
        h.deterministicRouter = address(otherRouter).codehash;
        try this.deployExternal(address(selector), address(otherRouter), GOV, h) {
            revert("mismatched deterministic router accepted");
        } catch {}
    }

    function testWrongGovernanceFailsClosed() public {
        ComputeVerifierReleaseCandidateWiring420.CodeHashes memory h = _hashes();
        try this.deployExternal(address(selector), address(deterministicRouter), address(0xBAD), h) {
            revert("wrong governance accepted");
        } catch {}
    }

    function testWrongSelectorGraphFailsClosed() public {
        ComputeVerifierIndependencePolicy420 otherIndependence =
            new ComputeVerifierIndependencePolicy420(GOV, ATTESTOR, PLACEHOLDER_SELECTOR);
        ComputeIndependentVerifierSelector420 otherSelector =
            new ComputeIndependentVerifierSelector420(
                address(jobs), address(matches), address(verifierRegistry),
                address(capabilityRegistry), address(otherIndependence), SELECTION_AUTHORITY
            );
        ComputeVerifierReleaseCandidateWiring420.CodeHashes memory h = _hashes();
        h.selector = address(otherSelector).codehash;
        try this.deployExternal(address(otherSelector), address(deterministicRouter), GOV, h) {
            revert("selector bound to wrong independence policy accepted");
        } catch {}
    }

    function deployExternal(
        address selector_,
        address deterministicRouter_,
        address governance_,
        ComputeVerifierReleaseCandidateWiring420.CodeHashes calldata h
    ) external returns (ComputeVerifierReleaseCandidateWiring420) {
        return _deploy(selector_, deterministicRouter_, governance_, h);
    }
}
