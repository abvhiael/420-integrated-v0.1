// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ICapabilityRegistry420 } from "../../../../src/interfaces/genesis/ICapabilityRegistry420.sol";
import { HighCountryAuthorization } from "../../../../src/highcountry/auth/HighCountryAuthorization.sol";
import { ActionIds } from "../../../../src/highcountry/constants/ActionIds.sol";
import { ModuleIds } from "../../../../src/highcountry/constants/ModuleIds.sol";
import { UpgradeState } from "../../../../src/highcountry/types/HighCountryEnums.sol";
import { ModuleRegistry } from "../../../../src/highcountry/upgrades/ModuleRegistry.sol";
import { MockCapabilityRegistry } from "../../mocks/MockCapabilityRegistry.sol";

contract MockHighCountryModuleV1 {}
contract MockHighCountryModuleV2 {}

contract ModuleRegistryTest {
    bytes32 private constant MODULE_ID = keccak256("HC.MODULE.TEST");
    bytes32 private constant RULESET_ID = keccak256("ruleset:test");

    MockCapabilityRegistry private capabilityRegistry;
    HighCountryAuthorization private authorization;
    ModuleRegistry private registry;

    constructor() {
        capabilityRegistry = new MockCapabilityRegistry();
        authorization = new HighCountryAuthorization(address(capabilityRegistry));
        registry = new ModuleRegistry(address(authorization));
        _grant(ActionIds.MODULE_REGISTER, keccak256("grant:register"));
        _grant(ActionIds.MODULE_SET_STATE, keccak256("grant:set-state"));
    }

    function testRegisterBindsImplementationOnce() public {
        MockHighCountryModuleV1 implementation = new MockHighCountryModuleV1();
        registry.registerModule(MODULE_ID, address(implementation), 1, RULESET_ID);
        require(registry.implementationOf(MODULE_ID) == address(implementation), "implementation mismatch");

        MockHighCountryModuleV2 replacement = new MockHighCountryModuleV2();
        (bool ok,) = address(registry).call(
            abi.encodeWithSelector(registry.registerModule.selector, MODULE_ID, address(replacement), 2, RULESET_ID)
        );
        require(!ok, "arbitrary implementation swap succeeded");
        require(registry.implementationOf(MODULE_ID) == address(implementation), "implementation changed");
    }

    function testForwardLifecycle() public {
        MockHighCountryModuleV1 implementation = new MockHighCountryModuleV1();
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
        registry.registerModule(MODULE_ID, address(implementation), 1, RULESET_ID);
        (bool ok,) = address(registry).call(
            abi.encodeWithSelector(registry.setModuleState.selector, MODULE_ID, UpgradeState.ACTIVE)
        );
        require(!ok, "lifecycle skip succeeded");
    }

    function testRejectedModuleIsTerminal() public {
        MockHighCountryModuleV1 implementation = new MockHighCountryModuleV1();
        registry.registerModule(MODULE_ID, address(implementation), 1, RULESET_ID);
        registry.setModuleState(MODULE_ID, UpgradeState.REJECTED);
        (bool ok,) = address(registry).call(
            abi.encodeWithSelector(registry.setModuleState.selector, MODULE_ID, UpgradeState.PROPOSED)
        );
        require(!ok, "rejected module revived");
    }

    function _grant(bytes32 actionId, bytes32 grantId) private {
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
