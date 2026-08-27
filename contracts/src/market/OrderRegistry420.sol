// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";

interface IListingRegistry420 {
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

interface IMarketSettlementPolicy420 {
    function isSettlementReporter(bytes32 adapterId, address reporter) external view returns (bool);
}

/// @notice Canonical order/fulfillment state for 420 Market.
/// @dev This contract records commercial state only. Funds remain in 420Pay or another approved settlement system.
contract OrderRegistry420 is I420System {
    enum Status {
        NONE,
        CREATED,
        PAID,
        FULFILLED,
        COMPLETED,
        CANCELLED,
        DISPUTED,
        REFUNDED
    }

    struct Order {
        bytes32 listingId;
        uint32 listingRevision;
        address buyer;
        address seller;
        uint256 quantity;
        address paymentAsset;
        uint256 totalAmount;
        bytes32 settlementAdapterId;
        bytes32 paymentRef;
        bytes32 fulfillmentHash;
        bytes32 disputeHash;
        Status status;
        uint64 createdAt;
        uint64 updatedAt;
    }

    IListingRegistry420 public immutable listingRegistry;
    IMarketSettlementPolicy420 public immutable policyRegistry;

    mapping(bytes32 => Order) public orders;

    error InvalidRegistry();
    error InvalidOrderId();
    error OrderExists();
    error UnknownListing();
    error ListingInactive();
    error InvalidRevision();
    error InvalidQuantity();
    error InvalidAmount();
    error InvalidPaymentAsset();
    error UnknownOrder();
    error NotBuyer();
    error NotSeller();
    error UnauthorizedSettlementReporter();
    error InvalidState();
    error InvalidReference();

    event OrderCreated(
        bytes32 indexed orderId,
        bytes32 indexed listingId,
        uint32 indexed listingRevision,
        address buyer,
        address seller,
        uint256 quantity,
        address paymentAsset,
        uint256 totalAmount,
        bytes32 settlementAdapterId
    );
    event PaymentRecorded(bytes32 indexed orderId, bytes32 indexed paymentRef);
    event FulfillmentRecorded(bytes32 indexed orderId, bytes32 indexed fulfillmentHash);
    event OrderCompleted(bytes32 indexed orderId);
    event OrderCancelled(bytes32 indexed orderId);
    event OrderDisputed(bytes32 indexed orderId, bytes32 indexed disputeHash);
    event RefundRecorded(bytes32 indexed orderId, bytes32 indexed paymentRef);

    constructor(address listingRegistry_, address policyRegistry_) {
        if (listingRegistry_ == address(0) || policyRegistry_ == address(0)) revert InvalidRegistry();
        listingRegistry = IListingRegistry420(listingRegistry_);
        policyRegistry = IMarketSettlementPolicy420(policyRegistry_);
    }

    function systemName() external pure returns (string memory) { return "OrderRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function createOrder(
        bytes32 orderId,
        bytes32 listingId,
        uint32 listingRevision,
        uint256 quantity,
        address paymentAsset,
        uint256 totalAmount
    ) external {
        if (orderId == bytes32(0)) revert InvalidOrderId();
        if (orders[orderId].buyer != address(0)) revert OrderExists();
        if (quantity == 0) revert InvalidQuantity();

        IListingRegistry420.Listing memory current = listingRegistry.getListing(listingId);
        if (current.seller == address(0)) revert UnknownListing();
        if (!current.active || (current.expiresAt != 0 && block.timestamp >= current.expiresAt)) revert ListingInactive();
        if (current.revision != listingRevision) revert InvalidRevision();
        if (quantity > current.quantity) revert InvalidQuantity();

        IListingRegistry420.Listing memory listing = listingRegistry.getListingRevision(listingId, listingRevision);
        if (listing.seller == address(0)) revert UnknownListing();
        if (paymentAsset != listing.quoteAsset) revert InvalidPaymentAsset();
        if (totalAmount == 0) revert InvalidAmount();
        if (listing.unitPrice != 0 && totalAmount != listing.unitPrice * quantity) revert InvalidAmount();

        uint64 nowTs = uint64(block.timestamp);
        orders[orderId] = Order({
            listingId: listingId,
            listingRevision: listingRevision,
            buyer: msg.sender,
            seller: listing.seller,
            quantity: quantity,
            paymentAsset: paymentAsset,
            totalAmount: totalAmount,
            settlementAdapterId: listing.settlementAdapterId,
            paymentRef: bytes32(0),
            fulfillmentHash: bytes32(0),
            disputeHash: bytes32(0),
            status: Status.CREATED,
            createdAt: nowTs,
            updatedAt: nowTs
        });

        emit OrderCreated(
            orderId,
            listingId,
            listingRevision,
            msg.sender,
            listing.seller,
            quantity,
            paymentAsset,
            totalAmount,
            listing.settlementAdapterId
        );
    }

    /// @notice Approved settlement adapter confirms a finalized payment in 420Pay or another canonical settlement system.
    function recordPayment(bytes32 orderId, bytes32 paymentRef) external {
        Order storage order = _order(orderId);
        if (order.status != Status.CREATED) revert InvalidState();
        if (paymentRef == bytes32(0)) revert InvalidReference();
        if (!policyRegistry.isSettlementReporter(order.settlementAdapterId, msg.sender)) {
            revert UnauthorizedSettlementReporter();
        }
        order.paymentRef = paymentRef;
        order.status = Status.PAID;
        order.updatedAt = uint64(block.timestamp);
        emit PaymentRecorded(orderId, paymentRef);
    }

    function recordFulfillment(bytes32 orderId, bytes32 fulfillmentHash) external {
        Order storage order = _order(orderId);
        if (order.seller != msg.sender) revert NotSeller();
        if (order.status != Status.PAID) revert InvalidState();
        if (fulfillmentHash == bytes32(0)) revert InvalidReference();
        order.fulfillmentHash = fulfillmentHash;
        order.status = Status.FULFILLED;
        order.updatedAt = uint64(block.timestamp);
        emit FulfillmentRecorded(orderId, fulfillmentHash);
    }

    function completeOrder(bytes32 orderId) external {
        Order storage order = _order(orderId);
        if (order.buyer != msg.sender) revert NotBuyer();
        if (order.status != Status.FULFILLED) revert InvalidState();
        order.status = Status.COMPLETED;
        order.updatedAt = uint64(block.timestamp);
        emit OrderCompleted(orderId);
    }

    function cancelOrder(bytes32 orderId) external {
        Order storage order = _order(orderId);
        if (order.buyer != msg.sender && order.seller != msg.sender) revert InvalidState();
        if (order.status != Status.CREATED) revert InvalidState();
        order.status = Status.CANCELLED;
        order.updatedAt = uint64(block.timestamp);
        emit OrderCancelled(orderId);
    }

    function disputeOrder(bytes32 orderId, bytes32 disputeHash) external {
        Order storage order = _order(orderId);
        if (order.buyer != msg.sender && order.seller != msg.sender) revert InvalidState();
        if (order.status != Status.PAID && order.status != Status.FULFILLED) revert InvalidState();
        if (disputeHash == bytes32(0)) revert InvalidReference();
        order.disputeHash = disputeHash;
        order.status = Status.DISPUTED;
        order.updatedAt = uint64(block.timestamp);
        emit OrderDisputed(orderId, disputeHash);
    }

    /// @notice Approved settlement adapter confirms the external settlement system finalized a refund.
    function recordRefund(bytes32 orderId, bytes32 refundRef) external {
        Order storage order = _order(orderId);
        if (order.status != Status.DISPUTED && order.status != Status.PAID && order.status != Status.FULFILLED) {
            revert InvalidState();
        }
        if (refundRef == bytes32(0)) revert InvalidReference();
        if (!policyRegistry.isSettlementReporter(order.settlementAdapterId, msg.sender)) {
            revert UnauthorizedSettlementReporter();
        }
        order.paymentRef = refundRef;
        order.status = Status.REFUNDED;
        order.updatedAt = uint64(block.timestamp);
        emit RefundRecorded(orderId, refundRef);
    }

    function _order(bytes32 orderId) private view returns (Order storage order) {
        order = orders[orderId];
        if (order.buyer == address(0)) revert UnknownOrder();
    }
}
