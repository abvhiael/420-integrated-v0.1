// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/system/CapabilityRegistry420.sol";
import "../src/compute/ComputeJobSignedRequestAuthority420.sol";
import "../src/compute/ComputeJobPayerCustody420.sol";
import "../src/compute/ComputeJobMatchedWorkerEvidence420.sol";
import "../src/compute/ComputeJobIndependentVerification420.sol";

interface VmCanonicalVerifier420 {
    function addr(uint256 key) external returns (address);
    function sign(uint256 key, bytes32 digest) external returns (uint8, bytes32, bytes32);
    function deal(address who, uint256 amount) external;
    function prank(address who) external;
    function warp(uint256 timestamp) external;
}
contract CanonicalVerifierSettlementDeny420 is IComputeJobSettlementEvidence420 {
    function settled(bytes32, bytes32, bytes32) external pure returns (bool) { return false; }
}

/// @notice Full signed request -> actual payer transfer -> matched worker receipt -> verifier
/// verdict with real, registrar-controlled CapabilityRegistry420 grants. The addresses below
/// are independent test actors, NOT a claim about production governance or workload correctness.
contract ComputeJobCanonicalVerifierAuthorities420Test {
    VmCanonicalVerifier420 private constant vm = VmCanonicalVerifier420(
        address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 private constant OWNER_KEY = 0xA11CE;
    uint256 private constant PAYER_KEY = 0xBEEF;
    uint256 private constant VERIFIER_KEY = 0xC0DE;
    address private constant REGISTRAR = address(0x1001);
    address private constant ISSUER = address(0x1002);
    address private constant PROFILE_ADMIN = address(0x1003);
    address private constant OUTSIDER = address(0x1004);
    address private constant OPERATOR = address(0xC0FFEE);
    bytes32 private constant MANIFEST = keccak256("canonical-verifier-manifest");
    bytes32 private constant PROFILE = keccak256("canonical-test-verifier-profile");

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
    ComputeJobIndependentVerification420 private verification;
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
        providers = new ComputeProviderRegistry420(REGISTRAR);
        nodes = new ComputeNodeRegistry420(address(providers), REGISTRAR);
        resources = new ComputeResourceRegistry420(address(nodes), REGISTRAR);
        matches = new ComputeJobAcceptedMatch420(address(resources), address(auth));
        workers = new ComputeJobMatchedWorkerEvidence420(address(matches), address(auth));
        // The verifier adapter's immutable bindingAdmin is the deploying profile authority.
        vm.prank(PROFILE_ADMIN);
        verification = new ComputeJobIndependentVerification420(address(matches), address(auth));
        jobs = new ComputeJobRegistry420(address(requests), address(custody), address(matches),
            address(workers), address(verification), address(new CanonicalVerifierSettlementDeny420()));
        custody.bindJobs(address(jobs));
        matches.bindJobs(address(jobs));
        workers.bindJobs(address(jobs));
        vm.prank(PROFILE_ADMIN);
        verification.bindJobs(address(jobs));
        // Deploying this test contract is only the initial registrar; transfer it to the
        // designated registrar and prove registration by an outsider is rejected.
        registry.transferComponentRegistrar(REGISTRAR);
        bytes32 component = auth.COMPONENT_COMPUTE();
        vm.prank(OUTSIDER);
        (bool ok,) = address(registry).call(abi.encodeCall(registry.registerProtocolComponent,
            (component, OUTSIDER)));
        require(!ok && registry.componentAuthority(component) == address(0),
            "unauthorized protocol component registration");
        vm.prank(REGISTRAR);
        registry.registerProtocolComponent(component, ISSUER);
        require(registry.componentRegistrar() == REGISTRAR
            && registry.componentAuthority(component) == ISSUER
            && registry.protocolComponentManaged(component), "registrar or component authority mismatch");
        vm.prank(OPERATOR);
        bytes32 providerId = providers.register(MANIFEST, keccak256("security"), OPERATOR);
        vm.prank(REGISTRAR);
        providers.activate(providerId);
        vm.prank(OPERATOR);
        bytes32 nodeId = nodes.register(providerId, MANIFEST, keccak256("endpoint"),
            uint64(block.timestamp + 3 days));
        vm.prank(OPERATOR);
        nodes.activate(nodeId);
        bytes32 gpu = resources.GPU_INFERENCE();
        vm.prank(OPERATOR);
        resourceId = resources.register(nodeId, gpu, MANIFEST,
            keccak256("runtime"), keccak256("capabilities"), 8);
        vm.prank(OPERATOR);
        resources.activate(resourceId);
        vm.prank(OUTSIDER);
        (ok,) = address(verification).call(abi.encodeCall(verification.setApprovedProfile,
            (PROFILE, true)));
        require(!ok && !verification.approvedProfile(PROFILE),
            "outsider approved verification profile");
        vm.prank(PROFILE_ADMIN);
        verification.setApprovedProfile(PROFILE, true);
    }

    function _signature(uint256 key, bytes32 digest) private returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }
    function _grant(address principal, bytes32 jobId, bytes32 action, uint256 nonce,
        uint64 until) private returns (bytes32 grantId) {
        bytes32 component = auth.COMPONENT_COMPUTE();
        bytes32 scope = auth.scopeJob(jobId);
        grantId = keccak256(abi.encode("canonical-verifier-test", principal, jobId, action, nonce));
        vm.prank(ISSUER);
        registry.createGrant(grantId, principal, component, action, scope, 0, 0, 0,
            uint64(block.timestamp), until);
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
        _grant(OPERATOR, id, auth.ACTION_ACCEPT_MATCH(), nonce * 10 + 1, 0);
        vm.prank(OPERATOR);
        matches.acceptMatch(id, 3);
        _grant(OPERATOR, id, auth.ACTION_EXECUTE_ATTEMPT(), nonce * 10 + 2, 0);
        _grant(OPERATOR, id, auth.ACTION_SUBMIT_RECEIPT(), nonce * 10 + 3, 0);
        vm.prank(OPERATOR);
        workers.acceptAssignment(id, resourceId, 4);
        vm.prank(OPERATOR);
        bytes32 result = workers.commitResult(id, keccak256("receipt"), keccak256("output"));
        vm.prank(OPERATOR);
        jobs.recordResult(id, 5, result);
    }
    function _verdict(bytes32 id, uint256 nonce) private view
        returns (ComputeJobIndependentVerification420.Verdict memory v) {
        ComputeJobRegistry420.Job memory j = jobs.job(id);
        v = ComputeJobIndependentVerification420.Verdict({
            jobId: id, requestId: j.requestId, manifestHash: j.manifestHash,
            matchId: j.matchId, assignmentRef: j.assignmentRef,
            resultCommitment: j.resultCommitment, verifier: verifier, profileId: PROFILE,
            approved: true, expectedRevision: j.revision,
            expiry: uint64(block.timestamp + 500), nonce: nonce
        });
    }
    function _submit(ComputeJobIndependentVerification420.Verdict memory v)
        private returns (bool ok, bytes32 decisionRef) {
        bytes32 digest = verification.verdictDigest(v);
        bytes memory sig = _signature(VERIFIER_KEY, digest);
        (ok,) = address(verification).call(abi.encodeCall(verification.submitVerdict, (v, sig)));
        decisionRef = digest;
    }

    function testRegistrarIssuerAndCanonicalEndToEndVerdict() public {
        bytes32 id = _resultJob(1);
        bytes32 component = auth.COMPONENT_COMPUTE();
        bytes32 action = auth.ACTION_VERIFY_RESULT();
        bytes32 scope = auth.scopeJob(id);
        bytes32 foreignGrant = keccak256("foreign-verifier-grant");
        vm.prank(OUTSIDER);
        (bool ok,) = address(registry).call(abi.encodeCall(registry.createGrant,
            (foreignGrant, verifier, component, action, scope, 0, 0, uint64(0),
             uint64(block.timestamp), uint64(0))));
        require(!ok && !auth.isAuthorized(verifier, action, scope, 0),
            "outsider issued canonical verifier grant");
        bytes32 grantId = _grant(verifier, id, action, 41, 0);
        require(auth.isAuthorized(verifier, action, scope, 0), "canonical verifier grant absent");
        vm.prank(OUTSIDER);
        (ok,) = address(registry).call(abi.encodeCall(registry.revokeGrant, (grantId)));
        require(!ok && auth.isAuthorized(verifier, action, scope, 0),
            "outsider revoked verifier grant");
        ComputeJobIndependentVerification420.Verdict memory v = _verdict(id, 71);
        bytes32 decisionRef;
        (ok, decisionRef) = _submit(v);
        require(ok && jobs.job(id).status == ComputeJobRegistry420.Status.VERIFIED
            && verification.verified(id, v.resultCommitment, verifier, decisionRef, true)
            && custody.totalReserved() == 3 ether, "canonical verified job or payer custody failed");
    }
    function testExpiredAndRevokedCanonicalVerifierGrants() public {
        bytes32 expiredId = _resultJob(2);
        bytes32 action = auth.ACTION_VERIFY_RESULT();
        bytes32 expiredScope = auth.scopeJob(expiredId);
        _grant(verifier, expiredId, action, 42, uint64(block.timestamp + 10));
        vm.warp(block.timestamp + 11);
        require(!auth.isAuthorized(verifier, action, expiredScope, 0),
            "expired canonical verifier grant remained active");
        (bool ok,) = _submit(_verdict(expiredId, 72));
        require(!ok && verification.decisionForJob(expiredId) == bytes32(0)
            && jobs.job(expiredId).status == ComputeJobRegistry420.Status.RESULT_COMMITTED,
            "expired verifier grant changed job state");
        bytes32 revokedId = _resultJob(3);
        bytes32 grantId = _grant(verifier, revokedId, action, 43, 0);
        bytes32 revokedScope = auth.scopeJob(revokedId);
        vm.prank(ISSUER);
        registry.revokeGrant(grantId);
        require(!auth.isAuthorized(verifier, action, revokedScope, 0),
            "revoked canonical verifier grant remained active");
        (ok,) = _submit(_verdict(revokedId, 73));
        require(!ok && verification.decisionForJob(revokedId) == bytes32(0)
            && jobs.job(revokedId).status == ComputeJobRegistry420.Status.RESULT_COMMITTED
            && custody.totalReserved() == 6 ether,
            "revoked verifier grant changed job state or released payer custody");
    }
    function testProfileAuthorityRevocationAndIsolation() public {
        bytes32 id = _resultJob(4);
        _grant(verifier, id, auth.ACTION_VERIFY_RESULT(), 44, 0);
        bytes32 otherProfile = keccak256("separately-authorized-profile");
        vm.prank(OUTSIDER);
        (bool ok,) = address(verification).call(abi.encodeCall(verification.setApprovedProfile,
            (PROFILE, false)));
        require(!ok && verification.approvedProfile(PROFILE), "outsider revoked verifier profile");
        vm.prank(PROFILE_ADMIN);
        verification.setApprovedProfile(PROFILE, false);
        require(!verification.approvedProfile(PROFILE), "profile authority could not revoke profile");
        (ok,) = _submit(_verdict(id, 74));
        require(!ok && verification.decisionForJob(id) == bytes32(0)
            && jobs.job(id).status == ComputeJobRegistry420.Status.RESULT_COMMITTED,
            "revoked profile admitted new verdict");
        vm.prank(PROFILE_ADMIN);
        verification.setApprovedProfile(otherProfile, true);
        require(verification.approvedProfile(otherProfile) && !verification.approvedProfile(PROFILE),
            "profile approval leaked to revoked profile");
        vm.prank(PROFILE_ADMIN);
        verification.setApprovedProfile(PROFILE, true);
        (ok,) = _submit(_verdict(id, 75));
        require(ok && jobs.job(id).status == ComputeJobRegistry420.Status.VERIFIED,
            "authorized profile restoration did not permit verdict");
    }
}
