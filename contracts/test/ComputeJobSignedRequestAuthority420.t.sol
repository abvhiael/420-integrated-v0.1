// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeJobSignedRequestAuthority420.sol";

interface VmSignedCompute420 {
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8, bytes32, bytes32);
    function prank(address caller) external;
    function warp(uint256 timestamp) external;
    function chainId(uint256 newChainId) external;
}

/// @dev Only satisfies constructor code-address checks; cannot approve funding or execution.
contract SignedRequestDenyEvidence420 is IComputeJobFundingEvidence420, IComputeJobMatchEvidence420,
    IComputeJobWorkerEvidence420, IComputeJobVerificationEvidence420, IComputeJobSettlementEvidence420 {
    function funded(bytes32, address, bytes32) external pure returns (bool) { return false; }
    function matched(bytes32, bytes32, bytes32, bytes32) external pure returns (bool) { return false; }
    function accepted(bytes32, bytes32, bytes32) external pure returns (bool) { return false; }
    function authorizedAssignment(bytes32, bytes32, address, bytes32) external pure returns (bool) { return false; }
    function committedResult(bytes32, bytes32, bytes32) external pure returns (bool) { return false; }
    function verified(bytes32, bytes32, address, bytes32, bool) external pure returns (bool) { return false; }
    function settled(bytes32, bytes32, bytes32) external pure returns (bool) { return false; }
}

contract ComputeJobSignedRequestAuthority420Test {
    VmSignedCompute420 private constant vm = VmSignedCompute420(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 private constant OWNER_KEY = 0xA11CE;
    uint256 private constant PAYER_KEY = 0xBEEF;
    bytes32 private constant MANIFEST = keccak256("exact-serialized-manifest");
    bytes32 private constant WORKLOAD = keccak256("gpu-inference");
    bytes32 private constant INPUT = keccak256("input-commitment");
    bytes32 private constant OUTPUT = keccak256("output-schema");
    ComputeJobSignedRequestAuthority420 private authority;
    ComputeJobRegistry420 private jobs;
    address private owner;
    address private payer;

    function setUp() public {
        owner = vm.addr(OWNER_KEY);
        payer = vm.addr(PAYER_KEY);
        authority = new ComputeJobSignedRequestAuthority420();
        SignedRequestDenyEvidence420 denied = new SignedRequestDenyEvidence420();
        jobs = new ComputeJobRegistry420(address(authority), address(denied), address(denied),
            address(denied), address(denied), address(denied));
    }

    function _terms() private view returns (ComputeJobSignedRequestAuthority420.Authorization memory a) {
        a = ComputeJobSignedRequestAuthority420.Authorization({owner: owner, payer: payer,
            manifestHash: MANIFEST, workloadType: WORKLOAD, inputCommitment: INPUT,
            outputSchemaCommitment: OUTPUT, deadline: uint64(block.timestamp + 1 days),
            authorizationExpiry: uint64(block.timestamp + 2 days), maxSpend: 42 ether, nonce: 7});
    }

    function _sign(uint256 key, bytes32 digest) private returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function _register(ComputeJobSignedRequestAuthority420.Authorization memory a)
        private returns (bytes32 requestId) {
        bytes32 digest = authority.authorizationDigest(a);
        bytes memory ownerSig = _sign(OWNER_KEY, digest);
        bytes memory payerSig = _sign(PAYER_KEY, digest);
        vm.prank(owner);
        requestId = authority.registerSignedRequest(a, ownerSig, payerSig);
    }

    function _create(bytes32 requestId, ComputeJobSignedRequestAuthority420.Authorization memory a)
        private returns (bytes32 jobId) {
        vm.prank(owner);
        jobId = jobs.createJob(requestId, requestId, a.manifestHash, a.workloadType,
            a.inputCommitment, a.outputSchemaCommitment, a.deadline);
    }

    function testSignedRequestBindsJobAndPayerCeiling() public {
        ComputeJobSignedRequestAuthority420.Authorization memory a = _terms();
        bytes32 id = _register(a);
        (address fundedBy, uint256 cap) = authority.fundingTerms(id);
        require(fundedBy == payer && cap == a.maxSpend, "payer or cap lost");
        bytes32 jobId = _create(id, a);
        require(jobs.job(jobId).owner == owner && jobs.job(jobId).manifestHash == MANIFEST,
            "job does not bind signed manifest");
        require(jobs.job(jobId).status == ComputeJobRegistry420.Status.CREATED,
            "signature alone must not fund job");
    }

    function testAlteredManifestAndWorkloadRejectedAtRegistration() public {
        ComputeJobSignedRequestAuthority420.Authorization memory a = _terms();
        bytes32 digest = authority.authorizationDigest(a);
        bytes memory ownerSig = _sign(OWNER_KEY, digest);
        bytes memory payerSig = _sign(PAYER_KEY, digest);
        a.manifestHash = keccak256("tampered-manifest");
        vm.prank(owner);
        (bool ok,) = address(authority).call(abi.encodeCall(authority.registerSignedRequest,
            (a, ownerSig, payerSig)));
        require(!ok, "altered manifest accepted");
        a = _terms();
        a.workloadType = keccak256("tampered-workload");
        vm.prank(owner);
        (ok,) = address(authority).call(abi.encodeCall(authority.registerSignedRequest,
            (a, ownerSig, payerSig)));
        require(!ok, "altered workload accepted");
    }

    function testAlteredPayerAndSpendingLimitRejected() public {
        ComputeJobSignedRequestAuthority420.Authorization memory a = _terms();
        bytes32 digest = authority.authorizationDigest(a);
        bytes memory ownerSig = _sign(OWNER_KEY, digest);
        bytes memory payerSig = _sign(PAYER_KEY, digest);
        a.maxSpend += 1;
        vm.prank(owner);
        (bool ok,) = address(authority).call(abi.encodeCall(authority.registerSignedRequest,
            (a, ownerSig, payerSig)));
        require(!ok, "altered spending ceiling accepted");
        a = _terms();
        a.payer = owner;
        vm.prank(owner);
        (ok,) = address(authority).call(abi.encodeCall(authority.registerSignedRequest,
            (a, ownerSig, payerSig)));
        require(!ok, "altered payer accepted");
    }

    function testPayerMustSignSameTermsAndOwnerMustSubmit() public {
        ComputeJobSignedRequestAuthority420.Authorization memory a = _terms();
        bytes32 digest = authority.authorizationDigest(a);
        bytes memory ownerSig = _sign(OWNER_KEY, digest);
        bytes memory wrongPayerSig = _sign(OWNER_KEY, digest);
        vm.prank(owner);
        (bool ok,) = address(authority).call(abi.encodeCall(authority.registerSignedRequest,
            (a, ownerSig, wrongPayerSig)));
        require(!ok, "unconsenting payer accepted");
        bytes memory payerSig = _sign(PAYER_KEY, digest);
        vm.prank(payer);
        (ok,) = address(authority).call(abi.encodeCall(authority.registerSignedRequest,
            (a, ownerSig, payerSig)));
        require(!ok, "non-owner submitted job request");
    }

    function testExpiredAuthorizationAndExpiredCreationRejected() public {
        ComputeJobSignedRequestAuthority420.Authorization memory a = _terms();
        bytes32 digest = authority.authorizationDigest(a);
        bytes memory ownerSig = _sign(OWNER_KEY, digest);
        bytes memory payerSig = _sign(PAYER_KEY, digest);
        vm.warp(uint256(a.authorizationExpiry) + 1);
        vm.prank(owner);
        (bool ok,) = address(authority).call(abi.encodeCall(authority.registerSignedRequest,
            (a, ownerSig, payerSig)));
        require(!ok, "expired signed authorization registered");
        a = _terms();
        bytes32 id = _register(a);
        vm.warp(uint256(a.deadline) + 1);
        vm.prank(owner);
        (ok,) = address(jobs).call(abi.encodeCall(jobs.createJob,
            (id, id, a.manifestHash, a.workloadType, a.inputCommitment, a.outputSchemaCommitment, a.deadline)));
        require(!ok, "expired request created job");
    }

    function testReplayedSignaturesAndJobCreationRejected() public {
        ComputeJobSignedRequestAuthority420.Authorization memory a = _terms();
        bytes32 id = _register(a);
        bytes32 digest = authority.authorizationDigest(a);
        bytes memory ownerSig = _sign(OWNER_KEY, digest);
        bytes memory payerSig = _sign(PAYER_KEY, digest);
        vm.prank(owner);
        (bool ok,) = address(authority).call(abi.encodeCall(authority.registerSignedRequest,
            (a, ownerSig, payerSig)));
        require(!ok && authority.usedNonce(owner, a.nonce), "signature replay accepted");
        _create(id, a);
        vm.prank(owner);
        (ok,) = address(jobs).call(abi.encodeCall(jobs.createJob,
            (id, id, a.manifestHash, a.workloadType, a.inputCommitment, a.outputSchemaCommitment, a.deadline)));
        require(!ok, "request reused to create another job");
    }

    function testWrongDomainContractAndChainRejected() public {
        ComputeJobSignedRequestAuthority420.Authorization memory a = _terms();
        bytes32 digest = authority.authorizationDigest(a);
        bytes memory ownerSig = _sign(OWNER_KEY, digest);
        bytes memory payerSig = _sign(PAYER_KEY, digest);
        ComputeJobSignedRequestAuthority420 other = new ComputeJobSignedRequestAuthority420();
        vm.prank(owner);
        (bool ok,) = address(other).call(abi.encodeCall(other.registerSignedRequest,
            (a, ownerSig, payerSig)));
        require(!ok, "cross-contract signature accepted");
        vm.chainId(block.chainid + 1);
        vm.prank(owner);
        (ok,) = address(authority).call(abi.encodeCall(authority.registerSignedRequest,
            (a, ownerSig, payerSig)));
        require(!ok, "cross-chain signature accepted");
    }

    function testAlteredCreationFieldsAndWrongOwnerRejected() public {
        ComputeJobSignedRequestAuthority420.Authorization memory a = _terms();
        bytes32 id = _register(a);
        vm.prank(owner);
        (bool ok,) = address(jobs).call(abi.encodeCall(jobs.createJob,
            (id, id, keccak256("altered"), a.workloadType, a.inputCommitment, a.outputSchemaCommitment, a.deadline)));
        require(!ok, "altered creation manifest accepted");
        vm.prank(payer);
        (ok,) = address(jobs).call(abi.encodeCall(jobs.createJob,
            (id, id, a.manifestHash, a.workloadType, a.inputCommitment, a.outputSchemaCommitment, a.deadline)));
        require(!ok, "payer impersonated request owner");
    }
}
