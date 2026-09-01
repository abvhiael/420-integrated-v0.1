// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library InteropIds420 {
    bytes32 internal constant COMPONENT_420_IS = keccak256("420/IS/COMPONENT/V1");

    bytes32 internal constant DOMAIN_IDENTITY = keccak256("420/IS/DOMAIN/IDENTITY/V1");
    bytes32 internal constant DOMAIN_ENTITLEMENT = keccak256("420/IS/DOMAIN/ENTITLEMENT/V1");
    bytes32 internal constant DOMAIN_CAPABILITY = keccak256("420/IS/DOMAIN/CAPABILITY/V1");
    bytes32 internal constant DOMAIN_PAYMENT = keccak256("420/IS/DOMAIN/PAYMENT/V1");
    bytes32 internal constant DOMAIN_ENCRYPTION = keccak256("420/IS/DOMAIN/ENCRYPTION/V1");
    bytes32 internal constant DOMAIN_SESSION = keccak256("420/IS/DOMAIN/SESSION/V1");
    bytes32 internal constant DOMAIN_CHECKPOINT = keccak256("420/IS/DOMAIN/CHECKPOINT/V1");
    bytes32 internal constant DOMAIN_PRIVACY_PROOF = keccak256("420/IS/DOMAIN/PRIVACY_PROOF/V1");
    bytes32 internal constant DOMAIN_APP_STATE = keccak256("420/IS/DOMAIN/APP_STATE/V1");

    bytes32 internal constant ACTION_PUBLISH_MAPPING = keccak256("420/IS/ACTION/PUBLISH_MAPPING/V1");
    bytes32 internal constant ACTION_SUPERSEDE_MAPPING = keccak256("420/IS/ACTION/SUPERSEDE_MAPPING/V1");
    bytes32 internal constant ACTION_PUBLISH_CHECKPOINT = keccak256("420/IS/ACTION/PUBLISH_CHECKPOINT/V1");

    uint32 internal constant STANDARD_VERSION = 1;
}
