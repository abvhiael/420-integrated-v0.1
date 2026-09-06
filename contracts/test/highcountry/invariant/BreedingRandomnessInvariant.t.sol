// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ICapabilityRegistry420 } from "../../../src/interfaces/genesis/ICapabilityRegistry420.sol";
import { HighCountryAuthorization } from "../../../src/highcountry/auth/HighCountryAuthorization.sol";
import { ActionIds } from "../../../src/highcountry/constants/ActionIds.sol";
import { ModuleIds } from "../../../src/highcountry/constants/ModuleIds.sol";
import { GenesisRegistry } from "../../../src/highcountry/genesis/GenesisRegistry.sol";
import { GenomeRegistry } from "../../../src/highcountry/genetics/GenomeRegistry.sol";
import { RandomnessCoordinator } from "../../../src/highcountry/random/RandomnessCoordinator.sol";
import { BreedingEngine } from "../../../src/highcountry/breeding/BreedingEngine.sol";
import { GenesisRoots } from "../../../src/highcountry/types/HighCountryTypes.sol";
import { MockCapabilityRegistry } from "../mocks/MockCapabilityRegistry.sol";

contract BreedingRandomnessInvariantTest {
    MockCapabilityRegistry private caps;
    HighCountryAuthorization private auth;
    GenesisRegistry private genesis;
    GenomeRegistry private genomes;
    RandomnessCoordinator private randomness;
    BreedingEngine private breeding;

    bytes32 private parentA = keccak256("hc5:inv:parent:a");
    bytes32 private parentB = keccak256("hc5:inv:parent:b");
    bytes32 private childId = keccak256("hc5:inv:child");
    bytes32 private requestId;
    bytes32 private contextHash;
    bytes32 private entropy = keccak256("hc5:inv:entropy");

    function setUp() public {
        caps = new MockCapabilityRegistry();
        auth = new HighCountryAuthorization(address(caps));
        genesis = new GenesisRegistry(address(auth));
        genomes = new GenomeRegistry(address(auth), address(genesis));
        randomness = new RandomnessCoordinator(address(auth));
        breeding = new BreedingEngine(address(auth), address(genomes), address(randomness));

        _grant(address(this), ModuleIds.GENESIS_REGISTRY, ActionIds.GENESIS_SET_ROOTS, bytes32(0), keccak256("inv:roots"));
        _grant(address(this), ModuleIds.GENESIS_REGISTRY, ActionIds.GENESIS_FINALIZE, bytes32(0), keccak256("inv:finalize"));
        genesis.setRoots(_roots());
        genesis.finalizeGenesis();

        _grant(address(this), ModuleIds.GENOME_REGISTRY, ActionIds.GENOME_REGISTER, parentA, keccak256("inv:pa"));
        _grant(address(this), ModuleIds.GENOME_REGISTRY, ActionIds.GENOME_REGISTER, parentB, keccak256("inv:pb"));
        genomes.registerGenome(parentA, keccak256("inv:line:a"), keccak256("inv:meta:a"), _loci("A"));
        genomes.registerGenome(parentB, keccak256("inv:line:b"), keccak256("inv:meta:b"), _loci("B"));

        uint64 eventId = 1;
        bytes32 lineId = keccak256("inv:line:c");
        bytes32 metadataHash = keccak256("inv:meta:c");
        contextHash = keccak256(abi.encode(eventId, parentA, parentB, childId, lineId, metadataHash));
        requestId = keccak256(abi.encode(keccak256("HC.RANDOM.BREEDING.V1"), contextHash));

        _grant(address(this), ModuleIds.BREEDING_ENGINE, ActionIds.BREEDING_REQUEST, bytes32(uint256(eventId)), keccak256("inv:breed:req"));
        _grant(address(this), ModuleIds.BREEDING_ENGINE, ActionIds.BREEDING_FINALIZE, bytes32(uint256(eventId)), keccak256("inv:breed:fin"));
        _grant(address(breeding), ModuleIds.RANDOMNESS_COORDINATOR, ActionIds.RANDOMNESS_REQUEST, requestId, keccak256("inv:rand:req"));
        _grant(address(this), ModuleIds.RANDOMNESS_COORDINATOR, ActionIds.RANDOMNESS_FULFILL, requestId, keccak256("inv:rand:fulfill"));
        _grant(address(breeding), ModuleIds.GENOME_REGISTRY, ActionIds.GENOME_REGISTER, childId, keccak256("inv:child"));

        breeding.requestBreeding(eventId, parentA, parentB, childId, lineId, metadataHash);
        randomness.fulfill(requestId, entropy);
        breeding.finalizeBreeding(eventId);
    }

    function invariant_HC_INV_BREEDING_014_RequestConsumedOnce() public view {
        RandomnessCoordinator.RandomRequest memory r = randomness.getRequest(requestId);
        require(r.fulfilled && r.consumed, "HC-INV-BREEDING-014: request not consumed");
        require(r.entropy == entropy, "HC-INV-BREEDING-014: entropy changed");
        require(r.requester == address(breeding), "HC-INV-BREEDING-014: requester changed");
        require(r.provider == address(this), "HC-INV-BREEDING-014: provider changed");
        require(r.contextHash == contextHash, "HC-INV-BREEDING-014: context changed");
    }

    function invariant_HC_INV_BREEDING_015_EventAndChildAreImmutable() public view {
        BreedingEngine.BreedingEvent memory e = breeding.getBreedingEvent(1);
        require(e.finalized, "HC-INV-BREEDING-015: event not finalized");
        require(e.parentA == parentA && e.parentB == parentB, "HC-INV-BREEDING-015: parents changed");
        require(e.childGenomeId == childId, "HC-INV-BREEDING-015: child changed");
        require(e.requestId == requestId && e.entropy == entropy, "HC-INV-BREEDING-015: randomness provenance changed");
        require(genomes.exists(childId), "HC-INV-BREEDING-015: child genome missing");
    }

    function _grant(address principal, bytes32 moduleId, bytes32 actionId, bytes32 scopeHash, bytes32 grantId) private {
        ICapabilityRegistry420.CapabilityGrant memory grant = ICapabilityRegistry420.CapabilityGrant({
            principal: principal, componentId: moduleId, capabilityId: actionId, scopeHash: scopeHash,
            perCallLimit: 0, periodLimit: 0, periodSeconds: 0, validFrom: 0,
            validUntil: uint64(block.timestamp + 1 days), revoked: false
        });
        caps.setGrant(grantId, grant, 0);
    }

    function _loci(string memory prefix) private pure returns (bytes32[28] memory loci) {
        for (uint256 i = 0; i < 28; ++i) loci[i] = keccak256(abi.encode(prefix, i));
    }

    function _roots() private pure returns (GenesisRoots memory) {
        return GenesisRoots({
            manifestRoot: keccak256("m"), parameterRoot: keccak256("p"), rulesetRoot: keccak256("r"),
            landRoot: keccak256("l"), randomnessRoot: keccak256("x"), qualificationRoot: keccak256("q")
        });
    }
}
