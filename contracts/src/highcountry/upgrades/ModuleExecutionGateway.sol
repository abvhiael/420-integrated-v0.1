// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { IModuleRegistry } from "../interfaces/IModuleRegistry.sol";
import { IHighCountryAuthorization } from "../interfaces/IHighCountryAuthorization.sol";
import { ModuleIds } from "../constants/ModuleIds.sol";
import { ActionIds } from "../constants/ActionIds.sol";
import { AuthorizationRequest } from "../types/HighCountryTypes.sol";

/// @notice Authorized module dispatch, resolving live ACTIVE provenance on every call.
/// @dev No native value transfers and no fallback to unsafe implementationOf.
contract ModuleExecutionGateway {
    IModuleRegistry public immutable modules;
    IHighCountryAuthorization public immutable authorization;
    error InvalidGatewayCall();
    event ModuleExecuted(bytes32 indexed moduleId, bytes4 indexed selector, address indexed caller);

    constructor(address registry, address auth) {
        if (registry.code.length == 0 || auth.code.length == 0) revert InvalidGatewayCall();
        modules = IModuleRegistry(registry);
        authorization = IHighCountryAuthorization(auth);
    }

    function execute(bytes32 moduleId, bytes calldata callData) external returns (bytes memory result) {
        if (callData.length < 4) revert InvalidGatewayCall();
        bytes4 selector = bytes4(callData[:4]);
        authorization.requireAuthorized(
            AuthorizationRequest(
                msg.sender, ModuleIds.MODULE_REGISTRY, ActionIds.MODULE_EXECUTE,
                keccak256(abi.encode(moduleId, selector)), 0
            )
        );
        address implementation = modules.activeImplementation(moduleId);
        (bool ok, bytes memory data) = implementation.call(callData);
        if (!ok) {
            assembly ("memory-safe") { revert(add(data, 32), mload(data)) }
        }
        emit ModuleExecuted(moduleId, selector, msg.sender);
        return data;
    }
}
