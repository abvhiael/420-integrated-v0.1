// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeWorkerTrust420.sol";

interface VmWorkerTrust420 {
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8, bytes32, bytes32);
    function prank(address caller) external;
}

contract MockTrust420 is ITrust420 {
    mapping(bytes32 => MetricRead) private _reads;

    function setMetric(
        bytes32 subjectType,
        bytes32 subjectId,
        bytes32 metricId,
        MetricRead calldata metric
    ) external {
        _reads[keccak256(abi.encode(subjectType, subjectId, metricId))] = metric;
    }

    function readMetric(bytes32 subjectType, bytes32 subjectId, bytes32 metricId)
        external
        view
        returns (MetricRead memory out)
    {
        return _reads[keccak256(abi.encode(subjectType, subjectId, metricId))];
    }
}

contract ComputeWorkerTrust420Test {
    VmWorkerTrust420 private constant vm =
        VmWorkerTrust420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant GOV = address(0x420);
    address private constant OPERATOR = address(0xA11CE);
    address private constant OUTSIDER = address(0xBAD);

    uint256 private constant EXEC_KEY = 0xBEEF;

    bytes32 private constant SUBJECT_WORKER = keccak256("420/TRUST/SUBJECT/PROTOCOL_ENTITY/V1");
    bytes32 private constant METRIC_COMPLETED = keccak256("compute/completed-jobs");
    bytes32 private constant DOMAIN_MARKET = keccak256("420/TRUST/DOMAIN/MARKET/V1");
    bytes32 private constant UNIT_COUNT = keccak256("420/TRUST/UNIT/COUNT/V1");
    bytes32 private constant POLICY = keccak256("compute-worker-history-policy");

    bytes32 private constant MANIFEST = keccak256("manifest");
    bytes32 private constant SECURITY = keccak256("security");
    bytes32 private constant ENDPOINT = keccak256("endpoint");
    bytes32 private constant HARDWARE = keccak256("hardware");
    bytes32 private constant RUNTIME = keccak256("runtime");
    bytes32 private constant RESOURCE_CAP = keccak256("resource-capability");
    bytes32 private constant WORKER_CAP = keccak256("worker-capability");

    ComputeProviderRegistry420 private providers;
    ComputeNodeRegistry420 private nodes;
    ComputeResourceRegistry420 private resources;
    ComputeWorkerRegistry420 private workers;
    MockTrust420 private trust;
    ComputeWorkerTrust420 private workerTrust;

    bytes32 private providerId;
    bytes32 private nodeId;
    bytes32 private resourceId;
    bytes32 private workerId;
    address private executionSigner;

    function setUp() public {
        executionSigner = vm.addr(EXEC_KEY);

        providers = new ComputeProviderRegistry420(GOV);
        nodes = new ComputeNodeRegistry420(address(providers), GOV);
        resources = new ComputeResourceRegistry420(address(nodes), GOV);
        workers = new ComputeWorkerRegistry420(address(resources), GOV);
        trust = new MockTrust420();
        workerTrust = new ComputeWorkerTrust420(address(workers), address(trust), GOV);

        vm.prank(OPERATOR);
        providerId = providers.register(MANIFEST, SECURITY, OPERATOR);
        vm.prank(GOV);
        providers.activate(providerId);

        vm.prank(OPERATOR);
        nodeId = nodes.register(providerId, MANIFEST, ENDPOINT, uint64(block.timestamp + 30 days));
        vm.prank(OPERATOR);
        nodes.activate(nodeId);

        bytes32 computeClass = resources.CPU_GENERAL();
        vm.prank(OPERATOR);
        resourceId = resources.register(
            nodeId,
            computeClass,
            HARDWARE,
            RUNTIME,
            RESOURCE_CAP,
            8
        );
        vm.prank(OPERATOR);
        resources.activate(resourceId);

        workerId = _registerWorker(WORKER_CAP);
        vm.prank(OPERATOR);
        workers.activate(workerId);

        vm.prank(GOV);
        workerTrust.publishPolicy(
            POLICY,
            SUBJECT_WORKER,
            METRIC_COMPLETED,
            DOMAIN_MARKET,
            UNIT_COUNT,
            10,
            2
        );

        _setTrust(12, 3, 1, true, DOMAIN_MARKET, UNIT_COUNT);
    }

    function _sign(bytes32 digest) private returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(EXEC_KEY, digest);
        return abi.encodePacked(r, s, v);
    }

    function _registerWorker(bytes32 profileHash) private returns (bytes32 id) {
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
            profileHash,
            bytes32(0)
        );
        bytes memory proof = _sign(digest);
        vm.prank(OPERATOR);
        id = workers.register(resourceId, executionSigner, profileHash, bytes32(0), proof);
    }

    function _setTrust(
        int256 total,
        uint64 signals,
        uint32 revision,
        bool active,
        bytes32 domainId,
        bytes32 unitId
    ) private {
        trust.setMetric(
            SUBJECT_WORKER,
            workerId,
            METRIC_COMPLETED,
            ITrust420.MetricRead({
                domainId: domainId,
                unitId: unitId,
                metricRevision: revision,
                metricActive: active,
                total: total,
                activeSignals: signals
            })
        );
    }

    function _capture() private returns (bytes32 id) {
        uint64 revision = workers.worker(workerId).revision;
        vm.prank(OPERATOR);
        id = workerTrust.captureReference(workerId, revision, POLICY);
    }

    function testPolicyScopedLiveTrustMetricQualifiesWithoutUniversalScore() public view {
        uint64 revision = workers.worker(workerId).revision;
        require(
            workerTrust.isEligible(workerId, revision, POLICY, false, bytes32(0)),
            "policy-scoped metric rejected"
        );

        ITrust420.MetricRead memory metric = workerTrust.currentMetric(workerId, POLICY);
        require(metric.total == 12 && metric.activeSignals == 3, "wrong trust metric read");
        require(metric.domainId == DOMAIN_MARKET && metric.unitId == UNIT_COUNT, "metric semantics changed");
    }

    function testReferenceBindsExactWorkerRevisionPolicyAndMetricSnapshot() public {
        uint64 revision = workers.worker(workerId).revision;
        bytes32 referenceId = _capture();
        ComputeWorkerTrust420.ReputationReference memory r = workerTrust.reputationReference(referenceId);

        require(r.workerId == workerId && r.workerRevision == revision, "worker revision not bound");
        require(r.policyId == POLICY && r.policyRevision == 1, "policy revision not bound");
        require(r.metricRevision == 1 && r.total == 12 && r.activeSignals == 3, "metric snapshot not bound");
        require(r.metricSnapshotCommitment != bytes32(0), "snapshot commitment missing");
        require(
            workerTrust.isEligible(workerId, revision, POLICY, true, referenceId),
            "valid reference rejected"
        );
    }

    function testBelowThresholdInactiveOrSemanticMismatchFailsClosed() public {
        uint64 revision = workers.worker(workerId).revision;

        _setTrust(9, 3, 1, true, DOMAIN_MARKET, UNIT_COUNT);
        require(!workerTrust.isEligible(workerId, revision, POLICY, false, bytes32(0)), "low total accepted");

        _setTrust(12, 1, 1, true, DOMAIN_MARKET, UNIT_COUNT);
        require(!workerTrust.isEligible(workerId, revision, POLICY, false, bytes32(0)), "low signal count accepted");

        _setTrust(12, 3, 1, false, DOMAIN_MARKET, UNIT_COUNT);
        require(!workerTrust.isEligible(workerId, revision, POLICY, false, bytes32(0)), "inactive metric accepted");

        _setTrust(12, 3, 1, true, keccak256("wrong-domain"), UNIT_COUNT);
        require(!workerTrust.isEligible(workerId, revision, POLICY, false, bytes32(0)), "wrong domain accepted");

        _setTrust(12, 3, 1, true, DOMAIN_MARKET, keccak256("wrong-unit"));
        require(!workerTrust.isEligible(workerId, revision, POLICY, false, bytes32(0)), "wrong unit accepted");
    }

    function testLiveTrustCorrectionCanRemoveNewAdmissionWithoutRewritingHistory() public {
        uint64 revision = workers.worker(workerId).revision;
        bytes32 referenceId = _capture();
        ComputeWorkerTrust420.ReputationReference memory beforeRef = workerTrust.reputationReference(referenceId);

        _setTrust(4, 1, 1, true, DOMAIN_MARKET, UNIT_COUNT);
        require(
            !workerTrust.isEligible(workerId, revision, POLICY, true, referenceId),
            "stale favorable snapshot overrode live trust"
        );

        ComputeWorkerTrust420.ReputationReference memory afterRef = workerTrust.reputationReference(referenceId);
        require(afterRef.total == beforeRef.total && afterRef.activeSignals == beforeRef.activeSignals, "history rewritten");
    }

    function testPolicySupersessionInvalidatesOldReferenceForNewAdmission() public {
        uint64 revision = workers.worker(workerId).revision;
        bytes32 referenceId = _capture();

        vm.prank(GOV);
        workerTrust.publishPolicy(
            POLICY,
            SUBJECT_WORKER,
            METRIC_COMPLETED,
            DOMAIN_MARKET,
            UNIT_COUNT,
            11,
            2
        );

        require(
            !workerTrust.isEligible(workerId, revision, POLICY, true, referenceId),
            "stale policy reference accepted"
        );

        bytes32 fresh = _capture();
        require(
            workerTrust.isEligible(workerId, revision, POLICY, true, fresh),
            "current policy reference rejected"
        );
    }

    function testWorkerRevisionChangeInvalidatesOldReference() public {
        uint64 oldRevision = workers.worker(workerId).revision;
        bytes32 oldReference = _capture();

        vm.prank(OPERATOR);
        workers.refreshProfile(workerId, keccak256("worker-capability-v2"), bytes32(0));
        vm.prank(OPERATOR);
        workers.activate(workerId);

        uint64 newRevision = workers.worker(workerId).revision;
        require(newRevision != oldRevision, "worker revision unchanged");
        require(
            !workerTrust.isEligible(workerId, newRevision, POLICY, true, oldReference),
            "old worker reference crossed revision"
        );

        bytes32 fresh = _capture();
        require(workerTrust.isEligible(workerId, newRevision, POLICY, true, fresh), "new reference rejected");
    }

    function testUnauthorizedReferenceCaptureAndPolicyMutationFail() public {
        uint64 revision = workers.worker(workerId).revision;

        vm.prank(OUTSIDER);
        (bool ok,) = address(workerTrust).call(
            abi.encodeCall(workerTrust.captureReference, (workerId, revision, POLICY))
        );
        require(!ok && workerTrust.nextReferenceSerial() == 0, "outsider captured reference");

        vm.prank(OUTSIDER);
        (ok,) = address(workerTrust).call(
            abi.encodeCall(
                workerTrust.publishPolicy,
                (
                    keccak256("outsider-policy"),
                    SUBJECT_WORKER,
                    METRIC_COMPLETED,
                    DOMAIN_MARKET,
                    UNIT_COUNT,
                    int256(1),
                    uint64(1)
                )
            )
        );
        require(!ok, "outsider published reputation policy");
    }

    function testParentSuspensionOverridesReputation() public {
        uint64 revision = workers.worker(workerId).revision;
        bytes32 referenceId = _capture();
        require(workerTrust.isEligible(workerId, revision, POLICY, true, referenceId), "baseline rejected");

        vm.prank(OPERATOR);
        resources.suspend(resourceId);
        require(
            !workerTrust.isEligible(workerId, revision, POLICY, true, referenceId),
            "reputation bypassed resource suspension"
        );
    }

    function testReputationReferenceDoesNotGrantWorkerLifecycleAuthority() public {
        _capture();

        vm.prank(OUTSIDER);
        (bool ok,) = address(workers).call(abi.encodeCall(workers.suspend, (workerId)));
        require(!ok, "reputation reference granted worker authority");
        require(workers.isEligible(workerId, workers.worker(workerId).revision), "failed escalation mutated worker");
    }
}
