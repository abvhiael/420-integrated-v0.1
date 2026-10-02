// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/IOracleSourceAdapter420.sol";
import "../interfaces/genesis/Types420.sol";
import "./OracleIds420.sol";

interface ITWAPOracle420Source {
    function readObservation(bytes32 marketId)
        external view
        returns (
            uint192 priceX96,
            uint64 observedAt,
            uint64 validUntil,
            uint32 observationWindowSeconds,
            uint16 confidenceBps,
            bytes32 sourceHash,
            Types420.Health health
        );
}

/// @notice Read-only normalization adapter for the canonical Swap TWAP oracle.
/// @dev The Swap oracle itself enforces source identity, observation window and freshness before this
///      adapter returns data. Confidence remains 0 because a single-pool TWAP exposes no statistical
///      confidence score; consumers that require one must combine it through 420Oracle policy.
contract TWAPOracleSourceAdapter420 is IOracleSourceAdapter420 {
    ITWAPOracle420Source public immutable twap;

    constructor(address twap_) {
        require(twap_ != address(0) && twap_.code.length != 0, "twap");
        twap = ITWAPOracle420Source(twap_);
    }

    function sourceKind() external pure returns (bytes32) {
        return OracleIds420.SOURCE_KIND_TWAP;
    }

    function readNumeric(bytes32 sourceKey)
        external view
        returns (int256 value, uint64 observedAt, uint8 decimals, uint16 confidenceBps, bytes32 dataHash)
    {
        (
            uint192 priceX96,
            uint64 timestamp,
            uint64 validUntil,
            uint32 observationWindowSeconds,
            uint16 sourceConfidenceBps,
            bytes32 sourceHash,
            Types420.Health health
        ) = twap.readObservation(sourceKey);

        require(health == Types420.Health.HEALTHY, "unhealthy");
        uint256 normalized = (uint256(priceX96) * 1e18) >> 96;
        require(normalized != 0 && normalized <= uint256(type(int256).max), "overflow");

        value = int256(normalized);
        observedAt = timestamp;
        decimals = 18;
        confidenceBps = sourceConfidenceBps;
        dataHash = keccak256(
            abi.encode(
                sourceKey,
                timestamp,
                validUntil,
                observationWindowSeconds,
                sourceHash,
                priceX96
            )
        );
    }

    function readResult(bytes32)
        external pure
        returns (bytes32, uint64, uint16, bytes32)
    {
        revert("numeric-only");
    }
}
