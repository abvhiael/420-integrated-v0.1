// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Canonical identifiers for the 420Stake shared-interface boundary.
library StakeIds420 {
    bytes32 internal constant VALIDATOR_REGISTRY = keccak256("420/GENESIS/VALIDATOR_REGISTRY/V1");
    bytes32 internal constant ACTION_ACTIVATE = keccak256("420/STAKE/ACTIVATE/V1");
    bytes32 internal constant ACTION_WITHDRAW = keccak256("420/STAKE/WITHDRAW/V1");
}
