// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeJobRequestAuthority420.sol";
import "../src/compute/ComputeJobWorkerEvidence420.sol";
import "../src/compute/ComputeJobVerifierEvidence420.sol";

interface VmComputeJobInputs420 { function prank(address) external; }

/// @dev TEST-ONLY mock for the *not yet implemented* CMP match and funding authorities.
/// No economic or accepted-match qualification is inferred from this fixture.
contract JobUnqualifiedFundingMatchFixture420 is IComputeJobFundingEvidence420, IComputeJobMatchEvidence420,
    IComputeJobSettlementEvidence420 {
    function funded(bytes32, address, bytes32) external pure returns (bool) { return true; }
    function matched(bytes32, bytes32, bytes32, bytes32) external pure returns (bool) { return true; }
    function accepted(bytes32, bytes32, bytes32) external pure returns (bool) { return true; }
    function settled(bytes32, bytes32, bytes32) external pure returns (bool) { return false; }
    function accept(ComputeJobRegistry420 jobs, bytes32 jobId, uint64 revision, bytes32 acceptanceRef) external {
        jobs.recordAcceptance(jobId, revision, acceptanceRef);
    }
}

/// @dev Restricted test capability source; exercises real ComputeAuthorization420
/// checks, but DOES NOT stand in for the live CapabilityRegistry registrar.
contract JobCapabilityFixture420 {
    mapping(bytes32 => bool) private _granted;
    function set(address principal, bytes32 component, bytes32 action, bytes32 scope, bool enabled) external {
        _granted[keccak256(abi.encode(principal, component, action, scope))] = enabled;
    }
    function isAuthorized(address principal, bytes32 component, bytes32 action, bytes32 scope, uint256)
        external view returns (bool) {
        return _granted[keccak256(abi.encode(principal, component, action, scope))];
    }
}

contract ComputeJobAuthenticatedInputs420Test {
    VmComputeJobInputs420 private constant vm = VmComputeJobInputs420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant OWNER = address(0xA11CE);
    address private constant WORKER = address(0xBEEF);
    address private constant VERIFIER = address(0xCAFE);
    address private constant OUTSIDER = address(0xBAD);
    address private constant GOVERNANCE = address(0x420);
    bytes32 private constant MANIFEST = keccak256("signed-manifest-stub");
    bytes32 private constant WORKLOAD = keccak256("gpu-inference");
    bytes32 private constant INPUT = keccak256("input");
    bytes32 private constant SCHEMA = keccak256("output-schema");
    bytes32 private constant FUNDING = keccak256("unqualified-funding-test-only");
    bytes32 private constant MATCH = keccak256("unqualified-match-test-only");
    bytes32 private constant ACCEPT = keccak256("unqualified-accept-test-only");
    bytes32 private constant RECEIPT = keccak256("receipt");
    bytes32 private constant OUTPUT = keccak256("output");
    bytes32 private constant VERIFICATION_PROOF = keccak256("verifier-evidence");

    ComputeJobRequestAuthority420 private requests;
    JobUnqualifiedFundingMatchFixture420 private unqualified;
    JobCapabilityFixture420 private caps;
    ComputeAuthorization420 private auth;
    ComputeProviderRegistry420 private providers;
    ComputeNodeRegistry420 private nodes;
    ComputeResourceRegistry420 private resources;
    ComputeJobWorkerEvidence420 private workers;
    ComputeJobVerifierEvidence420 private verifiers;
    ComputeJobRegistry420 private jobs;
    bytes32 private resourceId;

    function setUp() public {
        requests = new ComputeJobRequestAuthority420();
        unqualified = new JobUnqualifiedFundingMatchFixture420();
        caps = new JobCapabilityFixture420();
        auth = new ComputeAuthorization420(address(caps));
        providers = new ComputeProviderRegistry420(GOVERNANCE);
        nodes = new ComputeNodeRegistry420(address(providers), GOVERNANCE);
        resources = new ComputeResourceRegistry420(address(nodes), GOVERNANCE);
        workers = new ComputeJobWorkerEvidence420(address(resources), address(auth));
        verifiers = new ComputeJobVerifierEvidence420(address(auth));
        jobs = new ComputeJobRegistry420(address(requests), address(unqualified), address(unqualified),
            address(workers), address(verifiers), address(unqualified));
        workers.bindJobs(address(jobs));
        verifiers.bindJobs(address(jobs));
        vm.prank(WORKER);
        bytes32 providerId = providers.register(MANIFEST, keccak256("security-ref"), WORKER);
        vm.prank(GOVERNANCE);
        providers.activate(providerId);
        vm.prank(WORKER);
        bytes32 nodeId = nodes.register(providerId, MANIFEST, keccak256("endpoint"), uint64(block.timestamp + 3 days));
        vm.prank(WORKER);
        nodes.activate(nodeId);
        bytes32 computeClass = resources.GPU_INFERENCE();
        // vm.prank applies to the next external call: resolve the class before impersonating WORKER.
        vm.prank(WORKER);
        resourceId = resources.register(nodeId, computeClass, MANIFEST, keccak256("runtime"),
            keccak256("advertised-capabilities"), 8);
        vm.prank(WORKER);
        resources.activate(resourceId);
    }

    function _job() private returns (bytes32 jobId) {
        vm.prank(OWNER);
        bytes32 requestId = requests.registerRequest(MANIFEST, WORKLOAD, INPUT, SCHEMA, uint64(block.timestamp + 1 days));
        ComputeJobRequestAuthority420.Request memory r = requests.getRequest(requestId);
        vm.prank(OWNER);
        jobId = jobs.createJob(requestId, r.requestCommitment, MANIFEST, WORKLOAD, INPUT, SCHEMA, r.deadline);
        vm.prank(OWNER);
        jobs.recordFunding(jobId, 1, FUNDING);
        vm.prank(OWNER);
        jobs.recordMatch(jobId, 2, MATCH);
        unqualified.accept(jobs, jobId, 3, ACCEPT);
    }

    function _grant(address principal, bytes32 action, bytes32 jobId) private {
        caps.set(principal, auth.COMPONENT_COMPUTE(), action, auth.scopeJob(jobId), true);
    }

    function testAuthorizedWorkerAndIndependentVerifierDecision() public {
        bytes32 jobId = _job();
        _grant(WORKER, auth.ACTION_EXECUTE_ATTEMPT(), jobId);
        _grant(WORKER, auth.ACTION_SUBMIT_RECEIPT(), jobId);
        _grant(VERIFIER, auth.ACTION_VERIFY_RESULT(), jobId);
        vm.prank(WORKER);
        bytes32 assignmentRef = workers.acceptAssignment(jobId, resourceId, 4);
        require(assignmentRef != bytes32(0) && jobs.job(jobId).worker == WORKER, "operator not bound");
        vm.prank(WORKER);
        bytes32 result = workers.commitResult(jobId, RECEIPT, OUTPUT);
        vm.prank(WORKER);
        jobs.recordResult(jobId, 5, result);
        vm.prank(VERIFIER);
        bytes32 decisionRef = verifiers.submitDecision(jobId, 6, VERIFICATION_PROOF, true);
        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        require(j.status == ComputeJobRegistry420.Status.VERIFIED && j.verifier == VERIFIER,
            "independent verdict not recorded");
        require(j.verificationRef == decisionRef && j.resultCommitment == result, "result/decision mismatch");
    }

    function testOutsiderAndMissingScopeCannotAssign() public {
        bytes32 jobId = _job();
        vm.prank(OUTSIDER);
        (bool ok,) = address(workers).call(abi.encodeCall(workers.acceptAssignment, (jobId, resourceId, uint64(4))));
        require(!ok && jobs.job(jobId).status == ComputeJobRegistry420.Status.ACCEPTED,
            "outsider accepted resource assignment");
        vm.prank(WORKER);
        (ok,) = address(workers).call(abi.encodeCall(workers.acceptAssignment, (jobId, resourceId, uint64(4))));
        require(!ok && workers.assignmentForJob(jobId) == bytes32(0), "missing capability accepted");
    }

    function testWorkerCannotSelfVerifyEvenWithVerificationCapability() public {
        bytes32 jobId = _job();
        _grant(WORKER, auth.ACTION_EXECUTE_ATTEMPT(), jobId);
        _grant(WORKER, auth.ACTION_SUBMIT_RECEIPT(), jobId);
        _grant(WORKER, auth.ACTION_VERIFY_RESULT(), jobId);
        vm.prank(WORKER);
        workers.acceptAssignment(jobId, resourceId, 4);
        vm.prank(WORKER);
        bytes32 result = workers.commitResult(jobId, RECEIPT, OUTPUT);
        vm.prank(WORKER);
        jobs.recordResult(jobId, 5, result);
        vm.prank(WORKER);
        (bool ok,) = address(verifiers).call(abi.encodeCall(verifiers.submitDecision,
            (jobId, uint64(6), VERIFICATION_PROOF, true)));
        require(!ok && jobs.job(jobId).status == ComputeJobRegistry420.Status.RESULT_COMMITTED,
            "worker self-approved result");
    }
}
