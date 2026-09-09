// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Canonical finalized Ethereum execution-block oracle/light-client boundary.
interface IEthereumFinalityOracle420 {
    function isFinalizedExecutionBlock(uint64 blockNumber, bytes32 blockHash, bytes32 receiptsRoot)
        external
        view
        returns (bool);
}
