// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { PublicCultivationAccess } from "../land/PublicCultivationAccess.sol";

import { ActionIds } from "../constants/ActionIds.sol";
import { ModuleIds } from "../constants/ModuleIds.sol";
import {
    HCAlreadyExists,
    HCCapacityExceeded,
    HCInvalidId,
    HCInvalidState,
    HCNotFound,
    HCZeroAddress
} from "../errors/HighCountryErrors.sol";
import { IHighCountryAuthorization } from "../interfaces/IHighCountryAuthorization.sol";
import { AuthorizationRequest } from "../types/HighCountryTypes.sol";

interface IGenomeRegistryPlant {
    function exists(
        bytes32 genomeId
    ) external view returns (bool);
}

interface ILandRegistryPlant {
    function exists(
        uint64 parcelId
    ) external view returns (bool);
    function effectiveOperator(
        uint64 parcelId
    ) external view returns (address);
    function growCapacityOf(
        uint64 parcelId
    ) external view returns (uint32);
    function regionIdOf(
        uint64 parcelId
    ) external view returns (uint16);
}

contract PlantRegistry {
    enum PlantStage {
        NONE,
        GERMINATION,
        SEEDLING,
        VEGETATIVE,
        FLOWERING,
        READY,
        TERMINATED
    }
    uint64 public constant GERMINATION_DURATION = 1 days;
    uint64 public constant SEEDLING_DURATION = 2 days;
    uint64 public constant VEGETATIVE_DURATION = 7 days;
    uint64 public constant FLOWERING_DURATION = 7 days;

    struct PlantRecord {
        uint64 id;
        bytes32 genomeId;
        address grower;
        uint64 landParcelId;
        uint16 regionId;
        PlantStage stage;
        uint64 plantedAt;
        uint64 lastAdvancedAt;
        bool exists;
    }

    IHighCountryAuthorization public immutable authorization;
    IGenomeRegistryPlant public immutable genomeRegistry;
    ILandRegistryPlant public immutable landRegistry;
    PublicCultivationAccess public immutable publicAccess;
    mapping(uint64 => uint32) public privatePlantsByParcel;
    mapping(uint64 => mapping(address => uint32)) public activePublicPlants;
    mapping(uint64 => uint64) public publicPlotOfPlant;
    event PublicPlantAdmitted(uint64 indexed plantId, uint64 indexed plotId, address indexed grower);
    event PlantCapacityReleased(uint64 indexed plantId, uint64 indexed parcelId, uint64 indexed plotId, address grower);
    mapping(uint64 => PlantRecord) private _plants;
    mapping(uint64 => uint32) public activePlantsByParcel;

    event PlantRegistered(
        uint64 indexed plantId, bytes32 indexed genomeId, address indexed grower, uint64 landParcelId, uint16 regionId
    );
    event PlantAdvanced(uint64 indexed plantId, PlantStage previousStage, PlantStage newStage, uint64 timestamp);

    constructor(
        address authorization_,
        address genomeRegistry_,
        address landRegistry_,
        address publicAccess_
    ) {
        if (
            authorization_ == address(0) || genomeRegistry_ == address(0) || landRegistry_ == address(0)
                || publicAccess_ == address(0)
        ) {
            revert HCZeroAddress();
        }
        authorization = IHighCountryAuthorization(authorization_);
        genomeRegistry = IGenomeRegistryPlant(genomeRegistry_);
        landRegistry = ILandRegistryPlant(landRegistry_);
        publicAccess = PublicCultivationAccess(publicAccess_);
        if (
            address(publicAccess.authorization()) != authorization_
                || address(publicAccess.landRegistry()) != landRegistry_
        ) {
            revert HCInvalidState();
        }
    }

    function registerPlant(
        uint64 plantId,
        bytes32 genomeId,
        address grower,
        uint64 landParcelId
    ) external {
        if (plantId == 0 || genomeId == bytes32(0) || grower == address(0) || landParcelId == 0) revert HCInvalidId();
        if (_plants[plantId].exists) revert HCAlreadyExists();
        if (!genomeRegistry.exists(genomeId) || !landRegistry.exists(landParcelId)) revert HCNotFound();
        if (address(publicAccess.plantRegistry()) != address(this)) revert HCInvalidState();
        if (landRegistry.effectiveOperator(landParcelId) != grower) revert HCInvalidState();
        uint32 capacity = landRegistry.growCapacityOf(landParcelId);
        uint256 used = uint256(privatePlantsByParcel[landParcelId]) + publicAccess.publicCapacityOnParcel(landParcelId);
        if (used >= capacity) revert HCCapacityExceeded(used + 1, capacity);
        _auth(ActionIds.PLANT_REGISTER, plantId);
        privatePlantsByParcel[landParcelId] += 1;
        _registerPlant(plantId, genomeId, grower, landParcelId);
    }

    function registerPublicPlant(
        uint64 plantId,
        bytes32 genomeId,
        address grower,
        uint64 plotId
    ) external {
        if (plantId == 0 || genomeId == bytes32(0) || grower == address(0)) revert HCInvalidId();
        if (_plants[plantId].exists) revert HCAlreadyExists();
        if (address(publicAccess.plantRegistry()) != address(this)) revert HCInvalidState();
        PublicCultivationAccess.PublicPlot memory plot = publicAccess.getPlot(plotId);
        if (!genomeRegistry.exists(genomeId) || !landRegistry.exists(plot.parcelId)) revert HCNotFound();
        uint32 allocated = publicAccess.allocationOf(plotId, grower);
        uint32 active = activePublicPlants[plotId][grower];
        if (active >= allocated) revert HCCapacityExceeded(uint256(active) + 1, allocated);
        _auth(ActionIds.PLANT_REGISTER, plantId);
        activePublicPlants[plotId][grower] = active + 1;
        publicPlotOfPlant[plantId] = plotId;
        _registerPlant(plantId, genomeId, grower, plot.parcelId);
        emit PublicPlantAdmitted(plantId, plotId, grower);
    }

    function _registerPlant(
        uint64 plantId,
        bytes32 genomeId,
        address grower,
        uint64 landParcelId
    ) private {
        uint16 regionId = landRegistry.regionIdOf(landParcelId);
        _plants[plantId] = PlantRecord(
            plantId,
            genomeId,
            grower,
            landParcelId,
            regionId,
            PlantStage.GERMINATION,
            uint64(block.timestamp),
            uint64(block.timestamp),
            true
        );
        activePlantsByParcel[landParcelId] += 1;
        emit PlantRegistered(plantId, genomeId, grower, landParcelId, regionId);
    }

    function advanceStage(
        uint64 plantId,
        PlantStage newStage
    ) external {
        PlantRecord storage p = _require(plantId);
        if (p.stage == PlantStage.TERMINATED || newStage == PlantStage.NONE) revert HCInvalidState();
        if (uint8(newStage) != uint8(p.stage) + 1) revert HCInvalidState();
        _auth(ActionIds.PLANT_ADVANCE, plantId);
        if (p.stage != PlantStage.READY) {
            uint64 duration = stageDuration(p.stage);
            if (duration == 0 || block.timestamp < uint256(p.lastAdvancedAt) + duration) revert HCInvalidState();
            _advanceAt(p, newStage, p.lastAdvancedAt + duration);
        } else {
            _advanceAt(p, newStage, uint64(block.timestamp));
        }
    }

    function syncOfflineGrowth(
        uint64 plantId
    ) external returns (PlantStage stage, uint8 stagesAdvanced) {
        PlantRecord storage p = _require(plantId);
        if (p.stage == PlantStage.TERMINATED) revert HCInvalidState();
        _auth(ActionIds.PLANT_ADVANCE, plantId);
        while (p.stage != PlantStage.READY) {
            uint64 duration = stageDuration(p.stage);
            if (duration == 0 || block.timestamp < uint256(p.lastAdvancedAt) + duration) break;
            PlantStage next = PlantStage(uint8(p.stage) + 1);
            _advanceAt(p, next, p.lastAdvancedAt + duration);
            unchecked {
                ++stagesAdvanced;
            }
        }
        return (p.stage, stagesAdvanced);
    }

    function nextStageAt(
        uint64 plantId
    ) external view returns (uint64) {
        PlantRecord memory p = _plants[plantId];
        if (!p.exists) revert HCNotFound();
        uint64 duration = stageDuration(p.stage);
        if (duration == 0) return 0;
        return p.lastAdvancedAt + duration;
    }

    function stageDuration(
        PlantStage stage
    ) public pure returns (uint64) {
        if (stage == PlantStage.GERMINATION) return GERMINATION_DURATION;
        if (stage == PlantStage.SEEDLING) return SEEDLING_DURATION;
        if (stage == PlantStage.VEGETATIVE) return VEGETATIVE_DURATION;
        if (stage == PlantStage.FLOWERING) return FLOWERING_DURATION;
        return 0;
    }

    function getPlant(
        uint64 plantId
    ) external view returns (PlantRecord memory) {
        PlantRecord memory p = _plants[plantId];
        if (!p.exists) revert HCNotFound();
        return p;
    }

    function exists(
        uint64 plantId
    ) external view returns (bool) {
        return _plants[plantId].exists;
    }

    function genomeOf(
        uint64 plantId
    ) external view returns (bytes32) {
        PlantRecord memory p = _plants[plantId];
        if (!p.exists) revert HCNotFound();
        return p.genomeId;
    }

    function _advanceAt(
        PlantRecord storage p,
        PlantStage newStage,
        uint64 effectiveAt
    ) private {
        PlantStage previous = p.stage;
        p.stage = newStage;
        p.lastAdvancedAt = effectiveAt;
        if (newStage == PlantStage.TERMINATED) {
            activePlantsByParcel[p.landParcelId] -= 1;
            uint64 plotId = publicPlotOfPlant[p.id];
            if (plotId == 0) privatePlantsByParcel[p.landParcelId] -= 1;
            else activePublicPlants[plotId][p.grower] -= 1;
            emit PlantCapacityReleased(p.id, p.landParcelId, plotId, p.grower);
        }
        emit PlantAdvanced(p.id, previous, newStage, effectiveAt);
    }

    function _require(
        uint64 plantId
    ) private view returns (PlantRecord storage p) {
        p = _plants[plantId];
        if (!p.exists) revert HCNotFound();
    }

    function _auth(
        bytes32 actionId,
        uint64 plantId
    ) private view {
        authorization.requireAuthorized(
            AuthorizationRequest(msg.sender, ModuleIds.PLANT_REGISTRY, actionId, bytes32(uint256(plantId)), 0)
        );
    }
}
