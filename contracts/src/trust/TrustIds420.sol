// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library TrustIds420 {
    bytes32 internal constant SERVICE_ISSUER_REGISTRY = keccak256("420/TRUST/SERVICE/ISSUER_REGISTRY/V1");
    bytes32 internal constant SERVICE_POLICY_REGISTRY = keccak256("420/TRUST/SERVICE/POLICY_REGISTRY/V1");
    bytes32 internal constant SERVICE_SIGNAL_REGISTRY = keccak256("420/TRUST/SERVICE/SIGNAL_REGISTRY/V1");
    bytes32 internal constant SERVICE_AGGREGATOR = keccak256("420/TRUST/SERVICE/AGGREGATOR/V1");

    bytes32 internal constant SUBJECT_ACCOUNT = keccak256("420/TRUST/SUBJECT/ACCOUNT/V1");
    bytes32 internal constant SUBJECT_IDENTITY = keccak256("420/TRUST/SUBJECT/IDENTITY/V1");
    bytes32 internal constant SUBJECT_PROTOCOL_ENTITY = keccak256("420/TRUST/SUBJECT/PROTOCOL_ENTITY/V1");
    bytes32 internal constant SUBJECT_ORGANIZATION = keccak256("420/TRUST/SUBJECT/ORGANIZATION/V1");

    bytes32 internal constant DOMAIN_MARKET = keccak256("420/TRUST/DOMAIN/MARKET/V1");
    bytes32 internal constant DOMAIN_ORACLE = keccak256("420/TRUST/DOMAIN/ORACLE/V1");
    bytes32 internal constant DOMAIN_RESOURCE = keccak256("420/TRUST/DOMAIN/RESOURCE/V1");
    bytes32 internal constant DOMAIN_VALIDATOR = keccak256("420/TRUST/DOMAIN/VALIDATOR/V1");
    bytes32 internal constant DOMAIN_PAY = keccak256("420/TRUST/DOMAIN/PAY/V1");
    bytes32 internal constant DOMAIN_CREATIVE = keccak256("420/TRUST/DOMAIN/CREATIVE/V1");
    bytes32 internal constant DOMAIN_GAME = keccak256("420/TRUST/DOMAIN/GAME/V1");
    bytes32 internal constant DOMAIN_AI = keccak256("420/TRUST/DOMAIN/AI/V1");

    bytes32 internal constant UNIT_COUNT = keccak256("420/TRUST/UNIT/COUNT/V1");
    bytes32 internal constant UNIT_BASIS_POINTS = keccak256("420/TRUST/UNIT/BASIS_POINTS/V1");
    bytes32 internal constant UNIT_SECONDS = keccak256("420/TRUST/UNIT/SECONDS/V1");
    bytes32 internal constant UNIT_NATIVE_420 = keccak256("420/TRUST/UNIT/NATIVE_420_WEI/V1");
    bytes32 internal constant UNIT_BOOLEAN = keccak256("420/TRUST/UNIT/BOOLEAN_INT/V1");
}
