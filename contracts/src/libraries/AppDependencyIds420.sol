// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice dApp-side component identifiers for frozen v1.0 interfaces that were not assigned
/// symbolic constants by the frozen GenesisInterfaceIds420 library.
/// @dev This library deliberately lives outside the frozen shared-interface set.
library AppDependencyIds420 {
    bytes32 internal constant FEE_QUOTE = keccak256("420/APP/FEE_QUOTE");
    bytes32 internal constant SYSTEM_SAFETY = keccak256("420/APP/SYSTEM_SAFETY");
    bytes32 internal constant REPLAY_PROTECTION = keccak256("420/APP/REPLAY_PROTECTION");
    bytes32 internal constant RISK_LIMITS = keccak256("420/APP/RISK_LIMITS");
    bytes32 internal constant ASSET_CAPABILITIES = keccak256("420/APP/ASSET_CAPABILITIES");
    bytes32 internal constant METADATA_COMMITMENT = keccak256("420/APP/METADATA_COMMITMENT");
    bytes32 internal constant CHAIN_CONTEXT = keccak256("420/APP/CHAIN_CONTEXT");
}
