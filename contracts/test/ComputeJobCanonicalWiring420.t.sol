// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/system/CapabilityRegistry420.sol";
import "../src/compute/ComputeJobCanonicalWiring420.sol";
import "../src/compute/ComputeJobSignedRequestAuthority420.sol";

interface VmCanonicalWiring420 { function chainId(uint256) external; function prank(address) external; }

contract WiringSettlementDeny420 is IComputeJobSettlementEvidence420 {
    function settled(bytes32, bytes32, bytes32) external pure returns (bool) { return false; }
}

contract ComputeJobCanonicalWiring420Test {
    VmCanonicalWiring420 private constant vm = VmCanonicalWiring420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant GOV = address(0x1001);
    address private constant ATTESTOR = address(0x1002);
    address private constant SELECTOR = address(0x1003);
    ComputeJobRegistry420 private jobs;
    ComputeJobIntegerProfileVerification420 private verifier;
    ComputeVerifierIndependencePolicy420 private policy;
    ComputeJobCanonicalWiring420 private audit;

    function setUp() public {
        CapabilityRegistry420 capabilities = new CapabilityRegistry420();
        ComputeAuthorization420 auth = new ComputeAuthorization420(address(capabilities));
        ComputeJobSignedRequestAuthority420 requests = new ComputeJobSignedRequestAuthority420();
        ComputeJobPayerCustody420 custody = new ComputeJobPayerCustody420(address(requests));
        ComputeProviderRegistry420 providers = new ComputeProviderRegistry420(GOV);
        ComputeNodeRegistry420 nodes = new ComputeNodeRegistry420(address(providers), GOV);
        ComputeResourceRegistry420 resources = new ComputeResourceRegistry420(address(nodes), GOV);
        ComputeJobAcceptedMatch420 matches = new ComputeJobAcceptedMatch420(address(resources), address(auth));
        ComputeJobMatchedWorkerEvidence420 workers = new ComputeJobMatchedWorkerEvidence420(address(matches), address(auth));
        policy = new ComputeVerifierIndependencePolicy420(GOV, ATTESTOR, SELECTOR);
        verifier = new ComputeJobIntegerProfileVerification420(address(matches), address(auth), address(policy));
        jobs = new ComputeJobRegistry420(address(requests), address(custody), address(matches),
            address(workers), address(verifier), address(new WiringSettlementDeny420()));
        custody.bindJobs(address(jobs));
        matches.bindJobs(address(jobs));
        workers.bindJobs(address(jobs));
        verifier.bindJobs(address(jobs));
        verifier.setApprovedProfile(verifier.PROFILE_ID(), true);
        audit = _record(address(jobs), address(verifier), address(policy),
            address(jobs).codehash, address(verifier).codehash, address(policy).codehash);
    }

    function _record(address j, address v, address p, bytes32 jh, bytes32 vh, bytes32 ph)
        private returns (ComputeJobCanonicalWiring420) {
        return new ComputeJobCanonicalWiring420(j, v, p, GOV, ATTESTOR, SELECTOR, 1, jh, vh, ph);
    }

    function testBoundCanonicalProfileAndCodeHashesPass() public view {
        audit.assertWiring();
        require(address(audit.canonicalJobs()) == address(jobs)
            && address(jobs.verificationEvidence()) == address(verifier)
            && address(verifier.independencePolicy()) == address(policy)
            && audit.expectedVerificationCodeHash() == address(verifier).codehash,
            "wrong installed verification adapter");
    }

    function testWrongVerifierAndUnreviewedCodeHashesReject() public {
        ComputeJobIndependentVerification420 permissive = new ComputeJobIndependentVerification420(
            address(verifier.matches()), address(verifier.authorization()));
        // A permissive verifier cannot masquerade as the bound profile-evaluating adapter.
        (bool ok,) = address(this).call(abi.encodeCall(this.tryRecord,
            (address(jobs), address(permissive), address(policy), address(jobs).codehash,
                address(permissive).codehash, address(policy).codehash)));
        require(!ok, "permissive verifier qualified");
        (ok,) = address(this).call(abi.encodeCall(this.tryRecord,
            (address(jobs), address(verifier), address(policy), bytes32(uint256(1)),
                address(verifier).codehash, address(policy).codehash)));
        require(!ok, "incorrect job code hash qualified");
        (ok,) = address(this).call(abi.encodeCall(this.tryRecord,
            (address(jobs), address(verifier), address(policy), address(jobs).codehash,
                bytes32(uint256(1)), address(policy).codehash)));
        require(!ok, "unreviewed verifier code hash qualified");
    }

    function tryRecord(address j, address v, address p, bytes32 jh, bytes32 vh, bytes32 ph)
        external returns (address) { return address(_record(j, v, p, jh, vh, ph)); }

    function testDisabledProfileOrAuthorityRotationFailsClosed() public {
        verifier.setApprovedProfile(verifier.PROFILE_ID(), false);
        (bool ok,) = address(audit).call(abi.encodeCall(audit.assertWiring, ()));
        require(!ok, "disabled profile qualified");
        verifier.setApprovedProfile(verifier.PROFILE_ID(), true);
        audit.assertWiring();
        vm.prank(GOV);
        policy.setAuthorities(address(0x2002), address(0x2003));
        (ok,) = address(audit).call(abi.encodeCall(audit.assertWiring, ()));
        require(!ok, "authority drift qualified");
    }

    function testWrongChainFailsClosed() public {
        // The clean-chain success is independently asserted in
        // testBoundCanonicalProfileAndCodeHashesPass. A chain-id cheat-code
        // mutation can invalidate runtime binding assumptions until the next fixture.
        uint256 wrongChain = block.chainid + 1;
        vm.chainId(wrongChain);
        (bool ok,) = address(audit).call(abi.encodeCall(audit.assertWiring, ()));
        require(!ok, "wrong-chain wiring qualified");
    }
}
