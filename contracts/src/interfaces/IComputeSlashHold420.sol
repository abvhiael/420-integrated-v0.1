// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IComputeSlashHold420 {
    function outstandingSlash(bytes32 positionId) external view returns (uint256);
}
