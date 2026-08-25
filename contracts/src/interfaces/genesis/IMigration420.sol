// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./Types420.sol";

interface IMigration420 {
    enum MigrationStatus { NONE, PROPOSED, TIMELOCKED, READY, ACTIVE, COMPLETE, ABORTED }

    struct Migration {
        bytes32 migrationId;
        bytes32 componentId;
        address fromImplementation;
        address toImplementation;
        Types420.Version fromVersion;
        Types420.Version toVersion;
        bytes32 manifestHash;
        uint64 activationTime;
        MigrationStatus status;
    }

    event MigrationProposed(bytes32 indexed migrationId,bytes32 indexed componentId,address fromImplementation,address toImplementation);
    event MigrationActivated(bytes32 indexed migrationId);
    event MigrationCompleted(bytes32 indexed migrationId);

    function migration(bytes32 migrationId) external view returns (Migration memory);
    function historicalImplementation(bytes32 componentId,Types420.Version calldata version) external view returns(address);
}
