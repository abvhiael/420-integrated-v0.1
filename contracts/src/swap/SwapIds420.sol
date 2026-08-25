// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library SwapIds420 {
    bytes32 internal constant GENESIS_DEX_FACTORY = keccak256("420/APP/420SWAP/GENESIS_DEX_FACTORY");
    bytes32 internal constant CANONICAL_MARKET_REGISTRY = keccak256("420/APP/420SWAP/CANONICAL_MARKET_REGISTRY");
    bytes32 internal constant PERMISSIONLESS_DEX_FACTORY = keccak256("420/APP/420SWAP/PERMISSIONLESS_DEX_FACTORY");
    bytes32 internal constant TWAP_ORACLE = keccak256("420/APP/420SWAP/TWAP_ORACLE");
    bytes32 internal constant PUBLIC_BATCH_AUCTION = keccak256("420/APP/420SWAP/PUBLIC_BATCH_AUCTION");
    bytes32 internal constant APPROVED_QUOTE_ASSET_REGISTRY = keccak256("420/APP/420SWAP/APPROVED_QUOTE_ASSET_REGISTRY");
    bytes32 internal constant CANONICAL_SWAP_EXECUTOR = keccak256("420/APP/420SWAP/CANONICAL_SWAP_EXECUTOR");

    bytes32 internal constant ACTION_CONFIGURE = keccak256("420/SWAP/ACTION/CONFIGURE");
    bytes32 internal constant ACTION_REGISTER_POOL = keccak256("420/SWAP/ACTION/REGISTER_POOL");
    bytes32 internal constant ACTION_REGISTER_MARKET = keccak256("420/SWAP/ACTION/REGISTER_MARKET");
    bytes32 internal constant ACTION_EXECUTE_SWAP = keccak256("420/SWAP/ACTION/EXECUTE_SWAP");
    bytes32 internal constant ACTION_PUBLISH_ORACLE = keccak256("420/SWAP/ACTION/PUBLISH_ORACLE");
    bytes32 internal constant ACTION_BID = keccak256("420/SWAP/ACTION/BID");
    bytes32 internal constant ACTION_SETTLE_AUCTION = keccak256("420/SWAP/ACTION/SETTLE_AUCTION");
}
