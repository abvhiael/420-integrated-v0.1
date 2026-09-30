// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeWorkerReadModel420.sol";
import "../src/compute/ComputeProviderRegistry420.sol";
import "../src/compute/ComputeNodeRegistry420.sol";
import "../src/compute/ComputeResourceRegistry420.sol";
import "../src/compute/ComputeWorkerAttestedEligibility420.sol";
import "../src/compute/ComputeAuthorization420.sol";
import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/interfaces/ITrust420.sol";
import "../src/interfaces/IComputeStakeSource420.sol";

interface VmComputeRead420 {
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8, bytes32, bytes32);
    function prank(address caller) external;
}

contract ReadCapabilityRegistryMock420 is ICapabilityRegistry420 {
    function grant(bytes32) external pure returns (CapabilityGrant memory out) { return out; }
    function isAuthorized(address, bytes32, bytes32, bytes32, uint256)
        external pure returns (bool) { return true; }
}

contract ReadTrustSourceMock420 is ITrust420 {
    bytes32 public immutable domainId;
    bytes32 public immutable unitId;
    constructor(bytes32 domainId_, bytes32 unitId_) {
        domainId = domainId_;
        unitId = unitId_;
    }

    function readMetric(bytes32, bytes32, bytes32)
        external
        view
        returns (MetricRead memory out)
    {
        out = MetricRead({
            domainId: domainId,
            unitId: unitId,
            metricRevision: 1,
            metricActive: true,
            total: 100,
            activeSignals: 5
        });
    }
}

contract ReadStakeSourceMock420 is IComputeStakeSource420 {
    function computeStakeSourceId() external pure returns (bytes32) {
        return keccak256("420Integrated.ComputeMarket.ComputeStakeSource.v1");
    }

    function readWorkerPosition(bytes32 workerId, bytes32 stakePolicyId)
        external
        pure
        returns (PositionRead memory out)
    {
        out = PositionRead({
            positionId: keccak256(abi.encode("position", workerId, stakePolicyId)),
            positionRevision: 1,
            activeAmount: 100 ether,
            slashableAmount: 50 ether,
            active: true,
            exiting: false,
            withdrawableAt: 0
        });
    }
}

contract ReadJobEvidenceMock420 is
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
}

contract ReadMatchMock420 is IComputeJobMatchEvidence420, IComputeAcceptedMatchRuntime420 {
    address public override jobs;
    bytes32 public resourceId;
    address public operator;
    bytes32 public matchId;
    mapping(bytes32 => bytes32) public acceptanceForJob;

    function configure(address jobs_, bytes32 resourceId_, address operator_) external {
        jobs = jobs_;
        resourceId = resourceId_;
        operator = operator_;
    }

    function matched(bytes32, bytes32, bytes32 candidateMatchId, bytes32)
        external view returns (bool)
    {
        return candidateMatchId == matchId && matchId != bytes32(0);
    }

    function accepted(bytes32 jobId, bytes32 candidateMatchId, bytes32 candidateAcceptanceRef)
        external view returns (bool)
    {
        return candidateMatchId == matchId
            && candidateAcceptanceRef == acceptanceForJob[jobId]
            && candidateAcceptanceRef != bytes32(0);
    }

    function authorizedResource(
        bytes32 jobId,
        bytes32 candidateMatchId,
        bytes32 candidateAcceptanceRef,
        bytes32 candidateResourceId,
        address candidateOperator
    ) external view returns (bool) {
        return candidateMatchId == matchId
            && candidateAcceptanceRef == acceptanceForJob[jobId]
            && candidateResourceId == resourceId
            && candidateOperator == operator
            && candidateAcceptanceRef != bytes32(0);
    }

    function matchParties(bytes32 candidateMatchId)
        external
        view
        returns (bytes32 jobId, address owner, address operator_, bool exists)
    {
        return (bytes32(0), address(0), operator, candidateMatchId == matchId);
    }

    function setMatch(bytes32 matchId_) external { matchId = matchId_; }

    function acceptIntoJob(bytes32 jobId, uint64 expectedRevision, bytes32 acceptanceRef) external {
        acceptanceForJob[jobId] = acceptanceRef;
        ComputeJobRegistry420(jobs).recordAcceptance(jobId, expectedRevision, acceptanceRef);
    }
}

contract ComputeWorkerReadModel420Test {
    VmComputeRead420 private constant vm =
        VmComputeRead420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant GOV = address(0x420);
    address private constant OWNER = address(0xB0B);
    address private constant OPERATOR = address(0xA11CE);
    address private constant ATTESTER = address(0xA77E57);
    address private constant RELAYER = address(0xD311);
    uint256 private constant EXEC_KEY = 0xBEEF;

    bytes32 private constant CAP_POLICY = keccak256("cap-policy");
    bytes32 private constant TRUST_POLICY = keccak256("trust-policy");
    bytes32 private constant STAKE_POLICY = keccak256("stake-policy");
    bytes32 private constant TRUST_SUBJECT = keccak256("worker");
    bytes32 private constant TRUST_METRIC = keccak256("reliability");
    bytes32 private constant TRUST_DOMAIN = keccak256("compute");
    bytes32 private constant TRUST_UNIT = keccak256("points");
    bytes32 private constant ARCH = keccak256("x86_64");
    bytes32 private constant CPU = keccak256("cpu-general");
    bytes32 private constant SOFTWARE = keccak256("ffmpeg");
    bytes32 private constant NON_AI_WORKLOAD = keccak256("VIDEO_TRANSCODE");

    ComputeProviderRegistry420 private providers;
    ComputeNodeRegistry420 private nodes;
    ComputeResourceRegistry420 private resources;
    ComputeAuthorization420 private authorization;
    ComputeWorkerRegistry420 private workers;
    ComputeWorkerCapabilityProfile420 private profiles;
    ComputeWorkerAttestation420 private attestations;
    ComputeWorkerAttestedEligibility420 private attestedEligibility;
    ComputeWorkerCapabilityEligibility420 private capabilityEligibility;
    ComputeWorkerTrust420 private workerTrust;
    ComputeWorkerStake420 private workerStake;
    ComputeWorkerCapacityReservation420 private capacity;
    ComputeJobWorkerSnapshotEvidence420 private snapshots;
    ComputeJobRegistry420 private jobs;
    ComputeWorkerReadModel420 private reads;

    bytes32 private workerId;
    bytes32 private resourceId;
    bytes32 private jobId;
    bytes32 private attestationId;
    bytes32 private trustReferenceId;
    bytes32 private stakeReferenceId;
    bytes32 private assignmentRef;
    address private executionSigner;

    function setUp() public {
        executionSigner = vm.addr(EXEC_KEY);

        providers = new ComputeProviderRegistry420(GOV);
        nodes = new ComputeNodeRegistry420(address(providers), GOV);
        resources = new ComputeResourceRegistry420(address(nodes), GOV);
        ReadCapabilityRegistryMock420 capabilities = new ReadCapabilityRegistryMock420();
        authorization = new ComputeAuthorization420(address(capabilities));
        workers = new ComputeWorkerRegistry420(address(resources), address(authorization), GOV);

        profiles = new ComputeWorkerCapabilityProfile420(address(workers));
        attestations = new ComputeWorkerAttestation420(address(workers), GOV);
        attestedEligibility =
            new ComputeWorkerAttestedEligibility420(address(workers), address(attestations));
        capabilityEligibility =
            new ComputeWorkerCapabilityEligibility420(address(profiles), address(attestedEligibility));

        ReadTrustSourceMock420 trustSource = new ReadTrustSourceMock420(TRUST_DOMAIN, TRUST_UNIT);
        workerTrust = new ComputeWorkerTrust420(address(workers), address(trustSource), GOV);
        workerStake = new ComputeWorkerStake420(address(workers), GOV);
        ReadStakeSourceMock420 stakeSource = new ReadStakeSourceMock420();

        ReadJobEvidenceMock420 commonEvidence = new ReadJobEvidenceMock420();
        ReadMatchMock420 matchEvidence = new ReadMatchMock420();
        capacity = new ComputeWorkerCapacityReservation420(address(workers));
        snapshots = new ComputeJobWorkerSnapshotEvidence420(
            address(matchEvidence),
            address(authorization),
            address(workers),
            address(attestations),
            address(workerTrust),
            address(workerStake),
            address(capacity)
        );
        jobs = new ComputeJobRegistry420(
            address(commonEvidence),
            address(commonEvidence),
            address(matchEvidence),
            address(snapshots),
            address(commonEvidence),
            address(commonEvidence)
        );

        bytes32 providerId;
        bytes32 nodeId;
        vm.prank(OPERATOR);
        providerId = providers.register(keccak256("manifest"), keccak256("security"), OPERATOR);
        vm.prank(GOV);
        providers.activate(providerId);
        vm.prank(OPERATOR);
        nodeId = nodes.register(
            providerId,
            keccak256("node-manifest"),
            keccak256("endpoint"),
            uint64(block.timestamp + 30 days)
        );
        vm.prank(OPERATOR);
        nodes.activate(nodeId);

        bytes32 cpuGeneralClass = resources.CPU_GENERAL();
        vm.prank(OPERATOR);
        resourceId = resources.register(
            nodeId,
            cpuGeneralClass,
            keccak256("hardware"),
            keccak256("runtime"),
            keccak256("resource-capability"),
            2
        );
        vm.prank(OPERATOR);
        resources.activate(resourceId);

        ComputeWorkerCapabilityProfile420.ProfileInput memory p = _profileInput();
        bytes32 profileHash = profiles.profileCommitment(p);
        ComputeResourceRegistry420.Resource memory r = resources.resource(resourceId);
        uint64 serial = workers.nextSerial() + 1;
        bytes32 registration = workers.registrationDigest(
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
        bytes memory proof = _sign(registration);
        vm.prank(OPERATOR);
        workerId = workers.register(resourceId, executionSigner, profileHash, bytes32(0), proof);
        vm.prank(OPERATOR);
        workers.activate(workerId);
        uint64 workerRevision = workers.worker(workerId).revision;
        vm.prank(OPERATOR);
        profiles.publish(workerId, workerRevision, p);

        bytes32 benchmarkEvidenceType = attestations.EVIDENCE_BENCHMARK_V1();
        vm.prank(GOV);
        attestations.publishPolicy(
            CAP_POLICY,
            benchmarkEvidenceType,
            keccak256("benchmark-schema"),
            2 days
        );
        vm.prank(GOV);
        attestations.setAttester(CAP_POLICY, ATTESTER, true);
        vm.prank(ATTESTER);
        attestationId = attestations.attest(
            workerId,
            workerRevision,
            CAP_POLICY,
            keccak256("benchmark-evidence"),
            uint64(block.timestamp),
            uint64(block.timestamp + 1 days)
        );

        vm.prank(GOV);
        workerTrust.publishPolicy(
            TRUST_POLICY,
            TRUST_SUBJECT,
            TRUST_METRIC,
            TRUST_DOMAIN,
            TRUST_UNIT,
            50,
            1
        );
        vm.prank(OPERATOR);
        trustReferenceId = workerTrust.captureReference(workerId, workerRevision, TRUST_POLICY);

        vm.prank(GOV);
        workerStake.bindSource(address(stakeSource), true);
        vm.prank(GOV);
        workerStake.publishPolicy(STAKE_POLICY, 10 ether, 5 ether, true);
        vm.prank(OPERATOR);
        stakeReferenceId = workerStake.captureReference(workerId, workerRevision, STAKE_POLICY);

        matchEvidence.configure(address(jobs), resourceId, OPERATOR);
        snapshots.bindJobs(address(jobs));
        capacity.bindController(address(snapshots));

        vm.prank(OWNER);
        jobId = jobs.createJob(
            keccak256("request"),
            keccak256("request-commitment"),
            keccak256("manifest"),
            NON_AI_WORKLOAD,
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

        ComputeJobWorkerSnapshotEvidence420.AdmissionRefs memory refs =
            ComputeJobWorkerSnapshotEvidence420.AdmissionRefs({
                capabilityPolicyId: CAP_POLICY,
                capabilityAttestationId: attestationId,
                trustPolicyId: TRUST_POLICY,
                trustReference: trustReferenceId,
                stakePolicyId: STAKE_POLICY,
                stakeReference: stakeReferenceId
            });

        bytes32 digest =
            snapshots.assignmentExecutionDigest(jobId, workerId, workerRevision, 4, refs);
        bytes memory assignmentSignature = _sign(digest);
        vm.prank(RELAYER);
        assignmentRef = snapshots.acceptAssignment(
            jobId,
            workerId,
            workerRevision,
            4,
            refs,
            assignmentSignature
        );

        reads = new ComputeWorkerReadModel420(
            address(workers),
            address(profiles),
            address(capabilityEligibility),
            address(attestations),
            address(workerTrust),
            address(workerStake),
            address(capacity),
            address(snapshots)
        );
    }

    function _profileInput()
        private
        pure
        returns (ComputeWorkerCapabilityProfile420.ProfileInput memory p)
    {
        p.architectures = new bytes32[](1);
        p.architectures[0] = ARCH;
        p.cpuClasses = new bytes32[](1);
        p.cpuClasses[0] = CPU;
        p.gpuClasses = new bytes32[](0);
        p.softwareCapabilities = new bytes32[](1);
        p.softwareCapabilities[0] = SOFTWARE;
        p.vramMiB = 0;
        p.memoryMiB = 32768;
        p.storageGiB = 500;
        p.networkMbps = 1000;
        p.storageClassHash = keccak256("ssd");
        p.networkCapabilityHash = keccak256("ethernet");
        p.runtimeCapabilityHash = keccak256("container-runtime");
    }

    function _sign(bytes32 digest) private returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(EXEC_KEY, digest);
        return abi.encodePacked(r, s, v);
    }

    function _eligibilityQuery(uint64 revision)
        private
        view
        returns (ComputeWorkerReadModel420.EligibilityQuery memory query)
    {
        ComputeWorkerCapabilityProfile420.Requirements memory req;
        req.requiredResourceComputeClass = resources.CPU_GENERAL();
        req.requiredArchitecture = ARCH;
        req.requiredCpuClass = CPU;
        req.requiredSoftwareCapability = SOFTWARE;
        req.minMemoryMiB = 1024;

        query = ComputeWorkerReadModel420.EligibilityQuery({
            workerId: workerId,
            workerRevision: revision,
            requirements: req,
            requireTrustedAttestation: true,
            attestationPolicyId: CAP_POLICY,
            attestationId: attestationId,
            trustPolicyId: TRUST_POLICY,
            requireTrustReference: true,
            trustReferenceId: trustReferenceId,
            stakePolicyId: STAKE_POLICY,
            requireStakeReference: true,
            stakeReferenceId: stakeReferenceId
        });
    }


    function testDescriptorAndDomainSurfaceIsVersionedAndCanonical() public view {
        require(reads.schemaVersion() == 1, "wrong schema version");
        require(reads.READ_MODEL_SCHEMA_V1() != bytes32(0), "missing schema id");

        ComputeWorkerReadModel420.Components memory c = reads.components();
        require(c.workers == address(workers), "workers descriptor mismatch");
        require(c.snapshots == address(snapshots), "snapshot descriptor mismatch");

        ComputeWorkerReadModel420.Domains memory d = reads.domains();
        require(d.workerIdentity == workers.IDENTITY_DOMAIN_V1(), "identity domain drift");
        require(d.capabilityProfile == profiles.PROFILE_DOMAIN_V1(), "profile domain drift");
        require(d.capacityReservation == capacity.RESERVATION_DOMAIN_V1(), "capacity domain drift");
        require(d.executionAccept == snapshots.ACCEPT_EXECUTION_DOMAIN_V1(), "accept domain drift");
        require(d.acceptedConstraint == snapshots.ACCEPTED_CONSTRAINT_DOMAIN_V1(), "constraint domain drift");
    }

    function testReconstructsWorkerCapabilityReferencesCapacityAndAcceptedAttempt() public view {
        uint64 revision = workers.worker(workerId).revision;
        ComputeWorkerRegistry420.Worker memory w = reads.workerRevision(workerId, revision);
        require(w.revision == revision && w.resourceId == resourceId, "worker read mismatch");

        ComputeWorkerCapabilityProfile420.ProfileMeta memory p =
            reads.capabilityProfile(workerId, revision);
        require(p.exists && p.profileHash == w.capabilityProfileHash, "profile read mismatch");
        require(reads.capabilityArchitectures(workerId, revision)[0] == ARCH, "architecture missing");
        require(reads.capabilitySoftware(workerId, revision)[0] == SOFTWARE, "software missing");

        require(reads.attestationCore(attestationId).workerId == workerId, "attestation read mismatch");
        require(reads.attestationProvenance(attestationId).exists, "provenance missing");
        require(reads.trustReference(trustReferenceId).workerId == workerId, "trust read mismatch");
        require(reads.stakeReference(stakeReferenceId).workerId == workerId, "stake read mismatch");

        ComputeWorkerReadModel420.CapacityView memory capacityView =
            reads.capacityUsage(workerId, revision, resourceId, w.resourceRevision);
        require(capacityView.liveWorkerUnits == 1, "worker capacity missing");
        require(capacityView.liveResourceUnits == 1, "resource capacity missing");
        (bytes32 reservationId, ComputeWorkerCapacityReservation420.Reservation memory reservation) =
            reads.reservationForJob(jobId);
        require(reservationId != bytes32(0), "reservation id missing");
        require(reservation.jobId == jobId && reservation.assignmentRef == assignmentRef, "reservation read mismatch");

        ComputeWorkerReadModel420.AttemptIndex memory index = reads.attemptIndex(jobId);
        require(index.rootAssignmentRef == assignmentRef, "root attempt mismatch");
        require(index.latestAssignmentRef == assignmentRef, "latest attempt mismatch");
        require(index.attemptCount == 1, "attempt count mismatch");
        require(reads.assignment(assignmentRef).workerId == workerId, "assignment read mismatch");
        require(
            reads.attemptLifecycle(assignmentRef).status
                == ComputeJobWorkerSnapshotEvidence420.AttemptStatus.ACTIVE,
            "attempt lifecycle mismatch"
        );
    }

    function testEligibilityIsPublicFailClosedAndStaleRevisionSafe() public {
        uint64 revision = workers.worker(workerId).revision;
        ComputeWorkerReadModel420.EligibilityQuery memory query = _eligibilityQuery(revision);
        ComputeWorkerReadModel420.EligibilityView memory ok = reads.eligibility(query);
        require(ok.workerEligible && ok.capabilityEligible && ok.trustEligible && ok.stakeEligible, "valid admission read rejected");

        query.workerRevision = revision - 1;
        ComputeWorkerReadModel420.EligibilityView memory stale = reads.eligibility(query);
        require(!stale.workerEligible && !stale.capabilityEligible, "stale revision accepted");

        vm.prank(address(0xBAD));
        ComputeWorkerRegistry420.Worker memory publicRead = reads.currentWorker(workerId);
        require(publicRead.revision == revision, "caller-dependent read");
    }

    function testCrossComponentAdmissionShutdownPreservesAcceptedHistoryAndCapacity() public {
        uint64 acceptedRevision = reads.assignment(assignmentRef).workerRevision;
        bytes32 reservationId = reads.assignment(assignmentRef).reservationId;
        bytes32 snapshotCommitment = reads.assignment(assignmentRef).snapshotCommitment;

        vm.prank(OPERATOR);
        workers.suspend(workerId);
        vm.prank(GOV);
        attestations.setPolicyAcceptance(CAP_POLICY, false);
        vm.prank(GOV);
        workerTrust.setPolicyAcceptance(TRUST_POLICY, false);
        vm.prank(GOV);
        workerStake.setPolicyAcceptance(STAKE_POLICY, false);

        ComputeWorkerReadModel420.EligibilityView memory closed =
            reads.eligibility(_eligibilityQuery(acceptedRevision));
        require(!closed.workerEligible, "suspended worker remained eligible");
        require(!closed.capabilityEligible, "closed attestation policy remained eligible");
        require(!closed.trustEligible, "closed Trust policy remained eligible");
        require(!closed.stakeEligible, "closed stake policy remained eligible");

        ComputeWorkerRegistry420.Worker memory historical =
            reads.workerRevision(workerId, acceptedRevision);
        require(historical.status == ComputeWorkerRegistry420.Status.ACTIVE, "historical worker rewritten");

        ComputeJobWorkerSnapshotEvidence420.Assignment memory accepted =
            reads.assignment(assignmentRef);
        require(accepted.snapshotCommitment == snapshotCommitment, "accepted snapshot rewritten");
        require(accepted.workerRevision == acceptedRevision, "accepted revision drifted");
        require(reads.attestationCore(attestationId).workerRevision == acceptedRevision, "attestation history lost");
        require(reads.trustReference(trustReferenceId).workerRevision == acceptedRevision, "Trust history lost");
        require(reads.stakeReference(stakeReferenceId).workerRevision == acceptedRevision, "stake history lost");

        ComputeWorkerCapacityReservation420.Reservation memory reservation =
            capacity.reservation(reservationId);
        require(reservation.status == ComputeWorkerCapacityReservation420.Status.RESERVED, "accepted capacity confiscated");
        require(capacity.liveResourceUnits(resourceId) == 1, "accepted capacity accounting changed");
    }

    function testFuzzNonCurrentWorkerRevisionNeverQualifies(uint64 candidateRevision) public view {
        uint64 currentRevision = workers.worker(workerId).revision;
        if (candidateRevision == currentRevision) candidateRevision = 0;

        ComputeWorkerReadModel420.EligibilityView memory out =
            reads.eligibility(_eligibilityQuery(candidateRevision));
        require(!out.workerEligible, "non-current worker revision eligible");
        require(!out.capabilityEligible, "non-current capability revision eligible");
        require(!out.trustEligible, "non-current Trust revision eligible");
        require(!out.stakeEligible, "non-current stake revision eligible");
    }

    function testExplicitNonAiWorkloadAcceptedSnapshotIsReconstructable() public view {
        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        require(j.workloadType == NON_AI_WORKLOAD, "non-ai workload fixture drift");
        require(reads.assignment(assignmentRef).jobId == jobId, "non-ai assignment not reconstructable");
    }

    function testConstructorRejectsCrossWiredCanonicalGraph() public {
        vm.prank(address(0xBAD));
        (bool ok,) = address(this).call(
            abi.encodeWithSelector(
                this.deployBadReadModel.selector,
                address(workers),
                address(profiles),
                address(capabilityEligibility),
                address(attestations),
                address(workerTrust),
                address(workerStake),
                address(capacity),
                address(attestations)
            )
        );
        require(!ok, "cross-wired graph accepted");
    }

    function deployBadReadModel(
        address workers_,
        address profiles_,
        address eligibility_,
        address attestations_,
        address trust_,
        address stake_,
        address capacity_,
        address snapshots_
    ) external returns (address) {
        return address(new ComputeWorkerReadModel420(
            workers_, profiles_, eligibility_, attestations_, trust_, stake_, capacity_, snapshots_
        ));
    }
}
