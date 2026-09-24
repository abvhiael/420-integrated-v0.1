// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/system/CapabilityRegistry420.sol";
import "../src/compute/ComputeJobSignedRequestAuthority420.sol";
import "../src/compute/ComputeJobPayerCustody420.sol";
import "../src/compute/ComputeJobMatchedWorkerEvidence420.sol";
import "../src/compute/ComputeJobIntegerProfileVerification420.sol";

interface VmIndependenceGate420 {
    function addr(uint256) external returns (address);
    function sign(uint256, bytes32) external returns (uint8, bytes32, bytes32);
    function deal(address, uint256) external;
    function prank(address) external;
    function warp(uint256) external;
}
contract IndependenceGateNoSettlement420 is IComputeJobSettlementEvidence420 {
    function settled(bytes32, bytes32, bytes32) external pure returns (bool) { return false; }
}

/// @notice 1.1.4.2: independence policy must fail closed inside the real evaluated
/// verdict transition, not merely in a policy-only unit test.
contract ComputeJobVerifierIndependenceGate420Test {
    VmIndependenceGate420 private constant vm = VmIndependenceGate420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant GOV = address(0x1001);
    address private constant ATTESTOR = address(0x1002);
    address private constant SELECTOR = address(0x1003);
    address private constant ISSUER = address(0x1004);
    address private constant OPERATOR = address(0xC0FFEE);
    uint256 private constant OWNER_KEY = 0xA11CE;
    uint256 private constant PAYER_KEY = 0xBEEF;
    uint256 private constant VERIFIER_KEY = 0xC0DE;
    bytes32 private constant MANIFEST = keccak256("bounded-integer-profile-v1-manifest");
    bytes32 private constant OWNER_CONTROL = keccak256("owner-controller");
    bytes32 private constant PAYER_CONTROL = keccak256("payer-controller");
    bytes32 private constant OPERATOR_CONTROL = keccak256("operator-controller");
    bytes32 private constant VERIFIER_CONTROL = keccak256("verifier-controller");
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
            address(workers), address(verification), address(new IndependenceGateNoSettlement420()));
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
        _attest(owner, OWNER_CONTROL, 1, 1 days);
        _attest(payer, PAYER_CONTROL, 2, 1 days);
        _attest(OPERATOR, OPERATOR_CONTROL, 3, 1 days);
        _attest(verifier, VERIFIER_CONTROL, 4, 1 days);
        _createResult();
        _grant(verifier, auth.ACTION_VERIFY_RESULT(), 4);
    }
    function _attest(address account, bytes32 controller, uint256 n, uint256 lifetime) private {
        vm.prank(ATTESTOR);
        policy.attest(account, controller, keccak256(abi.encode("reviewed", n)),
            uint64(block.timestamp + lifetime));
    }
    function _signature(uint256 key, bytes32 digest) private returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }
    function _grant(address actor, bytes32 action, uint256 nonce) private {
        bytes32 component = auth.COMPONENT_COMPUTE();
        bytes32 scope = auth.scopeJob(jobId);
        vm.prank(ISSUER);
        registry.createGrant(keccak256(abi.encode(jobId, action, nonce)), actor,
            component, action, scope, 0, 0, 0, uint64(block.timestamp), 0);
    }
    function _createResult() private {
        ComputeJobSignedRequestAuthority420.Authorization memory a =
            ComputeJobSignedRequestAuthority420.Authorization({owner: owner, payer: payer,
                manifestHash: MANIFEST, workloadType: verification.WORKLOAD_TYPE(),
                inputCommitment: verification.inputHash(values),
                outputSchemaCommitment: verification.OUTPUT_SCHEMA(),
                deadline: uint64(block.timestamp + 1 days), authorizationExpiry: uint64(block.timestamp + 2 days),
                maxSpend: 5 ether, nonce: 4202});
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
        _grant(OPERATOR, auth.ACTION_ACCEPT_MATCH(), 1);
        vm.prank(OPERATOR);
        matches.acceptMatch(jobId, 3);
        _grant(OPERATOR, auth.ACTION_EXECUTE_ATTEMPT(), 2);
        _grant(OPERATOR, auth.ACTION_SUBMIT_RECEIPT(), 3);
        vm.prank(OPERATOR);
        workers.acceptAssignment(jobId, resourceId, 4);
        receipt = keccak256("canonical-independence-worker-receipt");
        bytes32 outHash = verification.outputHash(194);
        vm.prank(OPERATOR);
        bytes32 committed = workers.commitResult(jobId, receipt, outHash);
        vm.prank(OPERATOR);
        jobs.recordResult(jobId, 5, committed);
        require(jobs.job(jobId).status == ComputeJobRegistry420.Status.RESULT_COMMITTED,
            "fixture did not reach committed result");
        require(custody.totalReserved() == 3 ether, "fixture not funded");
    }
    function _appoint(address selected, uint256 lifetime) private returns (bool ok) {
        bytes32 profile = verification.PROFILE_ID();
        vm.prank(SELECTOR);
        (ok,) = address(policy).call(abi.encodeCall(policy.appoint,
            (jobId, selected, profile, owner, payer, OPERATOR,
             keccak256("reviewed-conflicts-and-selection"), uint64(block.timestamp + lifetime))));
    }
    function _verdict(uint256 nonce) private view returns (ComputeJobIndependentVerification420.Verdict memory v) {
        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        v = ComputeJobIndependentVerification420.Verdict({jobId: jobId, requestId: j.requestId,
            manifestHash: j.manifestHash, matchId: j.matchId, assignmentRef: j.assignmentRef,
            resultCommitment: j.resultCommitment, verifier: verifier,
            profileId: verification.PROFILE_ID(), approved: true, expectedRevision: j.revision,
            expiry: uint64(block.timestamp + 100), nonce: nonce});
    }
    function _submit(uint256 nonce) private returns (bool ok) {
        ComputeJobIndependentVerification420.Verdict memory v = _verdict(nonce);
        bytes memory sig = _signature(VERIFIER_KEY, verification.verdictDigest(v));
        (ok,) = address(verification).call(abi.encodeCall(verification.submitEvaluatedVerdict,
            (v, sig, values, uint256(194), receipt)));
    }
    function _unchanged(uint256 nonce) private view {
        require(jobs.job(jobId).status == ComputeJobRegistry420.Status.RESULT_COMMITTED,
            "independence failure changed canonical job state");
        require(verification.decisionForJob(jobId) == bytes32(0), "independence failure recorded decision");
        require(!verification.usedNonce(verifier, nonce), "independence failure burned verifier nonce");
        require(custody.totalReserved() == 3 ether, "independence failure released payer reserve");
    }
    function _deny(uint256 nonce) private {
        require(!_submit(nonce), "ineligible verifier approved canonical output");
        _unchanged(nonce);
    }
    function testNoAppointmentAndUnauthorizedSelectionFailAtActualVerdictGate() public {
        _deny(1);
        bytes32 profile = verification.PROFILE_ID();
        vm.prank(owner);
        (bool ok,) = address(policy).call(abi.encodeCall(policy.appoint,
            (jobId, verifier, profile, owner, payer, OPERATOR,
             keccak256("unauthorized-selection"), uint64(block.timestamp + 100))));
        require(!ok, "job owner selected own verifier");
        _deny(2);
        require(_appoint(verifier, 1000), "authorized independent appointment refused");
        require(_submit(3), "authorized independent verifier cannot complete real job");
        require(jobs.job(jobId).status == ComputeJobRegistry420.Status.VERIFIED,
            "valid independently evaluated verdict not recorded");
    }
    function testSharedControllerAliasesForAllThreeCanonicalPartiesFailClosed() public {
        bytes32[3] memory controls = [OWNER_CONTROL, PAYER_CONTROL, OPERATOR_CONTROL];
        for (uint256 i; i < 3; ++i) {
            _attest(verifier, controls[i], 10 + i, 1 days);
            require(!_appoint(verifier, 1000), "shared-controller verifier appointed");
            _deny(i + 10);
        }
        _attest(verifier, VERIFIER_CONTROL, 20, 1 days);
        require(_appoint(verifier, 1000), "independent appointment refused after conflict review");
        _denyAfterAttestedDrift();
    }
    function _denyAfterAttestedDrift() private {
        _attest(payer, VERIFIER_CONTROL, 21, 1 days);
        _deny(20);
        _attest(payer, PAYER_CONTROL, 22, 1 days);
        _attest(OPERATOR, VERIFIER_CONTROL, 23, 1 days);
        _deny(21);
        _attest(OPERATOR, OPERATOR_CONTROL, 24, 1 days);
        _attest(owner, VERIFIER_CONTROL, 25, 1 days);
        _deny(22);
        _attest(owner, OWNER_CONTROL, 26, 1 days);
        require(_submit(23), "restored independently controlled parties rejected");
    }
    function testWithdrawalSuspensionRevocationAndAuthorityRotationBlockVerdict() public {
        require(_appoint(verifier, 1000), "appointment failed");
        vm.prank(ATTESTOR);
        policy.withdraw(verifier);
        _deny(30);
        _attest(verifier, VERIFIER_CONTROL, 31, 1 days);
        vm.prank(GOV);
        policy.suspendAccount(verifier, true);
        _deny(31);
        vm.prank(GOV);
        policy.suspendAccount(verifier, false);
        vm.prank(SELECTOR);
        policy.revokeAppointment(jobId);
        _deny(32);
        require(_appoint(verifier, 1000), "appointment could not be restored after explicit revocation");
        vm.prank(GOV);
        policy.setAuthorities(address(0x777), address(0x778));
        _deny(33);
        require(!_appoint(verifier, 1000), "former selector retained appointment authority");
    }
    function testExpiredAttestationAndAppointmentFailAtActualVerdictGate() public {
        _attest(verifier, VERIFIER_CONTROL, 40, 1);
        require(_appoint(verifier, 1000), "appointment failed");
        vm.warp(block.timestamp + 2);
        _deny(40);
        _attest(verifier, VERIFIER_CONTROL, 41, 1 days);
        require(_submit(41), "freshly attested verifier rejected within appointment term");
    }
    function testAppointmentCannotBeSilentlyReplacedAndWrongProfileFails() public {
        require(_appoint(verifier, 1000), "appointment failed");
        bytes32 profile = verification.PROFILE_ID();
        vm.prank(SELECTOR);
        (bool replaced,) = address(policy).call(abi.encodeCall(policy.appoint,
            (jobId, verifier, profile, owner, payer, OPERATOR,
             keccak256("silent-replacement"), uint64(block.timestamp + 1000))));
        require(!replaced, "live appointment overwritten without revocation");
        ComputeVerifierIndependencePolicy420.Appointment memory a = policy.appointment(jobId);
        require(a.active && a.evidenceHash == keccak256("reviewed-conflicts-and-selection"),
            "rejected replacement altered appointment evidence");
        require(!policy.eligible(jobId, verifier, keccak256("wrong-profile"), owner, payer, OPERATOR),
            "wrong profile qualified by appointment");
        require(!policy.eligible(jobId, verifier, profile, owner, payer, verifier),
            "wrong canonical operator qualified");
        _deny(50); // prove rejection below by first withdrawing canonical payer
    }
}
