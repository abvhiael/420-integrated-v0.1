// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ComputeAuthorization420.sol";
import "./ComputeProviderRegistry420.sol";
import "./ComputeIds420.sol";

contract ComputeNodeRegistry420 is I420System {
    enum State { NONE, REGISTERED, ACTIVE, SUSPENDED, RETIRED }

    struct Node {
        bytes32 providerId;
        address operatorAccount;
        bytes32 nodeManifestHash;
        bytes32 endpointManifestHash;
        uint64 endpointExpiry;
        uint64 createdAt;
        uint32 revision;
        State state;
        bool exists;
    }

    ComputeAuthorization420 public immutable authorization;
    ComputeProviderRegistry420 public immutable providers;
    mapping(bytes32 => Node) private _nodes;

    error InvalidNode();
    error NodeExists();
    error NodeNotFound();
    error Unauthorized();
    error InvalidState();

    event NodeRegistered(bytes32 indexed nodeId, bytes32 indexed providerId, address indexed operatorAccount);
    event NodeUpdated(bytes32 indexed nodeId, bytes32 endpointManifestHash, uint64 endpointExpiry, uint32 revision);
    event NodeStateChanged(bytes32 indexed nodeId, State previousState, State newState, uint32 revision);

    constructor(address authorization_, address providers_) {
        if (authorization_ == address(0) || providers_ == address(0)) revert InvalidNode();
        authorization = ComputeAuthorization420(authorization_);
        providers = ComputeProviderRegistry420(providers_);
    }

    function systemName() external pure returns (string memory) { return "ComputeNodeRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function registerNode(
        bytes32 nodeId,
        bytes32 providerId,
        address operatorAccount,
        bytes32 nodeManifestHash,
        bytes32 endpointManifestHash,
        uint64 endpointExpiry
    ) external {
        if (
            nodeId == bytes32(0) || providerId == bytes32(0) || operatorAccount == address(0)
                || nodeManifestHash == bytes32(0) || endpointManifestHash == bytes32(0)
                || (endpointExpiry != 0 && endpointExpiry <= block.timestamp)
        ) revert InvalidNode();
        if (_nodes[nodeId].exists) revert NodeExists();

        ComputeProviderRegistry420.Provider memory p = providers.getProvider(providerId);
        if (
            msg.sender != p.operatorAccount
                && !authorization.isNodeAuthorized(msg.sender, providerId, nodeId, ComputeIds420.ACTION_REGISTER_NODE)
        ) revert Unauthorized();

        _nodes[nodeId] = Node({
            providerId: providerId,
            operatorAccount: operatorAccount,
            nodeManifestHash: nodeManifestHash,
            endpointManifestHash: endpointManifestHash,
            endpointExpiry: endpointExpiry,
            createdAt: uint64(block.timestamp),
            revision: 1,
            state: State.REGISTERED,
            exists: true
        });
        emit NodeRegistered(nodeId, providerId, operatorAccount);
    }

    function updateNode(
        bytes32 nodeId,
        bytes32 nodeManifestHash,
        bytes32 endpointManifestHash,
        uint64 endpointExpiry
    ) external {
        Node storage n = _get(nodeId);
        if (n.state == State.RETIRED) revert InvalidState();
        if (
            nodeManifestHash == bytes32(0) || endpointManifestHash == bytes32(0)
                || (endpointExpiry != 0 && endpointExpiry <= block.timestamp)
        ) revert InvalidNode();
        ComputeProviderRegistry420.Provider memory p = providers.getProvider(n.providerId);
        if (
            msg.sender != n.operatorAccount && msg.sender != p.operatorAccount
                && !authorization.isNodeAuthorized(msg.sender, n.providerId, nodeId, ComputeIds420.ACTION_UPDATE_NODE)
        ) revert Unauthorized();

        n.nodeManifestHash = nodeManifestHash;
        n.endpointManifestHash = endpointManifestHash;
        n.endpointExpiry = endpointExpiry;
        n.revision += 1;
        emit NodeUpdated(nodeId, endpointManifestHash, endpointExpiry, n.revision);
    }

    function setState(bytes32 nodeId, State next) external {
        Node storage n = _get(nodeId);
        ComputeProviderRegistry420.Provider memory p = providers.getProvider(n.providerId);
        if (
            msg.sender != n.operatorAccount && msg.sender != p.operatorAccount
                && !authorization.isNodeAuthorized(msg.sender, n.providerId, nodeId, ComputeIds420.ACTION_SET_NODE_STATE)
        ) revert Unauthorized();

        State previous = n.state;
        bool ok = (previous == State.REGISTERED && (next == State.ACTIVE || next == State.RETIRED))
            || (previous == State.ACTIVE && (next == State.SUSPENDED || next == State.RETIRED))
            || (previous == State.SUSPENDED && (next == State.ACTIVE || next == State.RETIRED));
        if (!ok) revert InvalidState();
        if (next == State.ACTIVE && !providers.isActive(n.providerId)) revert InvalidState();

        n.state = next;
        n.revision += 1;
        emit NodeStateChanged(nodeId, previous, next, n.revision);
    }

    function getNode(bytes32 nodeId) external view returns (Node memory) { return _get(nodeId); }

    function isActive(bytes32 nodeId) external view returns (bool) {
        Node memory n = _nodes[nodeId];
        return n.exists && n.state == State.ACTIVE && providers.isActive(n.providerId)
            && (n.endpointExpiry == 0 || block.timestamp <= n.endpointExpiry);
    }

    function _get(bytes32 nodeId) private view returns (Node storage n) {
        n = _nodes[nodeId];
        if (!n.exists) revert NodeNotFound();
    }
}
