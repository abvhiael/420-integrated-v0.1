// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../accounts/ECDSA420.sol";
import "./ComputeResourceRegistry420.sol";
import "./ComputeAuthorization420.sol";

/// @notice Canonical ComputeMarket worker execution identity and lifecycle registry.
/// @dev A worker is permanently bound to one provider/node/resource ancestry. Registration records
///      execution capability claims, not trusted hardware truth, reputation, stake, or verifier authority.
contract ComputeWorkerRegistry420 is I420System {
    bytes32 public constant IDENTITY_DOMAIN_V1 = keccak256("420Integrated.ComputeMarket.Identity.v1");
    bytes32 public constant WORKER_TAG = keccak256("WORKER");
    bytes32 public constant EXECUTION_KEY_TYPE_V1 = keccak256("SECP256K1_EOA_V1");
    bytes32 public constant REGISTER_ACTION = keccak256("REGISTER_WORKER");
    bytes32 public constant ROTATE_KEY_ACTION = keccak256("ROTATE_WORKER_EXECUTION_KEY");

    enum Status { NONE, REGISTERED, ACTIVE, SUSPENDED, RETIRED }

    struct Worker {
        bytes32 providerId;
        bytes32 nodeId;
        bytes32 resourceId;
        address operator;
        address executionSigner;
        bytes32 executionKeyCommitment;
        bytes32 capabilityProfileHash;
        bytes32 jurisdictionHash;
        uint64 resourceRevision;
        uint64 createdAt;
        uint64 revision;
        Status status;
    }

    ComputeResourceRegistry420 public immutable resources;
    ComputeNodeRegistry420 public immutable nodes;
    ComputeProviderRegistry420 public immutable providers;
    ComputeAuthorization420 public immutable authorization;
    address public immutable governanceTimelock;
    uint64 public nextSerial;

    mapping(bytes32 => Worker) private _current;
    mapping(bytes32 => mapping(uint64 => Worker)) private _history;

    error InvalidIdentity();
    error InvalidState();
    error UnauthorizedOperator();
    error InvalidExecutionKeyProof();
    error SerialExhausted();

    event WorkerRegistered(
        bytes32 indexed workerId,
        bytes32 indexed nodeId,
        bytes32 indexed resourceId,
        address operator,
        address executionSigner,
        uint64 serial
    );
    event WorkerRevised(
        bytes32 indexed workerId,
        uint64 oldRevision,
        uint64 newRevision,
        bytes32 oldCommitment,
        bytes32 newCommitment
    );

    constructor(address resourceRegistry_, address authorization_, address timelock_) {
        if (
            resourceRegistry_ == address(0) || resourceRegistry_.code.length == 0
                || authorization_ == address(0) || authorization_.code.length == 0
                || timelock_ == address(0)
        ) revert InvalidIdentity();
        resources = ComputeResourceRegistry420(resourceRegistry_);
        nodes = resources.nodes();
        providers = resources.providers();
        authorization = ComputeAuthorization420(authorization_);
        governanceTimelock = timelock_;
    }

    function systemName() external pure returns (string memory) { return "ComputeWorkerRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function deriveId(uint64 serial, bytes32 providerId, bytes32 nodeId, bytes32 resourceId)
        public view returns (bytes32)
    {
        if (block.chainid == 0 || serial == 0 || providerId == bytes32(0)
            || nodeId == bytes32(0) || resourceId == bytes32(0)) revert InvalidIdentity();
        return keccak256(
            abi.encode(
                IDENTITY_DOMAIN_V1,
                block.chainid,
                address(this),
                WORKER_TAG,
                serial,
                providerId,
                nodeId,
                resourceId
            )
        );
    }

    function executionKeyCommitment(address executionSigner) public pure returns (bytes32) {
        if (executionSigner == address(0)) revert InvalidIdentity();
        return keccak256(abi.encode(EXECUTION_KEY_TYPE_V1, executionSigner));
    }

    function registrationDigest(
        uint64 serial,
        bytes32 providerId,
        bytes32 nodeId,
        bytes32 resourceId,
        uint64 resourceRevision,
        address operator,
        address executionSigner,
        bytes32 capabilityProfileHash,
        bytes32 jurisdictionHash
    ) public view returns (bytes32) {
        if (operator == address(0) || executionSigner == address(0) || capabilityProfileHash == bytes32(0)) {
            revert InvalidIdentity();
        }
        bytes32 workerId = deriveId(serial, providerId, nodeId, resourceId);
        return keccak256(
            abi.encode(
                IDENTITY_DOMAIN_V1,
                block.chainid,
                address(this),
                REGISTER_ACTION,
                workerId,
                resourceRevision,
                operator,
                executionSigner,
                executionKeyCommitment(executionSigner),
                capabilityProfileHash,
                jurisdictionHash
            )
        );
    }

    function rotationDigest(bytes32 workerId, address newExecutionSigner) public view returns (bytes32) {
        Worker memory w = worker(workerId);
        if (newExecutionSigner == address(0) || w.revision == type(uint64).max) revert InvalidIdentity();
        return keccak256(
            abi.encode(
                IDENTITY_DOMAIN_V1,
                block.chainid,
                address(this),
                ROTATE_KEY_ACTION,
                workerId,
                w.revision + 1,
                w.executionKeyCommitment,
                newExecutionSigner,
                executionKeyCommitment(newExecutionSigner)
            )
        );
    }

    function worker(bytes32 workerId) public view returns (Worker memory w) {
        w = _current[workerId];
        if (w.status == Status.NONE) revert InvalidIdentity();
    }

    function revision(bytes32 workerId, uint64 version) external view returns (Worker memory w) {
        w = _history[workerId][version];
        if (w.status == Status.NONE) revert InvalidIdentity();
    }

    /// @notice Registers an execution identity for the canonical resource/node/provider operator.
    /// @dev Even the canonical operator requires an explicit exact-worker capability grant.
    function register(
        bytes32 resourceId,
        address executionSigner,
        bytes32 capabilityProfileHash,
        bytes32 jurisdictionHash,
        bytes calldata executionKeyProof
    ) external returns (bytes32 workerId) {
        return _registerFor(
            msg.sender,
            resourceId,
            executionSigner,
            capabilityProfileHash,
            jurisdictionHash,
            executionKeyProof
        );
    }

    /// @notice Delegated registration for the immutable canonical provider/node operator.
    /// @dev The delegate gains no ownership: the worker.operator remains the canonical operator argument.
    function registerFor(
        address operator,
        bytes32 resourceId,
        address executionSigner,
        bytes32 capabilityProfileHash,
        bytes32 jurisdictionHash,
        bytes calldata executionKeyProof
    ) external returns (bytes32 workerId) {
        return _registerFor(
            operator,
            resourceId,
            executionSigner,
            capabilityProfileHash,
            jurisdictionHash,
            executionKeyProof
        );
    }

    function _registerFor(
        address operator,
        bytes32 resourceId,
        address executionSigner,
        bytes32 capabilityProfileHash,
        bytes32 jurisdictionHash,
        bytes calldata executionKeyProof
    ) private returns (bytes32 workerId) {
        ComputeResourceRegistry420.Resource memory r = resources.resource(resourceId);
        ComputeNodeRegistry420.Node memory n = nodes.node(r.nodeId);
        if (
            operator == address(0) || !resources.isAvailable(resourceId)
                || !providers.isOperator(r.providerId, operator)
                || n.providerId != r.providerId || n.operator != operator
        ) revert UnauthorizedOperator();
        if (executionSigner == address(0) || capabilityProfileHash == bytes32(0) || block.chainid == 0) {
            revert InvalidIdentity();
        }
        if (nextSerial == type(uint64).max) revert SerialExhausted();

        uint64 serial = nextSerial + 1;
        workerId = deriveId(serial, r.providerId, r.nodeId, resourceId);
        if (_current[workerId].status != Status.NONE) revert InvalidIdentity();
        _requireCapability(
            msg.sender,
            authorization.ACTION_REGISTER_WORKER(),
            workerId,
            1
        );

        bytes32 digest = registrationDigest(
            serial,
            r.providerId,
            r.nodeId,
            resourceId,
            r.revision,
            operator,
            executionSigner,
            capabilityProfileHash,
            jurisdictionHash
        );
        if (ECDSA420.tryRecover(digest, executionKeyProof) != executionSigner) {
            revert InvalidExecutionKeyProof();
        }

        nextSerial = serial;
        Worker memory w = Worker({
            providerId: r.providerId,
            nodeId: r.nodeId,
            resourceId: resourceId,
            operator: operator,
            executionSigner: executionSigner,
            executionKeyCommitment: executionKeyCommitment(executionSigner),
            capabilityProfileHash: capabilityProfileHash,
            jurisdictionHash: jurisdictionHash,
            resourceRevision: r.revision,
            createdAt: uint64(block.timestamp),
            revision: 1,
            status: Status.REGISTERED
        });
        _current[workerId] = w;
        _history[workerId][1] = w;
        emit WorkerRegistered(workerId, r.nodeId, resourceId, operator, executionSigner, serial);
    }

    function activate(bytes32 workerId) external {
        Worker memory w = worker(workerId);
        _requireCapability(msg.sender, authorization.ACTION_ACTIVATE_WORKER(), workerId, w.revision);
        if (w.status != Status.REGISTERED && w.status != Status.SUSPENDED) revert InvalidState();
        if (!_parentsEligible(w)) revert InvalidState();
        w.status = Status.ACTIVE;
        _commit(workerId, w);
    }

    function suspend(bytes32 workerId) external {
        Worker memory w = worker(workerId);
        _requireCapability(msg.sender, authorization.ACTION_SUSPEND_WORKER(), workerId, w.revision);
        if (w.status != Status.ACTIVE) revert InvalidState();
        w.status = Status.SUSPENDED;
        _commit(workerId, w);
    }

    function retire(bytes32 workerId) external {
        Worker memory w = worker(workerId);
        _requireCapability(msg.sender, authorization.ACTION_RETIRE_WORKER(), workerId, w.revision);
        if (w.status == Status.RETIRED) revert InvalidState();
        w.status = Status.RETIRED;
        _commit(workerId, w);
    }

    /// @notice Refreshes the capability claim against the exact current resource revision.
    /// @dev Material capability/jurisdiction changes always suspend fresh paid admission until reactivated.
    function refreshProfile(bytes32 workerId, bytes32 capabilityProfileHash, bytes32 jurisdictionHash) external {
        Worker memory w = worker(workerId);
        _requireCapability(
            msg.sender,
            authorization.ACTION_REFRESH_WORKER_PROFILE(),
            workerId,
            w.revision
        );
        if (w.status == Status.RETIRED || capabilityProfileHash == bytes32(0)) revert InvalidState();

        ComputeResourceRegistry420.Resource memory r = resources.resource(w.resourceId);
        ComputeNodeRegistry420.Node memory n = nodes.node(w.nodeId);
        if (
            r.providerId != w.providerId || r.nodeId != w.nodeId || !resources.isAvailable(w.resourceId)
                || !providers.isOperator(w.providerId, w.operator)
                || n.providerId != w.providerId || n.operator != w.operator
        ) revert InvalidState();

        w.capabilityProfileHash = capabilityProfileHash;
        w.jurisdictionHash = jurisdictionHash;
        w.resourceRevision = r.revision;
        w.status = Status.SUSPENDED;
        _commit(workerId, w);
    }

    /// @notice Rotates the execution signing key after proof of possession by the new key.
    /// @dev Key rotation always suspends fresh paid admission and preserves the old revision.
    function rotateExecutionKey(bytes32 workerId, address newExecutionSigner, bytes calldata executionKeyProof)
        external
    {
        Worker memory w = worker(workerId);
        _requireCapability(
            msg.sender,
            authorization.ACTION_ROTATE_WORKER_EXECUTION_KEY(),
            workerId,
            w.revision
        );
        if (
            w.status == Status.RETIRED || newExecutionSigner == address(0)
                || newExecutionSigner == w.executionSigner
        ) revert InvalidState();

        bytes32 digest = rotationDigest(workerId, newExecutionSigner);
        if (ECDSA420.tryRecover(digest, executionKeyProof) != newExecutionSigner) {
            revert InvalidExecutionKeyProof();
        }

        w.executionSigner = newExecutionSigner;
        w.executionKeyCommitment = executionKeyCommitment(newExecutionSigner);
        w.status = Status.SUSPENDED;
        _commit(workerId, w);
    }

    function _requireCapability(
        address principal,
        bytes32 actionId,
        bytes32 workerId,
        uint64 workerRevision
    ) private view {
        if (
            !authorization.isAuthorized(
                principal,
                actionId,
                authorization.scopeWorker(workerId, workerRevision),
                0
            )
        ) revert UnauthorizedOperator();
    }

    /// @notice Exact-current eligibility for new admission. Later CMP-1.3 slices add attestation/stake predicates.
    function isEligible(bytes32 workerId, uint64 expectedWorkerRevision) public view returns (bool) {
        Worker storage w = _current[workerId];
        if (w.status != Status.ACTIVE || expectedWorkerRevision == 0 || w.revision != expectedWorkerRevision) {
            return false;
        }
        Worker memory snapshot = w;
        return _parentsEligible(snapshot);
    }

    function _parentsEligible(Worker memory w) private view returns (bool) {
        if (!resources.isAvailable(w.resourceId) || !providers.isOperator(w.providerId, w.operator)) return false;

        ComputeNodeRegistry420.Node memory n = nodes.node(w.nodeId);
        if (n.providerId != w.providerId || n.operator != w.operator || !nodes.isActive(w.nodeId)) return false;

        ComputeResourceRegistry420.Resource memory r = resources.resource(w.resourceId);
        return r.providerId == w.providerId
            && r.nodeId == w.nodeId
            && r.revision == w.resourceRevision;
    }

    function _commit(bytes32 workerId, Worker memory w) private {
        Worker memory old = _current[workerId];
        if (old.revision == type(uint64).max) revert SerialExhausted();
        w.revision = old.revision + 1;
        bytes32 oldHash = keccak256(abi.encode(old));
        bytes32 newHash = keccak256(abi.encode(w));
        _current[workerId] = w;
        _history[workerId][w.revision] = w;
        emit WorkerRevised(workerId, old.revision, w.revision, oldHash, newHash);
    }
}
