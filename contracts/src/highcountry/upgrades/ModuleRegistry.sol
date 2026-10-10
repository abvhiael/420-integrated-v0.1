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
import { IHighCountryModuleIdentity } from "../interfaces/IHighCountryModuleIdentity.sol";
import { IEmergencyState } from "../interfaces/IEmergencyState.sol";
import { IRulesetRegistry } from "../interfaces/IRulesetRegistry.sol";
import { EmergencyDomains } from "../constants/EmergencyDomains.sol";
import { UpgradeState } from "../types/HighCountryEnums.sol";
import { AuthorizationRequest } from "../types/HighCountryTypes.sol";

contract ModuleRegistry is IModuleRegistry {
    IHighCountryAuthorization public immutable authorization;
    mapping(bytes32 => ModuleRecord) private _modules;
    mapping(bytes32 => bytes32) public registeredCodeHash;
    mapping(bytes32 => bytes32) public registeredInterface;
    IEmergencyState public emergencyState;
    IRulesetRegistry public rulesetRegistry;
    bytes32 public constant RULESET_BIND_SCOPE = keccak256("HC.RULESET.MODULE_BIND.V1");
    event RulesetRegistryBound(address indexed rulesets);
    bytes32 public constant EMERGENCY_BIND_SCOPE = keccak256("HC.EMERGENCY.MODULE_BIND.V1");
    event EmergencyStateBound(address indexed emergency);

    constructor(
        address authorization_
    ) {
        if (authorization_ == address(0)) revert HCZeroAddress();
        authorization = IHighCountryAuthorization(authorization_);
    }

    function bindRulesetRegistry(
        address candidate
    ) external {
        if (address(rulesetRegistry) != address(0) || candidate.code.length == 0) revert HCInvalidState();
        authorization.requireAuthorized(
            AuthorizationRequest(
                msg.sender, ModuleIds.MODULE_REGISTRY, ActionIds.MODULE_BIND_RULESETS, RULESET_BIND_SCOPE, 0
            )
        );
        if (address(IRulesetRegistry(candidate).authorization()) != address(authorization)) revert HCInvalidState();
        rulesetRegistry = IRulesetRegistry(candidate);
        emit RulesetRegistryBound(candidate);
    }

    function _requireRegisteredRuleset(
        bytes32 rulesetId
    ) private view {
        if (address(rulesetRegistry) == address(0) || !rulesetRegistry.exists(rulesetId)) revert HCInvalidState();
        IRulesetRegistry.RulesetRecord memory record = rulesetRegistry.getRuleset(rulesetId);
        if (!record.exists || record.contentHash == bytes32(0)
            || rulesetRegistry.deriveRulesetId(record.contentHash) != rulesetId) revert HCInvalidState();
    }

    function bindEmergencyState(
        address candidate
    ) external {
        if (address(emergencyState) != address(0) || candidate.code.length == 0) revert HCInvalidState();
        authorization.requireAuthorized(
            AuthorizationRequest(
                msg.sender, ModuleIds.MODULE_REGISTRY, ActionIds.MODULE_BIND_EMERGENCY, EMERGENCY_BIND_SCOPE, 0
            )
        );
        if (
            IEmergencyState(candidate).authorizationRoot() != address(authorization)
                || !IEmergencyState(candidate).isAllowedDomain(EmergencyDomains.MODULE_ACTIVATION)
        ) revert HCInvalidState();
        emergencyState = IEmergencyState(candidate);
        emit EmergencyStateBound(candidate);
    }

    function activeImplementation(
        bytes32 moduleId
    ) external view returns (address) {
        ModuleRecord memory record = _modules[moduleId];
        if (!record.exists) revert HCModuleNotFound(moduleId);
        if (
            record.state != UpgradeState.ACTIVE || address(emergencyState) == address(0)
                || emergencyState.isRestricted(EmergencyDomains.MODULE_ACTIVATION)
                || record.implementation.codehash != registeredCodeHash[moduleId]
        ) revert HCInvalidState();
        _requireRegisteredRuleset(record.rulesetId);
        _verifyIdentity(
            moduleId, record.implementation, record.version, record.rulesetId, registeredInterface[moduleId]
        );
        return record.implementation;
    }

    function _verifyIdentity(
        bytes32 moduleId,
        address implementation,
        uint32 version,
        bytes32 rulesetId,
        bytes32 expectedInterface
    ) private view {
        if (implementation.code.length == 0) revert HCInvalidState();
        (bool ok, bytes memory result) =
            implementation.staticcall(abi.encodeCall(IHighCountryModuleIdentity.highCountryModuleIdentity, ()));
        if (!ok || result.length != 128) revert HCInvalidState();
        (bytes32 actualId, uint32 actualVersion, bytes32 actualRuleset, bytes32 actualInterface) =
            abi.decode(result, (bytes32, uint32, bytes32, bytes32));
        if (
            actualId != moduleId || actualVersion != version || actualRuleset != rulesetId
                || actualInterface == bytes32(0)
                || (expectedInterface != bytes32(0) && actualInterface != expectedInterface)
        ) {
            revert HCInvalidState();
        }
    }

    function getModule(
        bytes32 moduleId
    ) external view returns (ModuleRecord memory) {
        ModuleRecord memory record = _modules[moduleId];
        if (!record.exists) revert HCModuleNotFound(moduleId);
        return record;
    }

    function implementationOf(
        bytes32 moduleId
    ) external view returns (address) {
        ModuleRecord memory record = _modules[moduleId];
        if (!record.exists) revert HCModuleNotFound(moduleId);
        return record.implementation;
    }

    function registerModule(
        bytes32 moduleId,
        address implementation,
        uint32 version,
        bytes32 rulesetId
    ) external {
        if (moduleId == bytes32(0) || rulesetId == bytes32(0) || version == 0) revert HCInvalidId();
        if (implementation == address(0)) revert HCZeroAddress();
        _requireRegisteredRuleset(rulesetId);
        _verifyIdentity(moduleId, implementation, version, rulesetId, bytes32(0));
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

        (,,, bytes32 interfaceId) = IHighCountryModuleIdentity(implementation).highCountryModuleIdentity();
        registeredCodeHash[moduleId] = implementation.codehash;
        registeredInterface[moduleId] = interfaceId;
        _modules[moduleId] = ModuleRecord({
            implementation: implementation,
            version: version,
            state: UpgradeState.PROPOSED,
            rulesetId: rulesetId,
            exists: true
        });

        emit ModuleRegistered(moduleId, implementation, version, rulesetId);
    }

    function setModuleState(
        bytes32 moduleId,
        UpgradeState newState
    ) external {
        ModuleRecord storage record = _modules[moduleId];
        if (!record.exists) revert HCModuleNotFound(moduleId);
        if (!_isValidTransition(record.state, newState)) revert HCInvalidState();
        if (newState == UpgradeState.ACTIVE) {
            _requireRegisteredRuleset(record.rulesetId);
            if (
                address(emergencyState) == address(0) || emergencyState.isRestricted(EmergencyDomains.MODULE_ACTIVATION)
                    || record.implementation.codehash != registeredCodeHash[moduleId]
            ) revert HCInvalidState();
            _verifyIdentity(
                moduleId, record.implementation, record.version, record.rulesetId, registeredInterface[moduleId]
            );
        }

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

    function _isValidTransition(
        UpgradeState from,
        UpgradeState to
    ) private pure returns (bool) {
        if (from == UpgradeState.PROPOSED) return to == UpgradeState.QUALIFIED || to == UpgradeState.REJECTED;
        if (from == UpgradeState.QUALIFIED) return to == UpgradeState.SCHEDULED || to == UpgradeState.REJECTED;
        if (from == UpgradeState.SCHEDULED) return to == UpgradeState.ACTIVE || to == UpgradeState.REJECTED;
        if (from == UpgradeState.ACTIVE) return to == UpgradeState.DRAINING;
        if (from == UpgradeState.DRAINING) return to == UpgradeState.RETIRED;
        return false;
    }
}
