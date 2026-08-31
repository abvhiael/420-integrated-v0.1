// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Canonical stable service identifiers for genesis 420 Integrated services.
/// @dev IDs identify protocol roles, not implementation addresses or presentation names.
library ServiceIds420 {
    bytes32 internal constant PROTOCOL_REGISTRY = keccak256("420/service/protocol-registry/v1");
    bytes32 internal constant NAMES = keccak256("420/service/names/v1");
    bytes32 internal constant IDENTITY = keccak256("420/service/identity/v1");
    bytes32 internal constant WALLET = keccak256("420/service/wallet/v1");
    bytes32 internal constant RANDOMNESS = keccak256("420/service/randomness/v1");
    bytes32 internal constant PAY = keccak256("420/service/pay/v1");
    bytes32 internal constant SWAP = keccak256("420/service/swap/v1");
    bytes32 internal constant BRIDGE = keccak256("420/service/bridge/v1");
    bytes32 internal constant STAKE = keccak256("420/service/stake/v1");
    bytes32 internal constant GOVERNANCE = keccak256("420/service/governance/v1");
    bytes32 internal constant AI = keccak256("420/service/ai/v1");
    bytes32 internal constant ATTENTION = keccak256("420/service/attention/v1");
    bytes32 internal constant EXPLORER = keccak256("420/service/explorer/v1");

    function isGenesisCanonical(bytes32 serviceId) internal pure returns (bool) {
        return serviceId == PROTOCOL_REGISTRY || serviceId == NAMES || serviceId == IDENTITY
            || serviceId == WALLET || serviceId == RANDOMNESS || serviceId == PAY || serviceId == SWAP
            || serviceId == BRIDGE || serviceId == STAKE || serviceId == GOVERNANCE || serviceId == AI
            || serviceId == ATTENTION || serviceId == EXPLORER;
    }
}
