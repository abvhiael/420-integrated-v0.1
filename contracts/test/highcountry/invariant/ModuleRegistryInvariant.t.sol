// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ICapabilityRegistry420 } from "../../../src/interfaces/genesis/ICapabilityRegistry420.sol";
import { HighCountryAuthorization } from "../../../src/highcountry/auth/HighCountryAuthorization.sol";
import { ActionIds } from "../../../src/highcountry/constants/ActionIds.sol";
import { ModuleIds } from "../../../src/highcountry/constants/ModuleIds.sol";
import { UpgradeState } from "../../../src/highcountry/types/HighCountryEnums.sol";
import { EmergencyState } from "../../../src/highcountry/security/EmergencyState.sol";
import { RulesetRegistry } from "../../../src/highcountry/rules/RulesetRegistry.sol";
import { ModuleRegistry } from "../../../src/highcountry/upgrades/ModuleRegistry.sol";
import { InvariantTarget420 } from "../../helpers/InvariantTarget420.sol";
import { MockCapabilityRegistry } from "../mocks/MockCapabilityRegistry.sol";

contract ModuleInvariantImplementationV1 {
    function highCountryModuleIdentity() external pure returns (bytes32, uint32, bytes32, bytes32) {
        return (
            keccak256("HC.MODULE.INVARIANT.TEST"),
            1,
            keccak256(abi.encode(keccak256("HC.RULESET.V1"), keccak256("ruleset:invariant"))),
            keccak256("HC.INTERFACE.INVARIANT.V1")
        );
    }
}

contract ModuleInvariantReplacement { }

contract ModuleInvariantHandler {
    ModuleRegistry public immutable registry;
    bytes32 public immutable moduleId;
    bytes32 public immutable rulesetId;

    constructor(
        ModuleRegistry registry_,
        bytes32 moduleId_,
        bytes32 rulesetId_
    ) {
        registry = registry_;
        moduleId = moduleId_;
        rulesetId = rulesetId_;
    }

    function stepAttemptReplacement(
        uint32 version
    ) external {
        ModuleInvariantReplacement replacement = new ModuleInvariantReplacement();
        address(registry)
            .call(
                abi.encodeWithSelector(
                    registry.registerModule.selector,
                    moduleId,
                    address(replacement),
                    version == 0 ? uint32(1) : version,
                    rulesetId
                )
            );
    }

    function stepAdvanceLifecycle(
        uint8 rawState
    ) external {
        UpgradeState state = UpgradeState(rawState % 8);
        address(registry).call(abi.encodeWithSelector(registry.setModuleState.selector, moduleId, state));
    }
}

contract ModuleRegistryInvariantTest is InvariantTarget420 {
    bytes32 private constant MODULE_ID = keccak256("HC.MODULE.INVARIANT.TEST");
    bytes32 private RULESET_ID;

    MockCapabilityRegistry private capabilityRegistry;
    HighCountryAuthorization private authorization;
    ModuleRegistry private registry;
    ModuleInvariantHandler private handler;
    address private expectedImplementation;

    function setUp() public {
        capabilityRegistry = new MockCapabilityRegistry();
        authorization = new HighCountryAuthorization(address(capabilityRegistry));
        registry = new ModuleRegistry(address(authorization));
        RulesetRegistry rulesets = new RulesetRegistry(address(authorization));
        RULESET_ID = rulesets.deriveRulesetId(keccak256("ruleset:invariant"));
        _grant(
            address(this),
            ActionIds.MODULE_BIND_RULESETS,
            keccak256("bind-rulesets"),
            registry.RULESET_BIND_SCOPE(),
            ModuleIds.MODULE_REGISTRY
        );
        _grant(
            address(this),
            ActionIds.RULESET_REGISTER,
            keccak256("register-ruleset"),
            RULESET_ID,
            ModuleIds.RULESET_REGISTRY
        );
        rulesets.registerRuleset(keccak256("ruleset:invariant"));
        registry.bindRulesetRegistry(address(rulesets));

        ModuleInvariantImplementationV1 implementation = new ModuleInvariantImplementationV1();
        expectedImplementation = address(implementation);
        _grant(
            address(this), ActionIds.MODULE_REGISTER, keccak256("setup:register"), MODULE_ID, ModuleIds.MODULE_REGISTRY
        );
        _grant(
            address(this),
            ActionIds.MODULE_APPROVE_ARTIFACT,
            keccak256("setup:artifact"),
            MODULE_ID,
            ModuleIds.MODULE_REGISTRY
        );
        registry.approveArtifact(MODULE_ID, expectedImplementation, 1, RULESET_ID);
        registry.registerModule(MODULE_ID, expectedImplementation, 1, RULESET_ID);

        handler = new ModuleInvariantHandler(registry, MODULE_ID, RULESET_ID);
        _grant(
            address(handler),
            ActionIds.MODULE_REGISTER,
            keccak256("handler:register"),
            MODULE_ID,
            ModuleIds.MODULE_REGISTRY
        );
        _grant(
            address(handler),
            ActionIds.MODULE_SET_STATE,
            keccak256("handler:set-state"),
            MODULE_ID,
            ModuleIds.MODULE_REGISTRY
        );
        targetContract(address(handler));
    }

    function invariant_HC_INV_UPGRADE_003_NoArbitraryImplementationSwap() public view {
        require(
            registry.implementationOf(MODULE_ID) == expectedImplementation, "HC-INV-UPGRADE-003: implementation changed"
        );
    }

    function _grant(
        address principal,
        bytes32 actionId,
        bytes32 grantId,
        bytes32 scope,
        bytes32 module
    ) private {
        ICapabilityRegistry420.CapabilityGrant memory grant = ICapabilityRegistry420.CapabilityGrant({
            principal: principal,
            componentId: module,
            capabilityId: actionId,
            scopeHash: scope,
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
