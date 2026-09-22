// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ComputeProviderRegistry420.sol";

/// @notice Node identities have one permanent canonical provider parent. Endpoints are commitments, not secrets.
contract ComputeNodeRegistry420 is I420System {
    bytes32 public constant IDENTITY_DOMAIN_V1 = keccak256("420Integrated.ComputeMarket.Identity.v1");
    bytes32 public constant NODE_TAG = keccak256("NODE");
    enum Status { NONE, REGISTERED, ACTIVE, SUSPENDED, RETIRED }
    struct Node {
        bytes32 providerId;
        address operator;
        bytes32 manifestHash;
        bytes32 endpointHash;
        uint64 endpointExpiresAt;
        uint64 createdAt;
        uint64 revision;
        Status status;
    }
    ComputeProviderRegistry420 public immutable providers;
    address public immutable governanceTimelock;
    uint64 public nextSerial;
    mapping(bytes32 => Node) private _current;
    mapping(bytes32 => mapping(uint64 => Node)) private _history;
    error InvalidIdentity();
    error InvalidState();
    error UnauthorizedOperator();
    error SerialExhausted();
    event NodeRegistered(bytes32 indexed nodeId, bytes32 indexed providerId, uint64 serial);
    event NodeRevised(bytes32 indexed nodeId, uint64 oldRevision, uint64 newRevision, bytes32 oldCommitment, bytes32 newCommitment);

    constructor(address providerRegistry_, address timelock_) {
        if (providerRegistry_ == address(0) || providerRegistry_.code.length == 0 || timelock_ == address(0)) revert InvalidIdentity();
        providers = ComputeProviderRegistry420(providerRegistry_);
        governanceTimelock = timelock_;
    }
    function systemName() external pure returns (string memory) { return "ComputeNodeRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }
    function deriveId(uint64 serial, bytes32 providerId) public view returns (bytes32) {
        if (block.chainid == 0 || serial == 0 || providerId == bytes32(0)) revert InvalidIdentity();
        return keccak256(abi.encode(IDENTITY_DOMAIN_V1, block.chainid, address(this), NODE_TAG, serial, providerId));
    }
    function node(bytes32 id) public view returns (Node memory n) {
        n = _current[id];
        if (n.status == Status.NONE) revert InvalidIdentity();
    }
    function revision(bytes32 id, uint64 version) external view returns (Node memory n) {
        n = _history[id][version];
        if (n.status == Status.NONE) revert InvalidIdentity();
    }
    function isActive(bytes32 id) public view returns (bool) {
        Node storage n = _current[id];
        return n.status == Status.ACTIVE && n.endpointExpiresAt > block.timestamp && providers.isActive(n.providerId);
    }
    function register(bytes32 providerId, bytes32 manifestHash, bytes32 endpointHash, uint64 expiresAt)
        external returns (bytes32 id)
    {
        if (!providers.isOperator(providerId, msg.sender)) revert UnauthorizedOperator();
        if (manifestHash == bytes32(0) || endpointHash == bytes32(0) || expiresAt <= block.timestamp
            || block.chainid == 0) revert InvalidIdentity();
        if (nextSerial == type(uint64).max) revert SerialExhausted();
        uint64 serial = ++nextSerial;
        id = deriveId(serial, providerId);
        if (_current[id].status != Status.NONE) revert InvalidIdentity();
        Node memory n = Node(providerId, msg.sender, manifestHash, endpointHash, expiresAt,
            uint64(block.timestamp), 1, Status.REGISTERED);
        _current[id] = n;
        _history[id][1] = n;
        emit NodeRegistered(id, providerId, serial);
    }
    function activate(bytes32 id) external {
        Node memory n = node(id);
        if (msg.sender != n.operator) revert UnauthorizedOperator();
        if (!providers.isOperator(n.providerId, msg.sender) || n.endpointExpiresAt <= block.timestamp
            || (n.status != Status.REGISTERED && n.status != Status.SUSPENDED)) revert InvalidState();
        n.status = Status.ACTIVE;
        _commit(id, n);
    }
    function suspend(bytes32 id) external {
        Node memory n = node(id);
        if (msg.sender != n.operator && msg.sender != governanceTimelock) revert UnauthorizedOperator();
        if (n.status != Status.ACTIVE) revert InvalidState();
        n.status = Status.SUSPENDED;
        _commit(id, n);
    }
    function retire(bytes32 id) external {
        Node memory n = node(id);
        if (msg.sender != n.operator && msg.sender != governanceTimelock) revert UnauthorizedOperator();
        if (n.status == Status.RETIRED) revert InvalidState();
        n.status = Status.RETIRED;
        _commit(id, n);
    }
    function updateEndpoint(bytes32 id, bytes32 manifestHash, bytes32 endpointHash, uint64 expiresAt) external {
        Node memory n = node(id);
        if (msg.sender != n.operator || !providers.isOperator(n.providerId, msg.sender)) revert UnauthorizedOperator();
        if (n.status == Status.RETIRED || manifestHash == bytes32(0) || endpointHash == bytes32(0)
            || expiresAt <= block.timestamp) revert InvalidState();
        n.manifestHash = manifestHash;
        n.endpointHash = endpointHash;
        n.endpointExpiresAt = expiresAt;
        n.status = Status.SUSPENDED; // new endpoint must be activated explicitly
        _commit(id, n);
    }
    function _commit(bytes32 id, Node memory n) private {
        Node memory old = _current[id];
        if (old.revision == type(uint64).max) revert SerialExhausted();
        n.revision = old.revision + 1;
        bytes32 oldHash = keccak256(abi.encode(old));
        bytes32 newHash = keccak256(abi.encode(n));
        _current[id] = n;
        _history[id][n.revision] = n;
        emit NodeRevised(id, old.revision, n.revision, oldHash, newHash);
    }
}
