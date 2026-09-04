// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ICapabilityRegistry420 } from "../../../../src/interfaces/genesis/ICapabilityRegistry420.sol";
import { HighCountryAuthorization } from "../../../../src/highcountry/auth/HighCountryAuthorization.sol";
import { ActionIds } from "../../../../src/highcountry/constants/ActionIds.sol";
import { ModuleIds } from "../../../../src/highcountry/constants/ModuleIds.sol";
import { RulesetRegistry } from "../../../../src/highcountry/rules/RulesetRegistry.sol";
import { RulesetRouter } from "../../../../src/highcountry/rules/RulesetRouter.sol";
import { MockCapabilityRegistry } from "../../mocks/MockCapabilityRegistry.sol";

contract RulesetRouterTest {
    MockCapabilityRegistry private capabilityRegistry;
    HighCountryAuthorization private authorization;
    RulesetRegistry private registry;
    RulesetRouter private router;

    constructor() {
        capabilityRegistry = new MockCapabilityRegistry();
        authorization = new HighCountryAuthorization(address(capabilityRegistry));
        registry = new RulesetRegistry(address(authorization));
        router = new RulesetRouter(address(authorization), address(registry));
    }

    function testRouteRequiresRegisteredRuleset() public {
        bytes32 domain = keccak256("HC.RULES.DOMAIN.CULTIVATION");
        bytes32 unknownRulesetId = keccak256("unknown");
        _grantRoute(domain);
        (bool ok,) = address(router).call(
            abi.encodeWithSelector(router.setRulesetFor.selector, domain, unknownRulesetId)
        );
        require(!ok, "unknown ruleset routed");
    }

    function testAuthorizedRoute() public {
        bytes32 contentHash = keccak256("ruleset-v1");
        bytes32 rulesetId = registry.deriveRulesetId(contentHash);
        bytes32 domain = keccak256("HC.RULES.DOMAIN.CULTIVATION");
        _grantRegister(rulesetId);
        registry.registerRuleset(contentHash);
        _grantRoute(domain);

        router.setRulesetFor(domain, rulesetId);
        require(router.rulesetFor(domain) == rulesetId, "route mismatch");
    }

    function testDefaultDenyRoute() public {
        bytes32 contentHash = keccak256("ruleset-v1");
        bytes32 rulesetId = registry.deriveRulesetId(contentHash);
        bytes32 domain = keccak256("HC.RULES.DOMAIN.CULTIVATION");
        _grantRegister(rulesetId);
        registry.registerRuleset(contentHash);

        (bool ok,) = address(router).call(abi.encodeWithSelector(router.setRulesetFor.selector, domain, rulesetId));
        require(!ok, "unauthorized route changed");
    }

    function _grantRegister(bytes32 rulesetId) private {
        ICapabilityRegistry420.CapabilityGrant memory grant = ICapabilityRegistry420.CapabilityGrant({
            principal: address(this),
            componentId: ModuleIds.RULESET_REGISTRY,
            capabilityId: ActionIds.RULESET_REGISTER,
            scopeHash: rulesetId,
            perCallLimit: 0,
            periodLimit: 0,
            periodSeconds: 0,
            validFrom: 0,
            validUntil: uint64(block.timestamp + 1 days),
            revoked: false
        });
        capabilityRegistry.setGrant(keccak256(abi.encode("register", rulesetId)), grant, 0);
    }

    function _grantRoute(bytes32 domain) private {
        ICapabilityRegistry420.CapabilityGrant memory grant = ICapabilityRegistry420.CapabilityGrant({
            principal: address(this),
            componentId: ModuleIds.RULESET_ROUTER,
            capabilityId: ActionIds.RULESET_ROUTE,
            scopeHash: domain,
            perCallLimit: 0,
            periodLimit: 0,
            periodSeconds: 0,
            validFrom: 0,
            validUntil: uint64(block.timestamp + 1 days),
            revoked: false
        });
        capabilityRegistry.setGrant(keccak256(abi.encode("route", domain)), grant, 0);
    }
}
