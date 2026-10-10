// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ActionIds } from "../constants/ActionIds.sol";
import { ModuleIds } from "../constants/ModuleIds.sol";
import {
    HCAlreadyExists,
    HCInvalidId,
    HCInvalidState,
    HCNotFound,
    HCZeroAddress
} from "../errors/HighCountryErrors.sol";
import { IHighCountryAuthorization } from "../interfaces/IHighCountryAuthorization.sol";
import { AuthorizationRequest } from "../types/HighCountryTypes.sol";

interface IGenomeRegistryPhenotype {
    function exists(
        bytes32 genomeId
    ) external view returns (bool);
}

interface IPlantProvenance {
    function authorization() external view returns (address);
    function genomeRegistry() external view returns (address);
    function genomeOf(
        uint64 plantId
    ) external view returns (bytes32);
}

interface IBreedingProvenance {
    function authorization() external view returns (address);
    function genomeRegistry() external view returns (address);
    function childGenomeOfFinalizedEvent(
        uint64 eventId
    ) external view returns (bytes32);
}

interface IExpressionProvenance {
    function authorization() external view returns (address);
    function plantRegistry() external view returns (address);
    function expressionForPlant(
        uint64 plantId
    ) external view returns (bytes32);
}

contract PhenotypeRegistry {
    struct PhenotypeRecord {
        bytes32 id;
        bytes32 genomeId;
        uint64 sourcePlantId;
        uint64 sourceBreedingEventId;
        bytes32 traitHash;
        bytes32 metadataHash;
        bool exists;
    }

    bytes32 public constant BIND_SCOPE = keccak256("HC.PHENOTYPE_REGISTRY.PROVENANCE_BINDING");
    IPlantProvenance public plantRegistry;
    IBreedingProvenance public breedingEngine;
    IExpressionProvenance public cultivationEngine;
    event ProvenanceSourcesBound(address indexed plants, address indexed breeding, address indexed cultivation);

    IHighCountryAuthorization public immutable authorization;
    IGenomeRegistryPhenotype public immutable genomeRegistry;
    mapping(bytes32 => PhenotypeRecord) private _phenotypes;

    event PhenotypeRegistered(
        bytes32 indexed phenotypeId,
        bytes32 indexed genomeId,
        uint64 indexed sourcePlantId,
        uint64 sourceBreedingEventId
    );

    constructor(
        address authorization_,
        address genomeRegistry_
    ) {
        if (authorization_ == address(0) || genomeRegistry_ == address(0)) revert HCZeroAddress();
        authorization = IHighCountryAuthorization(authorization_);
        genomeRegistry = IGenomeRegistryPhenotype(genomeRegistry_);
    }

    function bindProvenanceSources(
        address plants,
        address breeding,
        address cultivation
    ) external {
        if (
            address(plantRegistry) != address(0) || plants.code.length == 0 || breeding.code.length == 0
                || cultivation.code.length == 0
        ) revert HCInvalidState();
        authorization.requireAuthorized(
            AuthorizationRequest(
                msg.sender, ModuleIds.PHENOTYPE_REGISTRY, ActionIds.PHENOTYPE_BIND_PROVENANCE, BIND_SCOPE, 0
            )
        );
        if (
            IPlantProvenance(plants).authorization() != address(authorization)
                || IPlantProvenance(plants).genomeRegistry() != address(genomeRegistry)
                || IBreedingProvenance(breeding).authorization() != address(authorization)
                || IBreedingProvenance(breeding).genomeRegistry() != address(genomeRegistry)
                || IExpressionProvenance(cultivation).authorization() != address(authorization)
                || IExpressionProvenance(cultivation).plantRegistry() != plants
        ) revert HCInvalidState();
        plantRegistry = IPlantProvenance(plants);
        breedingEngine = IBreedingProvenance(breeding);
        cultivationEngine = IExpressionProvenance(cultivation);
        emit ProvenanceSourcesBound(plants, breeding, cultivation);
    }

    function registerPhenotype(
        bytes32 phenotypeId,
        bytes32 genomeId,
        uint64 sourcePlantId,
        uint64 sourceBreedingEventId,
        bytes32 traitHash,
        bytes32 metadataHash
    ) external {
        if (phenotypeId == bytes32(0) || genomeId == bytes32(0) || traitHash == bytes32(0)) revert HCInvalidId();
        if (!genomeRegistry.exists(genomeId)) revert HCNotFound();
        if (_phenotypes[phenotypeId].exists) revert HCAlreadyExists();
        if (address(plantRegistry) == address(0) || sourcePlantId == 0) revert HCInvalidState();
        if (plantRegistry.genomeOf(sourcePlantId) != genomeId) revert HCInvalidState();
        bytes32 expression = cultivationEngine.expressionForPlant(sourcePlantId);
        if (expression == bytes32(0) || traitHash != expression) revert HCInvalidState();
        if (sourceBreedingEventId != 0) {
            if (breedingEngine.childGenomeOfFinalizedEvent(sourceBreedingEventId) != genomeId) {
                revert HCInvalidState();
            }
        }
        authorization.requireAuthorized(
            AuthorizationRequest(msg.sender, ModuleIds.PHENOTYPE_REGISTRY, ActionIds.PHENOTYPE_REGISTER, phenotypeId, 0)
        );
        _phenotypes[phenotypeId] =
            PhenotypeRecord(phenotypeId, genomeId, sourcePlantId, sourceBreedingEventId, traitHash, metadataHash, true);
        emit PhenotypeRegistered(phenotypeId, genomeId, sourcePlantId, sourceBreedingEventId);
    }

    function exists(
        bytes32 phenotypeId
    ) external view returns (bool) {
        return _phenotypes[phenotypeId].exists;
    }

    function getPhenotype(
        bytes32 phenotypeId
    ) external view returns (PhenotypeRecord memory) {
        PhenotypeRecord memory p = _phenotypes[phenotypeId];
        if (!p.exists) revert HCNotFound();
        return p;
    }
}
