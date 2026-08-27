// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";

interface IInventoryListingRegistry420 {
    struct Listing {
        address seller;
        bytes32 sellerProfileId;
        bytes32 itemClass;
        bytes32 assetRef;
        bytes32 metadataHash;
        bytes32 policyId;
        bytes32 saleMechanism;
        bytes32 settlementAdapterId;
        address quoteAsset;
        uint256 unitPrice;
        uint256 quantity;
        uint64 expiresAt;
        uint32 revision;
        bool active;
    }

    function getListing(bytes32 listingId) external view returns (Listing memory);
    function getListingRevision(bytes32 listingId, uint32 revision) external view returns (Listing memory);
}

/// @notice Canonical finite-inventory accounting for 420 Market listings.
/// @dev Tracks reservations only; it never takes custody of the underlying item or asset.
contract InventoryReservation420 is SystemAccess, I420System {
    enum ReservationStatus { NONE, RESERVED, RELEASED, CONSUMED }

    struct Inventory {
        uint256 originalOffered;
        uint256 reserved;
        uint256 sold;
        uint256 released;
        bool initialized;
    }

    struct Reservation {
        bytes32 listingId;
        uint32 listingRevision;
        uint256 quantity;
        ReservationStatus status;
    }

    IInventoryListingRegistry420 public immutable listingRegistry;
    address public orderRegistry;

    mapping(bytes32 => Inventory) public inventory;
    mapping(bytes32 => Reservation) public reservations;

    error InvalidRegistry();
    error AlreadyBound();
    error UnauthorizedOrderRegistry();
    error UnknownListing();
    error InvalidRevision();
    error InvalidQuantity();
    error InsufficientAvailableInventory();
    error ReservationExists();
    error UnknownReservation();
    error InvalidReservationState();
    error InventoryInvariantViolation();

    event OrderRegistryBound(address indexed orderRegistry);
    event InventoryInitialized(bytes32 indexed listingId, uint256 originalOffered);
    event InventoryReserved(bytes32 indexed orderId, bytes32 indexed listingId, uint32 indexed listingRevision, uint256 quantity);
    event InventoryReleased(bytes32 indexed orderId, bytes32 indexed listingId, uint256 quantity);
    event InventoryConsumed(bytes32 indexed orderId, bytes32 indexed listingId, uint256 quantity);

    constructor(address timelock_, address listingRegistry_) SystemAccess(timelock_) {
        if (listingRegistry_ == address(0)) revert InvalidRegistry();
        listingRegistry = IInventoryListingRegistry420(listingRegistry_);
    }

    modifier onlyOrderRegistry() {
        if (msg.sender != orderRegistry || orderRegistry == address(0)) revert UnauthorizedOrderRegistry();
        _;
    }

    function systemName() external pure returns (string memory) { return "InventoryReservation420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function bindOrderRegistry(address orderRegistry_) external onlyGovernance {
        if (orderRegistry_ == address(0)) revert InvalidRegistry();
        if (orderRegistry != address(0)) revert AlreadyBound();
        orderRegistry = orderRegistry_;
        emit OrderRegistryBound(orderRegistry_);
    }

    function reserve(bytes32 orderId, bytes32 listingId, uint32 listingRevision, uint256 quantity)
        external
        onlyOrderRegistry
    {
        if (reservations[orderId].status != ReservationStatus.NONE) revert ReservationExists();
        if (quantity == 0) revert InvalidQuantity();

        IInventoryListingRegistry420.Listing memory current = listingRegistry.getListing(listingId);
        if (current.seller == address(0)) revert UnknownListing();
        if (current.revision != listingRevision) revert InvalidRevision();

        IInventoryListingRegistry420.Listing memory revision = listingRegistry.getListingRevision(listingId, listingRevision);
        if (revision.seller == address(0)) revert UnknownListing();

        Inventory storage state = inventory[listingId];
        if (!state.initialized) {
            state.originalOffered = revision.quantity;
            state.initialized = true;
            emit InventoryInitialized(listingId, revision.quantity);
        } else if (revision.quantity != state.originalOffered) {
            revert InventoryInvariantViolation();
        }

        uint256 availableQuantity = state.originalOffered - state.reserved - state.sold;
        if (quantity > availableQuantity) revert InsufficientAvailableInventory();

        state.reserved += quantity;
        reservations[orderId] = Reservation({
            listingId: listingId,
            listingRevision: listingRevision,
            quantity: quantity,
            status: ReservationStatus.RESERVED
        });
        _assertInvariant(state);
        emit InventoryReserved(orderId, listingId, listingRevision, quantity);
    }

    function release(bytes32 orderId) external onlyOrderRegistry {
        Reservation storage reservation = reservations[orderId];
        if (reservation.status == ReservationStatus.NONE) revert UnknownReservation();
        if (reservation.status != ReservationStatus.RESERVED) revert InvalidReservationState();

        Inventory storage state = inventory[reservation.listingId];
        state.reserved -= reservation.quantity;
        state.released += reservation.quantity;
        reservation.status = ReservationStatus.RELEASED;
        _assertInvariant(state);
        emit InventoryReleased(orderId, reservation.listingId, reservation.quantity);
    }

    function consume(bytes32 orderId) external onlyOrderRegistry {
        Reservation storage reservation = reservations[orderId];
        if (reservation.status == ReservationStatus.NONE) revert UnknownReservation();
        if (reservation.status != ReservationStatus.RESERVED) revert InvalidReservationState();

        Inventory storage state = inventory[reservation.listingId];
        state.reserved -= reservation.quantity;
        state.sold += reservation.quantity;
        reservation.status = ReservationStatus.CONSUMED;
        _assertInvariant(state);
        emit InventoryConsumed(orderId, reservation.listingId, reservation.quantity);
    }

    function available(bytes32 listingId) external view returns (uint256) {
        Inventory memory state = inventory[listingId];
        if (!state.initialized) {
            IInventoryListingRegistry420.Listing memory listing = listingRegistry.getListing(listingId);
            return listing.quantity;
        }
        return state.originalOffered - state.reserved - state.sold;
    }

    function conserved(bytes32 listingId) external view returns (bool) {
        Inventory memory state = inventory[listingId];
        if (!state.initialized) return true;
        return state.originalOffered == (state.originalOffered - state.reserved - state.sold) + state.reserved + state.sold;
    }

    function _assertInvariant(Inventory storage state) private view {
        if (state.reserved + state.sold > state.originalOffered) revert InventoryInvariantViolation();
    }
}
