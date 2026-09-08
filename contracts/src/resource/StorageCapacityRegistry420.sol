// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ResourceAuthorization420.sol";
import "./ResourceIds420.sol";
import "./ResourceNodeRegistry420.sol";
import "./ResourceProviderRegistry420.sol";
import "./StorageIds420.sol";

/// @notice SR-3.2 per-STORE-node capacity accounting and immutable time-bounded reservations.
contract StorageCapacityRegistry420 is I420System {
    struct Capacity {
        uint128 totalBytes;
        uint128 reservedBytes;
        bytes32 metadataHash;
        uint32 revision;
        bool exists;
    }

    struct Reservation {
        bytes32 nodeId;
        bytes32 agreementId;
        uint128 sizeBytes;
        uint64 releaseAfter;
        bool active;
        bool exists;
    }

    ResourceAuthorization420 public immutable authorization;
    ResourceNodeRegistry420 public immutable nodes;
    ResourceProviderRegistry420 public immutable providers;

    mapping(bytes32 => Capacity) private _capacities;
    mapping(bytes32 => Reservation) private _reservations;

    error ZeroAddress();
    error InvalidCapacity();
    error CapacityNotFound();
    error ReservationNotFound();
    error ReservationExists();
    error InsufficientCapacity();
    error InvalidStoreNode();
    error Unauthorized();
    error ReservationLocked();

    event StorageCapacityConfigured(
        bytes32 indexed nodeId,
        uint128 totalBytes,
        uint128 reservedBytes,
        bytes32 metadataHash,
        uint32 revision
    );
    event StorageCapacityReserved(
        bytes32 indexed reservationId,
        bytes32 indexed nodeId,
        bytes32 indexed agreementId,
        uint128 sizeBytes,
        uint64 releaseAfter
    );
    event StorageCapacityReleased(bytes32 indexed reservationId, bytes32 indexed nodeId, uint128 sizeBytes);

    constructor(address authorization_, address nodes_, address providers_) {
        if (authorization_ == address(0) || nodes_ == address(0) || providers_ == address(0)) revert ZeroAddress();
        authorization = ResourceAuthorization420(authorization_);
        nodes = ResourceNodeRegistry420(nodes_);
        providers = ResourceProviderRegistry420(providers_);
    }

    function systemName() external pure returns (string memory) { return "StorageCapacityRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function canonicalReservationId(bytes32 nodeId, bytes32 agreementId) public pure returns (bytes32) {
        return keccak256(abi.encode(StorageIds420.RESERVATION_DOMAIN, nodeId, agreementId));
    }

    function configureCapacity(bytes32 nodeId, uint128 totalBytes, bytes32 metadataHash) external {
        if (nodeId == bytes32(0) || totalBytes == 0 || metadataHash == bytes32(0)) revert InvalidCapacity();
        ResourceNodeRegistry420.Node memory node = nodes.getNode(nodeId);
        if (node.serviceId != ResourceIds420.SERVICE_STORE || !nodes.isActiveFor(nodeId, ResourceIds420.SERVICE_STORE)) {
            revert InvalidStoreNode();
        }
        _requireAuthorized(msg.sender, node, StorageIds420.ACTION_CONFIGURE_STORAGE_CAPACITY);

        Capacity storage capacity = _capacities[nodeId];
        if (totalBytes < capacity.reservedBytes) revert InvalidCapacity();
        capacity.totalBytes = totalBytes;
        capacity.metadataHash = metadataHash;
        capacity.revision = capacity.exists ? capacity.revision + 1 : 1;
        capacity.exists = true;

        emit StorageCapacityConfigured(nodeId, totalBytes, capacity.reservedBytes, metadataHash, capacity.revision);
    }

    function reserveCapacity(bytes32 nodeId, bytes32 agreementId, uint128 sizeBytes, uint64 releaseAfter)
        external
        returns (bytes32 reservationId)
    {
        if (nodeId == bytes32(0) || agreementId == bytes32(0) || sizeBytes == 0 || releaseAfter <= block.timestamp) {
            revert InvalidCapacity();
        }
        ResourceNodeRegistry420.Node memory node = nodes.getNode(nodeId);
        if (node.serviceId != ResourceIds420.SERVICE_STORE || !nodes.isActiveFor(nodeId, ResourceIds420.SERVICE_STORE)) {
            revert InvalidStoreNode();
        }
        _requireAuthorized(msg.sender, node, StorageIds420.ACTION_RESERVE_STORAGE_CAPACITY);

        Capacity storage capacity = _capacities[nodeId];
        if (!capacity.exists) revert CapacityNotFound();
        if (uint256(capacity.reservedBytes) + uint256(sizeBytes) > uint256(capacity.totalBytes)) {
            revert InsufficientCapacity();
        }

        reservationId = canonicalReservationId(nodeId, agreementId);
        if (_reservations[reservationId].exists) revert ReservationExists();

        capacity.reservedBytes += sizeBytes;
        _reservations[reservationId] = Reservation({
            nodeId: nodeId,
            agreementId: agreementId,
            sizeBytes: sizeBytes,
            releaseAfter: releaseAfter,
            active: true,
            exists: true
        });

        emit StorageCapacityReserved(reservationId, nodeId, agreementId, sizeBytes, releaseAfter);
    }

    function releaseCapacity(bytes32 reservationId) external {
        Reservation storage reservation = _reservation(reservationId);
        if (!reservation.active) revert ReservationLocked();
        if (block.timestamp < reservation.releaseAfter) revert ReservationLocked();

        Capacity storage capacity = _capacities[reservation.nodeId];
        capacity.reservedBytes -= reservation.sizeBytes;
        reservation.active = false;
        emit StorageCapacityReleased(reservationId, reservation.nodeId, reservation.sizeBytes);
    }

    function getCapacity(bytes32 nodeId) external view returns (Capacity memory capacity) {
        capacity = _capacities[nodeId];
        if (!capacity.exists) revert CapacityNotFound();
    }

    function getReservation(bytes32 reservationId) external view returns (Reservation memory) {
        return _reservation(reservationId);
    }

    function availableBytes(bytes32 nodeId) external view returns (uint128) {
        Capacity memory capacity = _capacities[nodeId];
        if (!capacity.exists) revert CapacityNotFound();
        return capacity.totalBytes - capacity.reservedBytes;
    }

    function isReservationActive(bytes32 reservationId) external view returns (bool) {
        Reservation memory reservation = _reservations[reservationId];
        return reservation.exists && reservation.active && block.timestamp < reservation.releaseAfter;
    }

    function _requireAuthorized(address actor, ResourceNodeRegistry420.Node memory node, bytes32 actionId) private view {
        ResourceProviderRegistry420.Provider memory provider = providers.getProvider(node.providerId);
        if (
            actor != node.operatorAccount && actor != provider.operatorAccount
                && !authorization.isNodeAuthorized(actor, node.providerId, node.operatorAccount == address(0) ? bytes32(0) : _nodeId(node), actionId)
        ) revert Unauthorized();
    }

    function _nodeId(ResourceNodeRegistry420.Node memory) private pure returns (bytes32) {
        revert("node id required");
    }

    function _reservation(bytes32 reservationId) private view returns (Reservation storage reservation) {
        reservation = _reservations[reservationId];
        if (!reservation.exists) revert ReservationNotFound();
    }
}
