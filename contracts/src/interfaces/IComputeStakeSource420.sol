// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Narrow read interface expected from the independently qualified CMP-1.5 ComputeStake source.
/// @dev Validator stake, wallet balances, payer deposits, and arbitrary token balances do not satisfy this interface.
interface IComputeStakeSource420 {
    struct PositionRead {
        bytes32 positionId;
        uint64 positionRevision;
        uint256 activeAmount;
        uint256 slashableAmount;
        bool active;
        bool exiting;
        uint64 withdrawableAt;
    }

    function computeStakeSourceId() external pure returns (bytes32);

    /// @notice Canonical WorkerRegistry whose worker IDs this source accepts.
    function workerRegistry() external view returns (address);

    function readWorkerPosition(bytes32 workerId, bytes32 stakePolicyId)
        external
        view
        returns (PositionRead memory out);
}
