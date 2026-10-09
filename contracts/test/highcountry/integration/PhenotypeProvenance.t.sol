// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { PublicPlantCapacityFixture } from "./PublicPlantCapacity.t.sol";
import { PhenotypeRegistry } from "../../../src/highcountry/genetics/PhenotypeRegistry.sol";
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

    function setUp() public override {
        super.setUp();
        caps.registerProtocolComponent(ModuleIds.PHENOTYPE_REGISTRY, address(this));
        caps.registerProtocolComponent(ModuleIds.CULTIVATION_ENGINE, address(this));
        cultivation = new CultivationEngine(address(auth), address(plants));
        RandomnessCoordinator random = new RandomnessCoordinator(address(auth));
        breeding = new BreedingEngine(address(auth), address(genomes), address(random));
        phenotype = new PhenotypeRegistry(address(auth), address(genomes));
        _grant(address(this), ModuleIds.PHENOTYPE_REGISTRY, ActionIds.PHENOTYPE_BIND_PROVENANCE, phenotype.BIND_SCOPE());
        phenotype.bindProvenanceSources(address(plants), address(breeding), address(cultivation));
        _private(1);
        _grant(address(this), ModuleIds.CULTIVATION_ENGINE, ActionIds.CULTIVATION_UPDATE, bytes32(uint256(1)));
        _grant(address(this), ModuleIds.CULTIVATION_ENGINE, ActionIds.PHENOTYPE_EXPRESS, bytes32(uint256(1)));
    }

    function _environment() internal {
        cultivation.updateEnvironment(1, CultivationEngine.EnvironmentSnapshot(2400, 6000, 7000, 6000, 6500, 5000));
    }

    function testCanonicalExpressionAcceptedAndAnchorsImmutable() public {
        _environment();
        bytes32 expression = cultivation.expressPhenotype(1, GENOME, keccak256("ruleset"));
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
        bytes32 expression = cultivation.expressPhenotype(1, GENOME, keccak256("ruleset"));
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
}
