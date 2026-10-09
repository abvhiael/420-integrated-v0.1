// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { PublicPlantCapacityFixture } from "./PublicPlantCapacity.t.sol";
import { PlantRegistry } from "../../../src/highcountry/cultivation/PlantRegistry.sol";
import { PhenotypeRegistry } from "../../../src/highcountry/genetics/PhenotypeRegistry.sol";
import { RulesetRouter } from "../../../src/highcountry/rules/RulesetRouter.sol";
import { RulesetRegistry } from "../../../src/highcountry/rules/RulesetRegistry.sol";
import { CultivationEngine } from "../../../src/highcountry/cultivation/CultivationEngine.sol";
import { BreedingEngine } from "../../../src/highcountry/breeding/BreedingEngine.sol";
import { RandomnessCoordinator } from "../../../src/highcountry/random/RandomnessCoordinator.sol";
import { ActionIds } from "../../../src/highcountry/constants/ActionIds.sol";
import { ModuleIds } from "../../../src/highcountry/constants/ModuleIds.sol";
import { HCInvalidState } from "../../../src/highcountry/errors/HighCountryErrors.sol";

contract PhenotypeProvenanceTest is PublicPlantCapacityFixture {
    PhenotypeRegistry internal phenotype;
    CultivationEngine internal cultivation;
    BreedingEngine internal breeding;
    bytes32 internal approvedRulesetId;
    RulesetRegistry internal rulesets;
    RulesetRouter internal router;

    function setUp() public override {
        super.setUp();
        caps.registerProtocolComponent(ModuleIds.PHENOTYPE_REGISTRY, address(this));
        caps.registerProtocolComponent(ModuleIds.CULTIVATION_ENGINE, address(this));
        cultivation = new CultivationEngine(address(auth), address(plants));
        _grant(address(this), ModuleIds.CULTIVATION_ENGINE, ActionIds.CULTIVATION_BIND_EMERGENCY, cultivation.EMERGENCY_BIND_SCOPE());
        cultivation.bindEmergencyState(address(emergency));
        caps.registerProtocolComponent(ModuleIds.RULESET_REGISTRY, address(this));
        rulesets = new RulesetRegistry(address(auth));
        bytes32 hash = keccak256("r02.7:ruleset:version1");
        approvedRulesetId = rulesets.deriveRulesetId(hash);
        _grant(address(this), ModuleIds.RULESET_REGISTRY, ActionIds.RULESET_REGISTER, approvedRulesetId);
        rulesets.registerRuleset(hash);
        _grant(
            address(this),
            ModuleIds.CULTIVATION_ENGINE,
            ActionIds.CULTIVATION_BIND_RULESETS,
            cultivation.RULESET_BIND_SCOPE()
        );
        caps.registerProtocolComponent(ModuleIds.RULESET_ROUTER, address(this));
        router = new RulesetRouter(address(auth), address(rulesets));
        _grant(
            address(this), ModuleIds.RULESET_ROUTER, ActionIds.RULESET_ROUTE, cultivation.EXPRESSION_RULESET_DOMAIN()
        );
        router.setRulesetFor(cultivation.EXPRESSION_RULESET_DOMAIN(), approvedRulesetId);
        cultivation.bindRulesetRegistry(address(rulesets), address(router));
        RandomnessCoordinator random = new RandomnessCoordinator(address(auth));
        breeding = new BreedingEngine(address(auth), address(genomes), address(random));
        _grant(address(this), ModuleIds.RANDOMNESS_COORDINATOR, ActionIds.RANDOMNESS_BIND_EMERGENCY, random.EMERGENCY_BIND_SCOPE());
        random.bindEmergencyState(address(emergency));
        _grant(address(this), ModuleIds.BREEDING_ENGINE, ActionIds.BREEDING_BIND_EMERGENCY, breeding.EMERGENCY_BIND_SCOPE());
        breeding.bindEmergencyState(address(emergency));
        phenotype = new PhenotypeRegistry(address(auth), address(genomes));
        _grant(address(this), ModuleIds.PHENOTYPE_REGISTRY, ActionIds.PHENOTYPE_BIND_PROVENANCE, phenotype.BIND_SCOPE());
        phenotype.bindProvenanceSources(address(plants), address(breeding), address(cultivation));
        _private(1);
        _grant(address(this), ModuleIds.CULTIVATION_ENGINE, ActionIds.CULTIVATION_UPDATE, bytes32(uint256(1)));
        _grant(address(this), ModuleIds.CULTIVATION_ENGINE, ActionIds.PHENOTYPE_EXPRESS, bytes32(uint256(1)));
    }

    function _environment() internal {
        _grant(address(this), ModuleIds.PLANT_REGISTRY, ActionIds.PLANT_ADVANCE, bytes32(uint256(1)));
        cultivation.updateEnvironment(1, CultivationEngine.EnvironmentSnapshot(2400, 6000, 7000, 6000, 6500, 5000));
        vm.warp(block.timestamp + 17 days);
        plants.syncOfflineGrowth(1);
    }

    function testCanonicalExpressionAcceptedAndAnchorsImmutable() public {
        _environment();
        bytes32 expression = cultivation.expressPhenotype(1, GENOME, approvedRulesetId);
        bytes32 id = keccak256("phenotype");
        _grant(address(this), ModuleIds.PHENOTYPE_REGISTRY, ActionIds.PHENOTYPE_REGISTER, id);
        phenotype.registerPhenotype(id, GENOME, 1, 0, expression, keccak256("metadata"));
        require(phenotype.getPhenotype(id).traitHash == expression, "canonical expression");
        _reject(
            address(phenotype),
            abi.encodeCall(phenotype.registerPhenotype, (id, GENOME, 1, 0, expression, bytes32(0))),
            bytes4(keccak256("HCAlreadyExists()"))
        );
    }

    function testUnknownPlantAndUnlockedExpressionDenied() public {
        bytes32 id = keccak256("phenotype");
        _grant(address(this), ModuleIds.PHENOTYPE_REGISTRY, ActionIds.PHENOTYPE_REGISTER, id);
        _reject(
            address(phenotype),
            abi.encodeCall(phenotype.registerPhenotype, (id, GENOME, 999, 0, keccak256("fake"), bytes32(0))),
            bytes4(keccak256("HCNotFound()"))
        );
        _reject(
            address(phenotype),
            abi.encodeCall(phenotype.registerPhenotype, (id, GENOME, 1, 0, keccak256("fake"), bytes32(0))),
            HCInvalidState.selector
        );
    }

    function testUnrelatedGenomeFabricatedTraitsAndBreedingDenied() public {
        _environment();
        bytes32 expression = cultivation.expressPhenotype(1, GENOME, approvedRulesetId);
        bytes32 id = keccak256("phenotype");
        _grant(address(this), ModuleIds.PHENOTYPE_REGISTRY, ActionIds.PHENOTYPE_REGISTER, id);
        _reject(
            address(phenotype),
            abi.encodeCall(phenotype.registerPhenotype, (id, keccak256("wrong"), 1, 0, expression, bytes32(0))),
            bytes4(keccak256("HCNotFound()"))
        );
        _reject(
            address(phenotype),
            abi.encodeCall(phenotype.registerPhenotype, (id, GENOME, 1, 0, keccak256("fabrication"), bytes32(0))),
            HCInvalidState.selector
        );
        _reject(
            address(phenotype),
            abi.encodeCall(phenotype.registerPhenotype, (id, GENOME, 1, 77, expression, bytes32(0))),
            HCInvalidState.selector
        );
    }

    function testR027RulesetIdentityLifecycleAndNoReroll() public {
        _grant(address(this), ModuleIds.PHENOTYPE_REGISTRY, ActionIds.PHENOTYPE_REGISTER, keccak256("r027"));
        CultivationEngine.EnvironmentSnapshot memory env =
            CultivationEngine.EnvironmentSnapshot(2400, 6000, 7000, 6000, 6500, 5000);
        cultivation.updateEnvironment(1, env);
        _reject(
            address(cultivation),
            abi.encodeCall(cultivation.expressPhenotype, (1, GENOME, approvedRulesetId)),
            HCInvalidState.selector
        );
        _grant(address(this), ModuleIds.PLANT_REGISTRY, ActionIds.PLANT_ADVANCE, bytes32(uint256(1)));
        vm.warp(block.timestamp + 17 days);
        plants.syncOfflineGrowth(1);
        _reject(
            address(cultivation),
            abi.encodeCall(cultivation.expressPhenotype, (1, GENOME, keccak256("unregistered:ruleset"))),
            HCInvalidState.selector
        );
        require(!cultivation.getState(1).expressionLocked, "failed sealing locked state");
        bytes32 expression = cultivation.expressPhenotype(1, GENOME, approvedRulesetId);
        require(expression != bytes32(0), "no expression");
        require(cultivation.sealedRulesetId(1) == approvedRulesetId, "ruleset identity missing");
        require(
            cultivation.sealedRulesetContentHash(1) == keccak256("r02.7:ruleset:version1"),
            "ruleset content version missing"
        );
        _reject(
            address(cultivation),
            abi.encodeCall(cultivation.expressPhenotype, (1, GENOME, approvedRulesetId)),
            HCInvalidState.selector
        );
        _reject(address(cultivation), abi.encodeCall(cultivation.updateEnvironment, (1, env)), HCInvalidState.selector);
    }

    function testR027TerminatedPlantCannotMutateOrSeal() public {
        CultivationEngine.EnvironmentSnapshot memory env =
            CultivationEngine.EnvironmentSnapshot(2400, 6000, 7000, 6000, 6500, 5000);
        cultivation.updateEnvironment(1, env);
        _grant(address(this), ModuleIds.PLANT_REGISTRY, ActionIds.PLANT_ADVANCE, bytes32(uint256(1)));
        vm.warp(block.timestamp + 17 days);
        plants.syncOfflineGrowth(1);
        plants.advanceStage(1, PlantRegistry.PlantStage.TERMINATED);
        _reject(address(cultivation), abi.encodeCall(cultivation.updateEnvironment, (1, env)), HCInvalidState.selector);
        _reject(
            address(cultivation),
            abi.encodeCall(cultivation.expressPhenotype, (1, GENOME, approvedRulesetId)),
            HCInvalidState.selector
        );
        require(!cultivation.getState(1).expressionLocked, "terminated plant sealed");
    }

    function testR027CannotChangeCanonicalRulesetBinding() public {
        RulesetRegistry candidate = new RulesetRegistry(address(auth));
        _reject(
            address(cultivation),
            abi.encodeCall(cultivation.bindRulesetRegistry, (address(candidate), address(candidate))),
            HCInvalidState.selector
        );
    }

    function testR027RegisteredButWrongRoutedVersionDenied() public {
        bytes32 nextContent = keccak256("r02.7:ruleset:version2");
        bytes32 nextId = rulesets.deriveRulesetId(nextContent);
        _grant(address(this), ModuleIds.RULESET_REGISTRY, ActionIds.RULESET_REGISTER, nextId);
        rulesets.registerRuleset(nextContent);
        _environment();
        _reject(
            address(cultivation),
            abi.encodeCall(cultivation.expressPhenotype, (1, GENOME, nextId)),
            HCInvalidState.selector
        );
        router.setRulesetFor(cultivation.EXPRESSION_RULESET_DOMAIN(), nextId);
        _reject(
            address(cultivation),
            abi.encodeCall(cultivation.expressPhenotype, (1, GENOME, approvedRulesetId)),
            HCInvalidState.selector
        );
        bytes32 expression = cultivation.expressPhenotype(1, GENOME, nextId);
        require(expression != bytes32(0), "routed version did not seal");
        require(cultivation.sealedRulesetId(1) == nextId, "routed ID not pinned");
        require(cultivation.sealedRulesetContentHash(1) == nextContent, "routed content not pinned");
        router.setRulesetFor(cultivation.EXPRESSION_RULESET_DOMAIN(), approvedRulesetId);
        require(cultivation.sealedRulesetId(1) == nextId, "sealed version changed on reroute");
        _reject(
            address(cultivation),
            abi.encodeCall(cultivation.expressPhenotype, (1, GENOME, approvedRulesetId)),
            HCInvalidState.selector
        );
    }
}
