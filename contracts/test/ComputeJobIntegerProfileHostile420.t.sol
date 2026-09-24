// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/system/CapabilityRegistry420.sol";
import "../src/compute/ComputeJobSignedRequestAuthority420.sol";
import "../src/compute/ComputeJobPayerCustody420.sol";
import "../src/compute/ComputeJobMatchedWorkerEvidence420.sol";
import "../src/compute/ComputeJobIntegerProfileVerification420.sol";

interface VmIntegerHostile420 {
    function addr(uint256) external returns (address);
    function sign(uint256, bytes32) external returns (uint8, bytes32, bytes32);
    function deal(address, uint256) external;
    function prank(address) external;
    function warp(uint256) external;
    function chainId(uint256) external;
}
contract HostileSettlementDeny420 is IComputeJobSettlementEvidence420 {
    function settled(bytes32, bytes32, bytes32) external pure returns (bool) { return false; }
}

/// @notice 1.1.4.1: hostile submissions against the REAL signed request, payer reserve,
/// authorized match, assigned worker receipt, attested appointment and evaluated verdict path.
contract ComputeJobIntegerProfileHostile420Test {
    VmIntegerHostile420 private constant vm = VmIntegerHostile420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant GOV = address(0x1001);
    address private constant ATTESTOR = address(0x1002);
    address private constant SELECTOR = address(0x1003);
    address private constant ISSUER = address(0x1004);
    address private constant OPERATOR = address(0xC0FFEE);
    uint256 private constant OWNER_KEY = 0xA11CE;
    uint256 private constant PAYER_KEY = 0xBEEF;
    uint256 private constant VERIFIER_KEY = 0xC0DE;
    bytes32 private constant MANIFEST = keccak256("bounded-integer-profile-v1-manifest");
    address private owner;
    address private payer;
    address private verifier;
    CapabilityRegistry420 private registry;
    ComputeAuthorization420 private auth;
    ComputeJobSignedRequestAuthority420 private requests;
    ComputeJobPayerCustody420 private custody;
    ComputeProviderRegistry420 private providers;
    ComputeNodeRegistry420 private nodes;
    ComputeResourceRegistry420 private resources;
    ComputeJobAcceptedMatch420 private matches;
    ComputeJobMatchedWorkerEvidence420 private workers;
    ComputeVerifierIndependencePolicy420 private policy;
    ComputeJobIntegerProfileVerification420 private verification;
    ComputeJobRegistry420 private jobs;
    uint64[4] private values;
    bytes32 private resourceId;
    bytes32 private jobId;
    bytes32 private receipt;

    function setUp() public {
        owner = vm.addr(OWNER_KEY);
        payer = vm.addr(PAYER_KEY);
        verifier = vm.addr(VERIFIER_KEY);
        values = [uint64(3), uint64(4), uint64(5), uint64(12)];
        vm.deal(payer, 100 ether);
        registry = new CapabilityRegistry420();
        auth = new ComputeAuthorization420(address(registry));
        requests = new ComputeJobSignedRequestAuthority420();
        custody = new ComputeJobPayerCustody420(address(requests));
        providers = new ComputeProviderRegistry420(GOV);
        nodes = new ComputeNodeRegistry420(address(providers), GOV);
        resources = new ComputeResourceRegistry420(address(nodes), GOV);
        matches = new ComputeJobAcceptedMatch420(address(resources), address(auth));
        workers = new ComputeJobMatchedWorkerEvidence420(address(matches), address(auth));
        policy = new ComputeVerifierIndependencePolicy420(GOV, ATTESTOR, SELECTOR);
        verification = new ComputeJobIntegerProfileVerification420(address(matches), address(auth), address(policy));
        jobs = new ComputeJobRegistry420(address(requests), address(custody), address(matches),
            address(workers), address(verification), address(new HostileSettlementDeny420()));
        custody.bindJobs(address(jobs));
        matches.bindJobs(address(jobs));
        workers.bindJobs(address(jobs));
        verification.bindJobs(address(jobs));
        verification.setApprovedProfile(verification.PROFILE_ID(), true);
        registry.transferComponentRegistrar(GOV);
        bytes32 component = auth.COMPONENT_COMPUTE();
        vm.prank(GOV);
        registry.registerProtocolComponent(component, ISSUER);
        vm.prank(OPERATOR);
        bytes32 providerId = providers.register(MANIFEST, keccak256("security"), OPERATOR);
        vm.prank(GOV);
        providers.activate(providerId);
        vm.prank(OPERATOR);
        bytes32 nodeId = nodes.register(providerId, MANIFEST, keccak256("endpoint"), uint64(block.timestamp + 3 days));
        vm.prank(OPERATOR);
        nodes.activate(nodeId);
        bytes32 service = resources.GPU_INFERENCE();
        vm.prank(OPERATOR);
        resourceId = resources.register(nodeId, service, MANIFEST,
            keccak256("integer-execution-runtime"), keccak256("integer-profile-capability"), 8);
        vm.prank(OPERATOR);
        resources.activate(resourceId);
        _attest(owner, keccak256("owner-controller"), 1);
        _attest(payer, keccak256("payer-controller"), 2);
        _attest(OPERATOR, keccak256("operator-controller"), 3);
        _attest(verifier, keccak256("verifier-controller"), 4);
        _createResult();
    }

    function _attest(address account, bytes32 controller, uint256 n) private {
        vm.prank(ATTESTOR);
        policy.attest(account, controller, keccak256(abi.encode("reviewed", n)), uint64(block.timestamp + 1 days));
    }
    function _signature(uint256 key, bytes32 digest) private returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }
    function _grant(address actor, bytes32 id, bytes32 action, uint256 nonce) private {
        bytes32 component = auth.COMPONENT_COMPUTE();
        bytes32 scope = auth.scopeJob(id);
        vm.prank(ISSUER);
        registry.createGrant(keccak256(abi.encode(id, action, nonce)), actor,
            component, action, scope, 0, 0, 0, uint64(block.timestamp), 0);
    }
    function _createResult() private {
        ComputeJobSignedRequestAuthority420.Authorization memory a =
            ComputeJobSignedRequestAuthority420.Authorization({owner: owner, payer: payer,
                manifestHash: MANIFEST, workloadType: verification.WORKLOAD_TYPE(),
                inputCommitment: verification.inputHash(values),
                outputSchemaCommitment: verification.OUTPUT_SCHEMA(),
                deadline: uint64(block.timestamp + 1 days), authorizationExpiry: uint64(block.timestamp + 2 days),
                maxSpend: 5 ether, nonce: 4201});
        bytes32 digest = requests.authorizationDigest(a);
        bytes memory ownerSig = _signature(OWNER_KEY, digest);
        bytes memory payerSig = _signature(PAYER_KEY, digest);
        vm.prank(owner);
        bytes32 requestId = requests.registerSignedRequest(a, ownerSig, payerSig);
        vm.prank(owner);
        jobId = jobs.createJob(requestId, requestId, MANIFEST, a.workloadType,
            a.inputCommitment, a.outputSchemaCommitment, a.deadline);
        vm.prank(payer);
        custody.reserve{value: 3 ether}(jobId);
        vm.prank(owner);
        jobs.recordFunding(jobId, 1, jobId);
        vm.prank(owner);
        bytes32 matchId = matches.propose(jobId, resourceId);
        vm.prank(owner);
        jobs.recordMatch(jobId, 2, matchId);
        _grant(OPERATOR, jobId, auth.ACTION_ACCEPT_MATCH(), 1);
        vm.prank(OPERATOR);
        matches.acceptMatch(jobId, 3);
        _grant(OPERATOR, jobId, auth.ACTION_EXECUTE_ATTEMPT(), 2);
        _grant(OPERATOR, jobId, auth.ACTION_SUBMIT_RECEIPT(), 3);
        vm.prank(OPERATOR);
        workers.acceptAssignment(jobId, resourceId, 4);
        receipt = keccak256("canonical-hostile-worker-receipt");
        bytes32 outHash = verification.outputHash(194);
        vm.prank(OPERATOR);
        bytes32 committed = workers.commitResult(jobId, receipt, outHash);
        vm.prank(OPERATOR);
        jobs.recordResult(jobId, 5, committed);
        _grant(verifier, jobId, auth.ACTION_VERIFY_RESULT(), 4);
        bytes32 profile = verification.PROFILE_ID();
        vm.prank(SELECTOR);
        policy.appoint(jobId, verifier, profile, owner, payer, OPERATOR,
            keccak256("reviewed-hostile-appointment"), uint64(block.timestamp + 1000));
        require(jobs.job(jobId).status == ComputeJobRegistry420.Status.RESULT_COMMITTED,
            "fixture did not reach committed result");
        require(custody.totalReserved() == 3 ether, "fixture not funded");
    }
    function _verdict(uint256 nonce) private view returns (ComputeJobIndependentVerification420.Verdict memory v) {
        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        v = ComputeJobIndependentVerification420.Verdict({jobId: jobId, requestId: j.requestId,
            manifestHash: j.manifestHash, matchId: j.matchId, assignmentRef: j.assignmentRef,
            resultCommitment: j.resultCommitment, verifier: verifier,
            profileId: verification.PROFILE_ID(), approved: true, expectedRevision: j.revision,
            expiry: uint64(block.timestamp + 100), nonce: nonce});
    }
    function _submit(ComputeJobIndependentVerification420.Verdict memory v, bytes memory sig,
        uint64[4] memory input, uint256 output, bytes32 receipt_) private returns (bool ok) {
        (ok,) = address(verification).call(abi.encodeCall(verification.submitEvaluatedVerdict,
            (v, sig, input, output, receipt_)));
    }
    function _unchanged(uint256 nonce) private view {
        require(jobs.job(jobId).status == ComputeJobRegistry420.Status.RESULT_COMMITTED,
            "invalid submission changed job state");
        require(verification.decisionForJob(jobId) == bytes32(0), "invalid submission stored a decision");
        require(!verification.usedNonce(verifier, nonce), "invalid submission burned nonce");
        require(custody.totalReserved() == 3 ether, "invalid submission released payer reserve");
    }
    function testHostileVerdictFieldsAndSignaturesFailWithoutMutation() public {
        for (uint256 k = 1; k <= 9; ++k) {
            ComputeJobIndependentVerification420.Verdict memory v = _verdict(k);
            bytes memory sig = _signature(VERIFIER_KEY, verification.verdictDigest(v));
            if (k == 1) v.requestId = keccak256("wrong-request");
            if (k == 2) v.manifestHash = keccak256("wrong-manifest");
            if (k == 3) v.matchId = keccak256("wrong-match");
            if (k == 4) v.assignmentRef = keccak256("wrong-assignment");
            if (k == 5) v.resultCommitment = keccak256("wrong-result");
            if (k == 6) v.expectedRevision++;
            if (k == 7) v.verifier = owner;
            if (k == 8) v.approved = false; // correct result cannot be rejected
            if (k == 9) sig = _signature(OWNER_KEY, verification.verdictDigest(v));
            require(!_submit(v, sig, values, 194, receipt), "hostile verdict admitted");
            _unchanged(k);
        }
        ComputeJobIndependentVerification420.Verdict memory clean = _verdict(10);
        require(_submit(clean, _signature(VERIFIER_KEY, verification.verdictDigest(clean)),
            values, 194, receipt), "canonical verdict failed after hostile attempts");
        require(jobs.job(jobId).status == ComputeJobRegistry420.Status.VERIFIED,
            "canonical verification not recorded");
        require(custody.totalReserved() == 3 ether, "verification unexpectedly released reserve");
    }
    function testExpiryReplayAndDomainBinding() public {
        ComputeJobIndependentVerification420.Verdict memory v = _verdict(21);
        v.expiry = uint64(block.timestamp - 1);
        require(!_submit(v, _signature(VERIFIER_KEY, verification.verdictDigest(v)), values, 194, receipt),
            "expired verdict admitted");
        _unchanged(21);
        v = _verdict(22);
        bytes memory signedForOriginalChain = _signature(VERIFIER_KEY, verification.verdictDigest(v));
        uint256 originalChain = block.chainid;
        vm.chainId(originalChain + 1);
        require(!_submit(v, signedForOriginalChain, values, 194, receipt), "cross-chain replay admitted");
        _unchanged(22);
        vm.chainId(originalChain);
        require(_submit(v, signedForOriginalChain, values, 194, receipt),
            "original-domain signed verdict rejected");
        require(!_submit(v, signedForOriginalChain, values, 194, receipt), "duplicate verdict admitted");
        require(verification.usedNonce(verifier, 22) && verification.decisionForJob(jobId) != bytes32(0),
            "accepted verdict not consumed exactly once");
        require(custody.totalReserved() == 3 ether, "replay changed reserve");
    }
    function testProfileInputOutputReceiptAndSignatureOnlyBypassFailClosed() public {
        ComputeJobIndependentVerification420.Verdict memory v = _verdict(31);
        bytes memory sig = _signature(VERIFIER_KEY, verification.verdictDigest(v));
        v.profileId = keccak256("unsupported-profile");
        require(!_submit(v, sig, values, 194, receipt), "profile substitution admitted");
        _unchanged(31);
        v = _verdict(32);
        sig = _signature(VERIFIER_KEY, verification.verdictDigest(v));
        uint64[4] memory input = values;
        input[0]++;
        require(!_submit(v, sig, input, 194, receipt), "input substitution admitted");
        _unchanged(32);
        require(!_submit(v, sig, values, 195, receipt), "output substitution admitted");
        _unchanged(32);
        require(!_submit(v, sig, values, 194, keccak256("wrong-receipt")), "receipt substitution admitted");
        _unchanged(32);
        (bool bypass,) = address(verification).call(abi.encodeCall(verification.submitVerdict, (v, sig)));
        require(!bypass, "signature-only bypass admitted");
        _unchanged(32);
    }
}
