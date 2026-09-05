// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ActionIds } from "../constants/ActionIds.sol";
import { ModuleIds } from "../constants/ModuleIds.sol";
import { RandomDomains } from "../constants/RandomDomains.sol";
import { HCAlreadyExists, HCInvalidId, HCInvalidState, HCNotFound, HCZeroAddress } from "../errors/HighCountryErrors.sol";
import { IHighCountryAuthorization } from "../interfaces/IHighCountryAuthorization.sol";
import { AuthorizationRequest } from "../types/HighCountryTypes.sol";

interface IGenomeRegistryBreeding {
    struct GenomeRecord {
        bytes32 id;
        bytes32 lineId;
        bytes32 metadataHash;
        bytes32[28] loci;
        bool founding;
        bool exists;
    }
    function exists(bytes32 genomeId) external view returns (bool);
    function getGenome(bytes32 genomeId) external view returns (GenomeRecord memory);
    function registerGenome(bytes32 genomeId, bytes32 lineId, bytes32 metadataHash, bytes32[28] calldata loci) external;
}

interface IRandomnessCoordinatorBreeding {
    function request(bytes32 requestId, bytes32 domain, bytes32 contextHash) external;
    function result(bytes32 requestId) external view returns (bytes32 entropy, bool fulfilled);
}

contract BreedingEngine {
    struct BreedingEvent {
        uint64 id;
        bytes32 parentA;
        bytes32 parentB;
        bytes32 childGenomeId;
        bytes32 childLineId;
        bytes32 metadataHash;
        bytes32 requestId;
        bytes32 entropy;
        bool finalized;
        bool exists;
    }

    IHighCountryAuthorization public immutable authorization;
    IGenomeRegistryBreeding public immutable genomeRegistry;
    IRandomnessCoordinatorBreeding public immutable randomness;
    mapping(uint64 => BreedingEvent) private _events;

    event BreedingRequested(uint64 indexed breedingEventId, bytes32 indexed parentA, bytes32 indexed parentB, bytes32 childGenomeId, bytes32 requestId);
    event BreedingFinalized(uint64 indexed breedingEventId, bytes32 indexed childGenomeId, bytes32 entropy);

    constructor(address authorization_, address genomeRegistry_, address randomness_) {
        if (authorization_ == address(0) || genomeRegistry_ == address(0) || randomness_ == address(0)) revert HCZeroAddress();
        authorization = IHighCountryAuthorization(authorization_);
        genomeRegistry = IGenomeRegistryBreeding(genomeRegistry_);
        randomness = IRandomnessCoordinatorBreeding(randomness_);
    }

    function requestBreeding(uint64 breedingEventId, bytes32 parentA, bytes32 parentB, bytes32 childGenomeId, bytes32 childLineId, bytes32 metadataHash) external {
        if (breedingEventId == 0 || parentA == bytes32(0) || parentB == bytes32(0) || childGenomeId == bytes32(0) || childLineId == bytes32(0) || metadataHash == bytes32(0)) revert HCInvalidId();
        if (parentA == parentB) revert HCInvalidState();
        if (!genomeRegistry.exists(parentA) || !genomeRegistry.exists(parentB)) revert HCNotFound();
        if (genomeRegistry.exists(childGenomeId) || _events[breedingEventId].exists) revert HCAlreadyExists();

        _auth(ActionIds.BREEDING_REQUEST, breedingEventId);
        bytes32 contextHash = keccak256(abi.encode(breedingEventId, parentA, parentB, childGenomeId, childLineId, metadataHash));
        bytes32 requestId = keccak256(abi.encode(RandomDomains.BREEDING, contextHash));
        _events[breedingEventId] = BreedingEvent(breedingEventId, parentA, parentB, childGenomeId, childLineId, metadataHash, requestId, bytes32(0), false, true);
        randomness.request(requestId, RandomDomains.BREEDING, contextHash);
        emit BreedingRequested(breedingEventId, parentA, parentB, childGenomeId, requestId);
    }

    function finalizeBreeding(uint64 breedingEventId) external {
        BreedingEvent storage e = _events[breedingEventId];
        if (!e.exists) revert HCNotFound();
        if (e.finalized) revert HCInvalidState();
        _auth(ActionIds.BREEDING_FINALIZE, breedingEventId);

        (bytes32 entropy, bool fulfilled) = randomness.result(e.requestId);
        if (!fulfilled || entropy == bytes32(0)) revert HCInvalidState();

        IGenomeRegistryBreeding.GenomeRecord memory a = genomeRegistry.getGenome(e.parentA);
        IGenomeRegistryBreeding.GenomeRecord memory b = genomeRegistry.getGenome(e.parentB);
        bytes32[28] memory child;
        for (uint256 i = 0; i < 28; ++i) {
            bytes32 draw = keccak256(abi.encode(entropy, breedingEventId, i));
            bytes32 locus = (uint256(draw) & 1) == 0 ? a.loci[i] : b.loci[i];
            if (((uint256(draw) >> 8) & 0xff) < 5) {
                locus = keccak256(abi.encode("HC.MUTATION.V1", locus, entropy, breedingEventId, i));
            }
            child[i] = locus;
        }

        e.entropy = entropy;
        e.finalized = true;
        genomeRegistry.registerGenome(e.childGenomeId, e.childLineId, e.metadataHash, child);
        emit BreedingFinalized(breedingEventId, e.childGenomeId, entropy);
    }

    function getBreedingEvent(uint64 breedingEventId) external view returns (BreedingEvent memory) {
        BreedingEvent memory e = _events[breedingEventId];
        if (!e.exists) revert HCNotFound();
        return e;
    }

    function _auth(bytes32 actionId, uint64 id) private view {
        authorization.requireAuthorized(AuthorizationRequest(msg.sender, ModuleIds.BREEDING_ENGINE, actionId, bytes32(uint256(id)), 0));
    }
}
