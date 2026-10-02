// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IComputeSlashDistributionSource420 {
    function previewSlashBatch(bytes32 positionId, uint256 maxAmount, uint64 maxTranches)
        external
        view
        returns (uint256 amount, uint64 visitedTranches);

    function executeSlashBatch(
        bytes32 positionId,
        bytes32 authorizationRef,
        uint256 amount,
        uint64 maxTranches,
        address[] calldata recipients,
        uint256[] calldata recipientAmounts
    ) external returns (uint64 visitedTranches);
}
