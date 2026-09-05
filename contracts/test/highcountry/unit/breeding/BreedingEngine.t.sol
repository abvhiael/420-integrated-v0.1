// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ICapabilityRegistry420 } from "../../../../src/interfaces/genesis/ICapabilityRegistry420.sol";
import { HighCountryAuthorization } from "../../../../src/highcountry/auth/HighCountryAuthorization.sol";
import { ActionIds } from "../../../../src/highcountry/constants/ActionIds.sol";
import { ModuleIds } from "../../../../src/highcountry/constants/ModuleIds.sol";
import { GenesisRegistry } from "../../../../src/highcountry/genesis/GenesisRegistry.sol";
import { GenomeRegistry } from "../../../../src/highcountry/genetics/GenomeRegistry.sol";
import { RandomnessCoordinator } from "../../../../src/highcountry/random/RandomnessCoordinator.sol";
import { BreedingEngine } from "../../../../src/highcountry/breeding/BreedingEngine.sol";
import { GenesisRoots } from "../../../../src/highcountry/types/HighCountryTypes.sol";
import { MockCapabilityRegistry } from "../../mocks/MockCapabilityRegistry.sol";

contract BreedingEngineTest {
    MockCapabilityRegistry private caps;
    HighCountryAuthorization private auth;
    GenesisRegistry private genesis;
    GenomeRegistry private genomes;
    RandomnessCoordinator private randomness;
    BreedingEngine private breeding;

    bytes32 private parentA = keccak256("hc5:parent:a");
    bytes32 private parentB = keccak256("hc5:parent:b");

    constructor() {
        caps = new MockCapabilityRegistry();
        auth = new HighCountryAuthorization(address(caps));
        genesis = new GenesisRegistry(address(auth));
        genomes = new GenomeRegistry(address(auth), address(genesis));
        randomness = new RandomnessCoordinator(address(auth));
        breeding = new BreedingEngine(address(auth), address(genomes), address(randomness));

        _grant(address(this), ModuleIds.GENESIS_REGISTRY, ActionIds.GENESIS_SET_ROOTS, bytes32(0), keccak256("hc5:roots"));
        _grant(address(this), ModuleIds.GENESIS_REGISTRY, ActionIds.GENESIS_FINALIZE, bytes32(0), keccak256("hc5:finalize"));
        genesis.setRoots(_roots());
        genesis.finalizeGenesis();

        _grant(address(this), ModuleIds.GENOME_REGISTRY, ActionIds.GENOME_REGISTER, parentA, keccak256("hc5:pa"));
        _grant(address(this), ModuleIds.GENOME_REGISTRY, ActionIds.GENOME_REGISTER, parentB, keccak256("hc5:pb"));
        genomes.registerGenome(parentA, keccak256("line:a"), keccak256("meta:a"), _loci("A"));
        genomes.registerGenome(parentB, keccak256("line:b"), keccak256("meta:b"), _loci("B"));
    }

    function testBreedingRequiresDistinctExistingParents() public {
        _grant(address(this), ModuleIds.BREEDING_ENGINE, ActionIds.BREEDING_REQUEST, bytes32(uint256(1)), keccak256("hc5:req:1"));
        (bool ok,) = address(breeding).call(abi.encodeWithSelector(
            breeding.requestBreeding.selector,
            uint64(1), parentA, parentA, keccak256("child"), keccak256("line:c"), keccak256("meta:c")
        ));
        require(!ok, "same-parent breeding allowed");
    }

    function testRandomnessReplayDeniedAndBreedingFinalizesOnce() public {
        uint64 eventId = 2;
        bytes32 childId = keccak256("hc5:child:2");
        bytes32 scope = bytes32(uint256(eventId));
        _grant(address(this), ModuleIds.BREEDING_ENGINE, ActionIds.BREEDING_REQUEST, scope, keccak256("hc5:req:2"));
        _grant(address(this), ModuleIds.BREEDING_ENGINE, ActionIds.BREEDING_FINALIZE, scope, keccak256("hc5:fin:2"));

        bytes32 contextHash = keccak256(abi.encode(eventId, parentA, parentB, childId, keccak256("line:c"), keccak256("meta:c")));
        bytes32 requestId = keccak256(abi.encode(keccak256("HC.RANDOM.BREEDING.V1"), contextHash));
        _grant(address(breeding), ModuleIds.RANDOMNESS_COORDINATOR, ActionIds.RANDOMNESS_REQUEST, requestId, keccak256("hc5:rand:req"));
        _grant(address(this), ModuleIds.RANDOMNESS_COORDINATOR, ActionIds.RANDOMNESS_FULFILL, requestId, keccak256("hc5:rand:fulfill"));
        _grant(address(breeding), ModuleIds.GENOME_REGISTRY, ActionIds.GENOME_REGISTER, childId, keccak256("hc5:child:grant"));

        breeding.requestBreeding(eventId, parentA, parentB, childId, keccak256("line:c"), keccak256("meta:c"));
        randomness.fulfill(requestId, keccak256("entropy:2"));
        breeding.finalizeBreeding(eventId);
        require(genomes.exists(childId), "child genome missing");

        (bool replayFulfill,) = address(randomness).call(abi.encodeWithSelector(randomness.fulfill.selector, requestId, keccak256("entropy:again")));
        require(!replayFulfill, "randomness replay allowed");
        (bool replayFinalize,) = address(breeding).call(abi.encodeWithSelector(breeding.finalizeBreeding.selector, eventId));
        require(!replayFinalize, "breeding finalized twice");
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
