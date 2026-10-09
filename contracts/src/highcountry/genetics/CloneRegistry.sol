// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { IPlantSourceConsumer } from "../interfaces/IPlantSourceConsumer.sol";

import { ActionIds } from "../constants/ActionIds.sol";
import { ModuleIds } from "../constants/ModuleIds.sol";
import {
    HCAlreadyExists,
    HCInvalidId,
    HCInvalidState,
    HCNotFound,
    HCUnauthorized,
    HCZeroAddress
} from "../errors/HighCountryErrors.sol";
import { IHighCountryAuthorization } from "../interfaces/IHighCountryAuthorization.sol";
import { AuthorizationRequest } from "../types/HighCountryTypes.sol";

interface IGenomeRegistryClone {
    function exists(
        bytes32 genomeId
    ) external view returns (bool);
}

interface IMotherRegistryClone {
    function cloneRegistry() external view returns (address);
    function consumeForClone(
        uint64 motherId,
        uint64 cloneId
    ) external;
    function exists(
        uint64 motherId
    ) external view returns (bool);
    function genomeOf(
        uint64 motherId
    ) external view returns (bytes32);
}

contract CloneRegistry {
    struct CloneRecord {
        uint64 id;
        bytes32 genomeId;
        uint64 motherId;
        address owner;
        bytes32 metadataHash;
        bool exists;
    }

    bytes32 public constant BIND_SCOPE = keccak256("HC.CLONE_REGISTRY.PLANT_BINDING");
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
    mapping(uint64 => uint64) public consumedByPlant;
    mapping(uint64 => uint64) public cloneForPlant;
    event CloneConsumed(uint64 indexed cloneId, uint64 indexed plantId, address indexed grower);

    IHighCountryAuthorization public immutable authorization;
    IGenomeRegistryClone public immutable genomeRegistry;
    IMotherRegistryClone public immutable motherRegistry;
    mapping(uint64 => CloneRecord) private _clones;

    event CloneRegistered(uint64 indexed cloneId, bytes32 indexed genomeId, uint64 indexed motherId, address owner);
    event CloneTransferred(uint64 indexed cloneId, address indexed previousOwner, address indexed newOwner);

    constructor(
        address authorization_,
        address genomeRegistry_,
        address motherRegistry_
    ) {
        if (authorization_ == address(0) || genomeRegistry_ == address(0) || motherRegistry_ == address(0)) {
            revert HCZeroAddress();
        }
        authorization = IHighCountryAuthorization(authorization_);
        genomeRegistry = IGenomeRegistryClone(genomeRegistry_);
        motherRegistry = IMotherRegistryClone(motherRegistry_);
    }

    /// @notice Deployment-only binding; replacement requires a new registry.
    function bindPlantRegistry(
        address plants
    ) external {
        if (address(plantRegistry) != address(0) || plants.code.length == 0) revert HCInvalidState();
        authorization.requireAuthorized(
            AuthorizationRequest(msg.sender, ModuleIds.CLONE_REGISTRY, ActionIds.CLONE_BIND_PLANTS, BIND_SCOPE, 0)
        );
        IPlantSourceConsumer candidate = IPlantSourceConsumer(plants);
        if (
            candidate.authorization() != address(authorization) || candidate.genomeRegistry() != address(genomeRegistry)
                || candidate.cloneRegistry() != address(this)
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
        CloneRecord storage clone = _require(sourceId);
        if (clone.owner != msg.sender) {
            revert HCUnauthorized(msg.sender, ModuleIds.CLONE_REGISTRY, ActionIds.CLONE_CONSUME);
        }
        if (address(plantRegistry) == address(0) || plantId == 0 || parcelId == 0) revert HCInvalidState();
        if (consumedByPlant[sourceId] != 0) revert HCInvalidState();
        plantApproval[sourceId][plantId] = _approval(sourceId, plantId, clone.genomeId, msg.sender, parcelId, plotId);
        emit PlantSourceApproved(sourceId, plantId, msg.sender, parcelId, plotId, ownershipEpoch[sourceId]);
    }

    function revokePlantApproval(
        uint64 sourceId,
        uint64 plantId
    ) external {
        CloneRecord storage clone = _require(sourceId);
        if (clone.owner != msg.sender) {
            revert HCUnauthorized(msg.sender, ModuleIds.CLONE_REGISTRY, ActionIds.CLONE_CONSUME);
        }
        delete plantApproval[sourceId][plantId];
        emit PlantSourceApprovalRevoked(sourceId, plantId, msg.sender);
    }

    function consumeForPlant(
        uint64 sourceId,
        uint64 plantId
    ) external {
        if (msg.sender != address(plantRegistry) || plantId == 0) revert HCInvalidState();
        CloneRecord storage clone = _require(sourceId);
        (uint8 kind, uint64 recordedSource, bytes32 genomeId, address grower, uint64 parcelId, uint64 plotId) =
            plantRegistry.sourceContext(plantId);
        if (kind != 2 || recordedSource != sourceId || clone.genomeId != genomeId || clone.owner != grower) {
            revert HCInvalidState();
        }
        if (plantApproval[sourceId][plantId] != _approval(sourceId, plantId, genomeId, grower, parcelId, plotId)) {
            revert HCInvalidState();
        }
        if (cloneForPlant[plantId] != 0 || consumedByPlant[sourceId] != 0) revert HCInvalidState();
        authorization.requireAuthorized(
            AuthorizationRequest(
                msg.sender, ModuleIds.CLONE_REGISTRY, ActionIds.CLONE_CONSUME, bytes32(uint256(sourceId)), 1
            )
        );
        delete plantApproval[sourceId][plantId];
        cloneForPlant[plantId] = sourceId;
        consumedByPlant[sourceId] = plantId;
        emit CloneConsumed(sourceId, plantId, grower);
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

    function registerClone(
        uint64 cloneId,
        bytes32 genomeId,
        uint64 motherId,
        address owner,
        bytes32 metadataHash
    ) external {
        if (cloneId == 0 || genomeId == bytes32(0) || motherId == 0 || owner == address(0)) revert HCInvalidId();
        if (!genomeRegistry.exists(genomeId) || !motherRegistry.exists(motherId)) revert HCNotFound();
        if (motherRegistry.genomeOf(motherId) != genomeId) revert HCInvalidState();
        if (_clones[cloneId].exists) revert HCAlreadyExists();
        if (motherRegistry.cloneRegistry() != address(this)) revert HCInvalidState();
        _auth(ActionIds.CLONE_REGISTER, cloneId);
        _clones[cloneId] = CloneRecord(cloneId, genomeId, motherId, owner, metadataHash, true);
        motherRegistry.consumeForClone(motherId, cloneId);
        emit CloneRegistered(cloneId, genomeId, motherId, owner);
    }

    function cloneContext(
        uint64 cloneId
    ) external view returns (uint64 motherId, bytes32 genomeId, address owner) {
        CloneRecord storage clone = _require(cloneId);
        return (clone.motherId, clone.genomeId, clone.owner);
    }

    function transfer(
        uint64 cloneId,
        address newOwner
    ) external {
        if (newOwner == address(0)) revert HCZeroAddress();
        CloneRecord storage clone = _require(cloneId);
        if (consumedByPlant[cloneId] != 0) revert HCInvalidState();
        ownershipEpoch[cloneId] += 1;
        _auth(ActionIds.CLONE_TRANSFER, cloneId);
        address previous = clone.owner;
        clone.owner = newOwner;
        emit CloneTransferred(cloneId, previous, newOwner);
    }

    function exists(
        uint64 cloneId
    ) external view returns (bool) {
        return _clones[cloneId].exists;
    }

    function getClone(
        uint64 cloneId
    ) external view returns (CloneRecord memory) {
        CloneRecord memory c = _clones[cloneId];
        if (!c.exists) revert HCNotFound();
        return c;
    }

    function _require(
        uint64 id
    ) private view returns (CloneRecord storage c) {
        c = _clones[id];
        if (!c.exists) revert HCNotFound();
    }

    function _auth(
        bytes32 actionId,
        uint64 id
    ) private view {
        authorization.requireAuthorized(
            AuthorizationRequest(msg.sender, ModuleIds.CLONE_REGISTRY, actionId, bytes32(uint256(id)), 0)
        );
    }
}
