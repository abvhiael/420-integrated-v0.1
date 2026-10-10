// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ICapabilityRegistry420 } from "../../../../src/interfaces/genesis/ICapabilityRegistry420.sol";
import { HighCountryAuthorization } from "../../../../src/highcountry/auth/HighCountryAuthorization.sol";
import { ActionIds } from "../../../../src/highcountry/constants/ActionIds.sol";
import { ModuleIds } from "../../../../src/highcountry/constants/ModuleIds.sol";
import { UpgradeState } from "../../../../src/highcountry/types/HighCountryEnums.sol";
import { RulesetRegistry } from "../../../../src/highcountry/rules/RulesetRegistry.sol";
import { EmergencyState } from "../../../../src/highcountry/security/EmergencyState.sol";
import { ModuleRegistry } from "../../../../src/highcountry/upgrades/ModuleRegistry.sol";
import { MockCapabilityRegistry } from "../../mocks/MockCapabilityRegistry.sol";

contract MockHighCountryModuleV1 {
    function highCountryModuleIdentity() external pure returns (bytes32, uint32, bytes32, bytes32) {
        return (keccak256("HC.MODULE.TEST"), 1, keccak256(abi.encode(keccak256("HC.RULESET.V1"), keccak256("ruleset:test"))), keccak256("HC.INTERFACE.TEST.V1"));
    }
}

contract MockHighCountryModuleV2 { }

contract ModuleRegistryTest {
    bytes32 private constant MODULE_ID = keccak256("HC.MODULE.TEST");
    bytes32 private immutable RULESET_ID;

    MockCapabilityRegistry private capabilityRegistry;
    HighCountryAuthorization private authorization;
    ModuleRegistry private registry;
    RulesetRegistry private rulesets;

    constructor() {
        capabilityRegistry = new MockCapabilityRegistry();
        authorization = new HighCountryAuthorization(address(capabilityRegistry));
        registry = new ModuleRegistry(address(authorization));
        rulesets = new RulesetRegistry(address(authorization));
        RULESET_ID = rulesets.deriveRulesetId(keccak256("ruleset:test"));
        capabilityRegistry.setGrant(
            keccak256("grant:ruleset-register"),
            ICapabilityRegistry420.CapabilityGrant({
                principal: address(this), componentId: ModuleIds.RULESET_REGISTRY,
                capabilityId: ActionIds.RULESET_REGISTER, scopeHash: RULESET_ID,
                perCallLimit: 0, periodLimit: 0, periodSeconds: 0,
                validFrom: 0, validUntil: uint64(block.timestamp + 1 days), revoked: false
            }), 0
        );
        rulesets.registerRuleset(keccak256("ruleset:test"));
        capabilityRegistry.setGrant(
            keccak256("grant:bind-rulesets"),
            ICapabilityRegistry420.CapabilityGrant({
                principal: address(this), componentId: ModuleIds.MODULE_REGISTRY,
                capabilityId: ActionIds.MODULE_BIND_RULESETS, scopeHash: registry.RULESET_BIND_SCOPE(),
                perCallLimit: 0, periodLimit: 0, periodSeconds: 0,
                validFrom: 0, validUntil: uint64(block.timestamp + 1 days), revoked: false
            }), 0
        );
        registry.bindRulesetRegistry(address(rulesets));

        _grant(ActionIds.MODULE_REGISTER, keccak256("grant:register"));
        _grant(ActionIds.MODULE_SET_STATE, keccak256("grant:set-state"));
        _grant(ActionIds.MODULE_APPROVE_ARTIFACT, keccak256("grant:approve-artifact"));
        capabilityRegistry.setGrant(
            keccak256("grant:bind-emergency"),
            ICapabilityRegistry420.CapabilityGrant({
                principal: address(this),
                componentId: ModuleIds.MODULE_REGISTRY,
                capabilityId: ActionIds.MODULE_BIND_EMERGENCY,
                scopeHash: registry.EMERGENCY_BIND_SCOPE(),
                perCallLimit: 0,
                periodLimit: 0,
                periodSeconds: 0,
                validFrom: 0,
                validUntil: uint64(block.timestamp + 1 days),
                revoked: false
            }),
            0
        );
        EmergencyState emergency = new EmergencyState(address(authorization));
        registry.bindEmergencyState(address(emergency));
    }

    function testRegisterBindsImplementationOnce() public {
        MockHighCountryModuleV1 implementation = new MockHighCountryModuleV1();
        registry.approveArtifact(MODULE_ID, address(implementation), 1, RULESET_ID);
        registry.registerModule(MODULE_ID, address(implementation), 1, RULESET_ID);
        require(registry.implementationOf(MODULE_ID) == address(implementation), "implementation mismatch");

        MockHighCountryModuleV2 replacement = new MockHighCountryModuleV2();
        (bool ok,) = address(registry)
            .call(
                abi.encodeWithSelector(registry.registerModule.selector, MODULE_ID, address(replacement), 2, RULESET_ID)
            );
        require(!ok, "arbitrary implementation swap succeeded");
        require(registry.implementationOf(MODULE_ID) == address(implementation), "implementation changed");
    }

    function testForwardLifecycle() public {
        MockHighCountryModuleV1 implementation = new MockHighCountryModuleV1();
        registry.approveArtifact(MODULE_ID, address(implementation), 1, RULESET_ID);
        registry.registerModule(MODULE_ID, address(implementation), 1, RULESET_ID);
        registry.setModuleState(MODULE_ID, UpgradeState.QUALIFIED);
        registry.setModuleState(MODULE_ID, UpgradeState.SCHEDULED);
        registry.setModuleState(MODULE_ID, UpgradeState.ACTIVE);
        registry.setModuleState(MODULE_ID, UpgradeState.DRAINING);
        registry.setModuleState(MODULE_ID, UpgradeState.RETIRED);
        require(uint8(registry.getModule(MODULE_ID).state) == uint8(UpgradeState.RETIRED), "not retired");
    }

    function testCannotSkipLifecycle() public {
        MockHighCountryModuleV1 implementation = new MockHighCountryModuleV1();
        registry.approveArtifact(MODULE_ID, address(implementation), 1, RULESET_ID);
        registry.registerModule(MODULE_ID, address(implementation), 1, RULESET_ID);
        (bool ok,) = address(registry)
            .call(abi.encodeWithSelector(registry.setModuleState.selector, MODULE_ID, UpgradeState.ACTIVE));
        require(!ok, "lifecycle skip succeeded");
    }

    function testRejectedModuleIsTerminal() public {
        MockHighCountryModuleV1 implementation = new MockHighCountryModuleV1();
        registry.approveArtifact(MODULE_ID, address(implementation), 1, RULESET_ID);
        registry.registerModule(MODULE_ID, address(implementation), 1, RULESET_ID);
        registry.setModuleState(MODULE_ID, UpgradeState.REJECTED);
        (bool ok,) = address(registry)
            .call(abi.encodeWithSelector(registry.setModuleState.selector, MODULE_ID, UpgradeState.PROPOSED));
        require(!ok, "rejected module revived");
    }

    function testR0212RejectsEOAAndMissingModuleInterface() public {
        (bool ok,) = address(registry)
            .call(
                abi.encodeWithSelector(
                    registry.registerModule.selector, MODULE_ID, address(0x1234), uint32(1), RULESET_ID
                )
            );
        require(!ok, "EOA registered as module");
        MockHighCountryModuleV2 invalid = new MockHighCountryModuleV2();
        (ok,) = address(registry)
            .call(
                abi.encodeWithSelector(
                    registry.registerModule.selector, MODULE_ID, address(invalid), uint32(1), RULESET_ID
                )
            );
        require(!ok, "module without identity accepted");
    }

    function testR0212ScheduledNotExecutableAndActiveExecutable() public {
        MockHighCountryModuleV1 implementation = new MockHighCountryModuleV1();
        registry.approveArtifact(MODULE_ID, address(implementation), 1, RULESET_ID);
        registry.registerModule(MODULE_ID, address(implementation), 1, RULESET_ID);
        (bool ok,) = address(registry).call(abi.encodeWithSelector(registry.activeImplementation.selector, MODULE_ID));
        require(!ok, "proposed module was executable");
        registry.setModuleState(MODULE_ID, UpgradeState.QUALIFIED);
        registry.setModuleState(MODULE_ID, UpgradeState.SCHEDULED);
        (ok,) = address(registry).call(abi.encodeWithSelector(registry.activeImplementation.selector, MODULE_ID));
        require(!ok, "scheduled module was executable");
        registry.setModuleState(MODULE_ID, UpgradeState.ACTIVE);
        require(registry.activeImplementation(MODULE_ID) == address(implementation), "valid active module rejected");
        registry.setModuleState(MODULE_ID, UpgradeState.DRAINING);
        (ok,) = address(registry).call(abi.encodeWithSelector(registry.activeImplementation.selector, MODULE_ID));
        require(!ok, "draining module executable");
    }

    function _grant(
        bytes32 actionId,
        bytes32 grantId
    ) private {
        ICapabilityRegistry420.CapabilityGrant memory grant = ICapabilityRegistry420.CapabilityGrant({
            principal: address(this),
            componentId: ModuleIds.MODULE_REGISTRY,
            capabilityId: actionId,
            scopeHash: MODULE_ID,
            perCallLimit: 0,
            periodLimit: 0,
            periodSeconds: 0,
            validFrom: 0,
            validUntil: uint64(block.timestamp + 1 days),
            revoked: false
        });
        capabilityRegistry.setGrant(grantId, grant, 0);
    }
}
