// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library BridgeIds420 {
    bytes32 internal constant VERIFIED_GATEWAY = keccak256("420/APP/420BRIDGE/VERIFIED_GATEWAY");
    bytes32 internal constant GATEWAY_ROUTER = keccak256("420/APP/420BRIDGE/GATEWAY_ROUTER");
    bytes32 internal constant RISK_MANAGER = keccak256("420/APP/420BRIDGE/RISK_MANAGER");
    bytes32 internal constant TRANSFER_REGISTRY = keccak256("420/APP/420BRIDGE/TRANSFER_REGISTRY");
    bytes32 internal constant ASSET_REGISTRY = keccak256("420/APP/420BRIDGE/ASSET_REGISTRY");
    bytes32 internal constant ROUTE_REGISTRY = keccak256("420/APP/420BRIDGE/ROUTE_REGISTRY");
    bytes32 internal constant ACCOUNTING_REGISTRY = keccak256("420/APP/420BRIDGE/ACCOUNTING_REGISTRY");
    bytes32 internal constant CADC_INTEGRATION = keccak256("420/APP/420BRIDGE/CADC_INTEGRATION");

    bytes32 internal constant ACTION_CONFIGURE = keccak256("420/BRIDGE/ACTION/CONFIGURE");
    bytes32 internal constant ACTION_INBOUND = keccak256("420/BRIDGE/ACTION/INBOUND");
    bytes32 internal constant ACTION_OUTBOUND = keccak256("420/BRIDGE/ACTION/OUTBOUND");
    bytes32 internal constant ACTION_RECONCILE = keccak256("420/BRIDGE/ACTION/RECONCILE");
    bytes32 internal constant LIMIT_HOURLY_IN = keccak256("420/BRIDGE/LIMIT/HOURLY_IN");
    bytes32 internal constant LIMIT_HOURLY_OUT = keccak256("420/BRIDGE/LIMIT/HOURLY_OUT");
}
