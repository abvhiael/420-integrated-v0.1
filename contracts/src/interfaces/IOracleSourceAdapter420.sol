// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Read-only adapter boundary for normalizing external oracle/TWAP sources.
/// @dev Adapters never gain governance, custody, settlement, or arbitrary execution authority.
interface IOracleSourceAdapter420 {
    function sourceKind() external pure returns (bytes32);
    function readNumeric(bytes32 sourceKey)
        external view
        returns (int256 value, uint64 observedAt, uint8 decimals, uint16 confidenceBps, bytes32 dataHash);
    function readResult(bytes32 sourceKey)
        external view
        returns (bytes32 resultHash, uint64 observedAt, uint16 confidenceBps, bytes32 dataHash);
}
