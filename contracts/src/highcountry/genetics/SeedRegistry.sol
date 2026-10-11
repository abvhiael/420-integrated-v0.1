// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { IPlantSourceConsumer } from "../interfaces/IPlantSourceConsumer.sol";

import { ActionIds } from "../constants/ActionIds.sol";
import { ModuleIds } from "../constants/ModuleIds.sol";
import {
    HCAlreadyExists,
    HCInvalidId,
    HCNotFound,
    HCInvalidState,
    HCUnauthorized,
    HCZeroAddress
} from "../errors/HighCountryErrors.sol";
import { IHighCountryAuthorization } from "../interfaces/IHighCountryAuthorization.sol";
import { AuthorizationRequest } from "../types/HighCountryTypes.sol";

interface IGenomeRegistrySeed {
    function exists(
        bytes32 genomeId
    ) external view returns (bool);
}

contract SeedRegistry {
    struct SeedLot {
        uint64 id;
        bytes32 genomeId;
        uint64 breedingEventId;
        address owner;
        uint32 quantity;
        bytes32 metadataHash;
        bool exists;
    }

    bytes32 public constant BIND_SCOPE = keccak256("HC.SEED_REGISTRY.PLANT_BINDING");
    IPlantSourceConsumer public plantRegistry;
    mapping(uint64 => uint64) public ownershipEpoch;
    mapping(uint64 => mapping(uint64 => bytes32)) public plantApproval;
    event PlantRegistryBound(address indexed plantRegistry);
    event PlantSourceApproved(
        uint64 indexed sourceId,
        uint64 indexed plantId,
        address indexed owner,
        uint64 parcelId,
        uint64 plotId,
        uint64 ownershipEpoch
    );
    event PlantSourceApprovalRevoked(uint64 indexed sourceId, uint64 indexed plantId, address indexed owner);
    mapping(uint64 => uint32) public consumedQuantity;
    mapping(uint64 => uint64) public seedLotForPlant;
    event SeedConsumed(uint64 indexed seedLotId, uint64 indexed plantId, address indexed grower, uint32 remaining);

    IHighCountryAuthorization public immutable authorization;
    IGenomeRegistrySeed public immutable genomeRegistry;
    mapping(uint64 => SeedLot) private _lots;

    event SeedLotRegistered(
        uint64 indexed seedLotId,
        bytes32 indexed genomeId,
        address indexed owner,
        uint32 quantity,
        uint64 breedingEventId
    );
    event SeedLotTransferred(uint64 indexed seedLotId, address indexed previousOwner, address indexed newOwner);

    constructor(
        address authorization_,
        address genomeRegistry_
    ) {
        if (authorization_ == address(0) || genomeRegistry_ == address(0)) revert HCZeroAddress();
        authorization = IHighCountryAuthorization(authorization_);
        genomeRegistry = IGenomeRegistrySeed(genomeRegistry_);
    }

    /// @notice Deployment-only binding; replacement requires a new registry.
    function bindPlantRegistry(
        address plants
    ) external {
        if (address(plantRegistry) != address(0) || plants.code.length == 0) revert HCInvalidState();
        authorization.requireAuthorized(
            AuthorizationRequest(msg.sender, ModuleIds.SEED_REGISTRY, ActionIds.SEED_BIND_PLANTS, BIND_SCOPE, 0)
        );
        IPlantSourceConsumer candidate = IPlantSourceConsumer(plants);
        if (
            candidate.authorization() != address(authorization) || candidate.genomeRegistry() != address(genomeRegistry)
                || candidate.seedRegistry() != address(this)
        ) revert HCInvalidState();
        plantRegistry = candidate;
        emit PlantRegistryBound(plants);
    }

    function approvePlant(
        uint64 sourceId,
        uint64 plantId,
        uint64 parcelId,
        uint64 plotId
    ) external {
        SeedLot storage lot = _require(sourceId);
        if (lot.owner != msg.sender) {
            revert HCUnauthorized(msg.sender, ModuleIds.SEED_REGISTRY, ActionIds.SEED_CONSUME);
        }
        if (address(plantRegistry) == address(0) || plantId == 0 || parcelId == 0) revert HCInvalidState();
        if (consumedQuantity[sourceId] >= lot.quantity) revert HCInvalidState();
        plantApproval[sourceId][plantId] = _approval(sourceId, plantId, lot.genomeId, msg.sender, parcelId, plotId);
        emit PlantSourceApproved(sourceId, plantId, msg.sender, parcelId, plotId, ownershipEpoch[sourceId]);
    }

    function revokePlantApproval(
        uint64 sourceId,
        uint64 plantId
    ) external {
        SeedLot storage lot = _require(sourceId);
        if (lot.owner != msg.sender) {
            revert HCUnauthorized(msg.sender, ModuleIds.SEED_REGISTRY, ActionIds.SEED_CONSUME);
        }
        delete plantApproval[sourceId][plantId];
        emit PlantSourceApprovalRevoked(sourceId, plantId, msg.sender);
    }

    function consumeForPlant(
        uint64 sourceId,
        uint64 plantId
    ) external {
        if (msg.sender != address(plantRegistry) || plantId == 0) revert HCInvalidState();
        SeedLot storage lot = _require(sourceId);
        (uint8 kind, uint64 recordedSource, bytes32 genomeId, address grower, uint64 parcelId, uint64 plotId) =
            plantRegistry.sourceContext(plantId);
        if (kind != 1 || recordedSource != sourceId || lot.genomeId != genomeId || lot.owner != grower) {
            revert HCInvalidState();
        }
        if (plantApproval[sourceId][plantId] != _approval(sourceId, plantId, genomeId, grower, parcelId, plotId)) {
            revert HCInvalidState();
        }
        if (seedLotForPlant[plantId] != 0 || consumedQuantity[sourceId] >= lot.quantity) revert HCInvalidState();
        authorization.requireAuthorized(
            AuthorizationRequest(
                msg.sender, ModuleIds.SEED_REGISTRY, ActionIds.SEED_CONSUME, bytes32(uint256(sourceId)), 1
            )
        );
        delete plantApproval[sourceId][plantId];
        seedLotForPlant[plantId] = sourceId;
        consumedQuantity[sourceId] += 1;
        emit SeedConsumed(sourceId, plantId, grower, lot.quantity - consumedQuantity[sourceId]);
    }

    function _approval(
        uint64 sourceId,
        uint64 plantId,
        bytes32 genomeId,
        address grower,
        uint64 parcelId,
        uint64 plotId
    ) private view returns (bytes32) {
        return keccak256(
            abi.encode(
                address(plantRegistry), sourceId, plantId, genomeId, grower, parcelId, plotId, ownershipEpoch[sourceId]
            )
        );
    }

    function remainingQuantity(
        uint64 sourceId
    ) external view returns (uint32) {
        SeedLot storage lot = _require(sourceId);
        return lot.quantity - consumedQuantity[sourceId];
    }

    function registerSeedLot(
        uint64 seedLotId,
        bytes32 genomeId,
        uint64 breedingEventId,
        address owner,
        uint32 quantity,
        bytes32 metadataHash
    ) external {
        if (seedLotId == 0 || genomeId == bytes32(0) || owner == address(0) || quantity == 0) revert HCInvalidId();
        if (!genomeRegistry.exists(genomeId)) revert HCNotFound();
        if (_lots[seedLotId].exists) revert HCAlreadyExists();
        _auth(ActionIds.SEED_REGISTER, seedLotId, quantity);
        _lots[seedLotId] = SeedLot(seedLotId, genomeId, breedingEventId, owner, quantity, metadataHash, true);
        emit SeedLotRegistered(seedLotId, genomeId, owner, quantity, breedingEventId);
    }

    function transfer(
        uint64 seedLotId,
        address newOwner
    ) external {
        if (newOwner == address(0)) revert HCZeroAddress();
        SeedLot storage lot = _require(seedLotId);
        if (consumedQuantity[seedLotId] >= lot.quantity) revert HCInvalidState();
        ownershipEpoch[seedLotId] += 1;
        _auth(ActionIds.SEED_TRANSFER, seedLotId, lot.quantity - consumedQuantity[seedLotId]);
        address previous = lot.owner;
        lot.owner = newOwner;
        emit SeedLotTransferred(seedLotId, previous, newOwner);
    }

    function getSeedLot(
        uint64 seedLotId
    ) external view returns (SeedLot memory) {
        return _requireView(seedLotId);
    }

    function exists(
        uint64 seedLotId
    ) external view returns (bool) {
        return _lots[seedLotId].exists;
    }

    function _require(
        uint64 id
    ) private view returns (SeedLot storage lot) {
        lot = _lots[id];
        if (!lot.exists) revert HCNotFound();
    }

    function _requireView(
        uint64 id
    ) private view returns (SeedLot memory lot) {
        lot = _lots[id];
        if (!lot.exists) revert HCNotFound();
    }

    function _auth(
        bytes32 actionId,
        uint64 id,
        uint256 amount
    ) private view {
        authorization.requireAuthorized(
            AuthorizationRequest(msg.sender, ModuleIds.SEED_REGISTRY, actionId, bytes32(uint256(id)), amount)
        );
    }
}
