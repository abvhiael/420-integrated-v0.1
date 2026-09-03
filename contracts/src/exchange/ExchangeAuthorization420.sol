// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/genesis/ICapabilityRegistry420.sol";
import "./ExchangeIds420.sol";

/// @notice Read-only authorization facade for wallet/session-key capabilities used by 420Exchange.
contract ExchangeAuthorization420 {
    ICapabilityRegistry420 public immutable capabilityRegistry;

    constructor(address capabilityRegistry_) {
        require(capabilityRegistry_ != address(0), "capability registry");
        capabilityRegistry = ICapabilityRegistry420(capabilityRegistry_);
    }

    function scopeMarket(bytes32 marketId) public pure returns (bytes32) {
        return keccak256(abi.encode("420/EXCHANGE/MARKET/V1", marketId));
    }

    function scopeAsset(bytes32 assetId) public pure returns (bytes32) {
        return keccak256(abi.encode("420/EXCHANGE/ASSET/V1", assetId));
    }

    function canSwap(address principal, bytes32 marketId, uint256 amount) external view returns (bool) {
        return capabilityRegistry.isAuthorized(
            principal,
            ExchangeIds420.ROUTE_REGISTRY,
            ExchangeIds420.ACTION_SWAP,
            scopeMarket(marketId),
            amount
        );
    }

    function canPlaceLimitOrder(address principal, bytes32 marketId, uint256 amount) external view returns (bool) {
        return capabilityRegistry.isAuthorized(
            principal,
            ExchangeIds420.MARKET_REGISTRY,
            ExchangeIds420.ACTION_LIMIT_ORDER,
            scopeMarket(marketId),
            amount
        );
    }

    function canBridgeDeposit(address principal, bytes32 assetId, uint256 amount) external view returns (bool) {
        return capabilityRegistry.isAuthorized(
            principal,
            ExchangeIds420.ASSET_REGISTRY,
            ExchangeIds420.ACTION_BRIDGE_DEPOSIT,
            scopeAsset(assetId),
            amount
        );
    }

    function canBridgeWithdraw(address principal, bytes32 assetId, uint256 amount) external view returns (bool) {
        return capabilityRegistry.isAuthorized(
            principal,
            ExchangeIds420.ASSET_REGISTRY,
            ExchangeIds420.ACTION_BRIDGE_WITHDRAW,
            scopeAsset(assetId),
            amount
        );
    }
}
