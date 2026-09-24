// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/system/CapabilityRegistry420.sol";
import "../src/compute/ComputeJobSignedRequestAuthority420.sol";
import "../src/compute/ComputeJobPayerCustody420.sol";
import "../src/compute/ComputeJobMatchedWorkerEvidence420.sol";
import "../src/compute/ComputeJobIntegerProfileVerification420.sol";

interface VmIntegerProfile420 {
    function addr(uint256 key) external returns (address);
    function sign(uint256 key, bytes32 digest) external returns (uint8, bytes32, bytes32);
    function deal(address who, uint256 amount) external;
    function prank(address who) external;
}
contract IntegerProfileSettlementDeny420 is IComputeJobSettlementEvidence420 {
    function settled(bytes32, bytes32, bytes32) external pure returns (bool) { return false; }
}
contract ComputeJobIntegerProfileVerification420Test {
    VmIntegerProfile420 private constant vm = VmIntegerProfile420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant OPERATOR = address(0xC0FFEE);
    address private constant GOV = address(0x1001);
    address private constant ATTESTOR = address(0x1002);
    address private constant SELECTOR = address(0x1003);
    address private constant ISSUER = address(0x1004);
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
    bytes32 private resourceId;
    uint64[4] private values;

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
            address(workers), address(verification), address(new IntegerProfileSettlementDeny420()));
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
        bytes32 gpu = resources.GPU_INFERENCE();
        vm.prank(OPERATOR);
        resourceId = resources.register(nodeId, gpu, MANIFEST,
            keccak256("integer-execution-runtime"), keccak256("integer-profile-capability"), 8);
        vm.prank(OPERATOR);
        resources.activate(resourceId);
        _attest(owner, keccak256("owner-controller"), 1);
        _attest(payer, keccak256("payer-controller"), 2);
        _attest(OPERATOR, keccak256("operator-controller"), 3);
        _attest(verifier, keccak256("verifier-controller"), 4);
    }
    function _attest(address account, bytes32 controller, uint256 n) private {
        vm.prank(ATTESTOR);
        policy.attest(account, controller, keccak256(abi.encode("reviewed", n)), uint64(block.timestamp + 1 days));
    }
    function _signature(uint256 key, bytes32 digest) private returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }
    function _grant(address actor, bytes32 jobId, bytes32 action, uint256 n) private {
        // Foundry's vm.prank affects only the next external call. Resolve registry
        // arguments first so the designated issuer, not this fixture, creates the grant.
        bytes32 component = auth.COMPONENT_COMPUTE();
        bytes32 scope = auth.scopeJob(jobId);
        vm.prank(ISSUER);
        registry.createGrant(keccak256(abi.encode(jobId, action, n)), actor,
            component, action, scope, 0, 0, 0, uint64(block.timestamp), 0);
    }
    function _resultJob(uint256 n, uint256 output) private returns (bytes32 id, bytes32 receipt) {
        ComputeJobSignedRequestAuthority420.Authorization memory a =
            ComputeJobSignedRequestAuthority420.Authorization({owner: owner, payer: payer, manifestHash: MANIFEST,
                workloadType: verification.WORKLOAD_TYPE(), inputCommitment: verification.inputHash(values),
                outputSchemaCommitment: verification.OUTPUT_SCHEMA(), deadline: uint64(block.timestamp + 1 days),
                authorizationExpiry: uint64(block.timestamp + 2 days), maxSpend: 5 ether, nonce: n});
        bytes32 digest = requests.authorizationDigest(a);
        bytes memory ownerSig = _signature(OWNER_KEY, digest);
        bytes memory payerSig = _signature(PAYER_KEY, digest);
        vm.prank(owner);
        bytes32 requestId = requests.registerSignedRequest(a, ownerSig, payerSig);
        vm.prank(owner);
        id = jobs.createJob(requestId, requestId, MANIFEST, a.workloadType,
            a.inputCommitment, a.outputSchemaCommitment, a.deadline);
        vm.prank(payer);
        custody.reserve{value: 3 ether}(id);
        vm.prank(owner);
        jobs.recordFunding(id, 1, id);
        vm.prank(owner);
        bytes32 matchId = matches.propose(id, resourceId);
        vm.prank(owner);
        jobs.recordMatch(id, 2, matchId);
        _grant(OPERATOR, id, auth.ACTION_ACCEPT_MATCH(), n * 10 + 1);
        vm.prank(OPERATOR);
        matches.acceptMatch(id, 3);
        _grant(OPERATOR, id, auth.ACTION_EXECUTE_ATTEMPT(), n * 10 + 2);
        _grant(OPERATOR, id, auth.ACTION_SUBMIT_RECEIPT(), n * 10 + 3);
        vm.prank(OPERATOR);
        workers.acceptAssignment(id, resourceId, 4);
        receipt = keccak256(abi.encode("actual-worker-receipt", n));
        bytes32 outputCommitment = verification.outputHash(output);
        vm.prank(OPERATOR);
        bytes32 result = workers.commitResult(id, receipt, outputCommitment);
        vm.prank(OPERATOR);
        jobs.recordResult(id, 5, result);
        _grant(verifier, id, auth.ACTION_VERIFY_RESULT(), n * 10 + 4);
        bytes32 profile = verification.PROFILE_ID();
        vm.prank(SELECTOR);
        policy.appoint(id, verifier, profile, owner, payer, OPERATOR,
            keccak256(abi.encode("reviewed-appointment", n)), uint64(block.timestamp + 100));
    }
    function _verdict(bytes32 id, uint256 n, bool approved) private view
        returns (ComputeJobIndependentVerification420.Verdict memory v) {
        ComputeJobRegistry420.Job memory j = jobs.job(id);
        v = ComputeJobIndependentVerification420.Verdict({jobId: id, requestId: j.requestId,
            manifestHash: j.manifestHash, matchId: j.matchId, assignmentRef: j.assignmentRef,
            resultCommitment: j.resultCommitment, verifier: verifier,
            profileId: verification.PROFILE_ID(), approved: approved,
            expectedRevision: j.revision, expiry: uint64(block.timestamp + 100), nonce: n});
    }
    function _evaluate(bytes32 id, uint256 n, bool approved, uint256 output, bytes32 receipt)
        private returns (bool ok, bytes32 digest) {
        ComputeJobIndependentVerification420.Verdict memory v = _verdict(id, n, approved);
        digest = verification.verdictDigest(v);
        bytes memory sig = _signature(VERIFIER_KEY, digest);
        (ok,) = address(verification).call(abi.encodeCall(verification.submitEvaluatedVerdict,
            (v, sig, values, output, receipt)));
    }
    function testKnownGoodOutputEvaluatesAndRecordsReproducibleEvidence() public {
        bytes32 id; bytes32 receipt;
        (id, receipt) = _resultJob(1, 194);
        require(verification.expectedResult(values) == 194, "independent reference mismatch");
        (bool ok, bytes32 digest) = _evaluate(id, 1, true, 194, receipt);
        require(ok && jobs.job(id).status == ComputeJobRegistry420.Status.VERIFIED,
            "correct worker output not independently verified");
        ComputeJobIntegerProfileVerification420.Evaluation memory e = verification.evaluation(digest);
        require(e.exists && e.approved && e.expectedOutput == 194 && e.claimedOutput == 194
            && e.workerResultCommitment == jobs.job(id).resultCommitment
            && e.evidenceRef != bytes32(0) && verification.decisionForJob(id) == digest
            && custody.totalReserved() == 3 ether, "evaluated evidence not tied to actual receipt and verdict");
    }
    function testIncorrectOutputCannotBeApprovedButNegativeVerdictRecordsIndependentFailure() public {
        (bytes32 id, bytes32 receipt) = _resultJob(2, 195);
        (bool ok,) = _evaluate(id, 2, true, 195, receipt);
        require(!ok && jobs.job(id).status == ComputeJobRegistry420.Status.RESULT_COMMITTED
            && !verification.usedNonce(verifier, 2), "incorrect output approved or nonce consumed");
        bytes32 digest;
        (ok, digest) = _evaluate(id, 3, false, 195, receipt);
        require(ok && jobs.job(id).status == ComputeJobRegistry420.Status.FAILED
            && !verification.evaluation(digest).approved
            && verification.evaluation(digest).expectedOutput == 194
            && custody.totalReserved() == 3 ether, "incorrect result not rejected with reference evidence");
    }
    function testTamperedOutputInputAndReceiptCannotAlterCanonicalResult() public {
        (bytes32 id, bytes32 receipt) = _resultJob(3, 194);
        (bool ok,) = _evaluate(id, 4, true, 195, receipt);
        require(!ok, "tampered output preimage admitted");
        (ok,) = _evaluate(id, 5, true, 194, keccak256("tampered-receipt"));
        require(!ok, "tampered worker receipt admitted");
        uint64 original = values[0];
        values[0] = 4;
        (ok,) = _evaluate(id, 6, true, 194, receipt);
        require(!ok, "tampered request input admitted");
        values[0] = original;
        require(jobs.job(id).status == ComputeJobRegistry420.Status.RESULT_COMMITTED
            && verification.decisionForJob(id) == bytes32(0)
            && !verification.usedNonce(verifier, 4) && custody.totalReserved() == 3 ether,
            "failed tamper attempt mutated canonical state");
        (ok,) = _evaluate(id, 7, true, 194, receipt);
        require(ok, "valid evidence rejected after tamper attempts");
    }
    function testSignatureOnlyBypassAndUnsupportedProfileAreRejected() public {
        (bytes32 id, bytes32 receipt) = _resultJob(4, 194);
        ComputeJobIndependentVerification420.Verdict memory v = _verdict(id, 8, true);
        bytes memory sig = _signature(VERIFIER_KEY, verification.verdictDigest(v));
        (bool ok,) = address(verification).call(abi.encodeCall(verification.submitVerdict, (v, sig)));
        require(!ok, "signature-only bypass admitted without independently evaluated output");
        v.profileId = keccak256("unsupported-profile");
        sig = _signature(VERIFIER_KEY, verification.verdictDigest(v));
        (ok,) = address(verification).call(abi.encodeCall(verification.submitEvaluatedVerdict,
            (v, sig, values, uint256(194), receipt)));
        require(!ok && jobs.job(id).status == ComputeJobRegistry420.Status.RESULT_COMMITTED,
            "unsupported profile admitted");
    }
}
