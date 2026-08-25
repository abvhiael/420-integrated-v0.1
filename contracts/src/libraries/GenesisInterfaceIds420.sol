// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
library GenesisInterfaceIds420 {
    bytes32 internal constant PROTOCOL_REGISTRY = keccak256("420/APP/PROTOCOL_REGISTRY");
    bytes32 internal constant CANONICAL_ASSET_REGISTRY = keccak256("420/APP/CANONICAL_ASSET_REGISTRY");
    bytes32 internal constant GOVERNANCE_AUTHORITY = keccak256("420/APP/GOVERNANCE_AUTHORITY");
    bytes32 internal constant PAUSE_REGISTRY = keccak256("420/APP/PAUSE_REGISTRY");
    bytes32 internal constant HEALTH_REGISTRY = keccak256("420/APP/HEALTH_REGISTRY");
    bytes32 internal constant ORACLE = keccak256("420/APP/ORACLE");
    bytes32 internal constant IDENTITY_CREDENTIALS = keccak256("420/APP/IDENTITY_CREDENTIALS");
    bytes32 internal constant NAMES = keccak256("420/APP/NAMES");
    bytes32 internal constant SETTLEMENT_HEALTH = keccak256("420/APP/SETTLEMENT_HEALTH");
}
