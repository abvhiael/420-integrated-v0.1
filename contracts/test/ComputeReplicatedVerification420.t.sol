// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeReplicatedVerification420.sol";
import "../src/compute/ComputePolicyRegistry420.sol";

interface VmCMP146 {
    function prank(address caller) external;
}

contract CMP146Fixture420 is
    IComputeJobRequestEvidence420,
    IComputeJobFundingEvidence420,
    IComputeJobMatchEvidence420,
    IComputeJobWorkerEvidence420,
    IComputeJobVerificationEvidence420,
    IComputeJobSettlementEvidence420,
    IComputeJobRefundEvidence420,
    IComputeAcceptedMatchRuntime420
{
    address public override jobs;
    address public payer;
    uint256 public maxSpend = 100 ether;
    bytes32 public activeJob;
    address public owner;
    address public operator;
    bytes32 public expectedResult;

    constructor(address payer_) { payer = payer_; }

    function bindJobs(address jobs_) external { jobs = jobs_; }
    function setParties(bytes32 jobId, address owner_, address operator_) external {
        activeJob = jobId;
        owner = owner_;
        operator = operator_;
    }
    function setExpectedResult(bytes32 result) external { expectedResult = result; }

    function fundingTerms(bytes32) external view returns (address, uint256) { return (payer, maxSpend); }
    function validRequest(bytes32,address,bytes32,bytes32,bytes32,bytes32,bytes32,uint64)
        external pure returns (bool) { return true; }
    function funded(bytes32,address,bytes32) external pure returns (bool) { return true; }
    function matched(bytes32,bytes32,bytes32,bytes32) external pure returns (bool) { return true; }
    function accepted(bytes32,bytes32,bytes32) external pure returns (bool) { return true; }
    function authorizedAssignment(bytes32,bytes32,address,bytes32) external pure returns (bool) { return true; }
    function committedResult(bytes32,bytes32,bytes32 resultCommitment) external view returns (bool) {
        return expectedResult == bytes32(0) || resultCommitment == expectedResult;
    }
    function verified(bytes32,bytes32,address,bytes32,bool) external pure returns (bool) { return true; }
    function settled(bytes32,bytes32,bytes32) external pure returns (bool) { return true; }
    function refunded(bytes32,bytes32) external pure returns (bool) { return true; }
    function authorizedResource(bytes32,bytes32,bytes32,bytes32,address) external pure returns (bool) { return true; }

    function matchParties(bytes32) external view returns (bytes32,address,address,bool) {
        return (activeJob, owner, operator, activeJob != bytes32(0));
    }

    function acceptIntoJob(bytes32 jobId, uint64 expectedRevision, bytes32 acceptanceRef) external {
        ComputeJobRegistry420(jobs).recordAcceptance(jobId, expectedRevision, acceptanceRef);
    }

    function assignIntoJob(bytes32 jobId, uint64 expectedRevision, address worker, bytes32 assignmentRef) external {
        ComputeJobRegistry420(jobs).assignWorker(jobId, expectedRevision, worker, assignmentRef);
    }

    function commitIntoJob(bytes32 jobId, uint64 expectedRevision, bytes32 resultCommitment) external {
        ComputeJobRegistry420(jobs).recordResult(jobId, expectedRevision, resultCommitment);
    }
}

contract ComputeReplicatedVerification420Test {
    VmCMP146 private constant vm =
        VmCMP146(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant GOV = address(0x420);
    address private constant ATTESTOR = address(0x421);
    address private constant PLACEHOLDER_SELECTOR = address(0x422);
    address private constant SELECTION_AUTHORITY = address(0x423);
    address private constant OWNER = address(0xA11CE);
    address private constant PAYER = address(0xBEEF);
    address private constant OPERATOR = address(0xC0FFEE);
    address private constant V1 = address(0xD001);
    address private constant V2 = address(0xD002);
    address private constant V3 = address(0xD003);
    address private constant V4 = address(0xD004);
    address private constant OUTSIDER = address(0xBAD);

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
    bytes32 private constant PROFILE = keccak256("quorum-profile");
    bytes32 private constant POLICY = keccak256("verification-policy");
    bytes32 private constant POLICY_TERMS = keccak256("verification-terms");
    bytes32 private constant POLICY_SCHEMA = keccak256("verification-schema");
    bytes32 private constant COMMITTEE_EVIDENCE = keccak256("committee-selection-evidence");
    bytes32 private constant RESULT_A = keccak256("result-a");
    bytes32 private constant RESULT_B = keccak256("result-b");

    CMP146Fixture420 private fixture;
    ComputeJobRegistry420 private jobs;
    ComputePolicyRegistry420 private policies;
    ComputeVerifierRegistry420 private verifierRegistry;
    ComputeVerifierCapabilityRegistry420 private capabilities;
    ComputeVerifierIndependencePolicy420 private independence;
    ComputeIndependentVerifierSelector420 private selector;
    ComputeReplicatedVerification420 private replicated;
    bytes32 private jobId;
    bytes32[4] private verifierIds;

    function setUp() public {
        fixture = new CMP146Fixture420(PAYER);
        policies = new ComputePolicyRegistry420(GOV);
        jobs = new ComputeJobRegistry420(
            address(fixture), address(fixture), address(fixture),
            address(fixture), address(fixture), address(fixture)
        );
        fixture.bindJobs(address(jobs));
        jobs.bindVerificationPolicyRegistry(address(policies));

        verifierRegistry = new ComputeVerifierRegistry420(GOV);
        capabilities = new ComputeVerifierCapabilityRegistry420(address(verifierRegistry), GOV);
        independence = new ComputeVerifierIndependencePolicy420(GOV, ATTESTOR, PLACEHOLDER_SELECTOR);

        selector = new ComputeIndependentVerifierSelector420(
            address(jobs),
            address(fixture),
            address(verifierRegistry),
            address(capabilities),
            address(independence),
            SELECTION_AUTHORITY
        );
        vm.prank(GOV);
        independence.setAuthorities(ATTESTOR, address(selector));

        replicated = new ComputeReplicatedVerification420(address(selector));

        _attest(OWNER, keccak256("owner-controller"), 1);
        _attest(PAYER, keccak256("payer-controller"), 2);
        _attest(OPERATOR, keccak256("operator-controller"), 3);
        _attest(V1, keccak256("verifier-controller-1"), 4);
        _attest(V2, keccak256("verifier-controller-2"), 5);
        _attest(V3, keccak256("verifier-controller-3"), 6);
        _attest(V4, keccak256("owner-controller"), 7);

        verifierIds[0] = _registerAndQualify(V1, keccak256("v1"));
        verifierIds[1] = _registerAndQualify(V2, keccak256("v2"));
        verifierIds[2] = _registerAndQualify(V3, keccak256("v3"));
        verifierIds[3] = _registerAndQualify(V4, keccak256("v4"));

        bytes32 verificationKind = policies.KIND_VERIFICATION();
        vm.prank(GOV);
        policies.publish(POLICY, verificationKind, POLICY_TERMS, POLICY_SCHEMA, 1 days, 100, 100 ether);

        vm.prank(OWNER);
        jobId = jobs.createJob(
            REQUEST, REQUEST_COMMITMENT, MANIFEST, WORKLOAD, INPUT, OUTPUT,
            uint64(block.timestamp + 1 days)
        );
        fixture.setParties(jobId, OWNER, OPERATOR);

        vm.prank(OWNER);
        jobs.recordFunding(jobId, 1, FUNDING);
        vm.prank(OWNER);
        jobs.recordMatch(jobId, 2, MATCH);
        fixture.acceptIntoJob(jobId, 3, ACCEPTANCE);

        bytes32 commitment = policies.commitment(POLICY, 1);
        vm.prank(OWNER);
        jobs.bindVerificationPolicy(jobId, 4, POLICY, 1, commitment);
    }

    function _attest(address account, bytes32 controller, uint256 salt) private {
        vm.prank(ATTESTOR);
        independence.attest(
            account,
            controller,
            keccak256(abi.encode("controller-evidence", salt)),
            uint64(block.timestamp + 1 days)
        );
    }

    function _registerAndQualify(address authority, bytes32 manifest) private returns (bytes32 id) {
        vm.prank(authority);
        id = verifierRegistry.register(manifest);
        vm.prank(GOV);
        verifierRegistry.activate(id);

        bytes32 independentClass = capabilities.INDEPENDENT_VERIFIER();
        bytes32 committeeClass = capabilities.COMMITTEE_VERIFIER();
        vm.prank(GOV);
        capabilities.setCapability(id, independentClass, WORKLOAD, true, keccak256(abi.encode("ind", id)));
        vm.prank(GOV);
        capabilities.setCapability(id, committeeClass, WORKLOAD, true, keccak256(abi.encode("committee", id)));
    }

    function _committeeIds3() private view returns (bytes32[] memory ids, uint64[] memory revisions) {
        ids = new bytes32[](3);
        revisions = new uint64[](3);
        for (uint256 i = 0; i < 3; ++i) {
            ids[i] = verifierIds[i];
            revisions[i] = verifierRegistry.verifier(ids[i]).revision;
        }
    }

    function _freeze2of3() private returns (bytes32 ref) {
        (bytes32[] memory ids, uint64[] memory revisions) = _committeeIds3();
        vm.prank(SELECTION_AUTHORITY);
        ref = replicated.freezeCommittee(
            jobId,
            PROFILE,
            COMMITTEE_EVIDENCE,
            2,
            uint64(block.timestamp + 1 hours),
            ids,
            revisions
        );
    }

    function _commitWorkerResult(bytes32 result) private {
        fixture.assignIntoJob(jobId, 5, OPERATOR, ASSIGNMENT);
        fixture.setExpectedResult(result);
        fixture.commitIntoJob(jobId, 6, result);
        require(
            jobs.job(jobId).status == ComputeJobRegistry420.Status.RESULT_COMMITTED,
            "fixture did not commit result"
        );
    }

    function testFreezeExactIndependentTwoOfThreeCommitteeBeforeExecution() public {
        bytes32 ref = _freeze2of3();
        require(ref != bytes32(0), "committee ref missing");

        ComputeReplicatedVerification420.Committee memory c = replicated.committee(jobId);
        require(c.threshold == 2 && c.memberCount == 3, "wrong quorum shape");
        require(c.jobRevision == 5, "wrong accepted job revision");
        require(c.workloadClass == WORKLOAD && c.profileId == PROFILE, "wrong workload/profile");
        require(c.verificationPolicyId == POLICY && c.verificationPolicyRevision == 1, "policy not frozen");
        require(c.committeeRef == ref, "committee ref drift");
        require(replicated.memberAddresses(jobId).length == 3, "member list missing");
    }

    function testOnlySelectionAuthorityCanFreezeCommittee() public {
        (bytes32[] memory ids, uint64[] memory revisions) = _committeeIds3();
        address[5] memory callers = [OWNER, PAYER, OPERATOR, V1, OUTSIDER];
        for (uint256 i = 0; i < callers.length; ++i) {
            vm.prank(callers[i]);
            (bool ok,) = address(replicated).call(
                abi.encodeCall(
                    replicated.freezeCommittee,
                    (
                        jobId,
                        PROFILE,
                        COMMITTEE_EVIDENCE,
                        uint16(2),
                        uint64(block.timestamp + 1 hours),
                        ids,
                        revisions
                    )
                )
            );
            require(!ok, "unauthorized committee freeze");
        }
    }

    function testThresholdDuplicateAndSharedControllerFailClosed() public {
        (bytes32[] memory ids, uint64[] memory revisions) = _committeeIds3();

        vm.prank(SELECTION_AUTHORITY);
        (bool ok,) = address(replicated).call(
            abi.encodeCall(
                replicated.freezeCommittee,
                (
                    jobId,
                    PROFILE,
                    COMMITTEE_EVIDENCE,
                    uint16(1),
                    uint64(block.timestamp + 1 hours),
                    ids,
                    revisions
                )
            )
        );
        require(!ok, "1-of-M accepted as replicated verification");

        ids[2] = ids[1];
        revisions[2] = revisions[1];
        vm.prank(SELECTION_AUTHORITY);
        (ok,) = address(replicated).call(
            abi.encodeCall(
                replicated.freezeCommittee,
                (
                    jobId,
                    PROFILE,
                    COMMITTEE_EVIDENCE,
                    uint16(2),
                    uint64(block.timestamp + 1 hours),
                    ids,
                    revisions
                )
            )
        );
        require(!ok, "duplicate verifier satisfied committee");

        ids[2] = verifierIds[3];
        revisions[2] = verifierRegistry.verifier(verifierIds[3]).revision;
        vm.prank(SELECTION_AUTHORITY);
        (ok,) = address(replicated).call(
            abi.encodeCall(
                replicated.freezeCommittee,
                (
                    jobId,
                    PROFILE,
                    COMMITTEE_EVIDENCE,
                    uint16(2),
                    uint64(block.timestamp + 1 hours),
                    ids,
                    revisions
                )
            )
        );
        require(!ok, "party-controlled verifier entered committee");
    }

    function testMissingCommitteeCapabilityFailsClosed() public {
        bytes32 id;
        address candidate = address(0xD005);
        _attest(candidate, keccak256("verifier-controller-5"), 8);
        vm.prank(candidate);
        id = verifierRegistry.register(keccak256("v5"));
        vm.prank(GOV);
        verifierRegistry.activate(id);
        bytes32 independentClass = capabilities.INDEPENDENT_VERIFIER();
        vm.prank(GOV);
        capabilities.setCapability(id, independentClass, WORKLOAD, true, keccak256("ind-only"));

        bytes32[] memory ids = new bytes32[](2);
        uint64[] memory revisions = new uint64[](2);
        ids[0] = verifierIds[0];
        ids[1] = id;
        revisions[0] = verifierRegistry.verifier(ids[0]).revision;
        revisions[1] = verifierRegistry.verifier(ids[1]).revision;

        vm.prank(SELECTION_AUTHORITY);
        (bool ok,) = address(replicated).call(
            abi.encodeCall(
                replicated.freezeCommittee,
                (
                    jobId,
                    PROFILE,
                    COMMITTEE_EVIDENCE,
                    uint16(2),
                    uint64(block.timestamp + 1 hours),
                    ids,
                    revisions
                )
            )
        );
        require(!ok, "non-committee verifier entered quorum");
    }

    function testVotingRequiresCommittedResultAndFrozenMember() public {
        _freeze2of3();

        vm.prank(V1);
        (bool ok,) = address(replicated).call(
            abi.encodeCall(
                replicated.submitRecomputation,
                (jobId, RESULT_A, keccak256("v1-evidence"))
            )
        );
        require(!ok, "vote accepted before RESULT_COMMITTED");

        _commitWorkerResult(RESULT_A);

        vm.prank(OUTSIDER);
        (ok,) = address(replicated).call(
            abi.encodeCall(
                replicated.submitRecomputation,
                (jobId, RESULT_A, keccak256("outsider-evidence"))
            )
        );
        require(!ok, "outsider voted");
    }

    function testTwoOfThreeMatchingRecomputationsReachQuorumExactlyOnce() public {
        _freeze2of3();
        _commitWorkerResult(RESULT_A);

        vm.prank(V1);
        (, bytes32 q1) = replicated.submitRecomputation(
            jobId, RESULT_A, keccak256("v1-evidence")
        );
        require(q1 == bytes32(0), "single vote reached quorum");
        (bool reached,) = replicated.quorumReached(jobId, RESULT_A);
        require(!reached, "quorum reached too early");

        vm.prank(V2);
        (, bytes32 q2) = replicated.submitRecomputation(
            jobId, RESULT_A, keccak256("v2-evidence")
        );
        require(q2 != bytes32(0), "second matching vote missed quorum");
        bytes32 storedRef;
        (reached, storedRef) = replicated.quorumReached(jobId, RESULT_A);
        require(reached && storedRef == q2, "quorum evidence mismatch");
        require(replicated.votesForResult(jobId, RESULT_A) == 2, "wrong vote count");

        vm.prank(V3);
        (bool ok,) = address(replicated).call(
            abi.encodeCall(
                replicated.submitRecomputation,
                (jobId, RESULT_A, keccak256("v3-evidence"))
            )
        );
        require(!ok, "post-finalization vote accepted");
    }

    function testSplitVotesNeedThresholdOnSameResult() public {
        _freeze2of3();
        _commitWorkerResult(RESULT_A);

        vm.prank(V1);
        replicated.submitRecomputation(jobId, RESULT_A, keccak256("v1-a"));
        vm.prank(V2);
        replicated.submitRecomputation(jobId, RESULT_B, keccak256("v2-b"));

        (bool aReached,) = replicated.quorumReached(jobId, RESULT_A);
        (bool bReached,) = replicated.quorumReached(jobId, RESULT_B);
        require(!aReached && !bReached, "split vote incorrectly reached quorum");

        vm.prank(V3);
        (, bytes32 quorumRef) =
            replicated.submitRecomputation(jobId, RESULT_A, keccak256("v3-a"));
        require(quorumRef != bytes32(0), "third vote did not resolve quorum");
        (aReached,) = replicated.quorumReached(jobId, RESULT_A);
        require(aReached, "same-result threshold not recognized");
    }

    function testMemberCanVoteOnlyOnceAndSuspensionFailsClosed() public {
        _freeze2of3();
        _commitWorkerResult(RESULT_A);

        vm.prank(V1);
        replicated.submitRecomputation(jobId, RESULT_A, keccak256("v1-a"));

        vm.prank(V1);
        (bool ok,) = address(replicated).call(
            abi.encodeCall(
                replicated.submitRecomputation,
                (jobId, RESULT_B, keccak256("v1-b"))
            )
        );
        require(!ok, "member voted twice");

        vm.prank(GOV);
        verifierRegistry.suspend(verifierIds[1]);

        vm.prank(V2);
        (ok,) = address(replicated).call(
            abi.encodeCall(
                replicated.submitRecomputation,
                (jobId, RESULT_A, keccak256("v2-after-suspend"))
            )
        );
        require(!ok, "suspended verifier vote accepted");
    }

    function testCommitteeCannotBeFrozenAfterExecutionBegins() public {
        _commitWorkerResult(RESULT_A);
        (bytes32[] memory ids, uint64[] memory revisions) = _committeeIds3();

        vm.prank(SELECTION_AUTHORITY);
        (bool ok,) = address(replicated).call(
            abi.encodeCall(
                replicated.freezeCommittee,
                (
                    jobId,
                    PROFILE,
                    COMMITTEE_EVIDENCE,
                    uint16(2),
                    uint64(block.timestamp + 1 hours),
                    ids,
                    revisions
                )
            )
        );
        require(!ok, "committee frozen after execution");
    }
}
