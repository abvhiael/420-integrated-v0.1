// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/system/CapabilityRegistry420.sol";
import "../src/compute/ComputeJobSignedRequestAuthority420.sol";
import "../src/compute/ComputeJobPayerCustody420.sol";
import "../src/compute/ComputeJobMatchedWorkerEvidence420.sol";
import "../src/compute/ComputeJobPolicyEnforcedVerification420.sol";

interface VmPolicyIntegration420 {
    function addr(uint256 key) external returns (address);
    function sign(uint256 key, bytes32 digest) external returns (uint8, bytes32, bytes32);
    function deal(address who, uint256 amount) external;
    function prank(address who) external;
}
contract PolicySettlementDeny420 is IComputeJobSettlementEvidence420 {
    function settled(bytes32, bytes32, bytes32) external pure returns (bool) { return false; }
}
contract ComputeJobPolicyEnforcedVerification420Test {
    VmPolicyIntegration420 private constant vm = VmPolicyIntegration420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant OPERATOR = address(0xC0FFEE);
    address private constant GOV = address(0x1001);
    address private constant ATTESTOR = address(0x1002);
    address private constant SELECTOR = address(0x1003);
    address private constant ISSUER = address(0x1004);
    uint256 private constant OWNER_KEY = 0xA11CE;
    uint256 private constant PAYER_KEY = 0xBEEF;
    uint256 private constant VERIFIER_KEY = 0xC0DE;
    bytes32 private constant MANIFEST = keccak256("policy-bound-request");
    bytes32 private constant PROFILE = keccak256("policy-profile");
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
    ComputeJobPolicyEnforcedVerification420 private verification;
    ComputeJobRegistry420 private jobs;
    bytes32 private resourceId;

    function setUp() public {
        owner = vm.addr(OWNER_KEY);
        payer = vm.addr(PAYER_KEY);
        verifier = vm.addr(VERIFIER_KEY);
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
        verification = new ComputeJobPolicyEnforcedVerification420(address(matches), address(auth), address(policy));
        jobs = new ComputeJobRegistry420(address(requests), address(custody), address(matches),
            address(workers), address(verification), address(new PolicySettlementDeny420()));
        custody.bindJobs(address(jobs));
        matches.bindJobs(address(jobs));
        workers.bindJobs(address(jobs));
        verification.bindJobs(address(jobs));
        verification.setApprovedProfile(PROFILE, true);
        registry.transferComponentRegistrar(GOV);
        vm.prank(GOV);
        registry.registerProtocolComponent(auth.COMPONENT_COMPUTE(), ISSUER);
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
        resourceId = resources.register(nodeId, gpu, MANIFEST, keccak256("runtime"), keccak256("capabilities"), 8);
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
        bytes32 component = auth.COMPONENT_COMPUTE();
        bytes32 scope = auth.scopeJob(jobId);
        vm.prank(ISSUER);
        registry.createGrant(keccak256(abi.encode(jobId, action, n)), actor, component, action,
            scope, 0, 0, 0, uint64(block.timestamp), 0);
    }
    function _resultJob(uint256 n) private returns (bytes32 id) {
        ComputeJobSignedRequestAuthority420.Authorization memory a =
            ComputeJobSignedRequestAuthority420.Authorization({owner: owner, payer: payer, manifestHash: MANIFEST,
                workloadType: keccak256("gpu"), inputCommitment: keccak256("input"),
                outputSchemaCommitment: keccak256("output-schema"), deadline: uint64(block.timestamp + 1 days),
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
        vm.prank(OPERATOR);
        bytes32 result = workers.commitResult(id, keccak256("receipt"), keccak256("output"));
        vm.prank(OPERATOR);
        jobs.recordResult(id, 5, result);
        _grant(verifier, id, auth.ACTION_VERIFY_RESULT(), n * 10 + 4);
    }
    function _verdict(bytes32 id, uint256 n) private view returns (ComputeJobIndependentVerification420.Verdict memory v) {
        ComputeJobRegistry420.Job memory j = jobs.job(id);
        v = ComputeJobIndependentVerification420.Verdict({jobId: id, requestId: j.requestId,
            manifestHash: j.manifestHash, matchId: j.matchId, assignmentRef: j.assignmentRef,
            resultCommitment: j.resultCommitment, verifier: verifier, profileId: PROFILE,
            approved: true, expectedRevision: j.revision, expiry: uint64(block.timestamp + 100), nonce: n});
    }
    function _submit(bytes32 id, uint256 n) private returns (bool ok) {
        ComputeJobIndependentVerification420.Verdict memory v = _verdict(id, n);
        bytes memory sig = _signature(VERIFIER_KEY, verification.verdictDigest(v));
        (ok,) = address(verification).call(abi.encodeCall(verification.submitVerdict, (v, sig)));
    }
    function _appoint(bytes32 id) private {
        vm.prank(SELECTOR);
        policy.appoint(id, verifier, PROFILE, owner, payer, OPERATOR,
            keccak256("independent-review-record"), uint64(block.timestamp + 100));
    }
    function testNoAppointmentOrSharedControllerCanSubmitEvenWithValidCapabilityAndSignature() public {
        bytes32 id = _resultJob(1);
        require(!_submit(id, 1) && verification.decisionForJob(id) == bytes32(0),
            "unappointed verifier admitted");
        _attest(verifier, keccak256("owner-controller"), 5);
        vm.prank(SELECTOR);
        (bool ok,) = address(policy).call(abi.encodeCall(policy.appoint,
            (id, verifier, PROFILE, owner, payer, OPERATOR,
             keccak256("forged-independence"), uint64(block.timestamp + 100))));
        require(!ok && !_submit(id, 2), "owner-controlled alias passed independence gate");
        _attest(verifier, keccak256("verifier-controller"), 6);
        _appoint(id);
        require(_submit(id, 3) && jobs.job(id).status == ComputeJobRegistry420.Status.VERIFIED
            && custody.totalReserved() == 3 ether, "independent canonical verifier rejected or payer released");
    }
    function testAppointmentRevocationBlocksSignedDecision() public {
        bytes32 id = _resultJob(2);
        _appoint(id);
        vm.prank(GOV);
        policy.revokeAppointment(id);
        require(!_submit(id, 4) && jobs.job(id).status == ComputeJobRegistry420.Status.RESULT_COMMITTED
            && !verification.usedNonce(verifier, 4), "revoked appointment changed job state");
    }
}
