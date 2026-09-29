// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeWorkerRegistry420.sol";
import "./helpers/ComputeWorkerCapabilityMock420.sol";

interface VmWorkerAuthorization420 {
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8, bytes32, bytes32);
    function prank(address caller) external;
    function warp(uint256 timestamp) external;
}

contract ComputeWorkerAuthorization420Test {
    VmWorkerAuthorization420 private constant vm =
        VmWorkerAuthorization420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant GOV = address(0x420);
    address private constant OPERATOR = address(0xA11CE);
    address private constant DELEGATE = address(0xD311);
    address private constant OUTSIDER = address(0xBAD);
    uint256 private constant EXEC_KEY = 0xBEEF;
    uint256 private constant NEXT_EXEC_KEY = 0xCAFE;

    bytes32 private constant MANIFEST = keccak256("manifest");
    bytes32 private constant SECURITY = keccak256("security");
    bytes32 private constant ENDPOINT = keccak256("endpoint");
    bytes32 private constant HARDWARE = keccak256("hardware");
    bytes32 private constant RUNTIME = keccak256("runtime");
    bytes32 private constant RESOURCE_CAP = keccak256("resource-capability");
    bytes32 private constant WORKER_CAP = keccak256("worker-capability");
    bytes32 private constant WORKER_CAP_V2 = keccak256("worker-capability-v2");

    ComputeProviderRegistry420 private providers;
    ComputeNodeRegistry420 private nodes;
    ComputeResourceRegistry420 private resources;
    ComputeWorkerCapabilityMock420 private capabilities;
    ComputeAuthorization420 private authorization;
    ComputeWorkerRegistry420 private workers;

    bytes32 private providerId;
    bytes32 private nodeId;
    bytes32 private resourceId;
    address private executionSigner;
    address private nextExecutionSigner;

    function setUp() public {
        executionSigner = vm.addr(EXEC_KEY);
        nextExecutionSigner = vm.addr(NEXT_EXEC_KEY);

        providers = new ComputeProviderRegistry420(GOV);
        nodes = new ComputeNodeRegistry420(address(providers), GOV);
        resources = new ComputeResourceRegistry420(address(nodes), GOV);
        capabilities = new ComputeWorkerCapabilityMock420();
        authorization = new ComputeAuthorization420(address(capabilities));
        workers = new ComputeWorkerRegistry420(address(resources), address(authorization), GOV);

        vm.prank(OPERATOR);
        providerId = providers.register(MANIFEST, SECURITY, OPERATOR);
        vm.prank(GOV);
        providers.activate(providerId);

        vm.prank(OPERATOR);
        nodeId = nodes.register(providerId, MANIFEST, ENDPOINT, uint64(block.timestamp + 30 days));
        vm.prank(OPERATOR);
        nodes.activate(nodeId);

        bytes32 computeClass = resources.GPU_INFERENCE();
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
    }

    function _sign(uint256 key, bytes32 digest) private returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function _grant(address principal, bytes32 action, bytes32 workerId, uint64 revision, uint64 validUntil)
        private
    {
        capabilities.grantExact(
            principal,
            authorization.COMPONENT_COMPUTE(),
            action,
            authorization.scopeWorker(workerId, revision),
            validUntil
        );
    }

    function _prospectiveWorkerId() private view returns (bytes32) {
        ComputeResourceRegistry420.Resource memory r = resources.resource(resourceId);
        return workers.deriveId(workers.nextSerial() + 1, r.providerId, r.nodeId, resourceId);
    }

    function _registerBy(address caller, address operator) private returns (bytes32 workerId) {
        ComputeResourceRegistry420.Resource memory r = resources.resource(resourceId);
        workerId = _prospectiveWorkerId();
        _grant(caller, authorization.ACTION_REGISTER_WORKER(), workerId, 1, 0);
        bytes32 digest = workers.registrationDigest(
            workers.nextSerial() + 1,
            r.providerId,
            r.nodeId,
            resourceId,
            r.revision,
            operator,
            executionSigner,
            WORKER_CAP,
            bytes32(0)
        );
        bytes memory proof = _sign(EXEC_KEY, digest);
        vm.prank(caller);
        workerId = workers.registerFor(
            operator,
            resourceId,
            executionSigner,
            WORKER_CAP,
            bytes32(0),
            proof
        );
    }

    function testDelegatedRegistrationPreservesCanonicalOperatorAndExactRevisionAuthority() public {
        bytes32 workerId = _registerBy(DELEGATE, OPERATOR);
        ComputeWorkerRegistry420.Worker memory registered = workers.worker(workerId);
        require(registered.operator == OPERATOR, "delegate became canonical operator");
        require(registered.revision == 1, "wrong initial revision");

        _grant(DELEGATE, authorization.ACTION_ACTIVATE_WORKER(), workerId, 1, 0);
        vm.prank(DELEGATE);
        workers.activate(workerId);
        require(workers.worker(workerId).revision == 2, "delegated activation missing");

        // A grant for revision 1 is stale after activation and cannot mutate revision 2.
        _grant(DELEGATE, authorization.ACTION_SUSPEND_WORKER(), workerId, 1, 0);
        bytes32 beforeHash = keccak256(abi.encode(workers.worker(workerId)));
        vm.prank(DELEGATE);
        (bool ok,) = address(workers).call(abi.encodeCall(workers.suspend, (workerId)));
        require(!ok, "stale revision grant accepted");
        require(keccak256(abi.encode(workers.worker(workerId))) == beforeHash, "failed stale mutation changed state");

        _grant(DELEGATE, authorization.ACTION_SUSPEND_WORKER(), workerId, 2, 0);
        vm.prank(DELEGATE);
        workers.suspend(workerId);
        require(workers.worker(workerId).revision == 3, "fresh revision grant rejected");
    }

    function testDirectOperatorStillRequiresCapabilityAndFailureIsAtomic() public {
        ComputeResourceRegistry420.Resource memory r = resources.resource(resourceId);
        bytes32 expectedId = _prospectiveWorkerId();
        bytes32 digest = workers.registrationDigest(
            1,
            r.providerId,
            r.nodeId,
            resourceId,
            r.revision,
            OPERATOR,
            executionSigner,
            WORKER_CAP,
            bytes32(0)
        );
        bytes memory proof = _sign(EXEC_KEY, digest);

        vm.prank(OPERATOR);
        (bool ok,) = address(workers).call(
            abi.encodeCall(
                workers.register,
                (resourceId, executionSigner, WORKER_CAP, bytes32(0), proof)
            )
        );
        require(!ok, "operator bypassed capability registry");
        require(workers.nextSerial() == 0, "failed registration consumed serial");

        _grant(OPERATOR, authorization.ACTION_REGISTER_WORKER(), expectedId, 1, 0);
        vm.prank(OPERATOR);
        bytes32 workerId = workers.register(resourceId, executionSigner, WORKER_CAP, bytes32(0), proof);
        require(workerId == expectedId && workers.nextSerial() == 1, "authorized direct registration failed");
    }

    function testWrongActionWrongObjectRevokedExpiredAndGovernanceSubstitutionFailClosed() public {
        bytes32 workerId = _registerBy(DELEGATE, OPERATOR);
        bytes32 otherWorker = keccak256("other-worker");

        _grant(DELEGATE, authorization.ACTION_SUSPEND_WORKER(), workerId, 1, 0);
        vm.prank(DELEGATE);
        (bool ok,) = address(workers).call(abi.encodeCall(workers.activate, (workerId)));
        require(!ok, "wrong action grant accepted");

        _grant(DELEGATE, authorization.ACTION_ACTIVATE_WORKER(), otherWorker, 1, 0);
        vm.prank(DELEGATE);
        (ok,) = address(workers).call(abi.encodeCall(workers.activate, (workerId)));
        require(!ok, "wrong object scope accepted");

        _grant(DELEGATE, authorization.ACTION_ACTIVATE_WORKER(), workerId, 1, 0);
        bytes32 activateScope = authorization.scopeWorker(workerId, 1);
        capabilities.revokeExact(
            DELEGATE,
            authorization.COMPONENT_COMPUTE(),
            authorization.ACTION_ACTIVATE_WORKER(),
            activateScope
        );
        vm.prank(DELEGATE);
        (ok,) = address(workers).call(abi.encodeCall(workers.activate, (workerId)));
        require(!ok, "revoked grant accepted");

        _grant(DELEGATE, authorization.ACTION_ACTIVATE_WORKER(), workerId, 1, uint64(block.timestamp + 1));
        vm.warp(block.timestamp + 2);
        vm.prank(DELEGATE);
        (ok,) = address(workers).call(abi.encodeCall(workers.activate, (workerId)));
        require(!ok, "expired grant accepted");

        vm.prank(GOV);
        (ok,) = address(workers).call(abi.encodeCall(workers.retire, (workerId)));
        require(!ok, "governance identity substituted for worker capability");
        require(workers.worker(workerId).revision == 1, "failed authorization mutated revision");
    }

    function testDelegatedProfileAndKeyMutationRemainIdentitySafe() public {
        bytes32 workerId = _registerBy(DELEGATE, OPERATOR);
        _grant(DELEGATE, authorization.ACTION_ACTIVATE_WORKER(), workerId, 1, 0);
        vm.prank(DELEGATE);
        workers.activate(workerId);

        _grant(DELEGATE, authorization.ACTION_REFRESH_WORKER_PROFILE(), workerId, 2, 0);
        vm.prank(DELEGATE);
        workers.refreshProfile(workerId, WORKER_CAP_V2, keccak256("jurisdiction-v2"));
        ComputeWorkerRegistry420.Worker memory refreshed = workers.worker(workerId);
        require(refreshed.operator == OPERATOR, "profile delegate changed operator");
        require(refreshed.status == ComputeWorkerRegistry420.Status.SUSPENDED, "profile refresh not suspended");

        _grant(DELEGATE, authorization.ACTION_ACTIVATE_WORKER(), workerId, refreshed.revision, 0);
        vm.prank(DELEGATE);
        workers.activate(workerId);

        uint64 beforeRotationRevision = workers.worker(workerId).revision;
        bytes32 digest = workers.rotationDigest(workerId, nextExecutionSigner);
        bytes memory proof = _sign(NEXT_EXEC_KEY, digest);
        _grant(
            DELEGATE,
            authorization.ACTION_ROTATE_WORKER_EXECUTION_KEY(),
            workerId,
            beforeRotationRevision,
            0
        );
        vm.prank(DELEGATE);
        workers.rotateExecutionKey(workerId, nextExecutionSigner, proof);

        ComputeWorkerRegistry420.Worker memory rotated = workers.worker(workerId);
        require(rotated.executionSigner == nextExecutionSigner, "delegated key rotation failed");
        require(rotated.operator == OPERATOR, "key delegate changed operator");
        require(
            workers.revision(workerId, beforeRotationRevision).executionSigner == executionSigner,
            "historical execution key rewritten"
        );
    }

    function testWorkerGrantDoesNotImplySettlementOrOtherWorkerActions() public {
        bytes32 workerId = _registerBy(DELEGATE, OPERATOR);
        bytes32 scope = authorization.scopeWorker(workerId, 1);
        _grant(DELEGATE, authorization.ACTION_ACTIVATE_WORKER(), workerId, 1, 0);

        require(
            authorization.isAuthorized(
                DELEGATE,
                authorization.ACTION_ACTIVATE_WORKER(),
                scope,
                0
            ),
            "worker grant missing"
        );
        require(
            !authorization.isAuthorized(DELEGATE, authorization.ACTION_SETTLE(), scope, 0),
            "worker grant implied settlement authority"
        );
        require(
            !authorization.isAuthorized(DELEGATE, authorization.ACTION_RETIRE_WORKER(), scope, 0),
            "one worker action implied another"
        );
        require(
            !authorization.isAuthorized(OUTSIDER, authorization.ACTION_ACTIVATE_WORKER(), scope, 0),
            "ungranted outsider authorized"
        );
    }
}
