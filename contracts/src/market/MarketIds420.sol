// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Canonical identifiers shared by 420 Market contracts and clients.
library MarketIds420 {
    bytes32 internal constant ITEM_PHYSICAL_GOOD = keccak256("420/MARKET/ITEM/PHYSICAL_GOOD/V1");
    bytes32 internal constant ITEM_SERVICE = keccak256("420/MARKET/ITEM/SERVICE/V1");
    bytes32 internal constant ITEM_DIGITAL_GOOD = keccak256("420/MARKET/ITEM/DIGITAL_GOOD/V1");
    bytes32 internal constant ITEM_LICENSE = keccak256("420/MARKET/ITEM/LICENSE/V1");
    bytes32 internal constant ITEM_GAME_ASSET = keccak256("420/MARKET/ITEM/GAME_ASSET/V1");
    bytes32 internal constant ITEM_CREATIVE_PRODUCT = keccak256("420/MARKET/ITEM/CREATIVE_PRODUCT/V1");
    bytes32 internal constant ITEM_MERCHANT_INVENTORY = keccak256("420/MARKET/ITEM/MERCHANT_INVENTORY/V1");

    bytes32 internal constant SALE_FIXED_PRICE = keccak256("420/MARKET/SALE/FIXED_PRICE/V1");
    bytes32 internal constant SALE_REQUEST_FOR_QUOTE = keccak256("420/MARKET/SALE/REQUEST_FOR_QUOTE/V1");
    bytes32 internal constant SALE_AUCTION = keccak256("420/MARKET/SALE/AUCTION/V1");

    bytes32 internal constant SERVICE_MARKET_POLICY = keccak256("420/MARKET/SERVICE/POLICY_REGISTRY/V1");
    bytes32 internal constant SERVICE_MARKET_LISTINGS = keccak256("420/MARKET/SERVICE/LISTING_REGISTRY/V1");
    bytes32 internal constant SERVICE_MARKET_ORDERS = keccak256("420/MARKET/SERVICE/ORDER_REGISTRY/V1");
    bytes32 internal constant SERVICE_MARKET_SETTLEMENT_ADAPTER = keccak256("420/MARKET/SERVICE/SETTLEMENT_ADAPTER/V1");

    function isCanonicalItemClass(bytes32 itemClass) internal pure returns (bool) {
        return itemClass == ITEM_PHYSICAL_GOOD
            || itemClass == ITEM_SERVICE
            || itemClass == ITEM_DIGITAL_GOOD
            || itemClass == ITEM_LICENSE
            || itemClass == ITEM_GAME_ASSET
            || itemClass == ITEM_CREATIVE_PRODUCT
            || itemClass == ITEM_MERCHANT_INVENTORY;
    }

    function isCanonicalSaleMechanism(bytes32 mechanism) internal pure returns (bool) {
        return mechanism == SALE_FIXED_PRICE
            || mechanism == SALE_REQUEST_FOR_QUOTE
            || mechanism == SALE_AUCTION;
    }
}
