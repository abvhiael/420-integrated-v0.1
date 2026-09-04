// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ActionIds } from "../constants/ActionIds.sol";
import { ModuleIds } from "../constants/ModuleIds.sol";
import { HCInvalidId, HCRulesetNotFound, HCZeroAddress } from "../errors/HighCountryErrors.sol";
import { IHighCountryAuthorization } from "../interfaces/IHighCountryAuthorization.sol";
import { IRulesetRegistry } from "../interfaces/IRulesetRegistry.sol";
import { IRulesetRouter } from "../interfaces/IRulesetRouter.sol";
import { AuthorizationRequest } from "../types/HighCountryTypes.sol";

contract RulesetRouter is IRulesetRouter {
    IHighCountryAuthorization public immutable authorization;
    IRulesetRegistry public immutable rulesetRegistry;
    mapping(bytes32 => bytes32) private _routes;

    constructor(address authorization_, address rulesetRegistry_) {
        if (authorization_ == address(0) || rulesetRegistry_ == address(0)) revert HCZeroAddress();
        authorization = IHighCountryAuthorization(authorization_);
        rulesetRegistry = IRulesetRegistry(rulesetRegistry_);
    }

    function rulesetFor(bytes32 domain) external view returns (bytes32) {
        return _routes[domain];
    }

    function setRulesetFor(bytes32 domain, bytes32 rulesetId) external {
        if (domain == bytes32(0) || rulesetId == bytes32(0)) revert HCInvalidId();
        if (!rulesetRegistry.exists(rulesetId)) revert HCRulesetNotFound(rulesetId);

        authorization.requireAuthorized(
            AuthorizationRequest({
                principal: msg.sender,
                moduleId: ModuleIds.RULESET_ROUTER,
                actionId: ActionIds.RULESET_ROUTE,
                scopeHash: domain,
                amount: 0
            })
        );

        _routes[domain] = rulesetId;
        emit RulesetRouteSet(domain, rulesetId);
    }
}
