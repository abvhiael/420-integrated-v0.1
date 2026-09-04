// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ICapabilityRegistry420 } from "../../../../src/interfaces/genesis/ICapabilityRegistry420.sol";
import { HighCountryAuthorization } from "../../../../src/highcountry/auth/HighCountryAuthorization.sol";
import { ActionIds } from "../../../../src/highcountry/constants/ActionIds.sol";
import { ModuleIds } from "../../../../src/highcountry/constants/ModuleIds.sol";
import { RulesetRegistry } from "../../../../src/highcountry/rules/RulesetRegistry.sol";
import { MockCapabilityRegistry } from "../../mocks/MockCapabilityRegistry.sol";

contract RulesetRegistryTest {
    MockCapabilityRegistry private capabilityRegistry;
    HighCountryAuthorization private authorization;
    RulesetRegistry private registry;

    constructor() {
        capabilityRegistry = new MockCapabilityRegistry();
        authorization = new HighCountryAuthorization(address(capabilityRegistry));
        registry = new RulesetRegistry(address(authorization));
    }

    function testRulesetIdIsContentBound() public view {
        bytes32 contentHash = keccak256("canonical-json-ruleset");
        bytes32 expected = keccak256(abi.encode(registry.RULESET_ID_DOMAIN(), contentHash));
        require(registry.deriveRulesetId(contentHash) == expected, "ruleset id mismatch");
    }

    function testRegisterRulesetIsImmutableAndUnique() public {
        bytes32 contentHash = keccak256("canonical-json-ruleset");
        bytes32 rulesetId = registry.deriveRulesetId(contentHash);
        _grant(rulesetId);

        bytes32 registered = registry.registerRuleset(contentHash);
        require(registered == rulesetId, "wrong ruleset id");
        require(registry.exists(rulesetId), "ruleset missing");

        (bool ok,) = address(registry).call(abi.encodeWithSelector(registry.registerRuleset.selector, contentHash));
        require(!ok, "duplicate ruleset registered");
    }

    function testDefaultDenyRegistration() public {
        bytes32 contentHash = keccak256("unauthorized-ruleset");
        (bool ok,) = address(registry).call(abi.encodeWithSelector(registry.registerRuleset.selector, contentHash));
        require(!ok, "unauthorized ruleset registered");
    }

    function _grant(bytes32 rulesetId) private {
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
        capabilityRegistry.setGrant(keccak256(abi.encode("ruleset", rulesetId)), grant, 0);
    }
}
