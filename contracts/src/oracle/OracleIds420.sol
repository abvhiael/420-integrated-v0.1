// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library OracleIds420 {
    bytes32 internal constant SERVICE_PROVIDER_REGISTRY = keccak256("420/ORACLE/SERVICE/PROVIDER_REGISTRY/V1");
    bytes32 internal constant SERVICE_FEED_REGISTRY = keccak256("420/ORACLE/SERVICE/FEED_REGISTRY/V1");
    bytes32 internal constant SERVICE_ROUTER = keccak256("420/ORACLE/SERVICE/ROUTER/V1");
    bytes32 internal constant SERVICE_RISK_POLICY = keccak256("420/ORACLE/SERVICE/RISK_POLICY/V1");
    bytes32 internal constant SERVICE_RANDOMNESS = keccak256("420/ORACLE/SERVICE/RANDOMNESS_ROUTER/V1");

    bytes32 internal constant SOURCE_KIND_TWAP = keccak256("420/ORACLE/SOURCE/TWAP/V1");
    bytes32 internal constant SOURCE_KIND_EXTERNAL = keccak256("420/ORACLE/SOURCE/EXTERNAL_PROVIDER/V1");

    bytes32 internal constant FEED_PRICE = keccak256("420/ORACLE/FEED/PRICE/V1");
    bytes32 internal constant FEED_PROOF_OF_RESERVE = keccak256("420/ORACLE/FEED/PROOF_OF_RESERVE/V1");
    bytes32 internal constant FEED_OUTCOME = keccak256("420/ORACLE/FEED/OUTCOME/V1");
    bytes32 internal constant FEED_EXTERNAL_API = keccak256("420/ORACLE/FEED/EXTERNAL_API/V1");
    bytes32 internal constant FEED_AUTOMATION = keccak256("420/ORACLE/FEED/AUTOMATION/V1");
    bytes32 internal constant FEED_COMPUTATION = keccak256("420/ORACLE/FEED/COMPUTATION/V1");

    bytes32 internal constant AGGREGATION_MEDIAN_NUMERIC = keccak256("420/ORACLE/AGGREGATION/MEDIAN_NUMERIC/V1");
    bytes32 internal constant AGGREGATION_QUORUM_EQUAL = keccak256("420/ORACLE/AGGREGATION/QUORUM_EQUAL/V1");
}
