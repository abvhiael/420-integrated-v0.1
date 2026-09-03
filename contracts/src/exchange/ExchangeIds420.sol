// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library ExchangeIds420 {
    bytes32 internal constant ASSET_REGISTRY = keccak256("420.EXCHANGE.ASSET_REGISTRY.V1");
    bytes32 internal constant MARKET_REGISTRY = keccak256("420.EXCHANGE.MARKET_REGISTRY.V1");
    bytes32 internal constant FEE_POLICY = keccak256("420.EXCHANGE.FEE_POLICY.V1");
    bytes32 internal constant FEE_ROUTER = keccak256("420.EXCHANGE.FEE_ROUTER.V1");
    bytes32 internal constant ROUTE_REGISTRY = keccak256("420.EXCHANGE.ROUTE_REGISTRY.V1");
    bytes32 internal constant EXCHANGE_ROUTER = keccak256("420.EXCHANGE.ROUTER.V1");
    bytes32 internal constant EMERGENCY_CONTROL = keccak256("420.EXCHANGE.EMERGENCY_CONTROL.V1");

    bytes32 internal constant ACTION_CONFIGURE_ASSET = keccak256("420.EXCHANGE.CONFIGURE_ASSET");
    bytes32 internal constant ACTION_MODERATE_ASSET = keccak256("420.EXCHANGE.MODERATE_ASSET");
    bytes32 internal constant ACTION_CONFIGURE_MARKET = keccak256("420.EXCHANGE.CONFIGURE_MARKET");
    bytes32 internal constant ACTION_CONFIGURE_ROUTE = keccak256("420.EXCHANGE.CONFIGURE_ROUTE");
    bytes32 internal constant ACTION_CONFIGURE_FEES = keccak256("420.EXCHANGE.CONFIGURE_FEES");
    bytes32 internal constant ACTION_ROUTE_FEES = keccak256("420.EXCHANGE.ROUTE_FEES");
    bytes32 internal constant ACTION_SWAP = keccak256("420.EXCHANGE.SWAP");
    bytes32 internal constant ACTION_QUOTE = keccak256("420.EXCHANGE.QUOTE");
    bytes32 internal constant ACTION_LIMIT_ORDER = keccak256("420.EXCHANGE.LIMIT_ORDER");
    bytes32 internal constant ACTION_BRIDGE_DEPOSIT = keccak256("420.EXCHANGE.BRIDGE_DEPOSIT");
    bytes32 internal constant ACTION_BRIDGE_WITHDRAW = keccak256("420.EXCHANGE.BRIDGE_WITHDRAW");
    bytes32 internal constant ACTION_EMERGENCY_HALT = keccak256("420.EXCHANGE.EMERGENCY_HALT");
}
