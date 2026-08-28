// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./VPNAuthorization420.sol";
import "./VPNProviderRegistry420.sol";
import "./VPNIds420.sol";

contract VPNNodeRegistry420 is I420System {
    enum NodeState { NONE, REGISTERED, ACTIVE, DRAINING, OFFLINE, RETIRED }

    struct Node {
        bytes32 providerId;
        address operatorAccount;
        bytes32 capabilityClass;
        bytes32 endpointManifestHash;
        uint64 endpointExpiresAt;
        bytes32 metadataHash;
        uint64 createdAt;
        uint32 revision;
        NodeState state;
        bool exists;
    }

    VPNAuthorization420 public immutable authorization;
    VPNProviderRegistry420 public immutable providers;
    mapping(bytes32 => Node) private _nodes;

    error ZeroAddress();
    error InvalidNodeId();
    error InvalidCapabilityClass();
    error NodeAlreadyExists();
    error NodeNotFound();
    error ProviderInactive();
    error Unauthorized();
    error InvalidStateTransition();
    error NoChange();

    event NodeRegistered(bytes32 indexed nodeId, bytes32 indexed providerId, address indexed operatorAccount, bytes32 capabilityClass);
    event NodeUpdated(bytes32 indexed nodeId, bytes32 endpointManifestHash, uint64 endpointExpiresAt, bytes32 metadataHash, uint32 revision);
    event NodeStateChanged(bytes32 indexed nodeId, NodeState previousState, NodeState newState, uint32 revision);

    constructor(address authorization_, address providers_) {
        if (authorization_ == address(0) || providers_ == address(0)) revert ZeroAddress();
        authorization = VPNAuthorization420(authorization_);
        providers = VPNProviderRegistry420(providers_);
    }

    function systemName() external pure returns (string memory) { return "VPNNodeRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function registerNode(
        bytes32 nodeId,
        bytes32 providerId,
        address operatorAccount,
        bytes32 capabilityClass,
        bytes32 endpointManifestHash,
        uint64 endpointExpiresAt,
        bytes32 metadataHash
    ) external {
        if (nodeId == bytes32(0)) revert InvalidNodeId();
        if (operatorAccount == address(0)) revert ZeroAddress();
        if (!_validCapabilityClass(capabilityClass)) revert InvalidCapabilityClass();
        if (_nodes[nodeId].exists) revert NodeAlreadyExists();
        VPNProviderRegistry420.ProviderState providerState = providers.providerState(providerId);
        if (providerState != VPNProviderRegistry420.ProviderState.ACTIVE) revert ProviderInactive();
        if (!authorization.isNodeAuthorized(msg.sender, providerId, nodeId, VPNIds420.ACTION_REGISTER_NODE, 0)) revert Unauthorized();
        _nodes[nodeId] = Node({
            providerId: providerId,
            operatorAccount: operatorAccount,
            capabilityClass: capabilityClass,
            endpointManifestHash: endpointManifestHash,
            endpointExpiresAt: endpointExpiresAt,
            metadataHash: metadataHash,
            createdAt: uint64(block.timestamp),
            revision: 1,
            state: NodeState.REGISTERED,
            exists: true
        });
        emit NodeRegistered(nodeId, providerId, operatorAccount, capabilityClass);
    }

    function updateNode(bytes32 nodeId, bytes32 endpointManifestHash, uint64 endpointExpiresAt, bytes32 metadataHash) external {
        Node storage node = _get(nodeId);
        if (node.state == NodeState.RETIRED) revert InvalidStateTransition();
        if (!authorization.isNodeAuthorized(msg.sender, node.providerId, nodeId, VPNIds420.ACTION_UPDATE_NODE, 0)) revert Unauthorized();
        node.endpointManifestHash = endpointManifestHash;
        node.endpointExpiresAt = endpointExpiresAt;
        node.metadataHash = metadataHash;
        node.revision += 1;
        emit NodeUpdated(nodeId, endpointManifestHash, endpointExpiresAt, metadataHash, node.revision);
    }

    function setState(bytes32 nodeId, NodeState newState) external {
        Node storage node = _get(nodeId);
        NodeState oldState = node.state;
        if (newState == oldState) revert NoChange();
        if (!authorization.isNodeAuthorized(msg.sender, node.providerId, nodeId, VPNIds420.ACTION_SET_NODE_STATUS, 0)) revert Unauthorized();
        bool valid =
            (oldState == NodeState.REGISTERED && (newState == NodeState.ACTIVE || newState == NodeState.RETIRED)) ||
            (oldState == NodeState.ACTIVE && (newState == NodeState.DRAINING || newState == NodeState.OFFLINE || newState == NodeState.RETIRED)) ||
            (oldState == NodeState.DRAINING && (newState == NodeState.OFFLINE || newState == NodeState.RETIRED)) ||
            (oldState == NodeState.OFFLINE && (newState == NodeState.ACTIVE || newState == NodeState.RETIRED));
        if (!valid) revert InvalidStateTransition();
        if (newState == NodeState.ACTIVE && providers.providerState(node.providerId) != VPNProviderRegistry420.ProviderState.ACTIVE) revert ProviderInactive();
        node.state = newState;
        node.revision += 1;
        emit NodeStateChanged(nodeId, oldState, newState, node.revision);
    }

    function getNode(bytes32 nodeId) external view returns (Node memory) { return _get(nodeId); }
    function nodeState(bytes32 nodeId) external view returns (NodeState) { return _get(nodeId).state; }

    function _get(bytes32 nodeId) private view returns (Node storage node) {
        node = _nodes[nodeId];
        if (!node.exists) revert NodeNotFound();
    }

    function _validCapabilityClass(bytes32 x) private pure returns (bool) {
        return x == VPNIds420.NODE_ENTRY_RELAY || x == VPNIds420.NODE_MIDDLE_RELAY || x == VPNIds420.NODE_EXIT_RELAY
            || x == VPNIds420.NODE_PRIVATE_GATEWAY || x == VPNIds420.NODE_APP_RELAY;
    }
}
