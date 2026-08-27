// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Canonical read surface for provider-neutral 420Oracle consumers.
interface IOracle420 {
    struct NumericRead {
        int256 value;
        uint64 updatedAt;
        uint8 decimals;
        uint16 confidenceBps;
        uint16 spreadBps;
        uint16 sourceCount;
    }

    struct ResultRead {
        bytes32 resultHash;
        uint64 updatedAt;
        uint16 agreeingSources;
        uint16 confidenceBps;
    }

    function readNumeric(bytes32 feedId) external view returns (NumericRead memory);
    function readResult(bytes32 feedId) external view returns (ResultRead memory);
}
