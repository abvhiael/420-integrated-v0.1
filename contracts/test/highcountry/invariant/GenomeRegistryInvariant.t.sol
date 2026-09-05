// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ICapabilityRegistry420 } from "../../../src/interfaces/genesis/ICapabilityRegistry420.sol";
import { HighCountryAuthorization } from "../../../src/highcountry/auth/HighCountryAuthorization.sol";
import { ActionIds } from "../../../src/highcountry/constants/ActionIds.sol";
import { ModuleIds } from "../../../src/highcountry/constants/ModuleIds.sol";
import { GenesisRegistry } from "../../../src/highcountry/genesis/GenesisRegistry.sol";
import { GenomeRegistry } from "../../../src/highcountry/genetics/GenomeRegistry.sol";
import { GenesisRoots } from "../../../src/highcountry/types/HighCountryTypes.sol";
import { InvariantTarget420 } from "../../helpers/InvariantTarget420.sol";
import { MockCapabilityRegistry } from "../mocks/MockCapabilityRegistry.sol";

contract GenomeRegistryInvariantHandler {
    GenomeRegistry public immutable genomes;

    constructor(GenomeRegistry genomes_) {
        genomes = genomes_;
    }

    function stepAttemptDuplicate(bytes32 genomeId, uint256 salt) external {
        bytes32[28] memory loci;
        for (uint256 i = 0; i < 28; ++i) loci[i] = keccak256(abi.encode("mutated", salt, i));
        address(genomes).call(
            abi.encodeWithSelector(
                genomes.registerGenome.selector,
                genomeId,
                keccak256(abi.encode("line", salt)),
                keccak256(abi.encode("metadata", salt)),
                loci
            )
        );
    }
}

contract GenomeRegistryInvariantTest is InvariantTarget420 {
    MockCapabilityRegistry private capabilityRegistry;
    HighCountryAuthorization private authorization;
    GenesisRegistry private genesis;
    GenomeRegistry private genomes;
    GenomeRegistryInvariantHandler private handler;
    bytes32 private immutable canonicalGenomeId = keccak256("hc4:canonical:genome");
    bytes32 private immutable canonicalLineId = keccak256("hc4:canonical:line");
    bytes32 private immutable canonicalMetadata = keccak256("hc4:canonical:metadata");
    bytes32 private canonicalLocus0;
    bytes32 private canonicalLocus27;

    function setUp() public {
        capabilityRegistry = new MockCapabilityRegistry();
        authorization = new HighCountryAuthorization(address(capabilityRegistry));
        genesis = new GenesisRegistry(address(authorization));
        genomes = new GenomeRegistry(address(authorization), address(genesis));

        _grant(address(this), ModuleIds.GENESIS_REGISTRY, ActionIds.GENESIS_SET_ROOTS, bytes32(0), keccak256("inv:roots"));
        _grant(address(this), ModuleIds.GENESIS_REGISTRY, ActionIds.GENESIS_FINALIZE, bytes32(0), keccak256("inv:finalize"));
        _grant(address(this), ModuleIds.GENOME_REGISTRY, ActionIds.GENOME_REGISTER, canonicalGenomeId, keccak256("inv:genome"));
        genesis.setRoots(_roots());
        genesis.finalizeGenesis();

        bytes32[28] memory loci;
        for (uint256 i = 0; i < 28; ++i) loci[i] = keccak256(abi.encode("canonical", i));
        canonicalLocus0 = loci[0];
        canonicalLocus27 = loci[27];
        genomes.registerGenome(canonicalGenomeId, canonicalLineId, canonicalMetadata, loci);

        handler = new GenomeRegistryInvariantHandler(genomes);
        _grant(address(handler), ModuleIds.GENOME_REGISTRY, ActionIds.GENOME_REGISTER, canonicalGenomeId, keccak256("inv:handler"));
        targetContract(address(handler));
    }

    function invariant_HC_INV_GENETICS_009_GenomeRecordIsImmutable() public view {
        GenomeRegistry.GenomeRecord memory record = genomes.getGenome(canonicalGenomeId);
        require(record.lineId == canonicalLineId, "HC-INV-GENETICS-009: line mutated");
        require(record.metadataHash == canonicalMetadata, "HC-INV-GENETICS-009: metadata mutated");
        require(record.loci[0] == canonicalLocus0, "HC-INV-GENETICS-009: locus 1 mutated");
        require(record.loci[27] == canonicalLocus27, "HC-INV-GENETICS-009: locus 28 mutated");
        require(genomes.genomeCount() == 1, "HC-INV-GENETICS-009: duplicate genome inserted");
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
        capabilityRegistry.setGrant(grantId, grant, 0);
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
