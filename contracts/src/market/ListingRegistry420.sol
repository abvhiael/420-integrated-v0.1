// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./MarketIds420.sol";

interface IMarketPolicyRegistry420 {
    function policyActive(bytes32 policyId) external view returns (bool);
    function settlementAdapterActive(bytes32 adapterId) external view returns (bool);
}

/// @notice Canonical listing state for 420 Market.
/// @dev Listings describe offers only. Inventory ownership and payment custody remain in their canonical systems.
contract ListingRegistry420 is I420System {
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

    IMarketPolicyRegistry420 public immutable policyRegistry;

    mapping(bytes32 => Listing) private _listings;
    mapping(bytes32 => mapping(uint32 => Listing)) private _history;

    error InvalidRegistry();
    error InvalidListingId();
    error ListingExists();
    error UnknownListing();
    error NotSeller();
    error InvalidItemClass();
    error InvalidSaleMechanism();
    error InvalidAssetRef();
    error InvalidQuantity();
    error QuantityImmutable();
    error InvalidExpiry();
    error InactivePolicy();
    error InactiveSettlementAdapter();

    event ListingPublished(
        bytes32 indexed listingId,
        uint32 indexed revision,
        address indexed seller,
        bytes32 itemClass,
        bytes32 assetRef,
        bytes32 metadataHash,
        bytes32 policyId,
        bytes32 saleMechanism,
        bytes32 settlementAdapterId,
        address quoteAsset,
        uint256 unitPrice,
        uint256 quantity,
        uint64 expiresAt,
        bool active
    );
    event ListingCancelled(bytes32 indexed listingId, uint32 indexed revision, address indexed seller);

    constructor(address policyRegistry_) {
        if (policyRegistry_ == address(0)) revert InvalidRegistry();
        policyRegistry = IMarketPolicyRegistry420(policyRegistry_);
    }

    function systemName() external pure returns (string memory) { return "ListingRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 2; }

    function createListing(
        bytes32 listingId,
        bytes32 sellerProfileId,
        bytes32 itemClass,
        bytes32 assetRef,
        bytes32 metadataHash,
        bytes32 policyId,
        bytes32 saleMechanism,
        bytes32 settlementAdapterId,
        address quoteAsset,
        uint256 unitPrice,
        uint256 quantity,
        uint64 expiresAt
    ) external {
        if (listingId == bytes32(0)) revert InvalidListingId();
        if (_listings[listingId].seller != address(0)) revert ListingExists();

        Listing memory next = Listing({
            seller: msg.sender,
            sellerProfileId: sellerProfileId,
            itemClass: itemClass,
            assetRef: assetRef,
            metadataHash: metadataHash,
            policyId: policyId,
            saleMechanism: saleMechanism,
            settlementAdapterId: settlementAdapterId,
            quoteAsset: quoteAsset,
            unitPrice: unitPrice,
            quantity: quantity,
            expiresAt: expiresAt,
            revision: 1,
            active: true
        });
        _publish(listingId, next);
    }

    function reviseListing(
        bytes32 listingId,
        bytes32 metadataHash,
        bytes32 policyId,
        bytes32 saleMechanism,
        bytes32 settlementAdapterId,
        address quoteAsset,
        uint256 unitPrice,
        uint256 quantity,
        uint64 expiresAt
    ) external {
        Listing memory current = _listings[listingId];
        if (current.seller == address(0)) revert UnknownListing();
        if (current.seller != msg.sender) revert NotSeller();
        if (quantity != current.quantity) revert QuantityImmutable();

        Listing memory next = current;
        next.metadataHash = metadataHash;
        next.policyId = policyId;
        next.saleMechanism = saleMechanism;
        next.settlementAdapterId = settlementAdapterId;
        next.quoteAsset = quoteAsset;
        next.unitPrice = unitPrice;
        next.expiresAt = expiresAt;
        next.revision = current.revision + 1;
        next.active = true;
        _publish(listingId, next);
    }

    function cancelListing(bytes32 listingId) external {
        Listing storage current = _listings[listingId];
        if (current.seller == address(0)) revert UnknownListing();
        if (current.seller != msg.sender) revert NotSeller();
        current.active = false;
        _history[listingId][current.revision].active = false;
        emit ListingCancelled(listingId, current.revision, msg.sender);
    }

    function getListing(bytes32 listingId) external view returns (Listing memory) {
        return _listings[listingId];
    }

    function getListingRevision(bytes32 listingId, uint32 revision) external view returns (Listing memory) {
        return _history[listingId][revision];
    }

    function listingAvailable(bytes32 listingId) external view returns (bool) {
        Listing memory listing = _listings[listingId];
        return listing.seller != address(0)
            && listing.active
            && listing.quantity > 0
            && (listing.expiresAt == 0 || block.timestamp < listing.expiresAt);
    }

    function _publish(bytes32 listingId, Listing memory next) private {
        if (!MarketIds420.isCanonicalItemClass(next.itemClass)) revert InvalidItemClass();
        if (!MarketIds420.isCanonicalSaleMechanism(next.saleMechanism)) revert InvalidSaleMechanism();
        if (next.assetRef == bytes32(0)) revert InvalidAssetRef();
        if (next.quantity == 0) revert InvalidQuantity();
        if (next.expiresAt != 0 && next.expiresAt <= block.timestamp) revert InvalidExpiry();
        if (!policyRegistry.policyActive(next.policyId)) revert InactivePolicy();
        if (!policyRegistry.settlementAdapterActive(next.settlementAdapterId)) revert InactiveSettlementAdapter();

        _listings[listingId] = next;
        _history[listingId][next.revision] = next;
        _emitListingPublished(listingId, next);
    }

    function _emitListingPublished(bytes32 listingId, Listing memory listing) private {
        emit ListingPublished(
            listingId,
            listing.revision,
            listing.seller,
            listing.itemClass,
            listing.assetRef,
            listing.metadataHash,
            listing.policyId,
            listing.saleMechanism,
            listing.settlementAdapterId,
            listing.quoteAsset,
            listing.unitPrice,
            listing.quantity,
            listing.expiresAt,
            listing.active
        );
    }
}
