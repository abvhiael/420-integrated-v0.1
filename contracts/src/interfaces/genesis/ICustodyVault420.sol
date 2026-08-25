// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface ICustodyVault420 {
    struct Position {
        bytes32 positionId;
        bytes32 assetId;
        address beneficiary;
        uint256 deposited;
        uint256 committed;
        uint256 released;
        bytes32 conditionHash;
        bool closed;
    }

    event CustodyOpened(bytes32 indexed positionId,bytes32 indexed assetId,address indexed beneficiary,uint256 amount);
    event CustodyCommitted(bytes32 indexed positionId,uint256 amount,bytes32 conditionHash);
    event CustodyReleased(bytes32 indexed positionId,address indexed beneficiary,uint256 amount,bytes32 referenceId);

    function position(bytes32 positionId) external view returns (Position memory);
    function available(bytes32 positionId) external view returns (uint256);
    function locked(bytes32 positionId) external view returns (uint256);
}
