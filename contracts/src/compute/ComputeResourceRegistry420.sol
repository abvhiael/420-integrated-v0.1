// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ComputeAuthorization420.sol";
import "./ComputeProviderRegistry420.sol";
import "./ComputeNodeRegistry420.sol";
import "./ComputeIds420.sol";

contract ComputeResourceRegistry420 is I420System {
    enum State { NONE, REGISTERED, ACTIVE, SUSPENDED, RETIRED }

    struct Resource {
        bytes32 providerId;
        bytes32 nodeId;
        bytes32 computeClass;
        bytes32 hardwareProfileHash;
        bytes32 runtimeProfileId;
        bytes32 capabilitiesHash;
        uint128 capacityUnits;
        uint64 createdAt;
        uint32 revision;
        State state;
        bool exists;
    }

    ComputeAuthorization420 public immutable authorization;
    ComputeProviderRegistry420 public immutable providers;
    ComputeNodeRegistry420 public immutable nodes;
    mapping(bytes32 => Resource) private _resources;

    error InvalidResource();
    error ResourceExists();
    error ResourceNotFound();
    error Unauthorized();
    error InvalidState();

    event ResourceRegistered(
        bytes32 indexed resourceId, bytes32 indexed nodeId, bytes32 indexed providerId, bytes32 computeClass
    );
    event ResourceUpdated(bytes32 indexed resourceId, bytes32 hardwareProfileHash, uint128 capacityUnits, uint32 revision);
    event ResourceStateChanged(bytes32 indexed resourceId, State previousState, State newState, uint32 revision);

    constructor(address authorization_, address providers_, address nodes_) {
        if (authorization_ == address(0) || providers_ == address(0) || nodes_ == address(0)) revert InvalidResource();
        authorization = ComputeAuthorization420(authorization_);
        providers = ComputeProviderRegistry420(providers_);
        nodes = ComputeNodeRegistry420(nodes_);
    }

    function systemName() external pure returns (string memory) { return "ComputeResourceRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function registerResource(
        bytes32 resourceId,
        bytes32 nodeId,
        bytes32 computeClass,
        bytes32 hardwareProfileHash,
        bytes32 runtimeProfileId,
        bytes32 capabilitiesHash,
        uint128 capacityUnits
    ) external {
        if (
            resourceId == bytes32(0) || nodeId == bytes32(0) || !ComputeIds420.isComputeClass(computeClass)
                || hardwareProfileHash == bytes32(0) || runtimeProfileId == bytes32(0)
                || capabilitiesHash == bytes32(0) || capacityUnits == 0
        ) revert InvalidResource();
        if (_resources[resourceId].exists) revert ResourceExists();

        ComputeNodeRegistry420.Node memory n = nodes.getNode(nodeId);
        ComputeProviderRegistry420.Provider memory p = providers.getProvider(n.providerId);
        if (
            msg.sender != n.operatorAccount && msg.sender != p.operatorAccount
                && !authorization.isResourceAuthorized(
                    msg.sender, n.providerId, nodeId, resourceId, ComputeIds420.ACTION_REGISTER_RESOURCE
                )
        ) revert Unauthorized();

        _resources[resourceId] = Resource({
            providerId: n.providerId,
            nodeId: nodeId,
            computeClass: computeClass,
            hardwareProfileHash: hardwareProfileHash,
            runtimeProfileId: runtimeProfileId,
            capabilitiesHash: capabilitiesHash,
            capacityUnits: capacityUnits,
            createdAt: uint64(block.timestamp),
            revision: 1,
            state: State.REGISTERED,
            exists: true
        });
        emit ResourceRegistered(resourceId, nodeId, n.providerId, computeClass);
    }

    function updateResource(
        bytes32 resourceId,
        bytes32 hardwareProfileHash,
        bytes32 runtimeProfileId,
        bytes32 capabilitiesHash,
        uint128 capacityUnits
    ) external {
        Resource storage r = _get(resourceId);
        if (r.state == State.ACTIVE || r.state == State.RETIRED) revert InvalidState();
        if (
            hardwareProfileHash == bytes32(0) || runtimeProfileId == bytes32(0)
                || capabilitiesHash == bytes32(0) || capacityUnits == 0
        ) revert InvalidResource();
        if (
            !authorization.isResourceAuthorized(
                msg.sender, r.providerId, r.nodeId, resourceId, ComputeIds420.ACTION_UPDATE_RESOURCE
            )
        ) {
            ComputeProviderRegistry420.Provider memory p = providers.getProvider(r.providerId);
            ComputeNodeRegistry420.Node memory n = nodes.getNode(r.nodeId);
            if (msg.sender != p.operatorAccount && msg.sender != n.operatorAccount) revert Unauthorized();
        }
        r.hardwareProfileHash = hardwareProfileHash;
        r.runtimeProfileId = runtimeProfileId;
        r.capabilitiesHash = capabilitiesHash;
        r.capacityUnits = capacityUnits;
        r.revision += 1;
        emit ResourceUpdated(resourceId, hardwareProfileHash, capacityUnits, r.revision);
    }

    function setState(bytes32 resourceId, State next) external {
        Resource storage r = _get(resourceId);
        if (
            !authorization.isResourceAuthorized(
                msg.sender, r.providerId, r.nodeId, resourceId, ComputeIds420.ACTION_SET_RESOURCE_STATE
            )
        ) {
            ComputeProviderRegistry420.Provider memory p = providers.getProvider(r.providerId);
            ComputeNodeRegistry420.Node memory n = nodes.getNode(r.nodeId);
            if (msg.sender != p.operatorAccount && msg.sender != n.operatorAccount) revert Unauthorized();
        }
        State previous = r.state;
        bool ok = (previous == State.REGISTERED && (next == State.ACTIVE || next == State.RETIRED))
            || (previous == State.ACTIVE && (next == State.SUSPENDED || next == State.RETIRED))
            || (previous == State.SUSPENDED && (next == State.ACTIVE || next == State.RETIRED));
        if (!ok) revert InvalidState();
        if (next == State.ACTIVE && !nodes.isActive(r.nodeId)) revert InvalidState();
        r.state = next;
        r.revision += 1;
        emit ResourceStateChanged(resourceId, previous, next, r.revision);
    }

    function getResource(bytes32 resourceId) external view returns (Resource memory) { return _get(resourceId); }

    function isActive(bytes32 resourceId) external view returns (bool) {
        Resource memory r = _resources[resourceId];
        return r.exists && r.state == State.ACTIVE && nodes.isActive(r.nodeId);
    }

    function _get(bytes32 resourceId) private view returns (Resource storage r) {
        r = _resources[resourceId];
        if (!r.exists) revert ResourceNotFound();
    }
}
