// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeJobSignedRequestAuthority420.sol";
import "../src/compute/ComputeJobPayerCustody420.sol";
import "../src/compute/ComputeJobMatchedWorkerEvidence420.sol";
import "../src/compute/ComputeJobIndependentVerification420.sol";

interface VmComputeVerification420 {
    function addr(uint256 key) external returns (address);
    function sign(uint256 key, bytes32 digest) external returns (uint8, bytes32, bytes32);
    function deal(address who, uint256 amount) external;
    function prank(address who) external;
    function warp(uint256 timestamp) external;
}

contract VerifierGrants420 {
    mapping(bytes32 => bool) private _grants;
    function grant(address who, bytes32 component, bytes32 action, bytes32 scope) external {
        _grants[keccak256(abi.encode(who, component, action, scope))] = true;
    }
    function isAuthorized(address who, bytes32 component, bytes32 action, bytes32 scope, uint256)
        external view returns (bool) {
        return _grants[keccak256(abi.encode(who, component, action, scope))];
    }
}
contract VerifierSettlementDeny420 is IComputeJobSettlementEvidence420 {
    function settled(bytes32, bytes32, bytes32) external pure returns (bool) { return false; }
}

contract ComputeJobIndependentVerification420Test {
    VmComputeVerification420 private constant vm = VmComputeVerification420(
        address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 private constant OWNER_KEY = 0xA11CE;
    uint256 private constant PAYER_KEY = 0xBEEF;
    uint256 private constant VERIFIER_KEY = 0xC0DE;
    uint256 private constant FOREIGN_KEY = 0xBAD1;
    address private constant OPERATOR = address(0xC0FFEE);
    address private constant GOV = address(0x420);
    bytes32 private constant MANIFEST = keccak256("verified-manifest");
    bytes32 private constant PROFILE = keccak256("approved-independent-profile");

    address private owner;
    address private payer;
    address private verifier;
    ComputeJobSignedRequestAuthority420 private requests;
    ComputeJobPayerCustody420 private custody;
    VerifierGrants420 private grants;
    ComputeAuthorization420 private auth;
    ComputeProviderRegistry420 private providers;
    ComputeNodeRegistry420 private nodes;
    ComputeResourceRegistry420 private resources;
    ComputeJobAcceptedMatch420 private matches;
    ComputeJobMatchedWorkerEvidence420 private workers;
    ComputeJobIndependentVerification420 private verification;
    ComputeJobRegistry420 private jobs;
    bytes32 private resourceId;

    function setUp() public {
        owner = vm.addr(OWNER_KEY);
        payer = vm.addr(PAYER_KEY);
        verifier = vm.addr(VERIFIER_KEY);
        vm.deal(payer, 100 ether);
        requests = new ComputeJobSignedRequestAuthority420();
        custody = new ComputeJobPayerCustody420(address(requests));
        grants = new VerifierGrants420();
        auth = new ComputeAuthorization420(address(grants));
        providers = new ComputeProviderRegistry420(GOV);
        nodes = new ComputeNodeRegistry420(address(providers), GOV);
        resources = new ComputeResourceRegistry420(address(nodes), GOV);
        matches = new ComputeJobAcceptedMatch420(address(resources), address(auth));
        workers = new ComputeJobMatchedWorkerEvidence420(address(matches), address(auth));
        verification = new ComputeJobIndependentVerification420(address(matches), address(auth));
        VerifierSettlementDeny420 denied = new VerifierSettlementDeny420();
        jobs = new ComputeJobRegistry420(address(requests), address(custody), address(matches),
            address(workers), address(verification), address(denied));
        custody.bindJobs(address(jobs));
        matches.bindJobs(address(jobs));
        workers.bindJobs(address(jobs));
        verification.bindJobs(address(jobs));
        verification.setApprovedProfile(PROFILE, true);
        vm.prank(OPERATOR);
        bytes32 providerId = providers.register(MANIFEST, keccak256("security"), OPERATOR);
        vm.prank(GOV);
        providers.activate(providerId);
        vm.prank(OPERATOR);
        bytes32 nodeId = nodes.register(providerId, MANIFEST, keccak256("endpoint"),
            uint64(block.timestamp + 3 days));
        vm.prank(OPERATOR);
        nodes.activate(nodeId);
        bytes32 gpuClass = resources.GPU_INFERENCE();
        vm.prank(OPERATOR);
        resourceId = resources.register(nodeId, gpuClass, MANIFEST,
            keccak256("runtime"), keccak256("capabilities"), 8);
        vm.prank(OPERATOR);
        resources.activate(resourceId);
    }

    function _signature(uint256 key, bytes32 digest) private returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }
    function _grant(address who, bytes32 id, bytes32 action) private {
        grants.grant(who, auth.COMPONENT_COMPUTE(), action, auth.scopeJob(id));
    }
    function _resultJob(uint256 nonce) private returns (bytes32 id) {
        ComputeJobSignedRequestAuthority420.Authorization memory a =
            ComputeJobSignedRequestAuthority420.Authorization({
                owner: owner, payer: payer, manifestHash: MANIFEST,
                workloadType: keccak256("gpu"), inputCommitment: keccak256("input"),
                outputSchemaCommitment: keccak256("output-schema"),
                deadline: uint64(block.timestamp + 1 days),
                authorizationExpiry: uint64(block.timestamp + 2 days),
                maxSpend: 5 ether, nonce: nonce
            });
        bytes32 digest = requests.authorizationDigest(a);
        bytes memory ownerSignature = _signature(OWNER_KEY, digest);
        bytes memory payerSignature = _signature(PAYER_KEY, digest);
        vm.prank(owner);
        bytes32 requestId = requests.registerSignedRequest(a, ownerSignature, payerSignature);
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
        _grant(OPERATOR, id, auth.ACTION_ACCEPT_MATCH());
        vm.prank(OPERATOR);
        matches.acceptMatch(id, 3);
        _grant(OPERATOR, id, auth.ACTION_EXECUTE_ATTEMPT());
        _grant(OPERATOR, id, auth.ACTION_SUBMIT_RECEIPT());
        vm.prank(OPERATOR);
        workers.acceptAssignment(id, resourceId, 4);
        vm.prank(OPERATOR);
        bytes32 result = workers.commitResult(id, keccak256("receipt"), keccak256("output"));
        vm.prank(OPERATOR);
        jobs.recordResult(id, 5, result);
    }
    function _verdict(bytes32 id, address actor, uint256 nonce)
        private view returns (ComputeJobIndependentVerification420.Verdict memory v) {
        ComputeJobRegistry420.Job memory j = jobs.job(id);
        v = ComputeJobIndependentVerification420.Verdict({
            jobId: id, requestId: j.requestId, manifestHash: j.manifestHash,
            matchId: j.matchId, assignmentRef: j.assignmentRef,
            resultCommitment: j.resultCommitment, verifier: actor, profileId: PROFILE,
            approved: true, expectedRevision: j.revision,
            expiry: uint64(block.timestamp + 100), nonce: nonce
        });
    }
    function _submit(ComputeJobIndependentVerification420.Verdict memory v, uint256 key)
        private returns (bytes32 ref) {
        bytes32 digest = verification.verdictDigest(v);
        ref = verification.submitVerdict(v, _signature(key, digest));
    }
    function _rejected(ComputeJobIndependentVerification420.Verdict memory v, uint256 key)
        private returns (bool) {
        bytes32 digest = verification.verdictDigest(v);
        bytes memory sig = _signature(key, digest);
        (bool ok,) = address(verification).call(
            abi.encodeCall(verification.submitVerdict, (v, sig)));
        return !ok;
    }

    function testIndependentSignedVerdictAndNoImplicitSettlement() public {
        bytes32 id = _resultJob(1);
        _grant(verifier, id, auth.ACTION_VERIFY_RESULT());
        ComputeJobIndependentVerification420.Verdict memory v = _verdict(id, verifier, 1);
        bytes32 ref = _submit(v, VERIFIER_KEY);
        ComputeJobRegistry420.Job memory j = jobs.job(id);
        require(j.status == ComputeJobRegistry420.Status.VERIFIED && j.verificationRef == ref
            && j.verifier == verifier && verification.usedNonce(verifier, 1),
            "verifier provenance not recorded");
        require(verification.verified(id, j.resultCommitment, verifier, ref, true),
            "verifier decision evidence not bound");
        (bool ok,) = address(jobs).call(abi.encodeCall(jobs.recordSettlement,
            (id, uint64(7), keccak256("synthetic-payment"))));
        require(!ok && custody.totalReserved() == 3 ether,
            "verifier signature released custody without escrow proof");
    }
    function testRejectWorkerOwnerForeignSignerAndMissingCapability() public {
        bytes32 id = _resultJob(2);
        _grant(verifier, id, auth.ACTION_VERIFY_RESULT());
        ComputeJobIndependentVerification420.Verdict memory v = _verdict(id, OPERATOR, 2);
        _grant(OPERATOR, id, auth.ACTION_VERIFY_RESULT());
        require(_rejected(v, VERIFIER_KEY), "matched operator verified its own work");
        v = _verdict(id, owner, 3);
        _grant(owner, id, auth.ACTION_VERIFY_RESULT());
        require(_rejected(v, OWNER_KEY), "job owner verified own job");
        v = _verdict(id, verifier, 4);
        require(_rejected(v, FOREIGN_KEY), "foreign signature admitted");
        bytes32 second = _resultJob(3);
        v = _verdict(second, verifier, 5);
        require(_rejected(v, VERIFIER_KEY), "verifier without job grant admitted");
    }
    function testRejectAlteredFieldsExpiredNonceAndProfile() public {
        bytes32 id = _resultJob(4);
        _grant(verifier, id, auth.ACTION_VERIFY_RESULT());
        ComputeJobIndependentVerification420.Verdict memory v = _verdict(id, verifier, 6);
        v.resultCommitment = keccak256("foreign-result");
        require(_rejected(v, VERIFIER_KEY), "foreign result admitted");
        v = _verdict(id, verifier, 7);
        v.assignmentRef = keccak256("foreign-assignment");
        require(_rejected(v, VERIFIER_KEY), "foreign assignment admitted");
        v = _verdict(id, verifier, 8);
        v.expectedRevision += 1;
        require(_rejected(v, VERIFIER_KEY), "wrong revision admitted");
        v = _verdict(id, verifier, 9);
        v.profileId = keccak256("unapproved-profile");
        require(_rejected(v, VERIFIER_KEY), "unknown verifier profile admitted");
        v = _verdict(id, verifier, 10);
        vm.warp(block.timestamp + 101);
        require(_rejected(v, VERIFIER_KEY), "expired verdict admitted");
        v = _verdict(id, verifier, 11);
        _submit(v, VERIFIER_KEY);
        require(_rejected(v, VERIFIER_KEY) && verification.usedNonce(verifier, 11),
            "verdict replay admitted");
    }
    function testNegativeVerdictFailsJobAndDoesNotReleaseFunds() public {
        bytes32 id = _resultJob(5);
        _grant(verifier, id, auth.ACTION_VERIFY_RESULT());
        ComputeJobIndependentVerification420.Verdict memory v = _verdict(id, verifier, 12);
        v.approved = false;
        bytes32 ref = _submit(v, VERIFIER_KEY);
        require(jobs.job(id).status == ComputeJobRegistry420.Status.FAILED
            && verification.verified(id, v.resultCommitment, verifier, ref, false)
            && custody.totalReserved() == 3 ether,
            "negative verdict incorrectly settled or failed provenance");
    }
}
