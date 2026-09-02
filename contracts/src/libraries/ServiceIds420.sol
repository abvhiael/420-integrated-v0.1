// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Canonical stable service identifiers for Genesis 420 Integrated services.
/// @dev IDs identify protocol roles, not implementation addresses or presentation names.
library ServiceIds420 {
    bytes32 internal constant PROTOCOL_REGISTRY = keccak256("420/service/protocol-registry/v1");
    bytes32 internal constant WALLET = keccak256("420/service/wallet/v1");
    bytes32 internal constant SMART_ACCOUNTS = keccak256("420/service/smart-accounts/v1");
    bytes32 internal constant INTEROP = keccak256("420/service/420-is/v1");
    bytes32 internal constant RANDOMNESS = keccak256("420/service/randomness/v1");
    bytes32 internal constant EXPLORER = keccak256("420/service/explorer/v1");
    bytes32 internal constant SEARCH = keccak256("420/service/search/v1");
    bytes32 internal constant ANALYTICS = keccak256("420/service/analytics/v1");
    bytes32 internal constant NAMES = keccak256("420/service/names/v1");
    bytes32 internal constant IDENTITY = keccak256("420/service/identity/v1");
    bytes32 internal constant ARBITRATION = keccak256("420/service/arbitration/v1");
    bytes32 internal constant TRUST = keccak256("420/service/trust/v1");
    bytes32 internal constant COMMONS = keccak256("420/service/commons/v1");
    bytes32 internal constant PULSE = keccak256("420/service/pulse/v1");
    bytes32 internal constant MESSENGER = keccak256("420/service/messenger/v1");
    bytes32 internal constant VAULT = keccak256("420/service/vault/v1");
    bytes32 internal constant TREASURY = keccak256("420/service/treasury/v1");
    bytes32 internal constant GRANTS = keccak256("420/service/grants/v1");
    bytes32 internal constant LAUNCHPAD = keccak256("420/service/launchpad/v1");
    bytes32 internal constant TOKEN = keccak256("420/service/token/v1");
    bytes32 internal constant RESOURCE_PROTOCOL = keccak256("420/service/resource-protocol/v1");
    bytes32 internal constant RELAY = keccak256("420/service/relay/v1");
    bytes32 internal constant STORE = keccak256("420/service/store/v1");
    bytes32 internal constant CACHE = keccak256("420/service/cache/v1");
    bytes32 internal constant GATEWAY = keccak256("420/service/gateway/v1");
    bytes32 internal constant MARKET = keccak256("420/service/market/v1");
    bytes32 internal constant RIGHTS = keccak256("420/service/rights/v1");
    bytes32 internal constant SWAP = keccak256("420/service/swap/v1");
    bytes32 internal constant PAY = keccak256("420/service/pay/v1");
    bytes32 internal constant ORACLE = keccak256("420/service/oracle/v1");
    bytes32 internal constant BRIDGE = keccak256("420/service/bridge/v1");
    bytes32 internal constant STAKE = keccak256("420/service/stake/v1");
    bytes32 internal constant CIVIC = keccak256("420/service/civic/v1");
    bytes32 internal constant GOVERNANCE = keccak256("420/service/governance/v1");
    bytes32 internal constant AI = keccak256("420/service/ai/v1");
    bytes32 internal constant COMPUTE_MARKET = keccak256("420/service/compute-market/v1");
    bytes32 internal constant ATTENTION = keccak256("420/service/attention/v1");
    bytes32 internal constant CANNASEUR = keccak256("420/service/cannaseur/v1");
    bytes32 internal constant STATUS = keccak256("420/service/status/v1");

    function isGenesisCanonical(bytes32 serviceId) internal pure returns (bool) {
        return serviceId == PROTOCOL_REGISTRY || serviceId == WALLET || serviceId == SMART_ACCOUNTS || serviceId == INTEROP || serviceId == RANDOMNESS || serviceId == EXPLORER || serviceId == SEARCH || serviceId == ANALYTICS || serviceId == NAMES || serviceId == IDENTITY || serviceId == ARBITRATION || serviceId == TRUST || serviceId == COMMONS || serviceId == PULSE || serviceId == MESSENGER || serviceId == VAULT || serviceId == TREASURY || serviceId == GRANTS || serviceId == LAUNCHPAD || serviceId == TOKEN || serviceId == RESOURCE_PROTOCOL || serviceId == RELAY || serviceId == STORE || serviceId == CACHE || serviceId == GATEWAY || serviceId == MARKET || serviceId == RIGHTS || serviceId == SWAP || serviceId == PAY || serviceId == ORACLE || serviceId == BRIDGE || serviceId == STAKE || serviceId == CIVIC || serviceId == GOVERNANCE || serviceId == AI || serviceId == COMPUTE_MARKET || serviceId == ATTENTION || serviceId == CANNASEUR || serviceId == STATUS;
    }
}
