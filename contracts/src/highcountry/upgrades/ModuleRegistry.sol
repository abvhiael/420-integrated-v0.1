// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ActionIds } from "../constants/ActionIds.sol";
import { ModuleIds } from "../constants/ModuleIds.sol";
import {
    HCInvalidId,
    HCInvalidState,
    HCModuleAlreadyRegistered,
    HCModuleNotFound,
    HCZeroAddress
} from "../errors/HighCountryErrors.sol";
import { IHighCountryAuthorization } from "../interfaces/IHighCountryAuthorization.sol";
import { IModuleRegistry } from "../interfaces/IModuleRegistry.sol";
import { UpgradeState } from "../types/HighCountryEnums.sol";
import { AuthorizationRequest } from "../types/HighCountryTypes.sol";

contract ModuleRegistry is IModuleRegistry {
    IHighCountryAuthorization public immutable authorization;
    mapping(bytes32 => ModuleRecord) private _modules;

    constructor(address authorization_) {
        if (authorization_ == address(0)) revert HCZeroAddress();
        authorization = IHighCountryAuthorization(authorization_);
    }

    function getModule(bytes32 moduleId) external view returns (ModuleRecord memory) {
        ModuleRecord memory record = _modules[moduleId];
        if (!record.exists) revert HCModuleNotFound(moduleId);
        return record;
    }

    function implementationOf(bytes32 moduleId) external view returns (address) {
        ModuleRecord memory record = _modules[moduleId];
        if (!record.exists) revert HCModuleNotFound(moduleId);
        return record.implementation;
    }

    function registerModule(bytes32 moduleId, address implementation, uint32 version, bytes32 rulesetId) external {
        if (moduleId == bytes32(0) || rulesetId == bytes32(0) || version == 0) revert HCInvalidId();
        if (implementation == address(0)) revert HCZeroAddress();
        if (_modules[moduleId].exists) revert HCModuleAlreadyRegistered(moduleId);

        authorization.requireAuthorized(
            AuthorizationRequest({
                principal: msg.sender,
                moduleId: ModuleIds.MODULE_REGISTRY,
                actionId: ActionIds.MODULE_REGISTER,
                scopeHash: moduleId,
                amount: 0
            })
        );

        _modules[moduleId] = ModuleRecord({
            implementation: implementation,
            version: version,
            state: UpgradeState.PROPOSED,
            rulesetId: rulesetId,
            exists: true
        });

        emit ModuleRegistered(moduleId, implementation, version, rulesetId);
    }

    function setModuleState(bytes32 moduleId, UpgradeState newState) external {
        ModuleRecord storage record = _modules[moduleId];
        if (!record.exists) revert HCModuleNotFound(moduleId);
        if (!_isValidTransition(record.state, newState)) revert HCInvalidState();

        authorization.requireAuthorized(
            AuthorizationRequest({
                principal: msg.sender,
                moduleId: ModuleIds.MODULE_REGISTRY,
                actionId: ActionIds.MODULE_SET_STATE,
                scopeHash: moduleId,
                amount: 0
            })
        );

        UpgradeState previousState = record.state;
        record.state = newState;
        emit ModuleStateChanged(moduleId, previousState, newState);
    }

    function _isValidTransition(UpgradeState from, UpgradeState to) private pure returns (bool) {
        if (from == UpgradeState.PROPOSED) return to == UpgradeState.QUALIFIED || to == UpgradeState.REJECTED;
        if (from == UpgradeState.QUALIFIED) return to == UpgradeState.SCHEDULED || to == UpgradeState.REJECTED;
        if (from == UpgradeState.SCHEDULED) return to == UpgradeState.ACTIVE || to == UpgradeState.REJECTED;
        if (from == UpgradeState.ACTIVE) return to == UpgradeState.DRAINING;
        if (from == UpgradeState.DRAINING) return to == UpgradeState.RETIRED;
        return false;
    }
}
