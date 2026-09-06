// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ICapabilityRegistry420 } from "../../../src/interfaces/genesis/ICapabilityRegistry420.sol";
import { HighCountryAuthorization } from "../../../src/highcountry/auth/HighCountryAuthorization.sol";
import { ActionIds } from "../../../src/highcountry/constants/ActionIds.sol";
import { ModuleIds } from "../../../src/highcountry/constants/ModuleIds.sol";
import { GenesisRegistry } from "../../../src/highcountry/genesis/GenesisRegistry.sol";
import { GenomeRegistry } from "../../../src/highcountry/genetics/GenomeRegistry.sol";
import { SeedRegistry } from "../../../src/highcountry/genetics/SeedRegistry.sol";
import { CloneRegistry } from "../../../src/highcountry/genetics/CloneRegistry.sol";
import { MotherRegistry } from "../../../src/highcountry/genetics/MotherRegistry.sol";
import { PhenotypeRegistry } from "../../../src/highcountry/genetics/PhenotypeRegistry.sol";
import { GenesisRoots } from "../../../src/highcountry/types/HighCountryTypes.sol";
import { InvariantTarget420 } from "../../helpers/InvariantTarget420.sol";
import { MockCapabilityRegistry } from "../mocks/MockCapabilityRegistry.sol";

contract GeneticsAssetsInvariantHandler {
    SeedRegistry public immutable seeds;
    CloneRegistry public immutable clones;
    MotherRegistry public immutable mothers;
    PhenotypeRegistry public immutable phenotypes;
    bytes32 public immutable genomeId;
    bytes32 public immutable phenotypeId;

    constructor(SeedRegistry seeds_, CloneRegistry clones_, MotherRegistry mothers_, PhenotypeRegistry phenotypes_, bytes32 genomeId_, bytes32 phenotypeId_) {
        seeds = seeds_;
        clones = clones_;
        mothers = mothers_;
        phenotypes = phenotypes_;
        genomeId = genomeId_;
        phenotypeId = phenotypeId_;
    }

    function stepTransferSeed(address newOwner) external { address(seeds).call(abi.encodeWithSelector(seeds.transfer.selector, 1, newOwner)); }
    function stepTransferClone(address newOwner) external { address(clones).call(abi.encodeWithSelector(clones.transfer.selector, 2, newOwner)); }
    function stepTransferMother(address newOwner) external { address(mothers).call(abi.encodeWithSelector(mothers.transfer.selector, 3, newOwner)); }
    function stepConsumeMother() external { address(mothers).call(abi.encodeWithSelector(mothers.consumeCutting.selector, 3)); }
    function stepAttemptPhenotypeMutation(uint64 sourcePlantId, uint64 breedingEventId, uint256 salt) external {
        address(phenotypes).call(
            abi.encodeWithSelector(
                phenotypes.registerPhenotype.selector,
                phenotypeId,
                genomeId,
                sourcePlantId,
                breedingEventId,
                keccak256(abi.encode("mutated:traits", salt)),
                keccak256(abi.encode("mutated:metadata", salt))
            )
        );
    }
}

contract GeneticsAssetsInvariantTest is InvariantTarget420 {
    MockCapabilityRegistry private caps;
    HighCountryAuthorization private auth;
    GenesisRegistry private genesis;
    GenomeRegistry private genomes;
    SeedRegistry private seeds;
    CloneRegistry private clones;
    MotherRegistry private mothers;
    PhenotypeRegistry private phenotypes;
    GeneticsAssetsInvariantHandler private handler;

    bytes32 private immutable genomeId = keccak256("hc4:assets:genome");
    bytes32 private immutable phenotypeId = keccak256("hc4:assets:phenotype");
    bytes32 private immutable seedMetadata = keccak256("hc4:seed:metadata");
    bytes32 private immutable cloneMetadata = keccak256("hc4:clone:metadata");
    bytes32 private immutable motherMetadata = keccak256("hc4:mother:metadata");
    bytes32 private immutable phenotypeTraits = keccak256("hc4:phenotype:traits");
    bytes32 private immutable phenotypeMetadata = keccak256("hc4:phenotype:metadata");

    function setUp() public {
        caps = new MockCapabilityRegistry();
        auth = new HighCountryAuthorization(address(caps));
        genesis = new GenesisRegistry(address(auth));
        genomes = new GenomeRegistry(address(auth), address(genesis));
        seeds = new SeedRegistry(address(auth), address(genomes));
        mothers = new MotherRegistry(address(auth), address(genomes));
        clones = new CloneRegistry(address(auth), address(genomes), address(mothers));
        phenotypes = new PhenotypeRegistry(address(auth), address(genomes));

        _grant(address(this), ModuleIds.GENESIS_REGISTRY, ActionIds.GENESIS_SET_ROOTS, bytes32(0), keccak256("assets:roots"));
        _grant(address(this), ModuleIds.GENESIS_REGISTRY, ActionIds.GENESIS_FINALIZE, bytes32(0), keccak256("assets:finalize"));
        genesis.setRoots(_roots());
        genesis.finalizeGenesis();

        _grant(address(this), ModuleIds.GENOME_REGISTRY, ActionIds.GENOME_REGISTER, genomeId, keccak256("assets:genome"));
        genomes.registerGenome(genomeId, keccak256("hc4:assets:line"), keccak256("hc4:assets:genome:metadata"), _loci());

        _grant(address(this), ModuleIds.SEED_REGISTRY, ActionIds.SEED_REGISTER, bytes32(uint256(1)), keccak256("assets:seed"));
        seeds.registerSeedLot(1, genomeId, 44, address(this), 25, seedMetadata);

        _grant(address(this), ModuleIds.MOTHER_REGISTRY, ActionIds.MOTHER_REGISTER, bytes32(uint256(3)), keccak256("assets:mother"));
        mothers.registerMother(3, genomeId, address(this), 3, motherMetadata);

        _grant(address(this), ModuleIds.CLONE_REGISTRY, ActionIds.CLONE_REGISTER, bytes32(uint256(2)), keccak256("assets:clone"));
        clones.registerClone(2, genomeId, 3, address(this), cloneMetadata);

        _grant(address(this), ModuleIds.PHENOTYPE_REGISTRY, ActionIds.PHENOTYPE_REGISTER, phenotypeId, keccak256("assets:phenotype"));
        phenotypes.registerPhenotype(phenotypeId, genomeId, 55, 44, phenotypeTraits, phenotypeMetadata);

        handler = new GeneticsAssetsInvariantHandler(seeds, clones, mothers, phenotypes, genomeId, phenotypeId);
        _grant(address(handler), ModuleIds.SEED_REGISTRY, ActionIds.SEED_TRANSFER, bytes32(uint256(1)), keccak256("assets:seed:transfer"));
        _grant(address(handler), ModuleIds.CLONE_REGISTRY, ActionIds.CLONE_TRANSFER, bytes32(uint256(2)), keccak256("assets:clone:transfer"));
        _grant(address(handler), ModuleIds.MOTHER_REGISTRY, ActionIds.MOTHER_TRANSFER, bytes32(uint256(3)), keccak256("assets:mother:transfer"));
        _grant(address(handler), ModuleIds.MOTHER_REGISTRY, ActionIds.MOTHER_CONSUME_CUTTING, bytes32(uint256(3)), keccak256("assets:mother:consume"));
        _grant(address(handler), ModuleIds.PHENOTYPE_REGISTRY, ActionIds.PHENOTYPE_REGISTER, phenotypeId, keccak256("assets:phenotype:duplicate"));
        targetContract(address(handler));
    }

    function invariant_HC_INV_GENETICS_010_SeedProvenanceAndQuantityAreImmutable() public view {
        SeedRegistry.SeedLot memory lot = seeds.getSeedLot(1);
        require(lot.genomeId == genomeId, "HC-INV-GENETICS-010: seed genome mutated");
        require(lot.breedingEventId == 44, "HC-INV-GENETICS-010: breeding provenance mutated");
        require(lot.quantity == 25, "HC-INV-GENETICS-010: seed quantity mutated");
        require(lot.metadataHash == seedMetadata, "HC-INV-GENETICS-010: seed metadata mutated");
    }

    function invariant_HC_INV_GENETICS_011_CloneMotherAndGenomeRemainCanonical() public view {
        CloneRegistry.CloneRecord memory clone = clones.getClone(2);
        require(clone.genomeId == genomeId, "HC-INV-GENETICS-011: clone genome mutated");
        require(clone.motherId == 3, "HC-INV-GENETICS-011: mother provenance mutated");
        require(clone.metadataHash == cloneMetadata, "HC-INV-GENETICS-011: clone metadata mutated");
        require(mothers.exists(clone.motherId), "HC-INV-GENETICS-011: canonical mother missing");
        require(mothers.genomeOf(clone.motherId) == clone.genomeId, "HC-INV-GENETICS-011: mother genome mismatch");
    }

    function invariant_HC_INV_GENETICS_012_MotherCuttingBudgetIsConserved() public view {
        MotherRegistry.MotherRecord memory mother = mothers.getMother(3);
        require(mother.genomeId == genomeId, "HC-INV-GENETICS-012: mother genome mutated");
        require(mother.metadataHash == motherMetadata, "HC-INV-GENETICS-012: mother metadata mutated");
        require(mother.cuttingsTaken <= mother.maxCuttings, "HC-INV-GENETICS-012: cutting budget exceeded");
        require(mother.retired == (mother.cuttingsTaken == mother.maxCuttings), "HC-INV-GENETICS-012: retirement state inconsistent");
    }

    function invariant_HC_INV_GENETICS_013_PhenotypeProvenanceIsPermanent() public view {
        PhenotypeRegistry.PhenotypeRecord memory phenotype = phenotypes.getPhenotype(phenotypeId);
        require(phenotype.genomeId == genomeId, "HC-INV-GENETICS-013: phenotype genome mutated");
        require(phenotype.sourcePlantId == 55, "HC-INV-GENETICS-013: plant provenance mutated");
        require(phenotype.sourceBreedingEventId == 44, "HC-INV-GENETICS-013: breeding provenance mutated");
        require(phenotype.traitHash == phenotypeTraits, "HC-INV-GENETICS-013: traits mutated");
        require(phenotype.metadataHash == phenotypeMetadata, "HC-INV-GENETICS-013: metadata mutated");
    }

    function _grant(address principal, bytes32 moduleId, bytes32 actionId, bytes32 scopeHash, bytes32 grantId) private {
        ICapabilityRegistry420.CapabilityGrant memory grant = ICapabilityRegistry420.CapabilityGrant({
            principal: principal,
            componentId: moduleId,
            capabilityId: actionId,
            scopeHash: scopeHash,
            perCallLimit: 0,
            periodLimit: 0,
            periodSeconds: 0,
            validFrom: 0,
            validUntil: uint64(block.timestamp + 1 days),
            revoked: false
        });
        caps.setGrant(grantId, grant, 0);
    }

    function _loci() private pure returns (bytes32[28] memory loci) {
        for (uint256 i = 0; i < 28; ++i) loci[i] = keccak256(abi.encode("hc4:assets:locus", i));
    }

    function _roots() private pure returns (GenesisRoots memory) {
        return GenesisRoots({
            manifestRoot: keccak256("hc4:assets:manifest"),
            parameterRoot: keccak256("hc4:assets:parameters"),
            rulesetRoot: keccak256("hc4:assets:rulesets"),
            landRoot: keccak256("hc4:assets:land"),
            randomnessRoot: keccak256("hc4:assets:randomness"),
            qualificationRoot: keccak256("hc4:assets:qualification")
        });
    }
}
