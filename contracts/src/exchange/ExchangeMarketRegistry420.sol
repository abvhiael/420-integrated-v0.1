// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "./ExchangeTypes420.sol";

interface IExchangeAssetRegistry420 {
    function isTradeEligible(bytes32 assetId) external view returns (bool);
}

contract ExchangeMarketRegistry420 is SystemAccess {
    struct Market {
        bytes32 baseAssetId;
        bytes32 quoteAssetId;
        bytes32 executionMarketId;
        address executionVenue;
        ExchangeTypes420.MarketStatus status;
        bytes32 metadataHash;
    }

    IExchangeAssetRegistry420 public immutable assetRegistry;
    bytes32 public immutable native420AssetId;

    mapping(bytes32 => Market) public markets;

    event MarketConfigured(
        bytes32 indexed marketId,
        bytes32 indexed baseAssetId,
        bytes32 indexed quoteAssetId,
        address executionVenue,
        ExchangeTypes420.MarketStatus status
    );
    event MarketStatusChanged(bytes32 indexed marketId, ExchangeTypes420.MarketStatus oldStatus, ExchangeTypes420.MarketStatus newStatus);

    constructor(address timelock_, address assetRegistry_, bytes32 native420AssetId_) SystemAccess(timelock_) {
        if (assetRegistry_ == address(0)) revert ZeroAddress();
        require(native420AssetId_ != bytes32(0), "420 asset id");
        assetRegistry = IExchangeAssetRegistry420(assetRegistry_);
        native420AssetId = native420AssetId_;
    }

    function configureMarket(
        bytes32 marketId,
        bytes32 baseAssetId,
        bytes32 quoteAssetId,
        bytes32 executionMarketId,
        address executionVenue,
        ExchangeTypes420.MarketStatus status,
        bytes32 metadataHash
    ) external onlyGovernance {
        require(marketId != bytes32(0), "market id");
        require(baseAssetId != bytes32(0) && quoteAssetId != bytes32(0) && baseAssetId != quoteAssetId, "pair");
        require(status != ExchangeTypes420.MarketStatus.NONE, "status");
        if (status == ExchangeTypes420.MarketStatus.ACTIVE) {
            _requireEligible(baseAssetId);
            _requireEligible(quoteAssetId);
            require(executionVenue != address(0) && executionVenue.code.length != 0, "venue");
        }

        markets[marketId] = Market({
            baseAssetId: baseAssetId,
            quoteAssetId: quoteAssetId,
            executionMarketId: executionMarketId,
            executionVenue: executionVenue,
            status: status,
            metadataHash: metadataHash
        });

        emit MarketConfigured(marketId, baseAssetId, quoteAssetId, executionVenue, status);
    }

    function setStatus(bytes32 marketId, ExchangeTypes420.MarketStatus newStatus) external onlyGovernance {
        Market storage market = markets[marketId];
        require(market.status != ExchangeTypes420.MarketStatus.NONE, "unknown market");
        require(newStatus != ExchangeTypes420.MarketStatus.NONE, "status");
        if (newStatus == ExchangeTypes420.MarketStatus.ACTIVE) {
            _requireEligible(market.baseAssetId);
            _requireEligible(market.quoteAssetId);
            require(market.executionVenue != address(0) && market.executionVenue.code.length != 0, "venue");
        }
        ExchangeTypes420.MarketStatus oldStatus = market.status;
        market.status = newStatus;
        emit MarketStatusChanged(marketId, oldStatus, newStatus);
    }

    function isActive(bytes32 marketId) external view returns (bool) {
        Market storage market = markets[marketId];
        if (market.status != ExchangeTypes420.MarketStatus.ACTIVE) return false;
        return _eligible(market.baseAssetId) && _eligible(market.quoteAssetId);
    }

    function _requireEligible(bytes32 assetId) internal view {
        require(_eligible(assetId), "asset not eligible");
    }

    function _eligible(bytes32 assetId) internal view returns (bool) {
        if (assetId == native420AssetId) return true;
        return assetRegistry.isTradeEligible(assetId);
    }
}
