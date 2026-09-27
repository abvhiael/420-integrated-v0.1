// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeWorkerRegistry420.sol";

interface VmComputeWorker420 {
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8, bytes32, bytes32);
    function prank(address caller) external;
}

contract ComputeWorkerRegistry420Test {
    VmComputeWorker420 private constant vm =
        VmComputeWorker420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant GOV = address(0x420);
    address private constant OPERATOR = address(0xA11CE);
    address private constant OUTSIDER = address(0xBAD);
    uint256 private constant EXEC_KEY = 0xBEEF;
    uint256 private constant NEXT_EXEC_KEY = 0xCAFE;

    bytes32 private constant MANIFEST = keccak256("manifest");
    bytes32 private constant SECURITY = keccak256("security");
    bytes32 private constant ENDPOINT = keccak256("endpoint");
    bytes32 private constant HARDWARE = keccak256("hardware");
    bytes32 private constant RUNTIME = keccak256("runtime");
    bytes32 private constant RESOURCE_CAP = keccak256("resource-capability");
    bytes32 private constant WORKER_CAP = keccak256("worker-capability-v1");
    bytes32 private constant WORKER_CAP_V2 = keccak256("worker-capability-v2");
    bytes32 private constant JURISDICTION = keccak256("jurisdiction/policy");

    ComputeProviderRegistry420 private providers;
    ComputeNodeRegistry420 private nodes;
    ComputeResourceRegistry420 private resources;
    ComputeWorkerRegistry420 private workers;

    bytes32 private providerId;
    bytes32 private nodeId;
    bytes32 private resourceId;
    address private executionSigner;
    address private nextExecutionSigner;

    function setUp() public {
        executionSigner = vm.addr(EXEC_KEY);
        nextExecutionSigner = vm.addr(NEXT_EXEC_KEY);

        providers = new ComputeProviderRegistry420(GOV);
        nodes = new ComputeNodeRegistry420(address(providers), GOV);
        resources = new ComputeResourceRegistry420(address(nodes), GOV);
        workers = new ComputeWorkerRegistry420(address(resources), GOV);

        vm.prank(OPERATOR);
        providerId = providers.register(MANIFEST, SECURITY, OPERATOR);
        vm.prank(GOV);
        providers.activate(providerId);

        vm.prank(OPERATOR);
        nodeId = nodes.register(providerId, MANIFEST, ENDPOINT, uint64(block.timestamp + 7 days));
        vm.prank(OPERATOR);
        nodes.activate(nodeId);

        bytes32 gpuClass = resources.GPU_INFERENCE();
        vm.prank(OPERATOR);
        resourceId = resources.register(
            nodeId,
            gpuClass,
            HARDWARE,
            RUNTIME,
            RESOURCE_CAP,
            8
        );
        vm.prank(OPERATOR);
        resources.activate(resourceId);
    }

    function _sign(uint256 key, bytes32 digest) private returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function _register(bytes32 capability, bytes32 jurisdiction) private returns (bytes32 workerId) {
        ComputeResourceRegistry420.Resource memory r = resources.resource(resourceId);
        uint64 serial = workers.nextSerial() + 1;
        bytes32 digest = workers.registrationDigest(
            serial,
            r.providerId,
            r.nodeId,
            resourceId,
            r.revision,
            OPERATOR,
            executionSigner,
            capability,
            jurisdiction
        );
        bytes memory proof = _sign(EXEC_KEY, digest);
        vm.prank(OPERATOR);
        workerId = workers.register(resourceId, executionSigner, capability, jurisdiction, proof);
    }

    function _registerAndActivate() private returns (bytes32 workerId) {
        workerId = _register(WORKER_CAP, JURISDICTION);
        vm.prank(OPERATOR);
        workers.activate(workerId);
    }

    function testRegistrationBindsCanonicalAncestryKeyAndResourceRevision() public {
        bytes32 workerId = _register(WORKER_CAP, JURISDICTION);
        ComputeWorkerRegistry420.Worker memory w = workers.worker(workerId);
        ComputeResourceRegistry420.Resource memory r = resources.resource(resourceId);

        require(workerId == workers.deriveId(1, providerId, nodeId, resourceId), "worker ID mismatch");
        require(w.providerId == providerId && w.nodeId == nodeId && w.resourceId == resourceId, "ancestry lost");
        require(w.operator == OPERATOR && w.executionSigner == executionSigner, "execution identity lost");
        require(
            w.executionKeyCommitment == workers.executionKeyCommitment(executionSigner),
            "key commitment mismatch"
        );
        require(w.capabilityProfileHash == WORKER_CAP && w.jurisdictionHash == JURISDICTION, "profile lost");
        require(w.resourceRevision == r.revision && w.revision == 1, "revision binding lost");
        require(w.status == ComputeWorkerRegistry420.Status.REGISTERED, "wrong initial status");
        require(!workers.isEligible(workerId, 1), "registered worker admitted before activation");

        vm.prank(OPERATOR);
        workers.activate(workerId);
        require(workers.isEligible(workerId, 2), "active exact revision not eligible");
        require(!workers.isEligible(workerId, 1), "stale worker revision eligible");
    }

    function testOptionalJurisdictionAndUniqueDomainSeparatedIds() public {
        bytes32 first = _register(WORKER_CAP, bytes32(0));
        bytes32 second = _register(WORKER_CAP_V2, bytes32(0));
        require(first != second, "worker IDs reused");
        require(workers.worker(first).jurisdictionHash == bytes32(0), "optional jurisdiction not optional");
        require(first != providerId && first != nodeId && first != resourceId, "identity domain collision");
        require(workers.nextSerial() == 2, "serial progression wrong");
    }

    function testForgedProofAndUnauthorizedRegistrationFailWithoutConsumingIdentity() public {
        ComputeResourceRegistry420.Resource memory r = resources.resource(resourceId);
        bytes32 digest = workers.registrationDigest(
            1,
            r.providerId,
            r.nodeId,
            resourceId,
            r.revision,
            OPERATOR,
            executionSigner,
            WORKER_CAP,
            JURISDICTION
        );
        bytes memory forged = _sign(NEXT_EXEC_KEY, digest);

        vm.prank(OPERATOR);
        (bool ok,) = address(workers).call(
            abi.encodeCall(workers.register, (resourceId, executionSigner, WORKER_CAP, JURISDICTION, forged))
        );
        require(!ok && workers.nextSerial() == 0, "forged proof consumed worker identity");

        bytes memory valid = _sign(EXEC_KEY, digest);
        vm.prank(OUTSIDER);
        (ok,) = address(workers).call(
            abi.encodeCall(workers.register, (resourceId, executionSigner, WORKER_CAP, JURISDICTION, valid))
        );
        require(!ok && workers.nextSerial() == 0, "outsider registered worker");
    }

    function testResourceRevisionDriftFailsClosedUntilExplicitProfileRefresh() public {
        bytes32 workerId = _registerAndActivate();
        uint64 activeRevision = workers.worker(workerId).revision;
        require(workers.isEligible(workerId, activeRevision), "baseline worker ineligible");

        vm.prank(OPERATOR);
        resources.update(resourceId, HARDWARE, keccak256("runtime-v2"), keccak256("resource-cap-v2"), 8);
        require(!workers.isEligible(workerId, activeRevision), "suspended resource ignored");

        vm.prank(OPERATOR);
        resources.activate(resourceId);
        require(!workers.isEligible(workerId, activeRevision), "resource revision drift ignored");

        vm.prank(OPERATOR);
        workers.refreshProfile(workerId, WORKER_CAP_V2, bytes32(0));
        ComputeWorkerRegistry420.Worker memory refreshed = workers.worker(workerId);
        require(refreshed.status == ComputeWorkerRegistry420.Status.SUSPENDED, "profile refresh admitted directly");
        require(refreshed.resourceRevision == resources.resource(resourceId).revision, "resource revision not refreshed");
        require(
            workers.revision(workerId, activeRevision).capabilityProfileHash == WORKER_CAP,
            "historical profile rewritten"
        );

        vm.prank(OPERATOR);
        workers.activate(workerId);
        require(workers.isEligible(workerId, workers.worker(workerId).revision), "refreshed worker not eligible");
    }

    function testParentSuspensionOverridesLocallyActiveWorker() public {
        bytes32 workerId = _registerAndActivate();
        uint64 workerRevision = workers.worker(workerId).revision;

        vm.prank(OPERATOR);
        providers.suspend(providerId);
        require(!workers.isEligible(workerId, workerRevision), "provider suspension ignored");

        vm.prank(GOV);
        providers.activate(providerId);
        require(workers.isEligible(workerId, workerRevision), "parent reactivation changed worker identity");

        vm.prank(OPERATOR);
        nodes.suspend(nodeId);
        require(!workers.isEligible(workerId, workerRevision), "node suspension ignored");
    }

    function testExecutionKeyRotationRequiresNewKeyProofAndPreservesHistory() public {
        bytes32 workerId = _registerAndActivate();
        ComputeWorkerRegistry420.Worker memory beforeRotation = workers.worker(workerId);
        bytes32 digest = workers.rotationDigest(workerId, nextExecutionSigner);

        bytes memory wrongProof = _sign(EXEC_KEY, digest);
        vm.prank(OPERATOR);
        (bool ok,) = address(workers).call(
            abi.encodeCall(workers.rotateExecutionKey, (workerId, nextExecutionSigner, wrongProof))
        );
        require(!ok, "old key authorized replacement key");
        require(workers.worker(workerId).revision == beforeRotation.revision, "failed rotation mutated revision");

        bytes memory proof = _sign(NEXT_EXEC_KEY, digest);
        vm.prank(OPERATOR);
        workers.rotateExecutionKey(workerId, nextExecutionSigner, proof);

        ComputeWorkerRegistry420.Worker memory rotated = workers.worker(workerId);
        require(rotated.executionSigner == nextExecutionSigner, "new signer missing");
        require(rotated.status == ComputeWorkerRegistry420.Status.SUSPENDED, "rotation admitted without review");
        require(!workers.isEligible(workerId, rotated.revision), "rotated suspended worker eligible");
        require(
            workers.revision(workerId, beforeRotation.revision).executionSigner == executionSigner,
            "historical key rewritten"
        );

        vm.prank(OPERATOR);
        workers.activate(workerId);
        require(workers.isEligible(workerId, workers.worker(workerId).revision), "rotated key could not reactivate");
    }

    function testSuspensionRetirementAndUnauthorizedMutationFailClosed() public {
        bytes32 workerId = _registerAndActivate();

        vm.prank(OUTSIDER);
        (bool ok,) = address(workers).call(abi.encodeCall(workers.suspend, (workerId)));
        require(!ok, "outsider suspended worker");

        vm.prank(OPERATOR);
        workers.suspend(workerId);
        require(!workers.isEligible(workerId, workers.worker(workerId).revision), "suspended worker eligible");

        vm.prank(OPERATOR);
        workers.activate(workerId);
        vm.prank(GOV);
        workers.retire(workerId);
        require(workers.worker(workerId).status == ComputeWorkerRegistry420.Status.RETIRED, "retirement missing");

        vm.prank(OPERATOR);
        (ok,) = address(workers).call(abi.encodeCall(workers.activate, (workerId)));
        require(!ok, "retired worker reactivated");

        vm.prank(OPERATOR);
        (ok,) = address(workers).call(
            abi.encodeCall(workers.refreshProfile, (workerId, WORKER_CAP_V2, bytes32(0)))
        );
        require(!ok, "retired worker profile mutated");
    }
}
