// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @dev Isolated unit/invariant fixture. Integration tests must use real registries.
contract MockCanonicalPhenotypeSources {
    address public immutable authorization;
    address public immutable genomeRegistry;
    address public plantRegistry;
    bytes32 public genome;
    bytes32 public expression;
    uint64 public plantId;
    uint64 public breedingId;

    constructor(
        address auth,
        address genomes,
        bytes32 genome_,
        bytes32 expression_,
        uint64 plant_,
        uint64 breeding_
    ) {
        authorization = auth;
        genomeRegistry = genomes;
        plantRegistry = address(this);
        genome = genome_;
        expression = expression_;
        plantId = plant_;
        breedingId = breeding_;
    }

    function genomeOf(
        uint64 id
    ) external view returns (bytes32) {
        require(id == plantId, "unknown plant");
        return genome;
    }

    function childGenomeOfFinalizedEvent(
        uint64 id
    ) external view returns (bytes32) {
        require(id == breedingId, "unfinalized breeding");
        return genome;
    }

    function expressionForPlant(
        uint64 id
    ) external view returns (bytes32) {
        require(id == plantId, "unlocked expression");
        return expression;
    }
}
