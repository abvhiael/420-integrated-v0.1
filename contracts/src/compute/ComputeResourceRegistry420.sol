// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ComputeNodeRegistry420.sol";

/// @notice Resource identity and advertised capacity only; there is NO reservation or metering engine here.
contract ComputeResourceRegistry420 is I420System {
    bytes32 public constant IDENTITY_DOMAIN_V1 = keccak256("420Integrated.ComputeMarket.Identity.v1");
    bytes32 public constant RESOURCE_TAG = keccak256("RESOURCE");
    bytes32 public constant CPU_GENERAL = keccak256("CPU_GENERAL");
    bytes32 public constant GPU_INFERENCE = keccak256("GPU_INFERENCE");
    bytes32 public constant GPU_TRAINING = keccak256("GPU_TRAINING");
    bytes32 public constant GPU_RENDER = keccak256("GPU_RENDER");
    bytes32 public constant ACCELERATOR_GENERAL = keccak256("ACCELERATOR_GENERAL");
    bytes32 public constant ZK_PROVER = keccak256("ZK_PROVER");
    bytes32 public constant HIGH_MEMORY = keccak256("HIGH_MEMORY");
    enum Status { NONE, REGISTERED, AVAILABLE, SUSPENDED, RETIRED }
    struct Resource {
        bytes32 providerId;
        bytes32 nodeId;
        bytes32 computeClass;
        bytes32 hardwareProfileHash;
        bytes32 runtimeProfileHash;
        bytes32 capabilityHash;
        uint256 capacityUnits;
        uint64 createdAt;
        uint64 revision;
        Status status;
    }
    ComputeNodeRegistry420 public immutable nodes;
    ComputeProviderRegistry420 public immutable providers;
    address public immutable governanceTimelock;
    uint64 public nextSerial;
    mapping(bytes32 => Resource) private _current;
    mapping(bytes32 => mapping(uint64 => Resource)) private _history;
    error InvalidIdentity();
    error InvalidState();
    error UnauthorizedOperator();
    error SerialExhausted();
    event ResourceRegistered(bytes32 indexed resourceId, bytes32 indexed nodeId, bytes32 indexed providerId, uint64 serial);
    event ResourceRevised(bytes32 indexed resourceId, uint64 oldRevision, uint64 newRevision, bytes32 oldCommitment, bytes32 newCommitment);

    constructor(address nodeRegistry_, address timelock_) {
        if (nodeRegistry_ == address(0) || nodeRegistry_.code.length == 0 || timelock_ == address(0)) revert InvalidIdentity();
        nodes = ComputeNodeRegistry420(nodeRegistry_);
        providers = nodes.providers();
        governanceTimelock = timelock_;
    }
    function systemName() external pure returns (string memory) { return "ComputeResourceRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }
    function supportedClass(bytes32 kind) public pure returns (bool) {
        return kind == CPU_GENERAL || kind == GPU_INFERENCE || kind == GPU_TRAINING || kind == GPU_RENDER
            || kind == ACCELERATOR_GENERAL || kind == ZK_PROVER || kind == HIGH_MEMORY;
    }
    function deriveId(uint64 serial, bytes32 providerId, bytes32 nodeId) public view returns (bytes32) {
        if (block.chainid == 0 || serial == 0 || providerId == bytes32(0) || nodeId == bytes32(0)) revert InvalidIdentity();
        return keccak256(abi.encode(IDENTITY_DOMAIN_V1, block.chainid, address(this), RESOURCE_TAG, serial, providerId, nodeId));
    }
    function resource(bytes32 id) public view returns (Resource memory r) {
        r = _current[id];
        if (r.status == Status.NONE) revert InvalidIdentity();
    }
    function revision(bytes32 id, uint64 version) external view returns (Resource memory r) {
        r = _history[id][version];
        if (r.status == Status.NONE) revert InvalidIdentity();
    }
    function isAvailable(bytes32 id) public view returns (bool) {
        Resource storage r = _current[id];
        return r.status == Status.AVAILABLE && nodes.isActive(r.nodeId) && providers.isActive(r.providerId);
    }
    function _authorized(bytes32 providerId, bytes32 nodeId) private view returns (bool) {
        if (!providers.isOperator(providerId, msg.sender) || !nodes.isActive(nodeId)) return false;
        ComputeNodeRegistry420.Node memory n = nodes.node(nodeId);
        return n.providerId == providerId && n.operator == msg.sender;
    }
    function register(bytes32 nodeId, bytes32 computeClass, bytes32 hardwareProfileHash,
        bytes32 runtimeProfileHash, bytes32 capabilityHash, uint256 capacityUnits) external returns (bytes32 id)
    {
        ComputeNodeRegistry420.Node memory n = nodes.node(nodeId);
        if (!_authorized(n.providerId, nodeId)) revert UnauthorizedOperator();
        if (!supportedClass(computeClass) || hardwareProfileHash == bytes32(0) || runtimeProfileHash == bytes32(0)
            || capabilityHash == bytes32(0) || capacityUnits == 0 || block.chainid == 0) revert InvalidIdentity();
        if (nextSerial == type(uint64).max) revert SerialExhausted();
        uint64 serial = ++nextSerial;
        id = deriveId(serial, n.providerId, nodeId);
        if (_current[id].status != Status.NONE) revert InvalidIdentity();
        Resource memory r = Resource(n.providerId, nodeId, computeClass, hardwareProfileHash,
            runtimeProfileHash, capabilityHash, capacityUnits, uint64(block.timestamp), 1, Status.REGISTERED);
        _current[id] = r;
        _history[id][1] = r;
        emit ResourceRegistered(id, nodeId, n.providerId, serial);
    }
    function activate(bytes32 id) external {
        Resource memory r = resource(id);
        if (!_authorized(r.providerId, r.nodeId)) revert UnauthorizedOperator();
        if (r.status != Status.REGISTERED && r.status != Status.SUSPENDED) revert InvalidState();
        r.status = Status.AVAILABLE;
        _commit(id, r);
    }
    function suspend(bytes32 id) external {
        Resource memory r = resource(id);
        if (msg.sender != governanceTimelock && !_authorized(r.providerId, r.nodeId)) revert UnauthorizedOperator();
        if (r.status != Status.AVAILABLE) revert InvalidState();
        r.status = Status.SUSPENDED;
        _commit(id, r);
    }
    function retire(bytes32 id) external {
        Resource memory r = resource(id);
        if (msg.sender != governanceTimelock && !_authorized(r.providerId, r.nodeId)) revert UnauthorizedOperator();
        if (r.status == Status.RETIRED) revert InvalidState();
        r.status = Status.RETIRED;
        _commit(id, r);
    }
    /// @notice Class and immutable parents cannot change; any capability/capacity revision suspends new admission.
    function update(bytes32 id, bytes32 hardwareProfileHash, bytes32 runtimeProfileHash,
        bytes32 capabilityHash, uint256 capacityUnits) external {
        Resource memory r = resource(id);
        if (!_authorized(r.providerId, r.nodeId)) revert UnauthorizedOperator();
        if (r.status == Status.RETIRED || hardwareProfileHash == bytes32(0) || runtimeProfileHash == bytes32(0)
            || capabilityHash == bytes32(0) || capacityUnits == 0) revert InvalidState();
        r.hardwareProfileHash = hardwareProfileHash;
        r.runtimeProfileHash = runtimeProfileHash;
        r.capabilityHash = capabilityHash;
        r.capacityUnits = capacityUnits;
        r.status = Status.SUSPENDED;
        _commit(id, r);
    }
    function _commit(bytes32 id, Resource memory r) private {
        Resource memory old = _current[id];
        if (old.revision == type(uint64).max) revert SerialExhausted();
        r.revision = old.revision + 1;
        bytes32 oldHash = keccak256(abi.encode(old));
        bytes32 newHash = keccak256(abi.encode(r));
        _current[id] = r;
        _history[id][r.revision] = r;
        emit ResourceRevised(id, old.revision, r.revision, oldHash, newHash);
    }
}
