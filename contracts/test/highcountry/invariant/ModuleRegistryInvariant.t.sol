// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ICapabilityRegistry420 } from "../../../src/interfaces/genesis/ICapabilityRegistry420.sol";
import { HighCountryAuthorization } from "../../../src/highcountry/auth/HighCountryAuthorization.sol";
import { ActionIds } from "../../../src/highcountry/constants/ActionIds.sol";
import { ModuleIds } from "../../../src/highcountry/constants/ModuleIds.sol";
import { UpgradeState } from "../../../src/highcountry/types/HighCountryEnums.sol";
import { ModuleRegistry } from "../../../src/highcountry/upgrades/ModuleRegistry.sol";
import { InvariantTarget420 } from "../../helpers/InvariantTarget420.sol";
import { MockCapabilityRegistry } from "../mocks/MockCapabilityRegistry.sol";

contract ModuleInvariantImplementationV1 {}
contract ModuleInvariantReplacement {}

contract ModuleInvariantHandler {
    ModuleRegistry public immutable registry;
    bytes32 public immutable moduleId;
    bytes32 public immutable rulesetId;

    constructor(ModuleRegistry registry_, bytes32 moduleId_, bytes32 rulesetId_) {
        registry = registry_;
        moduleId = moduleId_;
        rulesetId = rulesetId_;
    }

    function stepAttemptReplacement(uint32 version) external {
        ModuleInvariantReplacement replacement = new ModuleInvariantReplacement();
        address(registry).call(
            abi.encodeWithSelector(
                registry.registerModule.selector,
                moduleId,
                address(replacement),
                version == 0 ? uint32(1) : version,
                rulesetId
            )
        );
    }

    function stepAdvanceLifecycle(uint8 rawState) external {
        UpgradeState state = UpgradeState(rawState % 8);
        address(registry).call(abi.encodeWithSelector(registry.setModuleState.selector, moduleId, state));
    }
}

contract ModuleRegistryInvariantTest is InvariantTarget420 {
    bytes32 private constant MODULE_ID = keccak256("HC.MODULE.INVARIANT.TEST");
    bytes32 private constant RULESET_ID = keccak256("ruleset:invariant");

    MockCapabilityRegistry private capabilityRegistry;
    HighCountryAuthorization private authorization;
    ModuleRegistry private registry;
    ModuleInvariantHandler private handler;
    address private expectedImplementation;

    function setUp() public {
        capabilityRegistry = new MockCapabilityRegistry();
        authorization = new HighCountryAuthorization(address(capabilityRegistry));
        registry = new ModuleRegistry(address(authorization));

        ModuleInvariantImplementationV1 implementation = new ModuleInvariantImplementationV1();
        expectedImplementation = address(implementation);
        _grant(address(this), ActionIds.MODULE_REGISTER, keccak256("setup:register"));
        registry.registerModule(MODULE_ID, expectedImplementation, 1, RULESET_ID);

        handler = new ModuleInvariantHandler(registry, MODULE_ID, RULESET_ID);
        _grant(address(handler), ActionIds.MODULE_REGISTER, keccak256("handler:register"));
        _grant(address(handler), ActionIds.MODULE_SET_STATE, keccak256("handler:set-state"));
        targetContract(address(handler));
    }

    function invariant_HC_INV_UPGRADE_003_NoArbitraryImplementationSwap() public view {
        require(
            registry.implementationOf(MODULE_ID) == expectedImplementation,
            "HC-INV-UPGRADE-003: implementation changed"
        );
    }

    function _grant(address principal, bytes32 actionId, bytes32 grantId) private {
        ICapabilityRegistry420.CapabilityGrant memory grant = ICapabilityRegistry420.CapabilityGrant({
            principal: principal,
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
