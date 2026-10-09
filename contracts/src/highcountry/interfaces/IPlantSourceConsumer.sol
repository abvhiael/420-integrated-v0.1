// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Exact deployment and admission context for canonical resource consumers.
interface IPlantSourceConsumer {
    function authorization() external view returns (address);
    function genomeRegistry() external view returns (address);
    function seedRegistry() external view returns (address);
    function cloneRegistry() external view returns (address);
    function sourceContext(
        uint64 plantId
    )
        external
        view
        returns (uint8 kind, uint64 sourceId, bytes32 genomeId, address grower, uint64 parcelId, uint64 plotId);
}
