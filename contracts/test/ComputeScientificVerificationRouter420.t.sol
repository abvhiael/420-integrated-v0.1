// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeScientificVerificationRouter420.sol";
import "../src/compute/ComputeSampledMeanScientificAdapter420.sol";
import "../src/compute/ComputeDeterministicAdapterRegistry420.sol";
import "../src/compute/ComputeIntegerSumSquaresAdapter420.sol";
import "../src/compute/ComputePolicyRegistry420.sol";

interface VmCMP148 {
    function prank(address caller) external;
}

contract CMP148Evidence420 is
    IComputeJobRequestEvidence420,
    IComputeJobFundingEvidence420,
    IComputeJobMatchEvidence420,
    IComputeJobWorkerEvidence420,
    IComputeJobVerificationEvidence420,
    IComputeJobSettlementEvidence420,
    IComputeJobRefundEvidence420
{
    ComputeJobRegistry420 public jobs;
    mapping(bytes32 => ComputeJobMatchedWorkerEvidence420.Assignment) private _assignments;

    function bindJobs(address jobs_) external { jobs = ComputeJobRegistry420(jobs_); }

    function validRequest(bytes32,address,bytes32,bytes32,bytes32,bytes32,bytes32,uint64)
        external pure returns (bool) { return true; }
    function funded(bytes32,address,bytes32) external pure returns (bool) { return true; }
    function matched(bytes32,bytes32,bytes32,bytes32) external pure returns (bool) { return true; }
    function accepted(bytes32,bytes32,bytes32) external pure returns (bool) { return true; }
    function authorizedAssignment(bytes32 jobId, bytes32, address worker, bytes32 assignmentRef)
        external view returns (bool)
    {
        ComputeJobMatchedWorkerEvidence420.Assignment storage a = _assignments[assignmentRef];
        return a.exists && a.jobId == jobId && a.worker == worker;
    }
    function committedResult(bytes32 jobId, bytes32 assignmentRef, bytes32 resultCommitment)
        external view returns (bool)
    {
        ComputeJobMatchedWorkerEvidence420.Assignment storage a = _assignments[assignmentRef];
        return a.exists && a.jobId == jobId && a.resultCommitment == resultCommitment;
    }
    function verified(bytes32,bytes32,address,bytes32,bool) external pure returns (bool) { return true; }
    function settled(bytes32,bytes32,bytes32) external pure returns (bool) { return true; }
    function refunded(bytes32,bytes32) external pure returns (bool) { return true; }

    function accept(bytes32 jobId, uint64 revision, bytes32 acceptanceRef) external {
        jobs.recordAcceptance(jobId, revision, acceptanceRef);
    }

    function assign(bytes32 jobId, uint64 revision, address worker, bytes32 assignmentRef) external {
        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        _assignments[assignmentRef] = ComputeJobMatchedWorkerEvidence420.Assignment({
            jobId: jobId,
            matchId: j.matchId,
            acceptanceRef: j.acceptanceRef,
            resourceId: keccak256("resource"),
            worker: worker,
            attempt: 1,
            resultCommitment: bytes32(0),
            receiptHash: bytes32(0),
            outputHash: bytes32(0),
            exists: true
        });
        jobs.assignWorker(jobId, revision, worker, assignmentRef);
    }

    function setCommitted(
        bytes32 assignmentRef,
        bytes32 resultCommitment,
        bytes32 receiptHash,
        bytes32 outputHash
    ) external {
        ComputeJobMatchedWorkerEvidence420.Assignment storage a = _assignments[assignmentRef];
        a.resultCommitment = resultCommitment;
        a.receiptHash = receiptHash;
        a.outputHash = outputHash;
    }

    function getAssignment(bytes32 assignmentRef)
        external view returns (ComputeJobMatchedWorkerEvidence420.Assignment memory)
    {
        return _assignments[assignmentRef];
    }
}

contract ComputeScientificVerificationRouter420Test {
    VmCMP148 private constant vm =
        VmCMP148(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant GOV = address(0x420);
    address private constant OWNER = address(0xA11CE);
    address private constant WORKER = address(0xB0B);
    address private constant SAMPLER = address(0x5151);
    address private constant OUTSIDER = address(0xBAD);

    bytes32 private constant POLICY = keccak256("scientific-verification-policy");
    bytes32 private constant TERMS = keccak256("scientific-terms-v1");
    bytes32 private constant SCHEMA = keccak256("scientific-policy-schema-v1");
    bytes32 private constant MANIFEST = keccak256("scientific-manifest");
    bytes32 private constant FUNDING = keccak256("funding");
    bytes32 private constant MATCH = keccak256("match");
    bytes32 private constant ACCEPTANCE = keccak256("acceptance");
    bytes32 private constant RECEIPT = keccak256("receipt");

    CMP148Evidence420 private evidence;
    ComputePolicyRegistry420 private policies;
    ComputeJobRegistry420 private jobs;
    ComputeScientificAdapterRegistry420 private registry;
    ComputeSampledMeanScientificAdapter420 private adapter;
    ComputeScientificVerificationRouter420 private router;
    uint256 private nonce;

    function setUp() public {
        evidence = new CMP148Evidence420();
        policies = new ComputePolicyRegistry420(GOV);
        jobs = new ComputeJobRegistry420(
            address(evidence), address(evidence), address(evidence),
            address(evidence), address(evidence), address(evidence)
        );
        evidence.bindJobs(address(jobs));
        jobs.bindVerificationPolicyRegistry(address(policies));

        registry = new ComputeScientificAdapterRegistry420(GOV);
        adapter = new ComputeSampledMeanScientificAdapter420();
        router = new ComputeScientificVerificationRouter420(address(jobs), address(registry), SAMPLER);

        bytes32 workload = adapter.WORKLOAD_TYPE();
        bytes32 profile = adapter.PROFILE_ID();
        vm.prank(GOV);
        registry.publish(workload, profile, address(adapter));

        bytes32 kind = policies.KIND_VERIFICATION();
        vm.prank(GOV);
        policies.publish(POLICY, kind, TERMS, SCHEMA, 1 days, 100, 100 ether);
    }

    function _uniform(uint64 value) private pure returns (uint64[16] memory data) {
        for (uint256 i; i < 16; ++i) data[i] = value;
    }

    function _leaf(uint32 index, uint64 value) private view returns (bytes32) {
        return keccak256(abi.encode(adapter.LEAF_DOMAIN(), index, value));
    }

    function _levels(uint64[16] memory data)
        private view returns (
            bytes32[16] memory l0,
            bytes32[8] memory l1,
            bytes32[4] memory l2,
            bytes32[2] memory l3,
            bytes32 root
        )
    {
        for (uint32 i; i < 16; ++i) l0[i] = _leaf(i, data[i]);
        for (uint256 i; i < 8; ++i) l1[i] = keccak256(abi.encodePacked(l0[i*2], l0[i*2+1]));
        for (uint256 i; i < 4; ++i) l2[i] = keccak256(abi.encodePacked(l1[i*2], l1[i*2+1]));
        for (uint256 i; i < 2; ++i) l3[i] = keccak256(abi.encodePacked(l2[i*2], l2[i*2+1]));
        root = keccak256(abi.encodePacked(l3[0], l3[1]));
    }

    function _proof(uint64[16] memory data, uint32 index)
        private view returns (bytes32[] memory proof)
    {
        (
            bytes32[16] memory l0,
            bytes32[8] memory l1,
            bytes32[4] memory l2,
            bytes32[2] memory l3,
        ) = _levels(data);
        proof = new bytes32[](4);
        proof[0] = l0[index ^ 1];
        proof[1] = l1[(index >> 1) ^ 1];
        proof[2] = l2[(index >> 2) ^ 1];
        proof[3] = l3[(index >> 3) ^ 1];
    }

    function _root(uint64[16] memory data) private view returns (bytes32 root) {
        (,,,,root) = _levels(data);
    }

    function _makeJob(uint64[16] memory data, uint256 claimedMean, bytes32 seed)
        private returns (bytes32 jobId, bytes memory evaluationData)
    {
        uint256 n = ++nonce;
        bytes32 root = _root(data);
        bytes32 input = adapter.inputCommitment(root, 16);
        bytes32 workload = adapter.WORKLOAD_TYPE();
        bytes32 schema = adapter.OUTPUT_SCHEMA();

        bytes32 request = keccak256(abi.encode("request", n));
        vm.prank(OWNER);
        jobId = jobs.createJob(
            request, request, MANIFEST, workload, input, schema, uint64(block.timestamp + 1 days)
        );
        vm.prank(OWNER);
        jobs.recordFunding(jobId, 1, FUNDING);
        vm.prank(OWNER);
        jobs.recordMatch(jobId, 2, MATCH);
        evidence.accept(jobId, 3, ACCEPTANCE);

        bytes32 policyCommitment = policies.commitment(POLICY, 1);
        vm.prank(OWNER);
        jobs.bindVerificationPolicy(jobId, 4, POLICY, 1, policyCommitment);

        bytes32 profile = adapter.PROFILE_ID();
        bytes32 seedCommitment = adapter.sampleSeedCommitment(seed);
        vm.prank(SAMPLER);
        router.bindAdapter(jobId, profile, 1, seedCommitment);

        bytes32 assignmentRef = keccak256(abi.encode("assignment", n));
        evidence.assign(jobId, 5, WORKER, assignmentRef);
        bytes32 outputHash = adapter.outputCommitment(claimedMean);
        bytes32 result = keccak256(abi.encode("scientific-result", jobId, assignmentRef, RECEIPT, outputHash));
        evidence.setCommitted(assignmentRef, result, RECEIPT, outputHash);
        vm.prank(WORKER);
        jobs.recordResult(jobId, 6, result);

        uint32[] memory indices = new uint32[](4);
        uint64[] memory values = new uint64[](4);
        bytes32[][] memory proofs = new bytes32[][](4);
        for (uint8 i; i < 4; ++i) {
            uint32 index = adapter.sampleIndex(seed, 16, i);
            indices[i] = index;
            values[i] = data[index];
            proofs[i] = _proof(data, index);
        }
        evaluationData = abi.encode(seed, root, uint32(16), indices, values, proofs, claimedMean);
    }

    function testSampledProtocolPassesUniformCommittedDatasetWithoutMutatingJob() public {
        bytes32 seed = keccak256("pass-seed");
        (bytes32 jobId, bytes memory evaluationData) = _makeJob(_uniform(100), 100, seed);
        (bytes32 ref, uint8 outcome) = router.evaluate(jobId, evaluationData);
        require(ref != bytes32(0) && outcome == adapter.OUTCOME_PASS(), "sampled pass missing");

        ComputeScientificVerificationRouter420.Evaluation memory e = router.evaluation(jobId);
        require(
            e.exists && e.outcome == adapter.OUTCOME_PASS()
                && e.sampleCount == 4 && e.coverageBps == 2500
                && jobs.job(jobId).status == ComputeJobRegistry420.Status.RESULT_COMMITTED,
            "scientific evidence mutated verdict state"
        );
    }

    function testSampledProtocolFailsCommittedClaimOutsideTolerance() public {
        bytes32 seed = keccak256("fail-seed");
        (bytes32 jobId, bytes memory evaluationData) = _makeJob(_uniform(100), 120, seed);
        (, uint8 outcome) = router.evaluate(jobId, evaluationData);
        require(outcome == adapter.OUTCOME_FAIL(), "outside-tolerance claim not failed");
        require(jobs.job(jobId).status == ComputeJobRegistry420.Status.RESULT_COMMITTED,
            "fail outcome fabricated canonical failure verdict");
    }

    function testHighDispersionIsExplicitlyInconclusive() public {
        bytes32 seed = keccak256("dispersion-seed");
        uint64[16] memory data = _uniform(100);
        uint32 first = adapter.sampleIndex(seed, 16, 0);
        uint32 second = adapter.sampleIndex(seed, 16, 1);
        data[first] = 0;
        data[second] = 200;

        (bytes32 jobId, bytes memory evaluationData) = _makeJob(data, 100, seed);
        (, uint8 outcome) = router.evaluate(jobId, evaluationData);
        require(outcome == adapter.OUTCOME_INCONCLUSIVE(), "high dispersion not inconclusive");
        require(jobs.job(jobId).status == ComputeJobRegistry420.Status.RESULT_COMMITTED,
            "inconclusive outcome mutated job");
    }

    function testWrongSeedProofOrWorkerOutputFailsClosed() public {
        bytes32 seed = keccak256("evidence-seed");
        uint64[16] memory data = _uniform(100);
        (bytes32 jobId, bytes memory validEvidence) = _makeJob(data, 100, seed);

        (
            ,
            bytes32 root,
            uint32 count,
            uint32[] memory indices,
            uint64[] memory values,
            bytes32[][] memory proofs,
            uint256 claimed
        ) = abi.decode(validEvidence,(bytes32,bytes32,uint32,uint32[],uint64[],bytes32[][],uint256));

        bytes memory wrongSeedEvidence = abi.encode(
            keccak256("wrong-seed"), root, count, indices, values, proofs, claimed
        );
        (bool ok,) = address(router).call(abi.encodeCall(router.evaluate, (jobId, wrongSeedEvidence)));
        require(!ok, "wrong seed accepted");

        proofs[0][0] = keccak256("tampered-proof");
        bytes memory badProofEvidence = abi.encode(seed, root, count, indices, values, proofs, claimed);
        (ok,) = address(router).call(abi.encodeCall(router.evaluate, (jobId, badProofEvidence)));
        require(!ok, "tampered Merkle proof accepted");

        require(!router.evaluationExistsForTest(jobId), "rejected evidence consumed job");
    }

    function testOnlySamplingAuthorityCanFreezeProtocolAndBindingMustPrecedeExecution() public {
        uint64[16] memory data = _uniform(100);
        bytes32 root = _root(data);
        bytes32 input = adapter.inputCommitment(root, 16);
        bytes32 workload = adapter.WORKLOAD_TYPE();
        bytes32 schema = adapter.OUTPUT_SCHEMA();
        bytes32 request = keccak256("authority-request");

        vm.prank(OWNER);
        bytes32 jobId = jobs.createJob(
            request, request, MANIFEST, workload, input, schema, uint64(block.timestamp + 1 days)
        );
        vm.prank(OWNER); jobs.recordFunding(jobId, 1, FUNDING);
        vm.prank(OWNER); jobs.recordMatch(jobId, 2, MATCH);
        evidence.accept(jobId, 3, ACCEPTANCE);
        bytes32 policyCommitment = policies.commitment(POLICY, 1);
        vm.prank(OWNER); jobs.bindVerificationPolicy(jobId, 4, POLICY, 1, policyCommitment);

        bytes32 profile = adapter.PROFILE_ID();
        bytes32 seedCommitment = adapter.sampleSeedCommitment(keccak256("authority-seed"));
        vm.prank(OUTSIDER);
        (bool ok,) = address(router).call(
            abi.encodeCall(router.bindAdapter, (jobId, profile, uint64(1), seedCommitment))
        );
        require(!ok, "outsider froze scientific protocol");

        bytes32 assignmentRef = keccak256("authority-assignment");
        evidence.assign(jobId, 5, WORKER, assignmentRef);
        vm.prank(SAMPLER);
        (ok,) = address(router).call(
            abi.encodeCall(router.bindAdapter, (jobId, profile, uint64(1), seedCommitment))
        );
        require(!ok, "scientific protocol bound after execution began");
    }

    function testAdapterUpgradeCannotRewriteFrozenScientificProtocol() public {
        bytes32 seed = keccak256("upgrade-seed");
        (bytes32 jobId, bytes memory evaluationData) = _makeJob(_uniform(100), 100, seed);
        ComputeScientificVerificationRouter420.Binding memory beforeBinding = router.binding(jobId);

        ComputeSampledMeanScientificAdapter420 replacement =
            new ComputeSampledMeanScientificAdapter420();
        bytes32 workload = replacement.WORKLOAD_TYPE();
        bytes32 profile = replacement.PROFILE_ID();
        vm.prank(GOV);
        uint64 revision = registry.publish(workload, profile, address(replacement));
        require(revision == 2, "scientific route not versioned");

        ComputeScientificVerificationRouter420.Binding memory afterBinding = router.binding(jobId);
        require(
            afterBinding.adapter == beforeBinding.adapter
                && afterBinding.adapterRevision == 1
                && afterBinding.protocolCommitment == beforeBinding.protocolCommitment,
            "frozen scientific protocol rewritten"
        );
        (, uint8 outcome) = router.evaluate(jobId, evaluationData);
        require(outcome == adapter.OUTCOME_PASS(), "frozen protocol stopped evaluating");
    }

    function testDeterministicAndScientificAdaptersCannotMasqueradeAsEachOther() public {
        ComputeIntegerSumSquaresAdapter420 deterministic = new ComputeIntegerSumSquaresAdapter420();
        bytes32 scientificWorkload = adapter.WORKLOAD_TYPE();
        bytes32 scientificProfile = adapter.PROFILE_ID();

        vm.prank(GOV);
        (bool ok,) = address(registry).call(
            abi.encodeCall(registry.publish, (scientificWorkload, scientificProfile, address(deterministic)))
        );
        require(!ok, "deterministic adapter admitted as scientific protocol");

        ComputeDeterministicAdapterRegistry420 deterministicRegistry =
            new ComputeDeterministicAdapterRegistry420(GOV);
        vm.prank(GOV);
        (ok,) = address(deterministicRegistry).call(
            abi.encodeCall(
                deterministicRegistry.publish,
                (scientificWorkload, scientificProfile, address(adapter))
            )
        );
        require(!ok, "scientific adapter admitted as deterministic protocol");
    }

    function testScientificEvaluationIsSingleUse() public {
        bytes32 seed = keccak256("replay-seed");
        (bytes32 jobId, bytes memory evaluationData) = _makeJob(_uniform(100), 100, seed);
        router.evaluate(jobId, evaluationData);
        (bool ok,) = address(router).call(abi.encodeCall(router.evaluate, (jobId, evaluationData)));
        require(!ok, "scientific evaluation replay accepted");
    }
}
