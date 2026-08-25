// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./Types420.sol";

interface IOracle420 {
    struct Price {
        bytes32 baseAssetId;
        bytes32 quoteAssetId;
        uint256 value;
        uint8 decimals;
        uint64 observedAt;
        uint64 validUntil;
        bytes32 sourceHash;
        uint32 observationWindowSeconds;
        uint16 confidenceBps;
        Types420.Health health;
    }

    function price(bytes32 baseAssetId,bytes32 quoteAssetId) external view returns(Price memory);
    function isFresh(bytes32 baseAssetId,bytes32 quoteAssetId,uint64 maxAge) external view returns(bool);
    function isSafe(bytes32 baseAssetId,bytes32 quoteAssetId,uint64 maxAge,uint16 minimumConfidenceBps)
        external view returns(bool);
}
