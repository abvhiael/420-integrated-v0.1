// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeJobRegistry420.sol";
import "../src/compute/ComputePolicyRegistry420.sol";

interface VmCMP143 {
    function prank(address caller) external;
}

contract CMP143Evidence420 is
    IComputeJobRequestEvidence420,
    IComputeJobFundingEvidence420,
    IComputeJobMatchEvidence420,
    IComputeJobWorkerEvidence420,
    IComputeJobVerificationEvidence420,
    IComputeJobSettlementEvidence420,
    IComputeJobRefundEvidence420
{
    function validRequest(bytes32,address,bytes32,bytes32,bytes32,bytes32,bytes32,uint64)
        external pure returns (bool) { return true; }
    function funded(bytes32,address,bytes32) external pure returns (bool) { return true; }
    function matched(bytes32,bytes32,bytes32,bytes32) external pure returns (bool) { return true; }
    function accepted(bytes32,bytes32,bytes32) external pure returns (bool) { return true; }
    function authorizedAssignment(bytes32,bytes32,address,bytes32) external pure returns (bool) { return true; }
    function committedResult(bytes32,bytes32,bytes32) external pure returns (bool) { return true; }
    function verified(bytes32,bytes32,address,bytes32,bool) external pure returns (bool) { return true; }
    function settled(bytes32,bytes32,bytes32) external pure returns (bool) { return true; }
    function refunded(bytes32,bytes32) external pure returns (bool) { return true; }
}

contract ComputeVerificationPolicyBinding420Test {
    VmCMP143 private constant vm =
        VmCMP143(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant GOV = address(0x420);
    address private constant OWNER = address(0xA11CE);
    address private constant WORKER = address(0xB0B);

    bytes32 private constant REQUEST = keccak256("request");
    bytes32 private constant REQUEST_COMMITMENT = keccak256("request-commitment");
    bytes32 private constant MANIFEST = keccak256("manifest");
    bytes32 private constant WORKLOAD = keccak256("GPU_INFERENCE");
    bytes32 private constant INPUT = keccak256("input");
    bytes32 private constant OUTPUT = keccak256("output");
    bytes32 private constant FUNDING = keccak256("funding");
    bytes32 private constant MATCH = keccak256("match");
    bytes32 private constant ACCEPTANCE = keccak256("acceptance");
    bytes32 private constant ASSIGNMENT = keccak256("assignment");
    bytes32 private constant POLICY = keccak256("verification-policy");
    bytes32 private constant TERMS_V1 = keccak256("verification-terms-v1");
    bytes32 private constant TERMS_V2 = keccak256("verification-terms-v2");
    bytes32 private constant SCHEMA = keccak256("verification-schema-v1");

    CMP143Evidence420 private evidence;
    ComputePolicyRegistry420 private policies;
    ComputeJobRegistry420 private jobs;

    function setUp() public {
        evidence = new CMP143Evidence420();
        policies = new ComputePolicyRegistry420(GOV);
        jobs = new ComputeJobRegistry420(
            address(evidence),
            address(evidence),
            address(evidence),
            address(evidence),
            address(evidence),
            address(evidence)
        );
        jobs.bindVerificationPolicyRegistry(address(policies));
    }

    function _publish(bytes32 terms) private returns (uint32 revision) {
        vm.prank(GOV);
        revision = policies.publish(
            POLICY,
            policies.KIND_VERIFICATION(),
            terms,
            SCHEMA,
            1 days,
            100,
            100 ether
        );
    }

    function _acceptedJob() private returns (bytes32 jobId) {
        vm.prank(OWNER);
        jobId = jobs.createJob(
            REQUEST,
            REQUEST_COMMITMENT,
            MANIFEST,
            WORKLOAD,
            INPUT,
            OUTPUT,
            uint64(block.timestamp + 1 days)
        );
        vm.prank(OWNER);
        jobs.recordFunding(jobId, 1, FUNDING);
        vm.prank(OWNER);
        jobs.recordMatch(jobId, 2, MATCH);
        vm.prank(address(evidence));
        jobs.recordAcceptance(jobId, 3, ACCEPTANCE);
    }

    function testBoundRegistryRequiresPolicyBeforeExecution() public {
        _publish(TERMS_V1);
        bytes32 jobId = _acceptedJob();

        vm.prank(address(evidence));
        (bool ok,) = address(jobs).call(
            abi.encodeCall(jobs.assignWorker, (jobId, uint64(4), WORKER, ASSIGNMENT))
        );
        require(!ok, "execution started without frozen verification policy");

        bytes32 commitment = policies.commitment(POLICY, 1);
        vm.prank(OWNER);
        jobs.bindVerificationPolicy(jobId, 4, POLICY, 1, commitment);

        ComputeJobRegistry420.Job memory bound = jobs.job(jobId);
        require(bound.verificationPolicyId == POLICY, "policy id not frozen");
        require(bound.verificationPolicyRevision == 1, "policy revision not frozen");
        require(bound.verificationPolicyCommitment == commitment, "policy commitment not frozen");
        require(bound.revision == 5, "policy bind did not revise job");

        vm.prank(address(evidence));
        jobs.assignWorker(jobId, 5, WORKER, ASSIGNMENT);
        require(jobs.job(jobId).status == ComputeJobRegistry420.Status.RUNNING, "execution did not start");
    }

    function testOnlyOwnerCanBindAndExactCurrentVerificationPolicyIsRequired() public {
        _publish(TERMS_V1);
        bytes32 jobId = _acceptedJob();
        bytes32 commitment = policies.commitment(POLICY, 1);

        vm.prank(WORKER);
        (bool ok,) = address(jobs).call(
            abi.encodeCall(jobs.bindVerificationPolicy, (jobId, uint64(4), POLICY, uint32(1), commitment))
        );
        require(!ok, "non-owner bound policy");

        vm.prank(OWNER);
        (ok,) = address(jobs).call(
            abi.encodeCall(jobs.bindVerificationPolicy, (jobId, uint64(4), POLICY, uint32(1), bytes32(uint256(7))))
        );
        require(!ok, "wrong commitment bound");

        vm.prank(GOV);
        policies.setNewAcceptance(POLICY, false);
        vm.prank(OWNER);
        (ok,) = address(jobs).call(
            abi.encodeCall(jobs.bindVerificationPolicy, (jobId, uint64(4), POLICY, uint32(1), commitment))
        );
        require(!ok, "suspended policy admitted");

        vm.prank(GOV);
        policies.setNewAcceptance(POLICY, true);
        vm.prank(OWNER);
        jobs.bindVerificationPolicy(jobId, 4, POLICY, 1, commitment);
    }

    function testLaterPolicyRevisionCannotRewriteAcceptedJob() public {
        _publish(TERMS_V1);
        bytes32 jobId = _acceptedJob();
        bytes32 v1 = policies.commitment(POLICY, 1);

        vm.prank(OWNER);
        jobs.bindVerificationPolicy(jobId, 4, POLICY, 1, v1);

        _publish(TERMS_V2);
        require(policies.latestRevision(POLICY) == 2, "policy did not advance");
        require(policies.commitment(POLICY, 1) == v1, "historical policy commitment changed");

        ComputeJobRegistry420.Job memory bound = jobs.job(jobId);
        require(bound.verificationPolicyRevision == 1, "job policy revision rewritten");
        require(bound.verificationPolicyCommitment == v1, "job policy commitment rewritten");

        vm.prank(address(evidence));
        jobs.assignWorker(jobId, 5, WORKER, ASSIGNMENT);
        require(jobs.job(jobId).status == ComputeJobRegistry420.Status.RUNNING, "historical policy no longer usable");
    }

    function testStaleRevisionAndDuplicateBindingFailClosed() public {
        _publish(TERMS_V1);
        bytes32 jobId = _acceptedJob();
        bytes32 commitment = policies.commitment(POLICY, 1);

        vm.prank(OWNER);
        jobs.bindVerificationPolicy(jobId, 4, POLICY, 1, commitment);

        vm.prank(OWNER);
        (bool ok,) = address(jobs).call(
            abi.encodeCall(jobs.bindVerificationPolicy, (jobId, uint64(4), POLICY, uint32(1), commitment))
        );
        require(!ok, "stale job revision rebound policy");

        vm.prank(OWNER);
        (ok,) = address(jobs).call(
            abi.encodeCall(jobs.bindVerificationPolicy, (jobId, uint64(5), POLICY, uint32(1), commitment))
        );
        require(!ok, "duplicate policy binding accepted");
    }

    function testPolicyRegistryBindingIsOneTimeAndDeploymentScoped() public {
        ComputePolicyRegistry420 other = new ComputePolicyRegistry420(GOV);

        (bool ok,) = address(jobs).call(
            abi.encodeCall(jobs.bindVerificationPolicyRegistry, (address(other)))
        );
        require(!ok, "policy registry rebound");

        vm.prank(WORKER);
        ComputeJobRegistry420 fresh = new ComputeJobRegistry420(
            address(evidence),
            address(evidence),
            address(evidence),
            address(evidence),
            address(evidence),
            address(evidence)
        );
        vm.prank(OWNER);
        (ok,) = address(fresh).call(
            abi.encodeCall(fresh.bindVerificationPolicyRegistry, (address(policies)))
        );
        require(!ok, "non-deployer bound policy registry");
    }
}
