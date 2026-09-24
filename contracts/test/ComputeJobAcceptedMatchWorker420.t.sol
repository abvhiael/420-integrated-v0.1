// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeJobMatchedWorkerEvidence420.sol";
import "../src/compute/ComputeJobRequestAuthority420.sol";

interface VmMatched420 { function prank(address) external; }

/// @dev Funding and settlement denied or explicitly fixture-only: these tests
/// qualify the match/worker edge, not deposits or verifier correctness.
contract MatchedFundingFixture420 is IComputeJobFundingEvidence420,
    IComputeJobVerificationEvidence420, IComputeJobSettlementEvidence420 {
    function funded(bytes32 jobId, address owner, bytes32 fundingRef) external pure returns (bool) {
        return jobId != bytes32(0) && owner != address(0) && fundingRef == jobId;
    }
    function verified(bytes32, bytes32, address, bytes32, bool) external pure returns (bool) { return false; }
    function settled(bytes32, bytes32, bytes32) external pure returns (bool) { return false; }
}

contract MatchedCapabilityFixture420 {
    mapping(bytes32 => bool) private allowed;
    function set(address principal, bytes32 component, bytes32 action, bytes32 scope) external {
        allowed[keccak256(abi.encode(principal, component, action, scope))] = true;
    }
    function isAuthorized(address principal, bytes32 component, bytes32 action, bytes32 scope, uint256)
        external view returns (bool) {
        return allowed[keccak256(abi.encode(principal, component, action, scope))];
    }
}

contract ComputeJobAcceptedMatchWorker420Test {
    VmMatched420 private constant vm = VmMatched420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant OWNER = address(0xA11CE);
    address private constant OPERATOR = address(0xBEEF);
    address private constant OUTSIDER = address(0xBAD);
    address private constant GOV = address(0x420);
    bytes32 private constant MANIFEST = keccak256("manifest");
    bytes32 private constant WORKLOAD = keccak256("gpu-workload");
    bytes32 private constant INPUT = keccak256("input");
    bytes32 private constant OUTPUT = keccak256("schema");
    bytes32 private constant RECEIPT = keccak256("receipt");
    bytes32 private constant RESULT = keccak256("result");

    ComputeJobRequestAuthority420 private requests;
    MatchedFundingFixture420 private funding;
    MatchedCapabilityFixture420 private grants;
    ComputeAuthorization420 private auth;
    ComputeProviderRegistry420 private providers;
    ComputeNodeRegistry420 private nodes;
    ComputeResourceRegistry420 private resources;
    ComputeJobAcceptedMatch420 private matches;
    ComputeJobMatchedWorkerEvidence420 private workers;
    ComputeJobRegistry420 private jobs;
    bytes32 private resourceId;
    bytes32 private providerId;
    bytes32 private nodeId;

    function setUp() public {
        requests = new ComputeJobRequestAuthority420();
        funding = new MatchedFundingFixture420();
        grants = new MatchedCapabilityFixture420();
        auth = new ComputeAuthorization420(address(grants));
        providers = new ComputeProviderRegistry420(GOV);
        nodes = new ComputeNodeRegistry420(address(providers), GOV);
        resources = new ComputeResourceRegistry420(address(nodes), GOV);
        matches = new ComputeJobAcceptedMatch420(address(resources), address(auth));
        workers = new ComputeJobMatchedWorkerEvidence420(address(matches), address(auth));
        jobs = new ComputeJobRegistry420(address(requests), address(funding), address(matches),
            address(workers), address(funding), address(funding));
        matches.bindJobs(address(jobs));
        workers.bindJobs(address(jobs));
        vm.prank(OPERATOR);
        providerId = providers.register(MANIFEST, keccak256("security"), OPERATOR);
        vm.prank(GOV);
        providers.activate(providerId);
        vm.prank(OPERATOR);
        nodeId = nodes.register(providerId, MANIFEST, keccak256("endpoint"), uint64(block.timestamp + 3 days));
        vm.prank(OPERATOR);
        nodes.activate(nodeId);
        bytes32 gpuClass = resources.GPU_INFERENCE();
        vm.prank(OPERATOR);
        resourceId = resources.register(nodeId, gpuClass, MANIFEST, keccak256("runtime"),
            keccak256("capabilities"), 8);
        vm.prank(OPERATOR);
        resources.activate(resourceId);
    }

    function _job() private returns (bytes32 id) {
        vm.prank(OWNER);
        bytes32 req = requests.registerRequest(MANIFEST, WORKLOAD, INPUT, OUTPUT, uint64(block.timestamp + 1 days));
        ComputeJobRequestAuthority420.Request memory r = requests.getRequest(req);
        vm.prank(OWNER);
        id = jobs.createJob(req, r.requestCommitment, MANIFEST, WORKLOAD, INPUT, OUTPUT, r.deadline);
        vm.prank(OWNER);
        jobs.recordFunding(id, 1, id);
    }

    function _grant(bytes32 id, bytes32 action) private {
        grants.set(OPERATOR, auth.COMPONENT_COMPUTE(), action, auth.scopeJob(id));
    }

    function _accepted(bytes32 id) private returns (bytes32 matchId) {
        vm.prank(OWNER);
        matchId = matches.propose(id, resourceId);
        vm.prank(OWNER);
        jobs.recordMatch(id, 2, matchId);
        _grant(id, auth.ACTION_ACCEPT_MATCH());
        vm.prank(OPERATOR);
        matches.acceptMatch(id, 3);
    }

    function testExactAcceptedResourceAndWorkerResult() public {
        bytes32 id = _job();
        bytes32 matchId = _accepted(id);
        _grant(id, auth.ACTION_EXECUTE_ATTEMPT());
        _grant(id, auth.ACTION_SUBMIT_RECEIPT());
        vm.prank(OPERATOR);
        bytes32 assignmentRef = workers.acceptAssignment(id, resourceId, 4);
        ComputeJobMatchedWorkerEvidence420.Assignment memory a = workers.getAssignment(assignmentRef);
        require(a.jobId == id && a.matchId == matchId && a.resourceId == resourceId
            && a.worker == OPERATOR && a.attempt == 1, "attempt not locked to accepted match");
        vm.prank(OPERATOR);
        bytes32 result = workers.commitResult(id, RECEIPT, RESULT);
        vm.prank(OPERATOR);
        jobs.recordResult(id, 5, result);
        require(jobs.job(id).status == ComputeJobRegistry420.Status.RESULT_COMMITTED
            && jobs.job(id).resultCommitment == result, "authenticated result not bound");
        vm.prank(OPERATOR);
        (bool ok,) = address(workers).call(abi.encodeCall(workers.commitResult, (id, RECEIPT, RESULT)));
        require(!ok, "duplicate receipt accepted");
    }

    function testUnacceptedAndOutsiderAssignmentRejected() public {
        bytes32 id = _job();
        vm.prank(OWNER);
        bytes32 matchId = matches.propose(id, resourceId);
        vm.prank(OWNER);
        jobs.recordMatch(id, 2, matchId);
        _grant(id, auth.ACTION_EXECUTE_ATTEMPT());
        vm.prank(OPERATOR);
        (bool ok,) = address(workers).call(abi.encodeCall(workers.acceptAssignment,
            (id, resourceId, uint64(3))));
        require(!ok, "unaccepted match used for assignment");
        _grant(id, auth.ACTION_ACCEPT_MATCH());
        vm.prank(OUTSIDER);
        (ok,) = address(matches).call(abi.encodeCall(matches.acceptMatch, (id, uint64(3))));
        require(!ok, "outsider accepted operator's match");
    }

    function testWrongResourceAndWrongWorkerRejected() public {
        bytes32 id = _job();
        _accepted(id);
        _grant(id, auth.ACTION_EXECUTE_ATTEMPT());
        vm.prank(OUTSIDER);
        (bool ok,) = address(workers).call(abi.encodeCall(workers.acceptAssignment,
            (id, resourceId, uint64(4))));
        require(!ok, "outsider assigned");
        vm.prank(OPERATOR);
        (ok,) = address(workers).call(abi.encodeCall(workers.acceptAssignment,
            (id, keccak256("unmatched-resource"), uint64(4))));
        require(!ok && workers.assignmentForJob(id) == bytes32(0), "unmatched resource assigned");
    }

    function testStaleRevisionAndResourceRevisionRejected() public {
        bytes32 id = _job();
        _accepted(id);
        _grant(id, auth.ACTION_EXECUTE_ATTEMPT());
        vm.prank(OPERATOR);
        (bool ok,) = address(workers).call(abi.encodeCall(workers.acceptAssignment,
            (id, resourceId, uint64(3))));
        require(!ok, "stale job revision assigned");
        vm.prank(OPERATOR);
        resources.update(resourceId, MANIFEST, keccak256("new-runtime"),
            keccak256("new-capabilities"), 8);
        vm.prank(OPERATOR);
        resources.activate(resourceId);
        vm.prank(OPERATOR);
        (ok,) = address(workers).call(abi.encodeCall(workers.acceptAssignment,
            (id, resourceId, uint64(4))));
        require(!ok, "revised resource silently replaced accepted resource");
    }

    function testCrossJobAssignmentAndReceiptReplayRejected() public {
        bytes32 first = _job();
        _accepted(first);
        bytes32 second = _job();
        _accepted(second);
        _grant(first, auth.ACTION_EXECUTE_ATTEMPT());
        _grant(first, auth.ACTION_SUBMIT_RECEIPT());
        _grant(second, auth.ACTION_EXECUTE_ATTEMPT());
        _grant(second, auth.ACTION_SUBMIT_RECEIPT());
        vm.prank(OPERATOR);
        bytes32 firstRef = workers.acceptAssignment(first, resourceId, 4);
        require(!workers.authorizedAssignment(second, jobs.job(second).matchId, OPERATOR, firstRef),
            "cross-job assignment accepted");
        vm.prank(OPERATOR);
        bytes32 firstResult = workers.commitResult(first, RECEIPT, RESULT);
        require(!workers.committedResult(second, firstRef, firstResult), "cross-job receipt accepted");
        vm.prank(OPERATOR);
        (bool ok,) = address(workers).call(abi.encodeCall(workers.acceptAssignment,
            (first, resourceId, uint64(4))));
        require(!ok, "duplicate attempt accepted");
    }
}
