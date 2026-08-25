// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IGenesisInitializable420 {
    function genesisInitialized() external view returns (bool);
    function genesisConfigHash() external view returns (bytes32);
    function initializationVersion() external view returns (uint32);
    function assertGenesisConfiguration(bytes32 expectedConfigHash) external view returns (bool);
}
