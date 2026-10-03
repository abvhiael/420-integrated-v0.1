// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeWorkerStake420.sol";
import "./helpers/ComputeWorkerCapabilityMock420.sol";

interface VmWorkerStake420 {
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8, bytes32, bytes32);
    function prank(address caller) external;
}

contract MockComputeStakeSource420 is IComputeStakeSource420 {
    bytes32 internal constant SOURCE_ID =
        keccak256("420Integrated.ComputeMarket.ComputeStakeSource.v1");

    address private immutable _workerRegistry;
    mapping(bytes32 => PositionRead) private _positions;

    constructor(address workerRegistry_) {
        _workerRegistry = workerRegistry_;
    }

    function computeStakeSourceId() external pure returns (bytes32) {
        return SOURCE_ID;
    }

    function workerRegistry() external view returns (address) {
        return _workerRegistry;
    }

    function setPosition(bytes32 workerId, bytes32 policyId, PositionRead calldata position) external {
        _positions[keccak256(abi.encode(workerId, policyId))] = position;
    }

    function readWorkerPosition(bytes32 workerId, bytes32 policyId)
        external
        view
        returns (PositionRead memory out)
    {
        return _positions[keccak256(abi.encode(workerId, policyId))];
    }
}

contract WrongStakeSurface420 {
    function validatorBondComposition(bytes32)
        external
        pure
        returns (uint256 ownedBond, uint256 protocolCredit, uint256 effective, uint256 totalSlashed)
    {
        return (21_000 ether, 21_000 ether, 42_000 ether, 0);
    }
}

contract ComputeWorkerStake420Test {
    VmWorkerStake420 private constant vm =
        VmWorkerStake420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant GOV = address(0x420);
    address private constant OPERATOR = address(0xA11CE);
    address private constant OUTSIDER = address(0xBAD);
    uint256 private constant EXEC_KEY = 0xBEEF;

    bytes32 private constant POLICY = keccak256("compute/collateral/general-v1");
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
    ComputeWorkerStake420 private workerStake;
    MockComputeStakeSource420 private source;
    WrongStakeSurface420 private validatorStakeLike;

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
        ComputeWorkerCapabilityMock420 workerCaps = new ComputeWorkerCapabilityMock420();
        workerCaps.setAllowPrincipal(OPERATOR, true);
        workerCaps.setAllowPrincipal(GOV, true);
        ComputeAuthorization420 workerAuthorization = new ComputeAuthorization420(address(workerCaps));
        workers = new ComputeWorkerRegistry420(address(resources), address(workerAuthorization), GOV);
        workerStake = new ComputeWorkerStake420(address(workers), GOV);
        source = new MockComputeStakeSource420(address(workers));
        validatorStakeLike = new WrongStakeSurface420();

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

        workerId = _registerWorker();
        vm.prank(OPERATOR);
        workers.activate(workerId);

        vm.prank(GOV);
        workerStake.publishPolicy(POLICY, 100 ether, 80 ether, true);
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

    function _position(
        uint256 activeAmount,
        uint256 slashableAmount,
        bool active,
        bool exiting,
        uint64 revision
    ) private pure returns (IComputeStakeSource420.PositionRead memory p) {
        p = IComputeStakeSource420.PositionRead({
            positionId: keccak256("position-1"),
            positionRevision: revision,
            activeAmount: activeAmount,
            slashableAmount: slashableAmount,
            active: active,
            exiting: exiting,
            withdrawableAt: 0
        });
    }

    function _bindSource() private {
        vm.prank(GOV);
        workerStake.bindSource(address(source), true);
    }

    function _setGoodPosition() private {
        source.setPosition(workerId, POLICY, _position(120 ether, 100 ether, true, false, 1));
    }

    function _capture() private returns (bytes32 refId) {
        uint64 revision = workers.worker(workerId).revision;
        vm.prank(OPERATOR);
        refId = workerStake.captureReference(workerId, revision, POLICY);
    }

    function testStakeRequiredEligibilityFailsClosedWhileCmp15SourceUnbound() public view {
        uint64 revision = workers.worker(workerId).revision;
        require(
            !workerStake.isEligible(workerId, revision, POLICY, false, bytes32(0)),
            "unbound stake source accepted"
        );
    }

    function testCompatibleMarkerWithWrongWorkerRegistryCannotBind() public {
        ComputeWorkerCapabilityMock420 otherCaps = new ComputeWorkerCapabilityMock420();
        ComputeAuthorization420 otherAuthorization =
            new ComputeAuthorization420(address(otherCaps));
        ComputeWorkerRegistry420 otherWorkers =
            new ComputeWorkerRegistry420(address(resources), address(otherAuthorization), GOV);
        MockComputeStakeSource420 wrongRegistrySource =
            new MockComputeStakeSource420(address(otherWorkers));

        vm.prank(GOV);
        (bool ok,) = address(workerStake).call(
            abi.encodeCall(workerStake.bindSource, (address(wrongRegistrySource), true))
        );
        require(!ok && workerStake.latestSourceBindingRevision() == 0, "cross-wired source bound");
    }

    function testValidatorStakeLikeSurfaceCannotBeBoundAsComputeCollateral() public {
        vm.prank(GOV);
        (bool ok,) = address(workerStake).call(
            abi.encodeCall(workerStake.bindSource, (address(validatorStakeLike), true))
        );
        require(!ok && workerStake.latestSourceBindingRevision() == 0, "validator stake substituted");
    }

    function testCompatibleComputeStakeSourceAndThresholdsQualify() public {
        _bindSource();
        _setGoodPosition();
        uint64 revision = workers.worker(workerId).revision;

        require(
            workerStake.isEligible(workerId, revision, POLICY, false, bytes32(0)),
            "valid compute collateral rejected"
        );

        source.setPosition(workerId, POLICY, _position(99 ether, 99 ether, true, false, 2));
        require(
            !workerStake.isEligible(workerId, revision, POLICY, false, bytes32(0)),
            "active amount threshold bypassed"
        );

        source.setPosition(workerId, POLICY, _position(120 ether, 79 ether, true, false, 3));
        require(
            !workerStake.isEligible(workerId, revision, POLICY, false, bytes32(0)),
            "slashable amount threshold bypassed"
        );
    }

    function testInactiveOrExitingStakeFailsClosed() public {
        _bindSource();
        uint64 revision = workers.worker(workerId).revision;

        source.setPosition(workerId, POLICY, _position(120 ether, 100 ether, false, false, 1));
        require(!workerStake.isEligible(workerId, revision, POLICY, false, bytes32(0)), "inactive stake accepted");

        source.setPosition(workerId, POLICY, _position(120 ether, 100 ether, true, true, 2));
        require(!workerStake.isEligible(workerId, revision, POLICY, false, bytes32(0)), "exiting stake accepted");
    }

    function testReferenceBindsExactWorkerPolicySourceAndPosition() public {
        _bindSource();
        _setGoodPosition();
        uint64 revision = workers.worker(workerId).revision;
        bytes32 refId = _capture();

        ComputeWorkerStake420.StakeReference memory r = workerStake.stakeReference(refId);
        require(r.workerId == workerId && r.workerRevision == revision, "worker revision not bound");
        require(r.stakePolicyId == POLICY && r.stakePolicyRevision == 1, "policy not bound");
        require(r.source == address(source) && r.sourceBindingRevision == 1, "source not bound");
        require(r.positionId == keccak256("position-1") && r.positionRevision == 1, "position not bound");
        require(r.snapshotCommitment != bytes32(0), "snapshot missing");
        require(workerStake.isEligible(workerId, revision, POLICY, true, refId), "valid reference rejected");
    }

    function testLiveSlashOrExitCanRemoveNewAdmissionWithoutRewritingHistory() public {
        _bindSource();
        _setGoodPosition();
        uint64 revision = workers.worker(workerId).revision;
        bytes32 refId = _capture();
        ComputeWorkerStake420.StakeReference memory beforeRef = workerStake.stakeReference(refId);

        source.setPosition(workerId, POLICY, _position(70 ether, 50 ether, true, false, 2));
        require(
            !workerStake.isEligible(workerId, revision, POLICY, true, refId),
            "historical stake snapshot overrode live slash"
        );

        ComputeWorkerStake420.StakeReference memory afterRef = workerStake.stakeReference(refId);
        require(
            afterRef.activeAmount == beforeRef.activeAmount
                && afterRef.slashableAmount == beforeRef.slashableAmount
                && afterRef.positionRevision == beforeRef.positionRevision,
            "historical stake reference rewritten"
        );
    }

    function testPolicyOrSourceRevisionInvalidatesOldReference() public {
        _bindSource();
        _setGoodPosition();
        uint64 revision = workers.worker(workerId).revision;
        bytes32 oldRef = _capture();

        vm.prank(GOV);
        workerStake.publishPolicy(POLICY, 110 ether, 90 ether, true);
        require(
            !workerStake.isEligible(workerId, revision, POLICY, true, oldRef),
            "old policy reference accepted"
        );

        bytes32 freshPolicyRef = _capture();
        require(
            workerStake.isEligible(workerId, revision, POLICY, true, freshPolicyRef),
            "fresh policy reference rejected"
        );

        vm.prank(GOV);
        workerStake.bindSource(address(source), true);
        require(
            !workerStake.isEligible(workerId, revision, POLICY, true, freshPolicyRef),
            "old source binding reference accepted"
        );
    }

    function testWorkerRevisionAndParentStateStillOverrideStake() public {
        _bindSource();
        _setGoodPosition();
        uint64 oldRevision = workers.worker(workerId).revision;
        bytes32 oldRef = _capture();

        vm.prank(OPERATOR);
        workers.refreshProfile(workerId, keccak256("worker-capability-v2"), bytes32(0));
        vm.prank(OPERATOR);
        workers.activate(workerId);

        uint64 newRevision = workers.worker(workerId).revision;
        require(
            !workerStake.isEligible(workerId, newRevision, POLICY, true, oldRef),
            "old worker revision reference accepted"
        );

        bytes32 newRef = _capture();
        vm.prank(OPERATOR);
        resources.suspend(resourceId);
        require(
            !workerStake.isEligible(workerId, newRevision, POLICY, true, newRef),
            "stake bypassed resource suspension"
        );
        require(oldRevision != newRevision, "worker revision unchanged");
    }

    function testUnauthorizedBindingPolicyAndReferenceCaptureFail() public {
        vm.prank(OUTSIDER);
        (bool ok,) = address(workerStake).call(
            abi.encodeCall(workerStake.bindSource, (address(source), true))
        );
        require(!ok, "outsider bound source");

        vm.prank(OUTSIDER);
        (ok,) = address(workerStake).call(
            abi.encodeCall(workerStake.publishPolicy, (keccak256("bad"), 1 ether, 1 ether, true))
        );
        require(!ok, "outsider published policy");

        _bindSource();
        _setGoodPosition();
        uint64 revision = workers.worker(workerId).revision;
        vm.prank(OUTSIDER);
        (ok,) = address(workerStake).call(
            abi.encodeCall(workerStake.captureReference, (workerId, revision, POLICY))
        );
        require(!ok && workerStake.nextReferenceSerial() == 0, "outsider captured stake reference");
    }
}
