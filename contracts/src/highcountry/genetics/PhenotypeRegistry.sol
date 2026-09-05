// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ActionIds } from "../constants/ActionIds.sol";
import { ModuleIds } from "../constants/ModuleIds.sol";
import { HCAlreadyExists, HCInvalidId, HCNotFound, HCZeroAddress } from "../errors/HighCountryErrors.sol";
import { IHighCountryAuthorization } from "../interfaces/IHighCountryAuthorization.sol";
import { AuthorizationRequest } from "../types/HighCountryTypes.sol";

interface IGenomeRegistryPhenotype { function exists(bytes32 genomeId) external view returns (bool); }

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

    IHighCountryAuthorization public immutable authorization;
    IGenomeRegistryPhenotype public immutable genomeRegistry;
    mapping(bytes32 => PhenotypeRecord) private _phenotypes;

    event PhenotypeRegistered(bytes32 indexed phenotypeId, bytes32 indexed genomeId, uint64 indexed sourcePlantId, uint64 sourceBreedingEventId);

    constructor(address authorization_, address genomeRegistry_) {
        if (authorization_ == address(0) || genomeRegistry_ == address(0)) revert HCZeroAddress();
        authorization = IHighCountryAuthorization(authorization_);
        genomeRegistry = IGenomeRegistryPhenotype(genomeRegistry_);
    }

    function registerPhenotype(bytes32 phenotypeId, bytes32 genomeId, uint64 sourcePlantId, uint64 sourceBreedingEventId, bytes32 traitHash, bytes32 metadataHash) external {
        if (phenotypeId == bytes32(0) || genomeId == bytes32(0) || traitHash == bytes32(0)) revert HCInvalidId();
        if (!genomeRegistry.exists(genomeId)) revert HCNotFound();
        if (_phenotypes[phenotypeId].exists) revert HCAlreadyExists();
        authorization.requireAuthorized(AuthorizationRequest(msg.sender, ModuleIds.PHENOTYPE_REGISTRY, ActionIds.PHENOTYPE_REGISTER, phenotypeId, 0));
        _phenotypes[phenotypeId] = PhenotypeRecord(phenotypeId, genomeId, sourcePlantId, sourceBreedingEventId, traitHash, metadataHash, true);
        emit PhenotypeRegistered(phenotypeId, genomeId, sourcePlantId, sourceBreedingEventId);
    }

    function exists(bytes32 phenotypeId) external view returns (bool) { return _phenotypes[phenotypeId].exists; }
    function getPhenotype(bytes32 phenotypeId) external view returns (PhenotypeRecord memory) {
        PhenotypeRecord memory p = _phenotypes[phenotypeId];
        if (!p.exists) revert HCNotFound();
        return p;
    }
}
