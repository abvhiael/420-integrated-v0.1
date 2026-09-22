// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeJobRegistry420.sol";

interface VmJob420 {
    function prank(address) external;
    function warp(uint256) external;
}

/// @dev TEST-ONLY stand-in: these flags are NOT real Vault, match, receipt or verifier evidence.
contract JobEvidenceFixture420 is IComputeJobFundingEvidence420, IComputeJobMatchEvidence420,
    IComputeJobWorkerEvidence420, IComputeJobVerificationEvidence420, IComputeJobSettlementEvidence420 {
    bool public enableFunding;
    bool public enableMatch;
    bool public enableAcceptance;
    bool public enableAssignment;
    bool public enableResult;
    bool public enableVerification;
    bool public enableSettlement;
    function allowAll() external {
        enableFunding = true;
        enableMatch = true;
        enableAcceptance = true;
        enableAssignment = true;
        enableResult = true;
        enableVerification = true;
        enableSettlement = true;
    }
    function funded(bytes32, address, bytes32) external view returns (bool) { return enableFunding; }
    function matched(bytes32, bytes32, bytes32, bytes32) external view returns (bool) { return enableMatch; }
    function accepted(bytes32, bytes32, bytes32) external view returns (bool) { return enableAcceptance; }
    function authorizedAssignment(bytes32, bytes32, address, bytes32) external view returns (bool) { return enableAssignment; }
    function committedResult(bytes32, bytes32, bytes32) external view returns (bool) { return enableResult; }
    function verified(bytes32, bytes32, address, bytes32, bool) external view returns (bool) { return enableVerification; }
    function settled(bytes32, bytes32, bytes32) external view returns (bool) { return enableSettlement; }
}

contract ComputeJobRegistry420Test {
    VmJob420 private constant vm = VmJob420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant OWNER = address(0xA11CE);
    address private constant FOREIGN = address(0xB0B);
    address private constant WORKER = address(0xBEEF);
    address private constant VERIFIER = address(0xCAFE);
    bytes32 private constant REQUEST = keccak256("request");
    bytes32 private constant REQUEST_COMMITMENT = keccak256("request-revision");
    bytes32 private constant MANIFEST = keccak256("manifest");
    bytes32 private constant WORKLOAD = keccak256("gpu-inference");
    bytes32 private constant INPUT = keccak256("input");
    bytes32 private constant OUTPUT_SCHEMA = keccak256("output-schema");
    bytes32 private constant FUNDING = keccak256("funding");
    bytes32 private constant MATCH = keccak256("match");
    bytes32 private constant ACCEPTANCE = keccak256("acceptance");
    bytes32 private constant ASSIGNMENT = keccak256("assignment");
    bytes32 private constant RESULT = keccak256("result");
    bytes32 private constant DECISION = keccak256("decision");
    bytes32 private constant SETTLEMENT = keccak256("settlement");
    JobEvidenceFixture420 private evidence;
    ComputeJobRegistry420 private registry;

    function setUp() public {
        evidence = new JobEvidenceFixture420();
        registry = new ComputeJobRegistry420(address(evidence), address(evidence), address(evidence),
            address(evidence), address(evidence));
    }
    function _create() private returns (bytes32 id) {
        vm.prank(OWNER);
        id = registry.createJob(REQUEST, REQUEST_COMMITMENT, MANIFEST, WORKLOAD, INPUT, OUTPUT_SCHEMA,
            uint64(block.timestamp + 1 days));
    }
    function _fund(bytes32 id) private {
        vm.prank(OWNER);
        registry.recordFunding(id, 1, FUNDING);
    }
    function _match(bytes32 id) private {
        vm.prank(OWNER);
        registry.recordMatch(id, 2, MATCH);
    }
    function _accept(bytes32 id) private {
        vm.prank(address(evidence));
        registry.recordAcceptance(id, 3, ACCEPTANCE);
    }
    function _assign(bytes32 id) private {
        vm.prank(address(evidence));
        registry.assignWorker(id, 4, WORKER, ASSIGNMENT);
    }
    function _result(bytes32 id) private {
        vm.prank(WORKER);
        registry.recordResult(id, 5, RESULT);
    }
    function _verify(bytes32 id, bool approved, address verifier) private {
        vm.prank(address(evidence));
        registry.recordVerification(id, 6, verifier, DECISION, approved);
    }
    function testCreationBindsOriginalRoadmapFieldsAndUniqueRequest() public {
        bytes32 id = _create();
        ComputeJobRegistry420.Job memory j = registry.job(id);
        require(id != 0 && j.status == ComputeJobRegistry420.Status.CREATED && j.revision == 1, "job identity");
        require(j.owner == OWNER && j.requestId == REQUEST && j.requestCommitment == REQUEST_COMMITMENT, "owner/request");
        require(j.manifestHash == MANIFEST && j.workloadType == WORKLOAD, "manifest/workload");
        require(j.inputCommitment == INPUT && j.outputSchemaCommitment == OUTPUT_SCHEMA, "input/output");
        require(j.matchId == 0 && j.worker == address(0) && j.verifier == address(0), "fabricated binding");
        vm.prank(OWNER);
        (bool ok,) = address(registry).call(abi.encodeCall(registry.createJob,
            (REQUEST, REQUEST_COMMITMENT, MANIFEST, WORKLOAD, INPUT, OUTPUT_SCHEMA, uint64(block.timestamp + 1 days))));
        require(!ok && registry.nextJobNonce() == 1, "reused request consumed nonce");
    }
    function testFundingMustBeProvenAndCannotBeSkipped() public {
        bytes32 id = _create();
        vm.prank(OWNER);
        (bool ok,) = address(registry).call(abi.encodeCall(registry.recordFunding, (id, uint64(1), FUNDING)));
        require(!ok, "unproven funding");
        vm.prank(OWNER);
        (ok,) = address(registry).call(abi.encodeCall(registry.recordMatch, (id, uint64(1), MATCH)));
        require(!ok, "unfunded match");
        require(registry.job(id).revision == 1, "failed guard mutated revision");
        evidence.allowAll();
        vm.prank(FOREIGN);
        (ok,) = address(registry).call(abi.encodeCall(registry.recordFunding, (id, uint64(1), FUNDING)));
        require(!ok, "foreign funding caller");
        _fund(id);
        vm.prank(OWNER);
        (ok,) = address(registry).call(abi.encodeCall(registry.recordFunding, (id, uint64(1), FUNDING)));
        require(!ok && registry.job(id).revision == 2, "funding replay");
    }
    function testFullEvidenceBoundLifecycleAndImmutableBindings() public {
        evidence.allowAll();
        bytes32 id = _create();
        _fund(id);
        _match(id);
        _accept(id);
        _assign(id);
        _result(id);
        _verify(id, true, VERIFIER);
        vm.prank(address(evidence));
        registry.recordSettlement(id, 7, SETTLEMENT);
        ComputeJobRegistry420.Job memory j = registry.job(id);
        require(j.status == ComputeJobRegistry420.Status.SETTLED && j.revision == 8, "settlement state");
        require(j.owner == OWNER && j.matchId == MATCH && j.manifestHash == MANIFEST, "changed accepted bindings");
        require(j.worker == WORKER && j.assignmentRef == ASSIGNMENT && j.resultCommitment == RESULT, "work provenance");
        require(j.verifier == VERIFIER && j.verificationRef == DECISION && j.settlementRef == SETTLEMENT, "verification/settlement provenance");
        vm.prank(address(evidence));
        (bool ok,) = address(registry).call(abi.encodeCall(registry.recordSettlement, (id, uint64(8), SETTLEMENT)));
        require(!ok && registry.job(id).revision == 8, "terminal replay");
    }
    function testWrongActorsStaleRevisionAndSelfVerificationFailClosed() public {
        evidence.allowAll();
        bytes32 id = _create();
        _fund(id);
        _match(id);
        vm.prank(OWNER);
        (bool ok,) = address(registry).call(abi.encodeCall(registry.recordAcceptance, (id, uint64(3), ACCEPTANCE)));
        require(!ok, "owner impersonated match adapter");
        _accept(id);
        vm.prank(OWNER);
        (ok,) = address(registry).call(abi.encodeCall(registry.assignWorker, (id, uint64(4), WORKER, ASSIGNMENT)));
        require(!ok, "owner impersonated assignment adapter");
        _assign(id);
        vm.prank(FOREIGN);
        (ok,) = address(registry).call(abi.encodeCall(registry.recordResult, (id, uint64(5), RESULT)));
        require(!ok, "other worker committed result");
        _result(id);
        vm.prank(address(evidence));
        (ok,) = address(registry).call(abi.encodeCall(registry.recordVerification,
            (id, uint64(6), WORKER, DECISION, true)));
        require(!ok, "worker self-verified");
        vm.prank(address(evidence));
        (ok,) = address(registry).call(abi.encodeCall(registry.recordVerification,
            (id, uint64(5), VERIFIER, DECISION, true)));
        require(!ok && registry.job(id).revision == 6, "stale decision changed job");
    }
    function testRejectedVerificationCannotReleaseSettlement() public {
        evidence.allowAll();
        bytes32 id = _create();
        _fund(id);
        _match(id);
        _accept(id);
        _assign(id);
        _result(id);
        _verify(id, false, VERIFIER);
        require(registry.job(id).status == ComputeJobRegistry420.Status.FAILED, "failed decision state");
        vm.prank(address(evidence));
        (bool ok,) = address(registry).call(abi.encodeCall(registry.recordSettlement, (id, uint64(7), SETTLEMENT)));
        require(!ok, "failed job settled");
    }
    function testExpiredJobCannotStart() public {
        evidence.allowAll();
        bytes32 id = _create();
        _fund(id);
        _match(id);
        _accept(id);
        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(address(evidence));
        (bool ok,) = address(registry).call(abi.encodeCall(registry.assignWorker, (id, uint64(4), WORKER, ASSIGNMENT)));
        require(!ok && registry.job(id).status == ComputeJobRegistry420.Status.ACCEPTED, "expired paid start");
    }
}
