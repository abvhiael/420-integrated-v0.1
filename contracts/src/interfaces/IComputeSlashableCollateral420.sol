// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IComputeSlashableCollateral420 {
    function slashAuthorization() external view returns (address);

    function slashSnapshot(bytes32 positionId) external view returns (
        uint8 subjectKind,
        bytes32 subjectRef,
        address beneficiary,
        bytes32 stakePolicyId,
        uint64 positionRevision,
        uint64 openedAt,
        uint256 slashableAmount,
        bool active,
        bool exiting,
        bool exists
    );
}
