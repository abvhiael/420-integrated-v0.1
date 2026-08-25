// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library EventStandard420 {
    struct AuditContext {
        bytes32 objectId;
        bytes32 componentId;
        uint32 version;
        address actor;
        bytes32 assetId;
        uint256 amount;
        bytes32 stateBefore;
        bytes32 stateAfter;
        bytes32 referenceHash;
    }
}
