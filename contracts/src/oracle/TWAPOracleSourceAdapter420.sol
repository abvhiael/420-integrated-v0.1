// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/IOracleSourceAdapter420.sol";
import "./OracleIds420.sol";

interface ITWAPOracle420Source {
    function latest(bytes32 marketId) external view returns (uint64 timestamp, uint192 priceX96);
}

/// @notice Read-only normalization adapter for the existing Swap TWAP oracle.
/// @dev Converts Q96 price to 18-decimal fixed point. Confidence is reported as 0 because
/// the TWAP source itself does not expose an explicit confidence metric.
contract TWAPOracleSourceAdapter420 is IOracleSourceAdapter420 {
    ITWAPOracle420Source public immutable twap;

    constructor(address twap_) {
        require(twap_ != address(0), "twap");
        twap = ITWAPOracle420Source(twap_);
    }

    function sourceKind() external pure returns (bytes32) {
        return OracleIds420.SOURCE_KIND_TWAP;
    }

    function readNumeric(bytes32 sourceKey)
        external view
        returns (int256 value, uint64 observedAt, uint8 decimals, uint16 confidenceBps, bytes32 dataHash)
    {
        (uint64 timestamp, uint192 priceX96) = twap.latest(sourceKey);
        uint256 normalized = (uint256(priceX96) * 1e18) >> 96;
        require(normalized <= uint256(type(int256).max), "overflow");
        value = int256(normalized);
        observedAt = timestamp;
        decimals = 18;
        confidenceBps = 0;
        dataHash = keccak256(abi.encode(sourceKey, timestamp, priceX96));
    }

    function readResult(bytes32)
        external pure
        returns (bytes32, uint64, uint16, bytes32)
    {
        revert("numeric-only");
    }
}
