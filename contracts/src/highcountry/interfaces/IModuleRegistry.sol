// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { UpgradeState } from "../types/HighCountryEnums.sol";

interface IModuleRegistry {
    struct ModuleRecord {
        address implementation;
        uint32 version;
        UpgradeState state;
        bytes32 rulesetId;
        bool exists;
    }

    event ModuleRegistered(
        bytes32 indexed moduleId,
        address indexed implementation,
        uint32 version,
        bytes32 indexed rulesetId
    );
    event ModuleStateChanged(bytes32 indexed moduleId, UpgradeState previousState, UpgradeState newState);

    function getModule(bytes32 moduleId) external view returns (ModuleRecord memory);
    function implementationOf(bytes32 moduleId) external view returns (address);
    function registerModule(bytes32 moduleId, address implementation, uint32 version, bytes32 rulesetId) external;
    function setModuleState(bytes32 moduleId, UpgradeState newState) external;
}
