// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ActionIds } from "../constants/ActionIds.sol";
import { ModuleIds } from "../constants/ModuleIds.sol";
import {
    HCGenesisAlreadyFinalized,
    HCGenesisAuthorityDisabled,
    HCInvalidGenesisRoot,
    HCZeroAddress
} from "../errors/HighCountryErrors.sol";
import { IGenesisRegistry } from "../interfaces/IGenesisRegistry.sol";
import { IHighCountryAuthorization } from "../interfaces/IHighCountryAuthorization.sol";
import { AuthorizationRequest, GenesisRoots } from "../types/HighCountryTypes.sol";

contract GenesisRegistry is IGenesisRegistry {
    bytes32 private constant MANIFEST_ROOT = keccak256("manifestRoot");
    bytes32 private constant PARAMETER_ROOT = keccak256("parameterRoot");
    bytes32 private constant RULESET_ROOT = keccak256("rulesetRoot");
    bytes32 private constant LAND_ROOT = keccak256("landRoot");
    bytes32 private constant RANDOMNESS_ROOT = keccak256("randomnessRoot");
    bytes32 private constant QUALIFICATION_ROOT = keccak256("qualificationRoot");

    IHighCountryAuthorization public immutable authorization;

    GenesisRoots private _roots;
    bool public finalized;
    bool public genesisAuthorityEnabled = true;

    constructor(address authorization_) {
        if (authorization_ == address(0)) revert HCZeroAddress();
        authorization = IHighCountryAuthorization(authorization_);
    }

    function roots() external view returns (GenesisRoots memory) {
        return _roots;
    }

    function setRoots(GenesisRoots calldata newRoots) external {
        if (!genesisAuthorityEnabled) revert HCGenesisAuthorityDisabled();
        if (finalized) revert HCGenesisAlreadyFinalized();
        _requireAuthorized(ActionIds.GENESIS_SET_ROOTS);
        _validateRoots(newRoots);

        _roots = newRoots;
        emit GenesisRootsSet(
            newRoots.manifestRoot,
            newRoots.parameterRoot,
            newRoots.rulesetRoot,
            newRoots.landRoot,
            newRoots.randomnessRoot,
            newRoots.qualificationRoot
        );
    }

    function finalizeGenesis() external {
        if (!genesisAuthorityEnabled) revert HCGenesisAuthorityDisabled();
        if (finalized) revert HCGenesisAlreadyFinalized();
        _requireAuthorized(ActionIds.GENESIS_FINALIZE);
        _validateRoots(_roots);

        finalized = true;
        genesisAuthorityEnabled = false;

        emit GenesisFinalized(uint64(block.timestamp));
        emit GenesisAuthorityDisabled();
    }

    function _requireAuthorized(bytes32 actionId) private view {
        authorization.requireAuthorized(
            AuthorizationRequest({
                principal: msg.sender,
                moduleId: ModuleIds.GENESIS_REGISTRY,
                actionId: actionId,
                scopeHash: bytes32(0),
                amount: 0
            })
        );
    }

    function _validateRoots(GenesisRoots memory candidate) private pure {
        if (candidate.manifestRoot == bytes32(0)) revert HCInvalidGenesisRoot(MANIFEST_ROOT);
        if (candidate.parameterRoot == bytes32(0)) revert HCInvalidGenesisRoot(PARAMETER_ROOT);
        if (candidate.rulesetRoot == bytes32(0)) revert HCInvalidGenesisRoot(RULESET_ROOT);
        if (candidate.landRoot == bytes32(0)) revert HCInvalidGenesisRoot(LAND_ROOT);
        if (candidate.randomnessRoot == bytes32(0)) revert HCInvalidGenesisRoot(RANDOMNESS_ROOT);
        if (candidate.qualificationRoot == bytes32(0)) revert HCInvalidGenesisRoot(QUALIFICATION_ROOT);
    }
}
