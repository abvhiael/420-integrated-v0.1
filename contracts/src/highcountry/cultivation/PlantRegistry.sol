// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { SeedRegistry } from "../genetics/SeedRegistry.sol";
import { CloneRegistry } from "../genetics/CloneRegistry.sol";
import { PublicCultivationAccess } from "../land/PublicCultivationAccess.sol";

import { ActionIds } from "../constants/ActionIds.sol";
import { EmergencyDomains } from "../constants/EmergencyDomains.sol";
import { IEmergencyState } from "../interfaces/IEmergencyState.sol";
import { ModuleIds } from "../constants/ModuleIds.sol";
import {
    HCAlreadyExists,
    HCCapacityExceeded,
    HCInvalidId,
    HCInvalidState,
    HCNotFound,
    HCZeroAddress,
    HCEmergencyRestrictionActive
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
    enum PlantSourceKind {
        NONE,
        SEED,
        CLONE
    }

    struct PlantSource {
        PlantSourceKind kind;
        uint64 sourceId;
    }
    mapping(uint64 => PlantSource) public sourceOfPlant;
    SeedRegistry public immutable seedRegistry;
    CloneRegistry public immutable cloneRegistry;
    bool private _entering;
    event PlantSourceConsumed(
        uint64 indexed plantId, PlantSourceKind indexed kind, uint64 indexed sourceId, address grower
    );
    modifier nonReentrantAdmission() {
        if (_entering) revert HCInvalidState();
        _entering = true;
        _;
        _entering = false;
    }

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

    IEmergencyState public emergencyState;
    bytes32 public constant EMERGENCY_BIND_SCOPE = keccak256("HC.EMERGENCY.ENGINE_BIND.V1");
    event EmergencyStateBound(address indexed emergencyState);

    function bindEmergencyState(address candidate) external {
        if (address(emergencyState) != address(0) || candidate.code.length == 0) revert HCInvalidState();
        authorization.requireAuthorized(
            AuthorizationRequest(
                msg.sender, ModuleIds.PLANT_REGISTRY,
                ActionIds.PLANT_BIND_EMERGENCY,
                EMERGENCY_BIND_SCOPE, 0
            )
        );
        if (IEmergencyState(candidate).isAllowedDomain(EmergencyDomains.CULTIVATION) == false
            || IEmergencyState(candidate).isAllowedDomain(EmergencyDomains.BREEDING) == false
            || IEmergencyState(candidate).isAllowedDomain(EmergencyDomains.RANDOMNESS_REQUEST) == false) revert HCInvalidState();
        emergencyState = IEmergencyState(candidate);
        emit EmergencyStateBound(candidate);
    }

    function _requireUnrestricted(bytes32 domain) private view {
        if (address(emergencyState) == address(0) || emergencyState.isRestricted(domain)) {
            revert HCEmergencyRestrictionActive(domain);
        }
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
        address publicAccess_,
        address seedRegistry_,
        address cloneRegistry_
    ) {
        if (
            authorization_ == address(0) || genomeRegistry_ == address(0) || landRegistry_ == address(0)
                || publicAccess_ == address(0) || seedRegistry_ == address(0) || cloneRegistry_ == address(0)
        ) {
            revert HCZeroAddress();
        }
        authorization = IHighCountryAuthorization(authorization_);
        genomeRegistry = IGenomeRegistryPlant(genomeRegistry_);
        landRegistry = ILandRegistryPlant(landRegistry_);
        publicAccess = PublicCultivationAccess(publicAccess_);
        seedRegistry = SeedRegistry(seedRegistry_);
        cloneRegistry = CloneRegistry(cloneRegistry_);
        if (
            address(seedRegistry.authorization()) != authorization_
                || address(cloneRegistry.authorization()) != authorization_
                || address(seedRegistry.genomeRegistry()) != genomeRegistry_
                || address(cloneRegistry.genomeRegistry()) != genomeRegistry_
        ) revert HCInvalidState();
        if (
            address(publicAccess.authorization()) != authorization_
                || address(publicAccess.landRegistry()) != landRegistry_
        ) {
            revert HCInvalidState();
        }
    }

    /// @notice Source-less legacy admission is deliberately disabled.
    function registerPlant(
        uint64,
        bytes32,
        address,
        uint64
    ) external pure {
        revert HCInvalidState();
    }

    function registerPublicPlant(
        uint64,
        bytes32,
        address,
        uint64
    ) external pure {
        revert HCInvalidState();
    }

    function registerPlantFromSource(
        uint64 plantId,
        bytes32 genomeId,
        address grower,
        uint64 parcelId,
        uint64 plotId,
        PlantSourceKind kind,
        uint64 sourceId
    ) external nonReentrantAdmission {
        _requireUnrestricted(EmergencyDomains.CULTIVATION);
        if (sourceId == 0 || kind == PlantSourceKind.NONE) revert HCInvalidId();
        if (
            address(seedRegistry.plantRegistry()) != address(this)
                || address(cloneRegistry.plantRegistry()) != address(this)
        ) revert HCInvalidState();
        if (kind == PlantSourceKind.SEED) {
            SeedRegistry.SeedLot memory lot = seedRegistry.getSeedLot(sourceId);
            if (lot.owner != grower || lot.genomeId != genomeId) revert HCInvalidState();
        } else {
            CloneRegistry.CloneRecord memory clone = cloneRegistry.getClone(sourceId);
            if (clone.owner != grower || clone.genomeId != genomeId) revert HCInvalidState();
        }
        if (plotId == 0) {
            _registerPrivatePlant(plantId, genomeId, grower, parcelId);
        } else {
            if (publicAccess.getPlot(plotId).parcelId != parcelId) revert HCInvalidState();
            _registerPublicPlant(plantId, genomeId, grower, plotId);
        }
        sourceOfPlant[plantId] = PlantSource(kind, sourceId);
        if (kind == PlantSourceKind.SEED) seedRegistry.consumeForPlant(sourceId, plantId);
        else cloneRegistry.consumeForPlant(sourceId, plantId);
        emit PlantSourceConsumed(plantId, kind, sourceId, grower);
    }

    function sourceContext(
        uint64 plantId
    )
        external
        view
        returns (uint8 kind, uint64 sourceId, bytes32 genomeId, address grower, uint64 parcelId, uint64 plotId)
    {
        PlantRecord storage p = _require(plantId);
        PlantSource memory source = sourceOfPlant[plantId];
        return (uint8(source.kind), source.sourceId, p.genomeId, p.grower, p.landParcelId, publicPlotOfPlant[plantId]);
    }

    function _registerPrivatePlant(
        uint64 plantId,
        bytes32 genomeId,
        address grower,
        uint64 landParcelId
    ) private {
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

    function _registerPublicPlant(
        uint64 plantId,
        bytes32 genomeId,
        address grower,
        uint64 plotId
    ) private {
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
        if (!(p.stage == PlantStage.READY && newStage == PlantStage.TERMINATED)) {
            _requireUnrestricted(EmergencyDomains.CULTIVATION);
        } else if (address(emergencyState) == address(0)) {
            revert HCEmergencyRestrictionActive(EmergencyDomains.CULTIVATION);
        }
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
        _requireUnrestricted(EmergencyDomains.CULTIVATION);
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
