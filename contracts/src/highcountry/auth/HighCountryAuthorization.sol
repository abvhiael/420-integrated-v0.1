// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ICapabilityRegistry420 } from "../../interfaces/genesis/ICapabilityRegistry420.sol";
import { HCZeroAddress, HCUnauthorized } from "../errors/HighCountryErrors.sol";
import { IHighCountryAuthorization } from "../interfaces/IHighCountryAuthorization.sol";
import { AuthorizationRequest } from "../types/HighCountryTypes.sol";

contract HighCountryAuthorization is IHighCountryAuthorization {
    ICapabilityRegistry420 private immutable _capabilityRegistry;

    constructor(address capabilityRegistry_) {
        if (capabilityRegistry_ == address(0)) revert HCZeroAddress();
        _capabilityRegistry = ICapabilityRegistry420(capabilityRegistry_);
    }

    function capabilityRegistry() external view returns (address) {
        return address(_capabilityRegistry);
    }

    function isAuthorized(AuthorizationRequest calldata request) public view returns (bool) {
        if (request.principal == address(0) || request.moduleId == bytes32(0) || request.actionId == bytes32(0)) {
            return false;
        }

        return _capabilityRegistry.isAuthorized(
            request.principal,
            request.moduleId,
            request.actionId,
            request.scopeHash,
            request.amount
        );
    }

    function requireAuthorized(AuthorizationRequest calldata request) external view {
        if (!isAuthorized(request)) {
            revert HCUnauthorized(request.principal, request.moduleId, request.actionId);
        }
    }
}
