// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ICapabilityRegistry420 } from "../../../../src/interfaces/genesis/ICapabilityRegistry420.sol";
import { HighCountryAuthorization } from "../../../../src/highcountry/auth/HighCountryAuthorization.sol";
import { ActionIds } from "../../../../src/highcountry/constants/ActionIds.sol";
import { ModuleIds } from "../../../../src/highcountry/constants/ModuleIds.sol";
import { GenesisRegistry } from "../../../../src/highcountry/genesis/GenesisRegistry.sol";
import { GenomeRegistry } from "../../../../src/highcountry/genetics/GenomeRegistry.sol";
import { SeedRegistry } from "../../../../src/highcountry/genetics/SeedRegistry.sol";
import { CloneRegistry } from "../../../../src/highcountry/genetics/CloneRegistry.sol";
import { MotherRegistry } from "../../../../src/highcountry/genetics/MotherRegistry.sol";
import { PhenotypeRegistry } from "../../../../src/highcountry/genetics/PhenotypeRegistry.sol";
import { GenesisRoots } from "../../../../src/highcountry/types/HighCountryTypes.sol";
import { MockCapabilityRegistry } from "../../mocks/MockCapabilityRegistry.sol";

contract GeneticsAssetsTest {
    MockCapabilityRegistry private caps;
    HighCountryAuthorization private auth;
    GenesisRegistry private genesis;
    GenomeRegistry private genomes;
    SeedRegistry private seeds;
    CloneRegistry private clones;
    MotherRegistry private mothers;
    PhenotypeRegistry private phenotypes;
    bytes32 private genomeId;

    constructor() {
        caps = new MockCapabilityRegistry();
        auth = new HighCountryAuthorization(address(caps));
        genesis = new GenesisRegistry(address(auth));
        genomes = new GenomeRegistry(address(auth), address(genesis));
        seeds = new SeedRegistry(address(auth), address(genomes));
        clones = new CloneRegistry(address(auth), address(genomes));
        mothers = new MotherRegistry(address(auth), address(genomes));
        phenotypes = new PhenotypeRegistry(address(auth), address(genomes));

        _grant(ModuleIds.GENESIS_REGISTRY, ActionIds.GENESIS_SET_ROOTS, bytes32(0), keccak256("asset:roots"));
        _grant(ModuleIds.GENESIS_REGISTRY, ActionIds.GENESIS_FINALIZE, bytes32(0), keccak256("asset:finalize"));
        genesis.setRoots(_roots());
        genesis.finalizeGenesis();

        genomeId = keccak256("asset:genome");
        _grant(ModuleIds.GENOME_REGISTRY, ActionIds.GENOME_REGISTER, genomeId, keccak256("asset:genome:grant"));
        genomes.registerGenome(genomeId, keccak256("asset:line"), keccak256("asset:metadata"), _loci());
    }

    function testSeedLotIsTransferableAndKeepsGenomeProvenance() public {
        _grant(ModuleIds.SEED_REGISTRY, ActionIds.SEED_REGISTER, bytes32(uint256(1)), keccak256("seed:create"));
        _grant(ModuleIds.SEED_REGISTRY, ActionIds.SEED_TRANSFER, bytes32(uint256(1)), keccak256("seed:transfer"));
        seeds.registerSeedLot(1, genomeId, 9, address(this), 42, keccak256("seed:meta"));
        seeds.transfer(1, address(0xBEEF));
        SeedRegistry.SeedLot memory lot = seeds.getSeedLot(1);
        require(lot.owner == address(0xBEEF), "seed owner");
        require(lot.genomeId == genomeId && lot.breedingEventId == 9 && lot.quantity == 42, "seed provenance");
    }

    function testCloneIsTransferableAndTracksMother() public {
        _grant(ModuleIds.CLONE_REGISTRY, ActionIds.CLONE_REGISTER, bytes32(uint256(2)), keccak256("clone:create"));
        _grant(ModuleIds.CLONE_REGISTRY, ActionIds.CLONE_TRANSFER, bytes32(uint256(2)), keccak256("clone:transfer"));
        clones.registerClone(2, genomeId, 77, address(this), keccak256("clone:meta"));
        clones.transfer(2, address(0xCAFE));
        CloneRegistry.CloneRecord memory c = clones.getClone(2);
        require(c.owner == address(0xCAFE), "clone owner");
        require(c.genomeId == genomeId && c.motherId == 77, "clone provenance");
    }

    function testMotherHasFiniteCuttingBudgetAndRetires() public {
        _grant(ModuleIds.MOTHER_REGISTRY, ActionIds.MOTHER_REGISTER, bytes32(uint256(3)), keccak256("mother:create"));
        _grant(ModuleIds.MOTHER_REGISTRY, ActionIds.MOTHER_CONSUME_CUTTING, bytes32(uint256(3)), keccak256("mother:cut"));
        mothers.registerMother(3, genomeId, address(this), 2, keccak256("mother:meta"));
        mothers.consumeCutting(3);
        mothers.consumeCutting(3);
        MotherRegistry.MotherRecord memory m = mothers.getMother(3);
        require(m.retired && m.cuttingsTaken == 2, "mother finite lifecycle");
        (bool ok,) = address(mothers).call(abi.encodeWithSelector(mothers.consumeCutting.selector, 3));
        require(!ok, "retired mother reused");
    }

    function testPhenotypeIsPermanentProvenanceRecord() public {
        bytes32 phenotypeId = keccak256("phenotype:one");
        _grant(ModuleIds.PHENOTYPE_REGISTRY, ActionIds.PHENOTYPE_REGISTER, phenotypeId, keccak256("phenotype:create"));
        phenotypes.registerPhenotype(phenotypeId, genomeId, 12, 9, keccak256("traits"), keccak256("phenotype:meta"));
        PhenotypeRegistry.PhenotypeRecord memory p = phenotypes.getPhenotype(phenotypeId);
        require(p.genomeId == genomeId && p.sourcePlantId == 12 && p.sourceBreedingEventId == 9, "phenotype provenance");
        (bool ok,) = address(phenotypes).call(abi.encodeWithSelector(phenotypes.registerPhenotype.selector, phenotypeId, genomeId, 99, 99, keccak256("mutated"), keccak256("mutated:meta")));
        require(!ok, "phenotype mutated");
    }

    function _grant(bytes32 moduleId, bytes32 actionId, bytes32 scopeHash, bytes32 grantId) private {
        ICapabilityRegistry420.CapabilityGrant memory grant = ICapabilityRegistry420.CapabilityGrant({
            principal: address(this), componentId: moduleId, capabilityId: actionId, scopeHash: scopeHash,
            perCallLimit: 0, periodLimit: 0, periodSeconds: 0, validFrom: 0,
            validUntil: uint64(block.timestamp + 1 days), revoked: false
        });
        caps.setGrant(grantId, grant, 0);
    }

    function _loci() private pure returns (bytes32[28] memory loci) {
        for (uint256 i = 0; i < 28; ++i) loci[i] = keccak256(abi.encode("asset:locus", i));
    }

    function _roots() private pure returns (GenesisRoots memory) {
        return GenesisRoots({manifestRoot: keccak256("m"), parameterRoot: keccak256("p"), rulesetRoot: keccak256("r"), landRoot: keccak256("l"), randomnessRoot: keccak256("x"), qualificationRoot: keccak256("q")});
    }
}
