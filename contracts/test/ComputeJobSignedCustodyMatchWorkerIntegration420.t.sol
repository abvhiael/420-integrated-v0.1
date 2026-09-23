// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeJobPayerCustody420.sol";
import "../src/compute/ComputeJobMatchedWorkerEvidence420.sol";

interface VmComputeIntegrated420 {
    function addr(uint256 key) external returns (address);
    function sign(uint256 key, bytes32 digest) external returns (uint8, bytes32, bytes32);
    function deal(address who, uint256 amount) external;
    function prank(address who) external;
    function warp(uint256 time) external;
}

/// @dev Test-only capability fixture. This does not constitute deployment qualification
/// of the canonical CapabilityRegistry registrar, component and grant lifecycle.
contract IntegratedComputeGrants420 {
    mapping(bytes32 => bool) private grants;
    function grant(address who, bytes32 component, bytes32 action, bytes32 scope) external {
        grants[keccak256(abi.encode(who, component, action, scope))] = true;
    }
    function isAuthorized(address who, bytes32 component, bytes32 action, bytes32 scope, uint256)
        external view returns (bool) {
        return grants[keccak256(abi.encode(who, component, action, scope))];
    }
}

contract IntegratedComputeDeny420 is IComputeJobVerificationEvidence420, IComputeJobSettlementEvidence420 {
    function verified(bytes32, bytes32, address, bytes32, bool) external pure returns (bool) { return false; }
    function settled(bytes32, bytes32, bytes32) external pure returns (bool) { return false; }
}

contract ComputeJobSignedCustodyMatchWorkerIntegration420Test {
    VmComputeIntegrated420 private constant vm = VmComputeIntegrated420(
        address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 private constant OWNER_KEY = 0xA11CE;
    uint256 private constant PAYER_KEY = 0xBEEF;
    address private constant OPERATOR = address(0xC0FFEE);
    address private constant OUTSIDER = address(0xBAD);
    address private constant GOV = address(0x420);
    bytes32 private constant MANIFEST = keccak256("signed-manifest-bytes");
    bytes32 private constant WORKLOAD = keccak256("gpu-inference");
    bytes32 private constant INPUT = keccak256("input-commitment");
    bytes32 private constant OUTPUT = keccak256("output-schema");

    address private owner;
    address private payer;
    ComputeJobSignedRequestAuthority420 private requests;
    ComputeJobPayerCustody420 private custody;
    IntegratedComputeGrants420 private grants;
    ComputeAuthorization420 private auth;
    ComputeProviderRegistry420 private providers;
    ComputeNodeRegistry420 private nodes;
    ComputeResourceRegistry420 private resources;
    ComputeJobAcceptedMatch420 private matches;
    ComputeJobMatchedWorkerEvidence420 private workers;
    ComputeJobRegistry420 private jobs;
    bytes32 private resourceId;

    function setUp() public {
        owner = vm.addr(OWNER_KEY);
        payer = vm.addr(PAYER_KEY);
        vm.deal(payer, 100 ether);
        vm.deal(OUTSIDER, 100 ether);
        requests = new ComputeJobSignedRequestAuthority420();
        custody = new ComputeJobPayerCustody420(address(requests));
        grants = new IntegratedComputeGrants420();
        auth = new ComputeAuthorization420(address(grants));
        providers = new ComputeProviderRegistry420(GOV);
        nodes = new ComputeNodeRegistry420(address(providers), GOV);
        resources = new ComputeResourceRegistry420(address(nodes), GOV);
        matches = new ComputeJobAcceptedMatch420(address(resources), address(auth));
        workers = new ComputeJobMatchedWorkerEvidence420(address(matches), address(auth));
        IntegratedComputeDeny420 denied = new IntegratedComputeDeny420();
        jobs = new ComputeJobRegistry420(address(requests), address(custody), address(matches),
            address(workers), address(denied), address(denied));
        custody.bindJobs(address(jobs));
        matches.bindJobs(address(jobs));
        workers.bindJobs(address(jobs));

        vm.prank(OPERATOR);
        bytes32 providerId = providers.register(MANIFEST, keccak256("security"), OPERATOR);
        vm.prank(GOV);
        providers.activate(providerId);
        vm.prank(OPERATOR);
        bytes32 nodeId = nodes.register(providerId, MANIFEST, keccak256("endpoint"),
            uint64(block.timestamp + 3 days));
        vm.prank(OPERATOR);
        nodes.activate(nodeId);
        vm.prank(OPERATOR);
        resourceId = resources.register(nodeId, resources.GPU_INFERENCE(), MANIFEST,
            keccak256("runtime"), keccak256("capabilities"), 8);
        vm.prank(OPERATOR);
        resources.activate(resourceId);
    }

    function _signature(uint256 key, bytes32 digest) private returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function _created(uint256 nonce, uint256 ceiling) private returns (bytes32 id) {
        ComputeJobSignedRequestAuthority420.Authorization memory a =
            ComputeJobSignedRequestAuthority420.Authorization({
                owner: owner, payer: payer, manifestHash: MANIFEST, workloadType: WORKLOAD,
                inputCommitment: INPUT, outputSchemaCommitment: OUTPUT,
                deadline: uint64(block.timestamp + 1 days),
                authorizationExpiry: uint64(block.timestamp + 2 days),
                maxSpend: ceiling, nonce: nonce
            });
        bytes32 digest = requests.authorizationDigest(a);
        vm.prank(owner);
        bytes32 requestId = requests.registerSignedRequest(a,
            _signature(OWNER_KEY, digest), _signature(PAYER_KEY, digest));
        vm.prank(owner);
        id = jobs.createJob(requestId, requestId, MANIFEST, WORKLOAD, INPUT, OUTPUT, a.deadline);
    }

    function _fund(bytes32 id, uint256 amount) private {
        vm.prank(payer);
        custody.reserve{value: amount}(id);
        vm.prank(owner);
        jobs.recordFunding(id, 1, id);
    }

    function _grant(bytes32 id, bytes32 action) private {
        grants.grant(OPERATOR, auth.COMPONENT_COMPUTE(), action, auth.scopeJob(id));
    }

    function _accept(bytes32 id) private returns (bytes32 matchId) {
        vm.prank(owner);
        matchId = matches.propose(id, resourceId);
        vm.prank(owner);
        jobs.recordMatch(id, 2, matchId);
        _grant(id, auth.ACTION_ACCEPT_MATCH());
        vm.prank(OPERATOR);
        matches.acceptMatch(id, 3);
    }

    function testSignedPayerRealCustodyAcceptedMatchAndAuthenticatedResult() public {
        bytes32 id = _created(1, 10 ether);
        require(jobs.job(id).status == ComputeJobRegistry420.Status.CREATED,
            "signature alone funded job");
        _fund(id, 7 ether);
        require(custody.funded(id, owner, id) && custody.totalReserved() == 7 ether
            && address(custody).balance == 7 ether, "real payer funds not isolated");
        bytes32 matchId = _accept(id);
        _grant(id, auth.ACTION_EXECUTE_ATTEMPT());
        _grant(id, auth.ACTION_SUBMIT_RECEIPT());
        vm.prank(OPERATOR);
        bytes32 assignmentRef = workers.acceptAssignment(id, resourceId, 4);
        vm.prank(OPERATOR);
        bytes32 result = workers.commitResult(id, keccak256("worker-receipt"), keccak256("output"));
        vm.prank(OPERATOR);
        jobs.recordResult(id, 5, result);
        ComputeJobRegistry420.Job memory j = jobs.job(id);
        require(j.status == ComputeJobRegistry420.Status.RESULT_COMMITTED && j.matchId == matchId
            && j.assignmentRef == assignmentRef && j.resultCommitment == result,
            "end-to-end provenance not preserved");
        require(custody.funded(id, owner, id) && custody.totalReserved() == 7 ether,
            "work result moved reserved funds without settlement");
    }

    function testUnfundedAndForeignPayerCannotReachMatch() public {
        bytes32 id = _created(2, 4 ether);
        vm.prank(owner);
        (bool ok,) = address(jobs).call(abi.encodeCall(jobs.recordFunding,
            (id, uint64(1), id)));
        require(!ok, "synthetic funding admitted");
        vm.prank(OUTSIDER);
        (ok,) = address(custody).call{value: 2 ether}(abi.encodeCall(custody.reserve, (id)));
        require(!ok && address(custody).balance == 0, "foreign payer admitted");
        vm.prank(owner);
        (ok,) = address(matches).call(abi.encodeCall(matches.propose, (id, resourceId)));
        require(!ok, "unfunded job entered matching");
        vm.prank(payer);
        (ok,) = address(custody).call{value: 4 ether + 1}(abi.encodeCall(custody.reserve, (id)));
        require(!ok, "signed spending maximum bypassed");
    }

    function testCrossJobFundingAndAssignmentReplayRejected() public {
        bytes32 first = _created(3, 10 ether);
        bytes32 second = _created(4, 10 ether);
        _fund(first, 3 ether);
        vm.prank(owner);
        (bool ok,) = address(jobs).call(abi.encodeCall(jobs.recordFunding,
            (second, uint64(1), first)));
        require(!ok && !custody.funded(second, owner, first), "cross-job funding replay");
        _fund(second, 2 ether);
        _accept(first);
        _accept(second);
        _grant(first, auth.ACTION_EXECUTE_ATTEMPT());
        vm.prank(OPERATOR);
        bytes32 assignmentRef = workers.acceptAssignment(first, resourceId, 4);
        require(!workers.authorizedAssignment(second, jobs.job(second).matchId,
            OPERATOR, assignmentRef), "cross-job assignment replay");
        require(custody.totalReserved() == 5 ether && address(custody).balance == 5 ether,
            "two job reservations share funds");
    }

    function testExpiryRefundAndChangedResourceCannotBypassAdmission() public {
        bytes32 refundable = _created(5, 10 ether);
        _fund(refundable, 2 ether);
        bytes32 matching = _created(6, 10 ether);
        _fund(matching, 3 ether);
        _accept(matching);
        _grant(matching, auth.ACTION_EXECUTE_ATTEMPT());
        vm.prank(OPERATOR);
        resources.update(resourceId, MANIFEST, keccak256("changed-runtime"),
            keccak256("changed-capabilities"), 8);
        vm.prank(OPERATOR);
        resources.activate(resourceId);
        vm.prank(OPERATOR);
        (bool ok,) = address(workers).call(abi.encodeCall(workers.acceptAssignment,
            (matching, resourceId, uint64(4))));
        require(!ok, "modified accepted resource admitted");
        vm.warp(uint256(jobs.job(refundable).deadline) + 1);
        uint256 prior = payer.balance;
        vm.prank(payer);
        custody.refundExpiredUnmatched(refundable);
        require(payer.balance == prior + 2 ether && custody.totalReserved() == 3 ether
            && !custody.funded(refundable, owner, refundable), "refund drew on wrong job");
        vm.prank(payer);
        (ok,) = address(custody).call(abi.encodeCall(custody.refundExpiredUnmatched, (matching)));
        require(!ok, "matched job refunded via unmatched path");
    }
}
