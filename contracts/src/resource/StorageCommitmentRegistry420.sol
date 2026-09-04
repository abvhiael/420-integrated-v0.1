// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ResourceAuthorization420.sol";
import "./ResourceIds420.sol";
import "./ResourceNodeRegistry420.sol";
import "./ResourceProviderRegistry420.sol";
import "./StorageProofIds420.sol";
import "./StorageProofSchemeRegistry420.sol";

contract StorageCommitmentRegistry420 is I420System {
    struct Commitment {
        bytes32 providerId;
        bytes32 nodeId;
        bytes32 proofSchemeId;
        bytes32 contentRoot;
        bytes32 replicaRoot;
        bytes32 metadataHash;
        uint128 sizeBytes;
        uint64 startTime;
        uint64 endTime;
        bool exists;
    }
    ResourceAuthorization420 public immutable authorization;
    ResourceProviderRegistry420 public immutable providers;
    ResourceNodeRegistry420 public immutable nodes;
    StorageProofSchemeRegistry420 public immutable schemes;
    mapping(bytes32 => Commitment) private _commitments;
    error ZeroAddress(); error InvalidCommitment(); error CommitmentExists(); error CommitmentNotFound(); error InvalidStoreNode(); error InactiveProofScheme(); error Unauthorized();
    event StorageCommitmentRegistered(bytes32 indexed commitmentId, bytes32 indexed providerId, bytes32 indexed nodeId, bytes32 proofSchemeId, bytes32 contentRoot, bytes32 replicaRoot, uint128 sizeBytes, uint64 startTime, uint64 endTime);
    constructor(address authorization_, address providers_, address nodes_, address schemes_) {
        if (authorization_ == address(0) || providers_ == address(0) || nodes_ == address(0) || schemes_ == address(0)) revert ZeroAddress();
        authorization = ResourceAuthorization420(authorization_); providers = ResourceProviderRegistry420(providers_); nodes = ResourceNodeRegistry420(nodes_); schemes = StorageProofSchemeRegistry420(schemes_);
    }
    function systemName() external pure returns (string memory) { return "StorageCommitmentRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }
    function registerCommitment(bytes32 commitmentId, bytes32 nodeId, bytes32 proofSchemeId, bytes32 contentRoot, bytes32 replicaRoot, uint128 sizeBytes, uint64 startTime, uint64 endTime, bytes32 metadataHash) external {
        if (commitmentId == bytes32(0) || nodeId == bytes32(0) || proofSchemeId == bytes32(0) || contentRoot == bytes32(0) || sizeBytes == 0 || startTime >= endTime || endTime <= block.timestamp) revert InvalidCommitment();
        if (_commitments[commitmentId].exists) revert CommitmentExists();
        if (!schemes.isActive(proofSchemeId)) revert InactiveProofScheme();
        ResourceNodeRegistry420.Node memory node = nodes.getNode(nodeId);
        if (node.serviceId != ResourceIds420.SERVICE_STORE || !nodes.isActiveFor(nodeId, ResourceIds420.SERVICE_STORE)) revert InvalidStoreNode();
        ResourceProviderRegistry420.Provider memory provider = providers.getProvider(node.providerId);
        if (msg.sender != node.operatorAccount && msg.sender != provider.operatorAccount && !authorization.isNodeAuthorized(msg.sender, node.providerId, nodeId, StorageProofIds420.ACTION_REGISTER_STORAGE_COMMITMENT)) revert Unauthorized();
        _commitments[commitmentId] = Commitment(node.providerId, nodeId, proofSchemeId, contentRoot, replicaRoot, metadataHash, sizeBytes, startTime, endTime, true);
        emit StorageCommitmentRegistered(commitmentId, node.providerId, nodeId, proofSchemeId, contentRoot, replicaRoot, sizeBytes, startTime, endTime);
    }
    function getCommitment(bytes32 commitmentId) external view returns (Commitment memory) { return _get(commitmentId); }
    function isLive(bytes32 commitmentId) external view returns (bool) {
        Commitment memory c = _commitments[commitmentId];
        return c.exists && block.timestamp >= c.startTime && block.timestamp <= c.endTime && nodes.isActiveFor(c.nodeId, ResourceIds420.SERVICE_STORE) && schemes.isActive(c.proofSchemeId);
    }
    function _get(bytes32 commitmentId) private view returns (Commitment storage commitment) { commitment = _commitments[commitmentId]; if (!commitment.exists) revert CommitmentNotFound(); }
}
