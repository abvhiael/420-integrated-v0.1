// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ICapabilityRegistryExtended420 } from "../../interfaces/genesis/ICapabilityRegistryExtended420.sol";
import { ICapabilityRegistry420 } from "../../interfaces/genesis/ICapabilityRegistry420.sol";
import { HCZeroAddress, HCUnauthorized } from "../errors/HighCountryErrors.sol";
import { IHighCountryAuthorization } from "../interfaces/IHighCountryAuthorization.sol";
import { AuthorizationRequest } from "../types/HighCountryTypes.sol";

contract HighCountryAuthorization is IHighCountryAuthorization {
    ICapabilityRegistry420 private immutable _capabilityRegistry;

    constructor(
        address capabilityRegistry_
    ) {
        if (capabilityRegistry_ == address(0)) revert HCZeroAddress();
        _capabilityRegistry = ICapabilityRegistry420(capabilityRegistry_);
    }

    function capabilityRegistry() external view returns (address) {
        return address(_capabilityRegistry);
    }

    function isAuthorized(
        AuthorizationRequest calldata request
    ) public view returns (bool) {
        if (request.principal == address(0) || request.moduleId == bytes32(0) || request.actionId == bytes32(0)) {
            return false;
        }

        // HC authorization is view-only: it cannot account for cumulative usage.
        // Reject periodic grants rather than imply a budget that callers can bypass.
        bytes32 grantId;
        try ICapabilityRegistryExtended420(address(_capabilityRegistry))
            .activeGrantId(request.principal, request.moduleId, request.actionId, request.scopeHash) returns (
            bytes32 activeGrant
        ) {
            grantId = activeGrant;
        } catch {
            return false;
        }
        if (grantId == bytes32(0)) return false;
        try _capabilityRegistry.grant(grantId) returns (ICapabilityRegistry420.CapabilityGrant memory g) {
            if (
                g.principal != request.principal || g.componentId != request.moduleId
                    || g.capabilityId != request.actionId || g.scopeHash != request.scopeHash || g.revoked
                    || g.periodLimit != 0 || g.periodSeconds != 0
            ) return false;
        } catch {
            return false;
        }
        try _capabilityRegistry.isAuthorized(
            request.principal, request.moduleId, request.actionId, request.scopeHash, request.amount
        ) returns (
            bool allowed
        ) {
            return allowed;
        } catch {
            return false;
        }
    }

    function requireAuthorized(
        AuthorizationRequest calldata request
    ) external view {
        if (!isAuthorized(request)) {
            revert HCUnauthorized(request.principal, request.moduleId, request.actionId);
        }
    }
}
