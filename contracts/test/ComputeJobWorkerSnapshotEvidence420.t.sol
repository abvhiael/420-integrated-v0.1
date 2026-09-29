// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeJobWorkerSnapshotEvidence420.sol";
import "../src/compute/ComputeProviderRegistry420.sol";
import "../src/compute/ComputeNodeRegistry420.sol";
import "../src/compute/ComputeResourceRegistry420.sol";
import "../src/compute/ComputeWorkerCapacityReservation420.sol";
import "../src/interfaces/genesis/ICapabilityRegistry420.sol";

interface VmWorkerSnapshot420 {
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8, bytes32, bytes32);
    function prank(address caller) external;
    function chainId(uint256 newChainId) external;
    function warp(uint256 newTimestamp) external;
}

contract SnapshotCapabilityRegistryMock420 is ICapabilityRegistry420 {
    bool public allow = true;
    function setAllow(bool allowed) external { allow = allowed; }

    function grant(bytes32) external pure returns (CapabilityGrant memory out) { return out; }

    function isAuthorized(address, bytes32, bytes32, bytes32, uint256)
        external
        view
        returns (bool)
    {
        return allow;
    }
}

contract SnapshotRequestFundingVerification420 is
    IComputeJobRequestEvidence420,
    IComputeJobFundingEvidence420,
    IComputeJobVerificationEvidence420,
    IComputeJobSettlementEvidence420,
    IComputeJobRefundEvidence420
{
    function validRequest(bytes32, address, bytes32, bytes32, bytes32, bytes32, bytes32, uint64)
        external pure returns (bool) { return true; }
    function funded(bytes32, address, bytes32) external pure returns (bool) { return true; }
    function verified(bytes32, bytes32, address, bytes32, bool) external pure returns (bool) { return true; }
    function settled(bytes32, bytes32, bytes32) external pure returns (bool) { return true; }
    function refunded(bytes32, bytes32) external pure returns (bool) { return true; }

    function recordDecision(
        address jobs_,
        bytes32 jobId,
        uint64 expectedRevision,
        bytes32 decisionRef,
        bool approved
    ) external {
        ComputeJobRegistry420(jobs_).recordVerification(
            jobId,
            expectedRevision,
            address(this),
            decisionRef,
            approved
        );
    }
}

contract SnapshotMatchMock420 is IComputeJobMatchEvidence420, IComputeAcceptedMatchRuntime420 {
    address public override jobs;
    bytes32 public resourceId;
    address public operator;
    bytes32 public matchId;
    bytes32 public acceptanceRef;
    mapping(bytes32 => bytes32) public acceptanceForJob;

    function configure(address jobs_, bytes32 resourceId_, address operator_) external {
        jobs = jobs_;
        resourceId = resourceId_;
        operator = operator_;
    }

    function matched(bytes32, bytes32, bytes32 candidateMatchId, bytes32)
        external
        view
        returns (bool)
    {
        return candidateMatchId == matchId && matchId != bytes32(0);
    }

    function accepted(bytes32 jobId, bytes32 candidateMatchId, bytes32 candidateAcceptanceRef)
        external
        view
        returns (bool)
    {
        bytes32 expectedAcceptance = acceptanceForJob[jobId];
        return candidateMatchId == matchId
            && candidateAcceptanceRef == expectedAcceptance
            && expectedAcceptance != bytes32(0);
    }

    function authorizedResource(
        bytes32 jobId,
        bytes32 candidateMatchId,
        bytes32 candidateAcceptanceRef,
        bytes32 candidateResourceId,
        address candidateOperator
    ) external view returns (bool) {
        bytes32 expectedAcceptance = acceptanceForJob[jobId];
        return candidateMatchId == matchId
            && candidateAcceptanceRef == expectedAcceptance
            && candidateResourceId == resourceId
            && candidateOperator == operator
            && expectedAcceptance != bytes32(0);
    }

    function matchParties(bytes32 candidateMatchId)
        external
        view
        returns (bytes32 jobId, address owner, address operator_, bool exists)
    {
        return (bytes32(0), address(0), operator, candidateMatchId == matchId);
    }

    function setMatch(bytes32 matchId_) external { matchId = matchId_; }

    function acceptIntoJob(bytes32 jobId, uint64 expectedRevision, bytes32 acceptanceRef_) external {
        acceptanceRef = acceptanceRef_;
        acceptanceForJob[jobId] = acceptanceRef_;
        ComputeJobRegistry420(jobs).recordAcceptance(jobId, expectedRevision, acceptanceRef_);
    }
}

contract SnapshotAdmissionMock420 is
    IComputeWorkerAttestationAdmission420,
    IComputeWorkerTrustAdmission420,
    IComputeWorkerStakeAdmission420
{
    bool public allow = true;
    function setAllow(bool allowed) external { allow = allowed; }

    function isAcceptable(bytes32, bytes32, uint64, bytes32, uint64, bytes32, bytes32, bytes32)
        external view returns (bool) { return allow; }

    function isEligible(bytes32, uint64, bytes32, bool, bytes32)
        external
        view
        override(IComputeWorkerTrustAdmission420, IComputeWorkerStakeAdmission420)
        returns (bool)
    {
        return allow;
    }
}

contract ComputeJobWorkerSnapshotEvidence420Test {
    VmWorkerSnapshot420 private constant vm =
        VmWorkerSnapshot420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant GOV = address(0x420);
    address private constant OWNER = address(0xB0B);
    address private constant OPERATOR = address(0xA11CE);
    uint256 private constant EXEC_KEY = 0xBEEF;
    uint256 private constant NEXT_EXEC_KEY = 0xCAFE;
    address private constant RELAYER = address(0xD311);

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
    SnapshotCapabilityRegistryMock420 private capabilities;
    ComputeAuthorization420 private authorization;
    SnapshotRequestFundingVerification420 private commonEvidence;
    SnapshotMatchMock420 private matchEvidence;
    SnapshotAdmissionMock420 private admission;
    ComputeJobWorkerSnapshotEvidence420 private workerEvidence;
    ComputeWorkerCapacityReservation420 private capacity;
    ComputeJobRegistry420 private jobs;

    bytes32 private resourceId;
    bytes32 private workerId;
    bytes32 private jobId;
    address private executionSigner;

    function setUp() public {
        executionSigner = vm.addr(EXEC_KEY);

        providers = new ComputeProviderRegistry420(GOV);
        nodes = new ComputeNodeRegistry420(address(providers), GOV);
        resources = new ComputeResourceRegistry420(address(nodes), GOV);
        capabilities = new SnapshotCapabilityRegistryMock420();
        authorization = new ComputeAuthorization420(address(capabilities));
        workers = new ComputeWorkerRegistry420(address(resources), address(authorization), GOV);
        commonEvidence = new SnapshotRequestFundingVerification420();
        matchEvidence = new SnapshotMatchMock420();
        admission = new SnapshotAdmissionMock420();
        capacity = new ComputeWorkerCapacityReservation420(address(workers));

        workerEvidence = new ComputeJobWorkerSnapshotEvidence420(
            address(matchEvidence),
            address(authorization),
            address(workers),
            address(admission),
            address(admission),
            address(admission),
            address(capacity)
        );

        jobs = new ComputeJobRegistry420(
            address(commonEvidence),
            address(commonEvidence),
            address(matchEvidence),
            address(workerEvidence),
            address(commonEvidence),
            address(commonEvidence)
        );

        bytes32 providerId;
        bytes32 nodeId;
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
            2
        );
        vm.prank(OPERATOR);
        resources.activate(resourceId);

        workerId = _registerWorker();
        vm.prank(OPERATOR);
        workers.activate(workerId);

        matchEvidence.configure(address(jobs), resourceId, OPERATOR);
        workerEvidence.bindJobs(address(jobs));
        capacity.bindController(address(workerEvidence));

        vm.prank(OWNER);
        jobId = jobs.createJob(
            keccak256("request"),
            keccak256("request-commitment"),
            MANIFEST,
            keccak256("workload"),
            keccak256("input"),
            keccak256("output-schema"),
            uint64(block.timestamp + 7 days)
        );

        vm.prank(OWNER);
        jobs.recordFunding(jobId, 1, keccak256("funding"));

        bytes32 matchId = keccak256("match");
        matchEvidence.setMatch(matchId);
        vm.prank(OWNER);
        jobs.recordMatch(jobId, 2, matchId);

        matchEvidence.acceptIntoJob(jobId, 3, keccak256("acceptance"));
    }

    function _registerWorker() private returns (bytes32 id) {
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
            WORKER_CAP,
            bytes32(0)
        );
        (uint8 v, bytes32 rr, bytes32 s) = vm.sign(EXEC_KEY, digest);
        bytes memory proof = abi.encodePacked(rr, s, v);
        vm.prank(OPERATOR);
        id = workers.register(resourceId, executionSigner, WORKER_CAP, bytes32(0), proof);
    }

    function _signExecution(uint256 key, bytes32 digest) private returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function _acceptedJob(bytes32 seed) private returns (bytes32 id) {
        vm.prank(OWNER);
        id = jobs.createJob(
            keccak256(abi.encode("request", seed)),
            keccak256(abi.encode("request-commitment", seed)),
            MANIFEST,
            keccak256("workload"),
            keccak256(abi.encode("input", seed)),
            keccak256("output-schema"),
            uint64(block.timestamp + 7 days)
        );
        vm.prank(OWNER);
        jobs.recordFunding(id, 1, keccak256(abi.encode("funding", seed)));
        bytes32 acceptedMatchId = matchEvidence.matchId();
        vm.prank(OWNER);
        jobs.recordMatch(id, 2, acceptedMatchId);
        matchEvidence.acceptIntoJob(id, 3, keccak256(abi.encode("acceptance", seed)));
    }

    function _emptyRefs()
        private
        pure
        returns (ComputeJobWorkerSnapshotEvidence420.AdmissionRefs memory refs)
    {}

    function _fullRefs()
        private
        pure
        returns (ComputeJobWorkerSnapshotEvidence420.AdmissionRefs memory refs)
    {
        refs = ComputeJobWorkerSnapshotEvidence420.AdmissionRefs({
            capabilityPolicyId: keccak256("cap-policy"),
            capabilityAttestationId: keccak256("cap-attestation"),
            trustPolicyId: keccak256("trust-policy"),
            trustReference: keccak256("trust-ref"),
            stakePolicyId: keccak256("stake-policy"),
            stakeReference: keccak256("stake-ref")
        });
    }

    function _assignJob(
        bytes32 targetJob,
        bytes32 targetWorker,
        uint256 signingKey,
        ComputeJobWorkerSnapshotEvidence420.AdmissionRefs memory refs
    ) private returns (bytes32 assignmentRef) {
        uint64 workerRevision = workers.worker(targetWorker).revision;
        bytes32 digest =
            workerEvidence.assignmentExecutionDigest(targetJob, targetWorker, workerRevision, 4, refs);
        bytes memory signature = _signExecution(signingKey, digest);
        vm.prank(RELAYER);
        assignmentRef = workerEvidence.acceptAssignment(
            targetJob,
            targetWorker,
            workerRevision,
            4,
            refs,
            signature
        );
    }

    function _assign(ComputeJobWorkerSnapshotEvidence420.AdmissionRefs memory refs)
        private
        returns (bytes32 assignmentRef)
    {
        assignmentRef = _assignJob(jobId, workerId, EXEC_KEY, refs);
    }

    function _commitJob(
        bytes32 targetJob,
        uint256 signingKey,
        bytes32 receiptHash,
        bytes32 outputHash
    ) private returns (bytes32 resultCommitment) {
        bytes32 digest = workerEvidence.resultExecutionDigest(targetJob, receiptHash, outputHash);
        bytes memory signature = _signExecution(signingKey, digest);
        vm.prank(RELAYER);
        resultCommitment = workerEvidence.commitResult(targetJob, receiptHash, outputHash, signature);
    }

    function _commit(bytes32 receiptHash, bytes32 outputHash) private returns (bytes32 resultCommitment) {
        resultCommitment = _commitJob(jobId, EXEC_KEY, receiptHash, outputHash);
    }

    function testAcceptedAssignmentFreezesExactWorkerExecutionSnapshot() public {
        uint64 workerRevision = workers.worker(workerId).revision;
        bytes32 assignmentRef = _assign(_fullRefs());
        ComputeJobWorkerSnapshotEvidence420.Assignment memory a =
            workerEvidence.getAssignment(assignmentRef);

        require(a.workerId == workerId && a.workerRevision == workerRevision, "worker revision not frozen");
        require(a.resourceId == resourceId && a.resourceRevision != 0, "resource revision not frozen");
        require(a.operator == OPERATOR && a.executionSigner == executionSigner, "execution identity not frozen");
        require(a.executionKeyCommitment != bytes32(0), "execution key commitment missing");
        require(a.capabilityProfileHash == WORKER_CAP, "capability commitment missing");
        require(a.snapshotCommitment != bytes32(0), "snapshot commitment missing");
        require(a.admission.trustReference == keccak256("trust-ref"), "trust ref not frozen");
        require(a.admission.stakeReference == keccak256("stake-ref"), "stake ref not frozen");
    }

    function testAdmissionPolicyFailureBlocksAssignmentWithoutMutation() public {
        admission.setAllow(false);
        uint64 workerRevision = workers.worker(workerId).revision;

        vm.prank(OPERATOR);
        (bool ok,) = address(workerEvidence).call(
            abi.encodeCall(
                workerEvidence.acceptAssignment,
                (jobId, workerId, workerRevision, uint64(4), _fullRefs(), bytes(""))
            )
        );
        require(!ok, "failed admission accepted");
        require(workerEvidence.assignmentForJob(jobId) == bytes32(0), "assignment mutated");
        require(jobs.job(jobId).status == ComputeJobRegistry420.Status.ACCEPTED, "job mutated");
    }

    function testMismatchedPolicyReferencePairsFailClosed() public {
        ComputeJobWorkerSnapshotEvidence420.AdmissionRefs memory refs = _emptyRefs();
        refs.trustPolicyId = keccak256("trust-policy");

        uint64 workerRevision = workers.worker(workerId).revision;
        vm.prank(OPERATOR);
        (bool ok,) = address(workerEvidence).call(
            abi.encodeCall(
                workerEvidence.acceptAssignment,
                (jobId, workerId, workerRevision, uint64(4), refs, bytes(""))
            )
        );
        require(!ok && workerEvidence.assignmentForJob(jobId) == bytes32(0), "partial trust ref accepted");
    }

    function testWrongWorkerRevisionOrResourceOperatorFailsClosed() public {
        uint64 workerRevision = workers.worker(workerId).revision;

        vm.prank(OPERATOR);
        (bool ok,) = address(workerEvidence).call(
            abi.encodeCall(
                workerEvidence.acceptAssignment,
                (jobId, workerId, workerRevision + 1, uint64(4), _emptyRefs(), bytes(""))
            )
        );
        require(!ok, "stale/future worker revision accepted");

        vm.prank(GOV);
        resources.suspend(resourceId);

        vm.prank(OPERATOR);
        (ok,) = address(workerEvidence).call(
            abi.encodeCall(
                workerEvidence.acceptAssignment,
                (jobId, workerId, workerRevision, uint64(4), _emptyRefs(), bytes(""))
            )
        );
        require(!ok, "unavailable resource accepted");
    }

    function testPostAssignmentWorkerMutationCannotRewriteHistoricalSnapshot() public {
        bytes32 assignmentRef = _assign(_emptyRefs());
        ComputeJobWorkerSnapshotEvidence420.Assignment memory beforeA =
            workerEvidence.getAssignment(assignmentRef);

        vm.prank(OPERATOR);
        workers.refreshProfile(workerId, keccak256("worker-capability-v2"), bytes32(0));
        vm.prank(OPERATOR);
        workers.activate(workerId);

        ComputeJobWorkerSnapshotEvidence420.Assignment memory afterA =
            workerEvidence.getAssignment(assignmentRef);
        require(afterA.workerRevision == beforeA.workerRevision, "historical worker revision rewritten");
        require(afterA.capabilityProfileHash == beforeA.capabilityProfileHash, "historical capability rewritten");
        require(afterA.executionKeyCommitment == beforeA.executionKeyCommitment, "historical key rewritten");
        require(afterA.snapshotCommitment == beforeA.snapshotCommitment, "snapshot rewritten");
    }

    function testRunningJobResultSurvivesLaterWorkerOrResourceSuspension() public {
        bytes32 assignmentRef = _assign(_emptyRefs());

        vm.prank(OPERATOR);
        workers.suspend(workerId);
        vm.prank(OPERATOR);
        resources.suspend(resourceId);

        bytes32 resultCommitment = _commit(keccak256("receipt"), keccak256("output"));

        require(resultCommitment != bytes32(0), "result not committed");
        vm.prank(OPERATOR);
        jobs.recordResult(jobId, 5, resultCommitment);

        require(
            jobs.job(jobId).status == ComputeJobRegistry420.Status.RESULT_COMMITTED,
            "accepted running job stranded by later suspension"
        );
        require(workerEvidence.assignmentForJob(jobId) == assignmentRef, "assignment changed");
    }

    function testDuplicateAssignmentAndResultReplayFailClosed() public {
        bytes32 assignmentRef = _assign(_emptyRefs());
        uint64 workerRevision = workers.worker(workerId).revision;

        vm.prank(OPERATOR);
        (bool ok,) = address(workerEvidence).call(
            abi.encodeCall(
                workerEvidence.acceptAssignment,
                (jobId, workerId, workerRevision, uint64(5), _emptyRefs(), bytes(""))
            )
        );
        require(!ok, "duplicate assignment accepted");

        bytes32 resultCommitment = _commit(keccak256("receipt"), keccak256("output"));
        require(resultCommitment != bytes32(0), "initial result failed");

        vm.prank(RELAYER);
        (ok,) = address(workerEvidence).call(
            abi.encodeCall(
                workerEvidence.commitResult,
                (jobId, keccak256("receipt-2"), keccak256("output-2"), bytes(""))
            )
        );
        require(!ok, "duplicate result accepted");
        require(workerEvidence.assignmentForJob(jobId) == assignmentRef, "assignment replay mutated");
    }

    function testAuthorizationRevocationBlocksNewResultSubmission() public {
        _assign(_emptyRefs());
        capabilities.setAllow(false);

        vm.prank(OPERATOR);
        (bool ok,) = address(workerEvidence).call(
            abi.encodeCall(
                workerEvidence.commitResult,
                (jobId, keccak256("receipt"), keccak256("output"), bytes(""))
            )
        );
        require(!ok, "revoked submit authorization ignored");
        require(jobs.job(jobId).status == ComputeJobRegistry420.Status.RUNNING, "job state mutated");
    }
    function testIndependentExecutionKeyAllowsRelayedAcceptedWorkAndResult() public {
        ComputeJobWorkerSnapshotEvidence420.AdmissionRefs memory refs = _emptyRefs();
        uint64 workerRevision = workers.worker(workerId).revision;
        bytes32 assignmentDigest =
            workerEvidence.assignmentExecutionDigest(jobId, workerId, workerRevision, 4, refs);
        bytes memory assignmentSignature = _signExecution(EXEC_KEY, assignmentDigest);

        vm.prank(RELAYER);
        bytes32 assignmentRef = workerEvidence.acceptAssignment(
            jobId, workerId, workerRevision, 4, refs, assignmentSignature
        );
        require(assignmentRef != bytes32(0), "relayed signed assignment failed");

        bytes32 receiptHash = keccak256("relayed-receipt");
        bytes32 outputHash = keccak256("relayed-output");
        bytes32 resultDigest = workerEvidence.resultExecutionDigest(jobId, receiptHash, outputHash);
        bytes memory resultSignature = _signExecution(EXEC_KEY, resultDigest);

        vm.prank(address(0xFEED));
        bytes32 result = workerEvidence.commitResult(jobId, receiptHash, outputHash, resultSignature);
        require(result != bytes32(0), "relayed signed result failed");
    }

    function testWrongExecutionKeyAndCrossChainReplayFailClosed() public {
        ComputeJobWorkerSnapshotEvidence420.AdmissionRefs memory refs = _emptyRefs();
        uint64 workerRevision = workers.worker(workerId).revision;
        bytes32 digest = workerEvidence.assignmentExecutionDigest(jobId, workerId, workerRevision, 4, refs);

        bytes memory wrongKeySignature = _signExecution(NEXT_EXEC_KEY, digest);
        vm.prank(RELAYER);
        (bool ok,) = address(workerEvidence).call(
            abi.encodeCall(
                workerEvidence.acceptAssignment,
                (jobId, workerId, workerRevision, uint64(4), refs, wrongKeySignature)
            )
        );
        require(!ok && workerEvidence.assignmentForJob(jobId) == bytes32(0), "wrong key admitted");

        bytes memory oldChainSignature = _signExecution(EXEC_KEY, digest);
        uint256 originalChain = block.chainid;
        vm.chainId(originalChain + 1);
        vm.prank(RELAYER);
        (ok,) = address(workerEvidence).call(
            abi.encodeCall(
                workerEvidence.acceptAssignment,
                (jobId, workerId, workerRevision, uint64(4), refs, oldChainSignature)
            )
        );
        vm.chainId(originalChain);
        require(!ok && workerEvidence.assignmentForJob(jobId) == bytes32(0), "cross-chain replay admitted");
    }

    function testCrossJobAndCrossWorkerExecutionSignaturesCannotReplay() public {
        ComputeJobWorkerSnapshotEvidence420.AdmissionRefs memory refs = _emptyRefs();
        uint64 workerRevision = workers.worker(workerId).revision;
        bytes32 digest = workerEvidence.assignmentExecutionDigest(jobId, workerId, workerRevision, 4, refs);
        bytes memory signature = _signExecution(EXEC_KEY, digest);

        bytes32 otherJob = _acceptedJob(keccak256("other-job"));
        vm.prank(RELAYER);
        (bool ok,) = address(workerEvidence).call(
            abi.encodeCall(
                workerEvidence.acceptAssignment,
                (otherJob, workerId, workerRevision, uint64(4), refs, signature)
            )
        );
        require(!ok && workerEvidence.assignmentForJob(otherJob) == bytes32(0), "cross-job replay admitted");

        bytes32 otherWorker = _registerWorker();
        vm.prank(OPERATOR);
        workers.activate(otherWorker);
        uint64 otherRevision = workers.worker(otherWorker).revision;
        vm.prank(RELAYER);
        (ok,) = address(workerEvidence).call(
            abi.encodeCall(
                workerEvidence.acceptAssignment,
                (jobId, otherWorker, otherRevision, uint64(4), refs, signature)
            )
        );
        require(!ok && workerEvidence.assignmentForJob(jobId) == bytes32(0), "cross-worker replay admitted");
    }

    function testStaleRevisionAndDuplicateAttemptReplayFailClosed() public {
        ComputeJobWorkerSnapshotEvidence420.AdmissionRefs memory refs = _emptyRefs();
        uint64 oldRevision = workers.worker(workerId).revision;
        bytes32 oldDigest = workerEvidence.assignmentExecutionDigest(jobId, workerId, oldRevision, 4, refs);
        bytes memory oldSignature = _signExecution(EXEC_KEY, oldDigest);

        vm.prank(OPERATOR);
        workers.refreshProfile(workerId, keccak256("worker-capability-v3"), bytes32(0));
        vm.prank(OPERATOR);
        workers.activate(workerId);

        vm.prank(RELAYER);
        (bool ok,) = address(workerEvidence).call(
            abi.encodeCall(
                workerEvidence.acceptAssignment,
                (jobId, workerId, oldRevision, uint64(4), refs, oldSignature)
            )
        );
        require(!ok, "stale worker revision signature admitted");

        uint64 currentRevision = workers.worker(workerId).revision;
        bytes32 freshDigest =
            workerEvidence.assignmentExecutionDigest(jobId, workerId, currentRevision, 4, refs);
        bytes memory freshSignature = _signExecution(EXEC_KEY, freshDigest);
        vm.prank(RELAYER);
        workerEvidence.acceptAssignment(jobId, workerId, currentRevision, 4, refs, freshSignature);

        vm.prank(RELAYER);
        (ok,) = address(workerEvidence).call(
            abi.encodeCall(
                workerEvidence.acceptAssignment,
                (jobId, workerId, currentRevision, uint64(5), refs, freshSignature)
            )
        );
        require(!ok, "duplicate attempt replay admitted");
    }

    function testRotationBlocksRetiredKeyForNewWorkButPreservesFrozenAcceptedKey() public {
        _assign(_emptyRefs());

        address nextSigner = vm.addr(NEXT_EXEC_KEY);
        bytes32 rotationDigest = workers.rotationDigest(workerId, nextSigner);
        bytes memory rotationProof = _signExecution(NEXT_EXEC_KEY, rotationDigest);
        vm.prank(OPERATOR);
        workers.rotateExecutionKey(workerId, nextSigner, rotationProof);
        vm.prank(OPERATOR);
        workers.activate(workerId);

        bytes32 receiptHash = keccak256("post-rotation-receipt");
        bytes32 outputHash = keccak256("post-rotation-output");
        bytes32 resultDigest = workerEvidence.resultExecutionDigest(jobId, receiptHash, outputHash);
        bytes memory frozenOldKeySignature = _signExecution(EXEC_KEY, resultDigest);
        vm.prank(RELAYER);
        bytes32 result =
            workerEvidence.commitResult(jobId, receiptHash, outputHash, frozenOldKeySignature);
        require(result != bytes32(0), "rotation rewrote frozen accepted key");

        bytes32 newJob = _acceptedJob(keccak256("post-rotation-job"));
        uint64 newRevision = workers.worker(workerId).revision;
        bytes32 newDigest =
            workerEvidence.assignmentExecutionDigest(newJob, workerId, newRevision, 4, _emptyRefs());
        bytes memory retiredKeySignature = _signExecution(EXEC_KEY, newDigest);
        vm.prank(RELAYER);
        (bool ok,) = address(workerEvidence).call(
            abi.encodeCall(
                workerEvidence.acceptAssignment,
                (newJob, workerId, newRevision, uint64(4), _emptyRefs(), retiredKeySignature)
            )
        );
        require(!ok, "retired execution key authorized new work");
    }

    function testExecutionKeySignatureDoesNotGrantLifecycleOrSettlementAuthority() public {
        _assign(_emptyRefs());
        capabilities.setAllow(false);

        vm.prank(executionSigner);
        (bool ok,) = address(workers).call(abi.encodeCall(workers.suspend, (workerId)));
        require(!ok, "execution key gained worker lifecycle authority");

        bytes32 receiptHash = keccak256("blocked-receipt");
        bytes32 outputHash = keccak256("blocked-output");
        bytes32 resultDigest = workerEvidence.resultExecutionDigest(jobId, receiptHash, outputHash);
        bytes memory signature = _signExecution(EXEC_KEY, resultDigest);
        vm.prank(RELAYER);
        (ok,) = address(workerEvidence).call(
            abi.encodeCall(
                workerEvidence.commitResult,
                (jobId, receiptHash, outputHash, signature)
            )
        );
        require(!ok, "execution signature bypassed operator submit capability");
    }


    function testCapacityReservationIsExactRevisionBoundAndReconstructable() public {
        bytes32 assignmentRef = _assign(_emptyRefs());
        ComputeJobWorkerSnapshotEvidence420.Assignment memory a =
            workerEvidence.getAssignment(assignmentRef);
        ComputeWorkerCapacityReservation420.Reservation memory r =
            capacity.reservation(a.reservationId);
        bytes32 expectedId = capacity.deriveReservationId(
            jobId,
            assignmentRef,
            workerId,
            a.workerRevision,
            resourceId,
            a.resourceRevision,
            4
        );

        require(a.reservationId == expectedId, "reservation id not reconstructable");
        require(r.jobId == jobId && r.assignmentRef == assignmentRef, "job/assignment not bound");
        require(r.workerId == workerId && r.workerRevision == a.workerRevision, "worker revision not bound");
        require(r.resourceId == resourceId && r.resourceRevision == a.resourceRevision, "resource revision not bound");
        require(r.units == 1 && r.capacityLimit == 2, "capacity-unit semantics wrong");
        require(capacity.liveResourceUnits(resourceId) == 1, "resource counter wrong");
        require(capacity.liveWorkerUnits(workerId) == 1, "worker counter wrong");
    }

    function testCapacityExhaustionRejectsThirdConcurrentJobAtomically() public {
        _assign(_emptyRefs());
        bytes32 secondJob = _acceptedJob(keccak256("capacity-second"));
        _assignJob(secondJob, workerId, EXEC_KEY, _emptyRefs());

        bytes32 thirdJob = _acceptedJob(keccak256("capacity-third"));
        uint64 workerRevision = workers.worker(workerId).revision;
        bytes32 digest = workerEvidence.assignmentExecutionDigest(
            thirdJob, workerId, workerRevision, 4, _emptyRefs()
        );
        bytes memory signature = _signExecution(EXEC_KEY, digest);

        vm.prank(RELAYER);
        (bool ok,) = address(workerEvidence).call(
            abi.encodeCall(
                workerEvidence.acceptAssignment,
                (thirdJob, workerId, workerRevision, uint64(4), _emptyRefs(), signature)
            )
        );

        require(!ok, "oversubscribed third job accepted");
        require(workerEvidence.assignmentForJob(thirdJob) == bytes32(0), "failed job got assignment");
        require(capacity.reservationForJob(thirdJob) == bytes32(0), "failed job got reservation");
        require(capacity.liveResourceUnits(resourceId) == 2, "failed reserve changed resource counter");
        require(capacity.liveWorkerUnits(workerId) == 2, "failed reserve changed worker counter");
        require(jobs.job(thirdJob).status == ComputeJobRegistry420.Status.ACCEPTED, "failed reserve mutated job");
    }

}
