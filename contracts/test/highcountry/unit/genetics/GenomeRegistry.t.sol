// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ICapabilityRegistry420 } from "../../../../src/interfaces/genesis/ICapabilityRegistry420.sol";
import { HighCountryAuthorization } from "../../../../src/highcountry/auth/HighCountryAuthorization.sol";
import { ActionIds } from "../../../../src/highcountry/constants/ActionIds.sol";
import { ModuleIds } from "../../../../src/highcountry/constants/ModuleIds.sol";
import { GenesisRegistry } from "../../../../src/highcountry/genesis/GenesisRegistry.sol";
import { FoundingGenetics } from "../../../../src/highcountry/genetics/FoundingGenetics.sol";
import { GenomeRegistry } from "../../../../src/highcountry/genetics/GenomeRegistry.sol";
import { GenesisRoots } from "../../../../src/highcountry/types/HighCountryTypes.sol";
import { MockCapabilityRegistry } from "../../mocks/MockCapabilityRegistry.sol";

contract GenomeRegistryTest {
    MockCapabilityRegistry private capabilityRegistry;
    HighCountryAuthorization private authorization;
    GenesisRegistry private genesis;
    GenomeRegistry private genomes;

    constructor() {
        capabilityRegistry = new MockCapabilityRegistry();
        authorization = new HighCountryAuthorization(address(capabilityRegistry));
        genesis = new GenesisRegistry(address(authorization));
        genomes = new GenomeRegistry(address(authorization), address(genesis));

        _grant(ModuleIds.GENESIS_REGISTRY, ActionIds.GENESIS_SET_ROOTS, bytes32(0), keccak256("genetics:roots"));
        _grant(ModuleIds.GENESIS_REGISTRY, ActionIds.GENESIS_FINALIZE, bytes32(0), keccak256("genetics:finalize"));
    }

    function testFoundingGenomeRegistersBeforeGenesisFinalization() public {
        bytes32 genomeId = keccak256("founding:one");
        _grant(ModuleIds.GENOME_REGISTRY, ActionIds.FOUNDING_GENOME_REGISTER, genomeId, keccak256("grant:founding:one"));
        genomes.registerFoundingGenome(1, genomeId, keccak256("metadata:one"), _loci(1));

        GenomeRegistry.GenomeRecord memory record = genomes.getGenome(genomeId);
        require(record.founding, "founding flag");
        require(record.lineId == FoundingGenetics.lineId(1), "line id");
        require(record.loci[27] == keccak256(abi.encode("locus", uint256(1), uint256(27))), "locus 28");
    }

    function testFoundingLineCannotRegisterTwice() public {
        bytes32 first = keccak256("founding:first");
        bytes32 second = keccak256("founding:second");
        _grant(ModuleIds.GENOME_REGISTRY, ActionIds.FOUNDING_GENOME_REGISTER, first, keccak256("grant:first"));
        _grant(ModuleIds.GENOME_REGISTRY, ActionIds.FOUNDING_GENOME_REGISTER, second, keccak256("grant:second"));
        genomes.registerFoundingGenome(1, first, keccak256("metadata:first"), _loci(1));

        (bool ok,) = address(genomes).call(
            abi.encodeWithSelector(genomes.registerFoundingGenome.selector, 1, second, keccak256("metadata:second"), _loci(2))
        );
        require(!ok, "duplicate founding line registered");
    }

    function testNormalGenomeRequiresFinalizedGenesis() public {
        bytes32 genomeId = keccak256("normal:one");
        _grant(ModuleIds.GENOME_REGISTRY, ActionIds.GENOME_REGISTER, genomeId, keccak256("grant:normal:one"));
        (bool okBefore,) = address(genomes).call(
            abi.encodeWithSelector(genomes.registerGenome.selector, genomeId, keccak256("line:normal"), keccak256("metadata:normal"), _loci(3))
        );
        require(!okBefore, "normal genome registered before finalization");

        genesis.setRoots(_roots());
        genesis.finalizeGenesis();
        genomes.registerGenome(genomeId, keccak256("line:normal"), keccak256("metadata:normal"), _loci(3));
        require(genomes.exists(genomeId), "normal genome missing");
    }

    function testFoundingGenomeBlockedAfterGenesisFinalization() public {
        genesis.setRoots(_roots());
        genesis.finalizeGenesis();
        bytes32 genomeId = keccak256("late:founding");
        _grant(ModuleIds.GENOME_REGISTRY, ActionIds.FOUNDING_GENOME_REGISTER, genomeId, keccak256("grant:late"));
        (bool ok,) = address(genomes).call(
            abi.encodeWithSelector(genomes.registerFoundingGenome.selector, 2, genomeId, keccak256("metadata:late"), _loci(4))
        );
        require(!ok, "late founding genome registered");
    }

    function _grant(bytes32 moduleId, bytes32 actionId, bytes32 scopeHash, bytes32 grantId) private {
        ICapabilityRegistry420.CapabilityGrant memory grant = ICapabilityRegistry420.CapabilityGrant({
            principal: address(this),
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
        capabilityRegistry.setGrant(grantId, grant, 0);
    }

    function _loci(uint256 salt) private pure returns (bytes32[28] memory loci) {
        for (uint256 i = 0; i < 28; ++i) loci[i] = keccak256(abi.encode("locus", salt, i));
    }

    function _roots() private pure returns (GenesisRoots memory) {
        return GenesisRoots({
            manifestRoot: keccak256("hc4:manifest"),
            parameterRoot: keccak256("hc4:parameters"),
            rulesetRoot: keccak256("hc4:rulesets"),
            landRoot: keccak256("hc4:land"),
            randomnessRoot: keccak256("hc4:randomness"),
            qualificationRoot: keccak256("hc4:qualification")
        });
    }
}
