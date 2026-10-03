// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeCapacityAwareAssignment420.sol";
import "../src/compute/ComputeJobWorkerSnapshotEvidence420.sol";
import "../src/compute/ComputeWorkerCapacityReservation420.sol";
import "../src/system/CapabilityRegistry420.sol";
import "../src/interfaces/genesis/ICapabilityRegistry420.sol";

interface VmCMP25 {
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8, bytes32, bytes32);
    function prank(address caller) external;
}

contract CMP25CapabilityMock is ICapabilityRegistry420 {
    function grant(bytes32) external pure returns (CapabilityGrant memory out) { return out; }
    function isAuthorized(address, bytes32, bytes32, bytes32, uint256)
        external pure returns (bool) { return true; }
}

contract CMP25CommonEvidence is
    IComputeJobFundingEvidence420,
    IComputeJobVerificationEvidence420,
    IComputeJobSettlementEvidence420,
    IComputeJobRefundEvidence420
{
    function funded(bytes32, address, bytes32) external pure returns (bool) { return true; }
    function verified(bytes32, bytes32, address, bytes32, bool) external pure returns (bool) { return true; }
    function settled(bytes32, bytes32, bytes32) external pure returns (bool) { return true; }
    function refunded(bytes32, bytes32) external pure returns (bool) { return true; }
}

contract CMP25AdmissionMock is
    IComputeWorkerAttestationAdmission420,
    IComputeWorkerTrustAdmission420,
    IComputeWorkerStakeAdmission420
{
    function isAcceptable(bytes32, bytes32, uint64, bytes32, uint64, bytes32, bytes32, bytes32)
        external pure returns (bool) { return true; }
    function isEligible(bytes32, uint64, bytes32, bool, bytes32)
        external pure
        override(IComputeWorkerTrustAdmission420, IComputeWorkerStakeAdmission420)
        returns (bool) { return true; }
}

contract ComputeCapacityAwareAssignment420Test {
    VmCMP25 private constant vm =
        VmCMP25(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant OWNER_KEY = 0xA11CE;
    uint256 private constant PAYER_KEY = 0xBEEF;
    uint256 private constant EXEC_KEY = 0xCAFE;
    address private constant GOV = address(0x420);
    address private constant OPERATOR = address(0xC0FFEE);
    address private constant BENEFICIARY = address(0xFEE1);
    address private constant SCHEDULER = address(0x5A);
    address private constant RELAYER = address(0xD311);

    bytes32 private constant MANIFEST = keccak256("cmp-2.5/manifest");
    bytes32 private constant WORKLOAD = keccak256("cmp-2.5/workload");
    bytes32 private constant INPUT = keccak256("cmp-2.5/input");
    bytes32 private constant OUTPUT = keccak256("cmp-2.5/output");
    bytes32 private constant HARDWARE = keccak256("cmp-2.5/hardware");
    bytes32 private constant RUNTIME = keccak256("cmp-2.5/runtime");
    bytes32 private constant CAPABILITY = keccak256("cmp-2.5/capability");
    bytes32 private constant WORKER_CAPABILITY = keccak256("cmp-2.5/worker-capability");
    bytes32 private constant JURISDICTION = keccak256("CA-SK");
    bytes32 private constant PRICING = keccak256("cmp-2.5/fixed/native-420/v1");

    address private owner;
    address private payer;
    address private executionSigner;

    CMP25CapabilityMock private caps;
    ComputeAuthorization420 private auth;
    ComputeJobSignedRequestAuthority420 private signedRequests;
    ComputeRequestRegistry420 private requests;
    ComputeProviderRegistry420 private providers;
    ComputeNodeRegistry420 private nodes;
    ComputeResourceRegistry420 private resources;
    ComputeOfferRegistry420 private offers;
    ComputeMatch420 private market;
    ComputeCapacityAwareAssignment420 private assignment;
    ComputeWorkerRegistry420 private workers;
    ComputeWorkerCapacityReservation420 private capacity;
    CMP25AdmissionMock private admission;
    ComputeJobWorkerSnapshotEvidence420 private workerEvidence;
    CMP25CommonEvidence private common;
    ComputeJobRegistry420 private jobs;

    bytes32 private resourceId;
    bytes32 private offerId;
    bytes32 private workerId;
    uint256 private requestNonce;

    function setUp() public {
        owner = vm.addr(OWNER_KEY);
        payer = vm.addr(PAYER_KEY);
        executionSigner = vm.addr(EXEC_KEY);

        caps = new CMP25CapabilityMock();
        auth = new ComputeAuthorization420(address(caps));
        signedRequests = new ComputeJobSignedRequestAuthority420();
        requests = new ComputeRequestRegistry420(address(signedRequests), address(auth));

        providers = new ComputeProviderRegistry420(GOV);
        nodes = new ComputeNodeRegistry420(address(providers), GOV);
        resources = new ComputeResourceRegistry420(address(nodes), GOV);
        offers = new ComputeOfferRegistry420(address(resources), address(auth));
        market = new ComputeMatch420(address(requests), address(offers), address(auth));
        assignment = new ComputeCapacityAwareAssignment420(address(market));

        vm.prank(OPERATOR);
        bytes32 providerId = providers.register(MANIFEST, keccak256("security"), BENEFICIARY);
        vm.prank(GOV);
        providers.activate(providerId);
        vm.prank(OPERATOR);
        bytes32 nodeId = nodes.register(
            providerId, MANIFEST, keccak256("endpoint"), uint64(block.timestamp + 7 days)
        );
        vm.prank(OPERATOR);
        nodes.activate(nodeId);
        vm.prank(OPERATOR);
        resourceId = resources.register(
            nodeId, resources.GPU_INFERENCE(), HARDWARE, RUNTIME, CAPABILITY, 1
        );
        vm.prank(OPERATOR);
        resources.activate(resourceId);
        vm.prank(OPERATOR);
        offerId = offers.publishWorkerOffer(
            resourceId, JURISDICTION, uint64(block.timestamp),
            uint64(block.timestamp + 2 days), PRICING, 1, 3 ether
        );

        workers = new ComputeWorkerRegistry420(address(resources), address(auth), GOV);
        workerId = _registerWorker();
        vm.prank(OPERATOR);
        workers.activate(workerId);
        capacity = new ComputeWorkerCapacityReservation420(address(workers));
        admission = new CMP25AdmissionMock();
        workerEvidence = new ComputeJobWorkerSnapshotEvidence420(
            address(assignment), address(auth), address(workers),
            address(admission), address(admission), address(admission), address(capacity)
        );
        common = new CMP25CommonEvidence();
        jobs = new ComputeJobRegistry420(
            address(requests), address(common), address(assignment), address(workerEvidence),
            address(common), address(common)
        );
        assignment.bindJobs(address(jobs));
        workerEvidence.bindJobs(address(jobs));
        capacity.bindController(address(workerEvidence));
    }

    function _sign(uint256 key, bytes32 digest) private returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function _registerWorker() private returns (bytes32 id) {
        ComputeResourceRegistry420.Resource memory r = resources.resource(resourceId);
        uint64 serial = workers.nextSerial() + 1;
        bytes32 digest = workers.registrationDigest(
            serial, r.providerId, r.nodeId, resourceId, r.revision, OPERATOR,
            executionSigner, WORKER_CAPABILITY, JURISDICTION
        );
        vm.prank(OPERATOR);
        id = workers.register(
            resourceId, executionSigner, WORKER_CAPABILITY, JURISDICTION, _sign(EXEC_KEY, digest)
        );
    }

    function _terms(uint256 maximumPrice)
        private view returns (ComputeRequestRegistry420.Terms memory t)
    {
        ComputeRequestRegistry420.PolicyRef memory generic =
            ComputeRequestRegistry420.PolicyRef(
                keccak256("cmp-2.5/generic-policy"), 1, keccak256("cmp-2.5/generic-commitment")
            );
        ComputeRequestRegistry420.PolicyRef memory pricing =
            ComputeRequestRegistry420.PolicyRef(PRICING, 1, keccak256("cmp-2.5/pricing-commitment"));
        t = ComputeRequestRegistry420.Terms({
            resourceClass: resources.GPU_INFERENCE(),
            runtimeHash: RUNTIME,
            capabilityHash: CAPABILITY,
            verification: generic,
            privacy: generic,
            jurisdictionHash: JURISDICTION,
            dataAccessHash: keccak256("cmp-2.5/data"),
            partitionPlanHash: keccak256("cmp-2.5/plan"),
            partitionCount: 1,
            replicationFactor: 1,
            capacityUnits: 1,
            pricing: pricing,
            sla: generic,
            deadline: uint64(block.timestamp + 2 days),
            expiresAt: uint64(block.timestamp + 1 days),
            maximumPrice: maximumPrice,
            fundingReference: keccak256("cmp-2.5/funding")
        });
    }

    function _marketRequest() private returns (bytes32 requestId) {
        requestNonce++;
        ComputeJobSignedRequestAuthority420.Authorization memory a =
            ComputeJobSignedRequestAuthority420.Authorization({
                owner: owner,
                payer: payer,
                manifestHash: MANIFEST,
                workloadType: WORKLOAD,
                inputCommitment: INPUT,
                outputSchemaCommitment: OUTPUT,
                deadline: uint64(block.timestamp + 2 days),
                authorizationExpiry: uint64(block.timestamp + 3 days),
                maxSpend: 5 ether,
                nonce: requestNonce
            });
        bytes32 digest = signedRequests.authorizationDigest(a);
        vm.prank(owner);
        bytes32 signedId = signedRequests.registerSignedRequest(
            a, _sign(OWNER_KEY, digest), _sign(PAYER_KEY, digest)
        );
        vm.prank(owner);
        requestId = requests.createRequest(signedId, _terms(5 ether));
    }

    function _acceptedMarketMatch(bytes32 requestId) private returns (bytes32 matchId) {
        vm.prank(SCHEDULER);
        bytes32 proposalId = market.propose(requestId, offerId);
        vm.prank(owner);
        matchId = market.accept(proposalId, 1, 1);
    }

    function _acceptedJob() private returns (bytes32 jobId, bytes32 matchId) {
        bytes32 requestId = _marketRequest();
        matchId = _acceptedMarketMatch(requestId);
        ComputeRequestRegistry420.Request memory r = requests.request(requestId);

        vm.prank(owner);
        jobId = jobs.createJob(
            requestId,
            requests.commitment(requestId, r.revision),
            r.manifestHash,
            r.workloadType,
            r.inputCommitment,
            r.outputSchemaCommitment,
            r.terms.deadline
        );
        vm.prank(owner);
        jobs.recordFunding(jobId, 1, keccak256(abi.encode("funding", jobId)));
        vm.prank(owner);
        assignment.linkAcceptedMatch(jobId, matchId);
        vm.prank(owner);
        jobs.recordMatch(jobId, 2, matchId);
        vm.prank(owner);
        assignment.acceptIntoJob(jobId, 3);
    }

    function _emptyRefs()
        private pure returns (ComputeJobWorkerSnapshotEvidence420.AdmissionRefs memory refs)
    {}

    function _assign(bytes32 jobId) private returns (bytes32 assignmentRef) {
        uint64 workerRevision = workers.worker(workerId).revision;
        bytes32 digest =
            workerEvidence.assignmentExecutionDigest(jobId, workerId, workerRevision, 4, _emptyRefs());
        vm.prank(RELAYER);
        assignmentRef = workerEvidence.acceptAssignment(
            jobId, workerId, workerRevision, 4, _emptyRefs(), _sign(EXEC_KEY, digest)
        );
    }

    function testAcceptedMarketMatchConsumesCmp13ReservationAtomicallyAtWorkerAssignment() public {
        (bytes32 jobId, bytes32 matchId) = _acceptedJob();
        bytes32 assignmentRef = _assign(jobId);
        ComputeJobWorkerSnapshotEvidence420.Assignment memory a =
            workerEvidence.getAssignment(assignmentRef);
        ComputeWorkerCapacityReservation420.Reservation memory reservation =
            capacity.reservation(a.reservationId);

        require(jobs.job(jobId).status == ComputeJobRegistry420.Status.RUNNING, "job not running");
        require(reservation.jobId == jobId && reservation.assignmentRef == assignmentRef, "reservation identity");
        require(reservation.resourceId == resourceId && reservation.units == 1, "capacity snapshot");
        require(reservation.status == ComputeWorkerCapacityReservation420.Status.RESERVED, "capacity not live");
        require(capacity.liveResourceUnits(resourceId) == 1, "resource capacity not consumed");
        require(assignment.marketMatchForJob(jobId) == matchId, "market match link lost");
    }

    function testCapacityExhaustionRevertsAssignmentWithoutPartialMutation() public {
        (bytes32 firstJob,) = _acceptedJob();
        _assign(firstJob);
        (bytes32 secondJob,) = _acceptedJob();

        uint64 workerRevision = workers.worker(workerId).revision;
        bytes32 digest =
            workerEvidence.assignmentExecutionDigest(secondJob, workerId, workerRevision, 4, _emptyRefs());
        vm.prank(RELAYER);
        (bool ok,) = address(workerEvidence).call(
            abi.encodeCall(
                workerEvidence.acceptAssignment,
                (secondJob, workerId, workerRevision, uint64(4), _emptyRefs(), _sign(EXEC_KEY, digest))
            )
        );

        require(!ok, "over-capacity assignment accepted");
        require(jobs.job(secondJob).status == ComputeJobRegistry420.Status.ACCEPTED, "job partially advanced");
        require(workerEvidence.assignmentForJob(secondJob) == bytes32(0), "assignment stranded");
        require(capacity.reservationForJob(secondJob) == bytes32(0), "reservation stranded");
        require(capacity.liveResourceUnits(resourceId) == 1, "capacity counter corrupted");
    }

    function testSchedulerCannotLinkJobOrReserveCapacityDirectly() public {
        bytes32 requestId = _marketRequest();
        bytes32 matchId = _acceptedMarketMatch(requestId);
        ComputeRequestRegistry420.Request memory r = requests.request(requestId);
        vm.prank(owner);
        bytes32 jobId = jobs.createJob(
            requestId, requests.commitment(requestId, 1), r.manifestHash, r.workloadType,
            r.inputCommitment, r.outputSchemaCommitment, r.terms.deadline
        );
        vm.prank(owner);
        jobs.recordFunding(jobId, 1, keccak256("funding"));

        vm.prank(SCHEDULER);
        (bool ok,) = address(assignment).call(
            abi.encodeCall(assignment.linkAcceptedMatch, (jobId, matchId))
        );
        require(!ok && assignment.marketMatchForJob(jobId) == bytes32(0), "scheduler linked assignment");

        vm.prank(SCHEDULER);
        (ok,) = address(capacity).call(
            abi.encodeCall(
                capacity.reserve,
                (
                    jobId, keccak256("assignment"), workerId, workers.worker(workerId).revision,
                    resourceId, resources.resource(resourceId).revision, uint64(4),
                    uint64(block.timestamp + 1 days)
                )
            )
        );
        require(!ok && capacity.liveResourceUnits(resourceId) == 0, "scheduler reserved capacity");
    }

    function testResourceRevisionDriftBlocksJobLinkBeforeCapacityMutation() public {
        bytes32 requestId = _marketRequest();
        bytes32 matchId = _acceptedMarketMatch(requestId);
        ComputeRequestRegistry420.Request memory r = requests.request(requestId);
        vm.prank(owner);
        bytes32 jobId = jobs.createJob(
            requestId, requests.commitment(requestId, 1), r.manifestHash, r.workloadType,
            r.inputCommitment, r.outputSchemaCommitment, r.terms.deadline
        );
        vm.prank(owner);
        jobs.recordFunding(jobId, 1, keccak256("funding"));

        vm.prank(OPERATOR);
        resources.update(resourceId, HARDWARE, RUNTIME, CAPABILITY, 1);
        vm.prank(OPERATOR);
        resources.activate(resourceId);

        vm.prank(owner);
        (bool ok,) = address(assignment).call(
            abi.encodeCall(assignment.linkAcceptedMatch, (jobId, matchId))
        );
        require(!ok, "stale accepted resource linked");
        require(capacity.liveResourceUnits(resourceId) == 0, "capacity mutated on stale link");
    }

    function testMarketRequestExposesExactJobRegistryEvidenceOnly() public {
        bytes32 requestId = _marketRequest();
        ComputeRequestRegistry420.Request memory r = requests.request(requestId);
        bytes32 commitment = requests.commitment(requestId, r.revision);
        require(
            requests.validRequest(
                requestId, owner, commitment, r.manifestHash, r.workloadType,
                r.inputCommitment, r.outputSchemaCommitment, r.terms.deadline
            ),
            "exact request evidence rejected"
        );
        require(
            !requests.validRequest(
                requestId, owner, keccak256("wrong"), r.manifestHash, r.workloadType,
                r.inputCommitment, r.outputSchemaCommitment, r.terms.deadline
            ),
            "wrong request commitment accepted"
        );
    }
}
