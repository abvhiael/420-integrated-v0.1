// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeDeterministicVerificationRouter420.sol";
import "../src/compute/ComputeIntegerSumSquaresAdapter420.sol";
import "../src/compute/ComputePolicyRegistry420.sol";

interface VmCMP147 {
    function prank(address caller) external;
}

contract CMP147Evidence420 is
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

contract ComputeDeterministicVerificationRouter420Test {
    VmCMP147 private constant vm =
        VmCMP147(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant GOV = address(0x420);
    address private constant OWNER = address(0xA11CE);
    address private constant WORKER = address(0xB0B);
    address private constant OUTSIDER = address(0xBAD);

    bytes32 private constant REQUEST = keccak256("request");
    bytes32 private constant REQUEST_COMMITMENT = keccak256("request-commitment");
    bytes32 private constant MANIFEST = keccak256("manifest");
    bytes32 private constant MATCH = keccak256("match");
    bytes32 private constant FUNDING = keccak256("funding");
    bytes32 private constant ACCEPTANCE = keccak256("acceptance");
    bytes32 private constant ASSIGNMENT = keccak256("assignment");
    bytes32 private constant RECEIPT = keccak256("receipt");
    bytes32 private constant POLICY = keccak256("verification-policy");
    bytes32 private constant TERMS = keccak256("terms");
    bytes32 private constant SCHEMA = keccak256("policy-schema");

    CMP147Evidence420 private evidence;
    ComputePolicyRegistry420 private policies;
    ComputeJobRegistry420 private jobs;
    ComputeDeterministicAdapterRegistry420 private registry;
    ComputeIntegerSumSquaresAdapter420 private adapter;
    ComputeDeterministicVerificationRouter420 private router;
    bytes32 private jobId;
    uint64[4] private values;

    function setUp() public {
        values = [uint64(3), uint64(4), uint64(5), uint64(12)];

        evidence = new CMP147Evidence420();
        policies = new ComputePolicyRegistry420(GOV);
        jobs = new ComputeJobRegistry420(
            address(evidence), address(evidence), address(evidence),
            address(evidence), address(evidence), address(evidence)
        );
        evidence.bindJobs(address(jobs));
        jobs.bindVerificationPolicyRegistry(address(policies));

        registry = new ComputeDeterministicAdapterRegistry420(GOV);
        adapter = new ComputeIntegerSumSquaresAdapter420();
        router = new ComputeDeterministicVerificationRouter420(address(jobs), address(registry));

        vm.prank(GOV);
        registry.publish(adapter.WORKLOAD_TYPE(), adapter.PROFILE_ID(), address(adapter));

        bytes32 verificationKind = policies.KIND_VERIFICATION();
        vm.prank(GOV);
        policies.publish(POLICY, verificationKind, TERMS, SCHEMA, 1 days, 100, 100 ether);

        bytes memory inputData = abi.encode(values);
        vm.prank(OWNER);
        jobId = jobs.createJob(
            REQUEST,
            REQUEST_COMMITMENT,
            MANIFEST,
            adapter.WORKLOAD_TYPE(),
            adapter.inputCommitment(inputData),
            adapter.OUTPUT_SCHEMA(),
            uint64(block.timestamp + 1 days)
        );
        vm.prank(OWNER);
        jobs.recordFunding(jobId, 1, FUNDING);
        vm.prank(OWNER);
        jobs.recordMatch(jobId, 2, MATCH);
        evidence.accept(jobId, 3, ACCEPTANCE);

        bytes32 policyCommitment = policies.commitment(POLICY, 1);
        vm.prank(OWNER);
        jobs.bindVerificationPolicy(jobId, 4, POLICY, 1, policyCommitment);
    }

    function _bind() private returns (bytes32 ref) {
        vm.prank(OWNER);
        ref = router.bindAdapter(jobId, adapter.PROFILE_ID(), 1);
    }

    function _commitOutput(uint256 output) private returns (bytes memory outputData) {
        outputData = abi.encode(output);
        evidence.assign(jobId, 5, WORKER, ASSIGNMENT);
        bytes32 outputHash = adapter.outputCommitment(outputData);
        bytes32 resultCommitment = keccak256(
            abi.encode("fixture-result", jobId, ASSIGNMENT, RECEIPT, outputHash)
        );
        evidence.setCommitted(ASSIGNMENT, resultCommitment, RECEIPT, outputHash);
        vm.prank(WORKER);
        jobs.recordResult(jobId, 6, resultCommitment);
    }

    function testRoutePublicationAndPreExecutionBindingFreezeExactAdapter() public {
        bytes32 ref = _bind();
        require(ref != bytes32(0), "binding ref missing");

        ComputeDeterministicVerificationRouter420.Binding memory b = router.binding(jobId);
        require(b.adapter == address(adapter), "adapter mismatch");
        require(b.adapterCodeHash == address(adapter).codehash, "codehash mismatch");
        require(b.adapterRevision == 1, "revision mismatch");
        require(b.jobRevision == 5, "job revision mismatch");
        require(b.outputSchemaCommitment == adapter.OUTPUT_SCHEMA(), "schema mismatch");
        require(b.verificationPolicyId == POLICY && b.verificationPolicyRevision == 1, "policy mismatch");
    }

    function testOnlyOwnerCanBindAndCannotBindAfterExecution() public {
        vm.prank(OUTSIDER);
        (bool ok,) = address(router).call(
            abi.encodeCall(router.bindAdapter, (jobId, adapter.PROFILE_ID(), uint64(1)))
        );
        require(!ok, "outsider bound adapter");

        _commitOutput(194);
        vm.prank(OWNER);
        (ok,) = address(router).call(
            abi.encodeCall(router.bindAdapter, (jobId, adapter.PROFILE_ID(), uint64(1)))
        );
        require(!ok, "adapter bound after execution");
    }

    function testCorrectOutputProducesPositiveDeterministicEvidenceWithoutMutatingJob() public {
        _bind();
        bytes memory outputData = _commitOutput(194);
        bytes memory inputData = abi.encode(values);

        (bytes32 evaluationRef, bool correct) = router.evaluate(jobId, inputData, outputData);
        require(evaluationRef != bytes32(0) && correct, "correct output not reproduced");

        ComputeDeterministicVerificationRouter420.Evaluation memory e = router.evaluation(jobId);
        require(e.exists && e.correct, "evaluation missing");
        require(e.workerOutputCommitment == adapter.outputCommitment(outputData), "worker output mismatch");
        require(e.expectedOutputCommitment == e.workerOutputCommitment, "expected output mismatch");
        require(jobs.job(jobId).status == ComputeJobRegistry420.Status.RESULT_COMMITTED,
            "router mutated canonical job verdict state");
    }

    function testIncorrectOutputProducesNegativeEvidenceWithoutFabricatingFailureVerdict() public {
        _bind();
        bytes memory outputData = _commitOutput(195);
        bytes memory inputData = abi.encode(values);

        (bytes32 ref, bool correct) = router.evaluate(jobId, inputData, outputData);
        require(ref != bytes32(0) && !correct, "incorrect output not detected");
        require(jobs.job(jobId).status == ComputeJobRegistry420.Status.RESULT_COMMITTED,
            "negative evaluation fabricated verdict state");
    }

    function testTamperedInputAndOutputFailClosedAgainstCanonicalCommitments() public {
        _bind();
        bytes memory outputData = _commitOutput(194);

        uint64[4] memory tampered = [uint64(4), uint64(4), uint64(5), uint64(12)];
        (bool ok,) = address(router).call(
            abi.encodeCall(router.evaluate, (jobId, abi.encode(tampered), outputData))
        );
        require(!ok, "tampered input accepted");

        (ok,) = address(router).call(
            abi.encodeCall(router.evaluate, (jobId, abi.encode(values), abi.encode(uint256(195))))
        );
        require(!ok, "output preimage not bound to worker commitment");
    }

    function testAdapterUpgradeDoesNotRewriteFrozenJobRoute() public {
        _bind();
        ComputeIntegerSumSquaresAdapter420 replacement = new ComputeIntegerSumSquaresAdapter420();

        vm.prank(GOV);
        uint64 revision = registry.publish(
            replacement.WORKLOAD_TYPE(), replacement.PROFILE_ID(), address(replacement)
        );
        require(revision == 2, "registry did not version route");

        ComputeDeterministicVerificationRouter420.Binding memory b = router.binding(jobId);
        require(b.adapter == address(adapter) && b.adapterRevision == 1, "frozen route rewritten");

        bytes memory outputData = _commitOutput(194);
        (bytes32 ref, bool correct) = router.evaluate(jobId, abi.encode(values), outputData);
        require(ref != bytes32(0) && correct, "frozen adapter stopped working after upgrade");
    }

    function testInactiveOrWrongProfileRouteCannotBeNewlyBound() public {
        vm.prank(GOV);
        registry.setActive(adapter.WORKLOAD_TYPE(), adapter.PROFILE_ID(), 1, false);

        vm.prank(OWNER);
        (bool ok,) = address(router).call(
            abi.encodeCall(router.bindAdapter, (jobId, adapter.PROFILE_ID(), uint64(1)))
        );
        require(!ok, "inactive route bound");

        vm.prank(OWNER);
        (ok,) = address(router).call(
            abi.encodeCall(router.bindAdapter, (jobId, keccak256("wrong-profile"), uint64(1)))
        );
        require(!ok, "unknown profile bound");
    }

    function testEvaluationIsSingleUse() public {
        _bind();
        bytes memory outputData = _commitOutput(194);
        router.evaluate(jobId, abi.encode(values), outputData);

        (bool ok,) = address(router).call(
            abi.encodeCall(router.evaluate, (jobId, abi.encode(values), outputData))
        );
        require(!ok, "evaluation replay accepted");
    }
}
