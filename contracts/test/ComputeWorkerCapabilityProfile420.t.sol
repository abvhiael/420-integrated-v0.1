// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeWorkerCapabilityEligibility420.sol";

interface VmWorkerCapability420 {
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8, bytes32, bytes32);
    function prank(address caller) external;
}

contract ComputeWorkerCapabilityProfile420Test {
    VmWorkerCapability420 private constant vm =
        VmWorkerCapability420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant GOV = address(0x420);
    address private constant OPERATOR = address(0xA11CE);
    address private constant OUTSIDER = address(0xBAD);
    address private constant ATTESTER = address(0xA77E57);

    uint256 private constant EXEC_KEY = 0xBEEF;

    bytes32 private constant ARCH_X86 = bytes32(uint256(0x1001));
    bytes32 private constant ARCH_ARM = bytes32(uint256(0x1002));
    bytes32 private constant CPU_GENERAL_CLASS = bytes32(uint256(0x2001));
    bytes32 private constant CPU_VECTOR_CLASS = bytes32(uint256(0x2002));
    bytes32 private constant GPU_COMPUTE_CLASS = bytes32(uint256(0x3001));
    bytes32 private constant GPU_RENDER_CLASS = bytes32(uint256(0x3002));
    bytes32 private constant SOFTWARE_CONTAINER = bytes32(uint256(0x4001));
    bytes32 private constant SOFTWARE_WASM = bytes32(uint256(0x4002));

    bytes32 private constant STORAGE_CLASS = keccak256("storage-class/nvme");
    bytes32 private constant NETWORK_CAP = keccak256("network-capability/v1");
    bytes32 private constant RUNTIME_CAP = keccak256("runtime-capability/v1");

    bytes32 private constant MANIFEST = keccak256("manifest");
    bytes32 private constant SECURITY = keccak256("security");
    bytes32 private constant ENDPOINT = keccak256("endpoint");
    bytes32 private constant HARDWARE = keccak256("hardware");
    bytes32 private constant RESOURCE_RUNTIME = keccak256("resource-runtime");
    bytes32 private constant RESOURCE_CAP = keccak256("resource-capability");

    bytes32 private constant POLICY = keccak256("trusted-capability-policy");
    bytes32 private constant SCHEMA = keccak256("benchmark-schema");
    bytes32 private constant EVIDENCE = keccak256("benchmark-evidence");

    ComputeProviderRegistry420 private providers;
    ComputeNodeRegistry420 private nodes;
    ComputeResourceRegistry420 private resources;
    ComputeWorkerRegistry420 private workers;
    ComputeWorkerAttestation420 private attestations;
    ComputeWorkerAttestedEligibility420 private attestedEligibility;
    ComputeWorkerCapabilityProfile420 private profiles;
    ComputeWorkerCapabilityEligibility420 private eligibility;

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
        attestations = new ComputeWorkerAttestation420(address(workers), GOV);
        attestedEligibility = new ComputeWorkerAttestedEligibility420(address(workers), address(attestations));
        profiles = new ComputeWorkerCapabilityProfile420(address(workers));
        eligibility = new ComputeWorkerCapabilityEligibility420(address(profiles), address(attestedEligibility));

        vm.prank(OPERATOR);
        providerId = providers.register(MANIFEST, SECURITY, OPERATOR);
        vm.prank(GOV);
        providers.activate(providerId);

        vm.prank(OPERATOR);
        nodeId = nodes.register(providerId, MANIFEST, ENDPOINT, uint64(block.timestamp + 30 days));
        vm.prank(OPERATOR);
        nodes.activate(nodeId);

        bytes32 gpuInference = resources.GPU_INFERENCE();
        vm.prank(OPERATOR);
        resourceId = resources.register(
            nodeId,
            gpuInference,
            HARDWARE,
            RESOURCE_RUNTIME,
            RESOURCE_CAP,
            8
        );
        vm.prank(OPERATOR);
        resources.activate(resourceId);

        ComputeWorkerCapabilityProfile420.ProfileInput memory p = _profileV1();
        workerId = _registerWorker(profiles.profileCommitment(p));
        vm.prank(OPERATOR);
        workers.activate(workerId);

        uint64 revision = workers.worker(workerId).revision;
        vm.prank(OPERATOR);
        profiles.publish(workerId, revision, p);

        bytes32 benchmarkType = attestations.EVIDENCE_BENCHMARK_V1();
        vm.prank(GOV);
        attestations.publishPolicy(POLICY, benchmarkType, SCHEMA, 7 days);
        vm.prank(GOV);
        attestations.setAttester(POLICY, ATTESTER, true);
    }

    function _profileV1()
        private
        pure
        returns (ComputeWorkerCapabilityProfile420.ProfileInput memory p)
    {
        p.architectures = new bytes32[](2);
        p.architectures[0] = ARCH_X86;
        p.architectures[1] = ARCH_ARM;

        p.cpuClasses = new bytes32[](2);
        p.cpuClasses[0] = CPU_GENERAL_CLASS;
        p.cpuClasses[1] = CPU_VECTOR_CLASS;

        p.gpuClasses = new bytes32[](2);
        p.gpuClasses[0] = GPU_COMPUTE_CLASS;
        p.gpuClasses[1] = GPU_RENDER_CLASS;

        p.softwareCapabilities = new bytes32[](2);
        p.softwareCapabilities[0] = SOFTWARE_CONTAINER;
        p.softwareCapabilities[1] = SOFTWARE_WASM;

        p.vramMiB = 24_576;
        p.memoryMiB = 65_536;
        p.storageGiB = 2_048;
        p.networkMbps = 10_000;
        p.storageClassHash = STORAGE_CLASS;
        p.networkCapabilityHash = NETWORK_CAP;
        p.runtimeCapabilityHash = RUNTIME_CAP;
    }

    function _profileV2()
        private
        pure
        returns (ComputeWorkerCapabilityProfile420.ProfileInput memory p)
    {
        p = _profileV1();
        p.vramMiB = 49_152;
        p.memoryMiB = 131_072;
    }

    function _requirements()
        private
        view
        returns (ComputeWorkerCapabilityProfile420.Requirements memory r)
    {
        r.requiredResourceComputeClass = resources.GPU_INFERENCE();
        r.requiredArchitecture = ARCH_X86;
        r.requiredCpuClass = CPU_VECTOR_CLASS;
        r.requiredGpuClass = GPU_COMPUTE_CLASS;
        r.requiredSoftwareCapability = SOFTWARE_CONTAINER;
        r.minVramMiB = 16_384;
        r.minMemoryMiB = 32_768;
        r.minStorageGiB = 1_024;
        r.minNetworkMbps = 1_000;
        r.requiredStorageClassHash = STORAGE_CLASS;
        r.requiredNetworkCapabilityHash = NETWORK_CAP;
        r.requiredRuntimeCapabilityHash = RUNTIME_CAP;
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

    function _attestCurrent() private returns (bytes32 id) {
        uint64 revision = workers.worker(workerId).revision;
        vm.prank(ATTESTER);
        id = attestations.attest(
            workerId,
            revision,
            POLICY,
            EVIDENCE,
            uint64(block.timestamp),
            uint64(block.timestamp + 1 days)
        );
    }

    function testProfilePublishesAllRequiredCapabilityDimensions() public view {
        uint64 revision = workers.worker(workerId).revision;
        ComputeWorkerCapabilityProfile420.ProfileMeta memory p = profiles.profile(workerId, revision);

        require(p.vramMiB == 24_576, "vram missing");
        require(p.memoryMiB == 65_536, "memory missing");
        require(p.storageGiB == 2_048, "storage missing");
        require(p.networkMbps == 10_000, "network missing");
        require(p.storageClassHash == STORAGE_CLASS, "storage class missing");
        require(p.networkCapabilityHash == NETWORK_CAP, "network capability missing");
        require(p.runtimeCapabilityHash == RUNTIME_CAP, "runtime capability missing");

        require(profiles.architectures(workerId, revision).length == 2, "architectures missing");
        require(profiles.cpuClasses(workerId, revision).length == 2, "cpu classes missing");
        require(profiles.gpuClasses(workerId, revision).length == 2, "gpu classes missing");
        require(profiles.softwareCapabilities(workerId, revision).length == 2, "software missing");
    }

    function testExactClassAndScalarRequirementsMatchFailClosed() public view {
        uint64 revision = workers.worker(workerId).revision;
        ComputeWorkerCapabilityProfile420.Requirements memory r = _requirements();
        require(profiles.matches(workerId, revision, r), "valid requirements rejected");

        r.minVramMiB = 32_768;
        require(!profiles.matches(workerId, revision, r), "insufficient vram accepted");
        r.minVramMiB = 16_384;

        r.requiredGpuClass = bytes32(uint256(0x3999));
        require(!profiles.matches(workerId, revision, r), "missing gpu class accepted");
        r.requiredGpuClass = GPU_COMPUTE_CLASS;

        r.requiredSoftwareCapability = bytes32(uint256(0x4999));
        require(!profiles.matches(workerId, revision, r), "missing software accepted");
    }

    function testCanonicalResourceClassCannotBeBroadenedByWorkerClaim() public view {
        uint64 revision = workers.worker(workerId).revision;
        ComputeWorkerCapabilityProfile420.Requirements memory r = _requirements();
        r.requiredResourceComputeClass = resources.CPU_GENERAL();
        require(!profiles.matches(workerId, revision, r), "worker claim broadened resource compute class");
    }

    function testTrustedPolicyRejectsSelfReportUntilExactRevisionAttested() public {
        uint64 revision = workers.worker(workerId).revision;
        ComputeWorkerCapabilityProfile420.Requirements memory r = _requirements();

        require(
            eligibility.isEligible(workerId, revision, r, false, bytes32(0), bytes32(0)),
            "self-report path unexpectedly rejected"
        );
        require(
            !eligibility.isEligible(workerId, revision, r, true, POLICY, bytes32(0)),
            "trusted policy accepted self-report without evidence"
        );

        bytes32 evidenceId = _attestCurrent();
        require(
            eligibility.isEligible(workerId, revision, r, true, POLICY, evidenceId),
            "exact trusted capability evidence rejected"
        );
    }

    function testProfileMutationInvalidatesOldRevisionAndRequiresRepublish() public {
        uint64 oldRevision = workers.worker(workerId).revision;
        ComputeWorkerCapabilityProfile420.Requirements memory oldReq = _requirements();
        require(profiles.matches(workerId, oldRevision, oldReq), "old profile unavailable");

        ComputeWorkerCapabilityProfile420.ProfileInput memory p2 = _profileV2();
        vm.prank(OPERATOR);
        workers.refreshProfile(workerId, profiles.profileCommitment(p2), bytes32(0));
        vm.prank(OPERATOR);
        workers.activate(workerId);

        uint64 newRevision = workers.worker(workerId).revision;
        require(newRevision != oldRevision, "worker revision not advanced");
        require(!profiles.matches(workerId, oldRevision, oldReq), "stale worker revision admitted");
        require(!profiles.matches(workerId, newRevision, oldReq), "unpublished new profile admitted");

        vm.prank(OPERATOR);
        profiles.publish(workerId, newRevision, p2);
        require(profiles.matches(workerId, newRevision, oldReq), "republished profile rejected");
        require(
            profiles.profile(workerId, oldRevision).vramMiB == 24_576,
            "historical capability profile rewritten"
        );
    }

    function testCommitmentMismatchUnauthorizedPublishAndDuplicatePublishFail() public {
        ComputeWorkerCapabilityProfile420.ProfileInput memory p = _profileV1();
        bytes32 profileHash = profiles.profileCommitment(p);
        bytes32 secondWorker = _registerWorker(profileHash);
        vm.prank(OPERATOR);
        workers.activate(secondWorker);
        uint64 revision = workers.worker(secondWorker).revision;

        vm.prank(OUTSIDER);
        (bool ok,) = address(profiles).call(
            abi.encodeCall(profiles.publish, (secondWorker, revision, p))
        );
        require(!ok, "outsider published worker profile");

        ComputeWorkerCapabilityProfile420.ProfileInput memory wrong = _profileV2();
        vm.prank(OPERATOR);
        (ok,) = address(profiles).call(
            abi.encodeCall(profiles.publish, (secondWorker, revision, wrong))
        );
        require(!ok, "mismatched profile commitment published");

        vm.prank(OPERATOR);
        profiles.publish(secondWorker, revision, p);

        vm.prank(OPERATOR);
        (ok,) = address(profiles).call(
            abi.encodeCall(profiles.publish, (secondWorker, revision, p))
        );
        require(!ok, "duplicate profile publication accepted");
    }

    function testNonCanonicalOrOversizedSetsAreRejected() public {
        ComputeWorkerCapabilityProfile420.ProfileInput memory p = _profileV1();
        p.architectures[0] = ARCH_ARM;
        p.architectures[1] = ARCH_X86;
        (bool ok,) = address(profiles).staticcall(
            abi.encodeCall(profiles.profileCommitment, (p))
        );
        require(!ok, "unsorted capability set accepted");

        p = _profileV1();
        p.softwareCapabilities = new bytes32[](17);
        for (uint256 i = 0; i < 17; ++i) {
            p.softwareCapabilities[i] = bytes32(i + 1);
        }
        (ok,) = address(profiles).staticcall(
            abi.encodeCall(profiles.profileCommitment, (p))
        );
        require(!ok, "oversized capability set accepted");
    }

    function testParentOrResourceStateStillOverridesDetailedCapabilityMatch() public {
        uint64 revision = workers.worker(workerId).revision;
        ComputeWorkerCapabilityProfile420.Requirements memory r = _requirements();
        require(profiles.matches(workerId, revision, r), "baseline match failed");

        vm.prank(OPERATOR);
        resources.suspend(resourceId);
        require(!profiles.matches(workerId, revision, r), "suspended resource still admitted");
    }
}
