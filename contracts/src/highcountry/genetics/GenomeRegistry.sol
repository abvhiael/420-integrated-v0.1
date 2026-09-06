// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ActionIds } from "../constants/ActionIds.sol";
import { ModuleIds } from "../constants/ModuleIds.sol";
import { HCAlreadyExists, HCGenesisAlreadyFinalized, HCGenesisNotFinalized, HCInvalidId, HCNotFound } from "../errors/HighCountryErrors.sol";
import { IGenesisRegistry } from "../interfaces/IGenesisRegistry.sol";
import { IHighCountryAuthorization } from "../interfaces/IHighCountryAuthorization.sol";
import { AuthorizationRequest } from "../types/HighCountryTypes.sol";
import { FoundingGenetics } from "./FoundingGenetics.sol";

contract GenomeRegistry {
    struct GenomeRecord {
        bytes32 id;
        bytes32 lineId;
        bytes32 metadataHash;
        bytes32[28] loci;
        bool founding;
        bool exists;
    }

    IHighCountryAuthorization public immutable authorization;
    IGenesisRegistry public immutable genesisRegistry;

    mapping(bytes32 => GenomeRecord) private _genomes;
    mapping(bytes32 => bytes32) public foundingGenomeOfLine;
    uint64 public genomeCount;
    uint8 public foundingGenomeCount;

    event GenomeRegistered(bytes32 indexed genomeId, bytes32 indexed lineId, bool founding, bytes32 metadataHash);

    constructor(address authorization_, address genesisRegistry_) {
        authorization = IHighCountryAuthorization(authorization_);
        genesisRegistry = IGenesisRegistry(genesisRegistry_);
    }

    function registerFoundingGenome(
        uint8 foundingLineIndex,
        bytes32 genomeId,
        bytes32 metadataHash,
        bytes32[28] calldata loci
    ) external {
        if (genesisRegistry.finalized()) revert HCGenesisAlreadyFinalized();
        bytes32 lineId = FoundingGenetics.lineId(foundingLineIndex);
        if (lineId == bytes32(0)) revert HCInvalidId();
        if (foundingGenomeOfLine[lineId] != bytes32(0)) revert HCAlreadyExists();

        _requireAuthorized(ActionIds.FOUNDING_GENOME_REGISTER, genomeId);
        _register(genomeId, lineId, metadataHash, loci, true);
        foundingGenomeOfLine[lineId] = genomeId;
        unchecked { foundingGenomeCount += 1; }
    }

    function registerGenome(
        bytes32 genomeId,
        bytes32 lineId,
        bytes32 metadataHash,
        bytes32[28] calldata loci
    ) external {
        if (!genesisRegistry.finalized()) revert HCGenesisNotFinalized();
        _requireAuthorized(ActionIds.GENOME_REGISTER, genomeId);
        _register(genomeId, lineId, metadataHash, loci, false);
    }

    function exists(bytes32 genomeId) external view returns (bool) {
        return _genomes[genomeId].exists;
    }

    function getGenome(bytes32 genomeId) external view returns (GenomeRecord memory) {
        GenomeRecord memory genome = _genomes[genomeId];
        if (!genome.exists) revert HCNotFound();
        return genome;
    }

    function foundingSetComplete() external view returns (bool) {
        return foundingGenomeCount == FoundingGenetics.FOUNDING_LINE_COUNT;
    }

    function _register(
        bytes32 genomeId,
        bytes32 lineId,
        bytes32 metadataHash,
        bytes32[28] calldata loci,
        bool founding
    ) private {
        if (genomeId == bytes32(0) || lineId == bytes32(0) || metadataHash == bytes32(0)) revert HCInvalidId();
        if (_genomes[genomeId].exists) revert HCAlreadyExists();

        _genomes[genomeId] = GenomeRecord({
            id: genomeId,
            lineId: lineId,
            metadataHash: metadataHash,
            loci: loci,
            founding: founding,
            exists: true
        });
        unchecked { genomeCount += 1; }
        emit GenomeRegistered(genomeId, lineId, founding, metadataHash);
    }

    function _requireAuthorized(bytes32 actionId, bytes32 genomeId) private view {
        authorization.requireAuthorized(
            AuthorizationRequest({
                principal: msg.sender,
                moduleId: ModuleIds.GENOME_REGISTRY,
                actionId: actionId,
                scopeHash: genomeId,
                amount: 0
            })
        );
    }
}
