// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ActionIds } from "../constants/ActionIds.sol";
import { EmergencyDomains } from "../constants/EmergencyDomains.sol";
import { HCEmergencyRestrictionActive } from "../errors/HighCountryErrors.sol";
import { ModuleIds } from "../constants/ModuleIds.sol";
import { HCInvalidId, HCInvalidState, HCZeroAddress } from "../errors/HighCountryErrors.sol";
import { IHighCountryAuthorization } from "../interfaces/IHighCountryAuthorization.sol";
import { AuthorizationRequest } from "../types/HighCountryTypes.sol";
import { PlantRegistry } from "../cultivation/PlantRegistry.sol";
import { CultivationEngine } from "../cultivation/CultivationEngine.sol";

/// @notice R03.1 harvest acceptance only. Yield/product accounting and plant termination
///         are separate canonical R03.2-R03.4 responsibilities.
contract HarvestEngine {
    struct HarvestAcceptance {
        uint64 plantId;
        bytes32 genomeId;
        bytes32 expressionHash;
        bytes32 rulesetId;
        bytes32 rulesetContentHash;
        address grower;
        uint64 parcelId;
        uint64 publicPlotId;
        uint64 acceptedAt;
        bool accepted;
    }

    IHighCountryAuthorization public immutable authorization;
    PlantRegistry public immutable plantRegistry;
    CultivationEngine public immutable cultivationEngine;
    mapping(uint64 => HarvestAcceptance) private _accepted;

    event HarvestAccepted(
        uint64 indexed plantId,
        bytes32 indexed genomeId,
        address indexed grower,
        uint64 parcelId,
        bytes32 expressionHash,
        bytes32 rulesetId,
        bytes32 rulesetContentHash,
        uint64 publicPlotId,
        uint64 acceptedAt
    );

    constructor(
        if (authorization_ == address(0) || plantRegistry_ == address(0) || cultivationEngine_ == address(0)) {
        address authorization_,
            revert HCZeroAddress();
        address plantRegistry_,
        }
        address cultivationEngine_
        if (authorization_.code.length == 0 || plantRegistry_.code.length == 0 || cultivationEngine_.code.length == 0) {
    ) {
            revert HCInvalidState();
        }
        authorization = IHighCountryAuthorization(authorization_);
        plantRegistry = PlantRegistry(plantRegistry_);
        cultivationEngine = CultivationEngine(cultivationEngine_);
        if (
            address(plantRegistry.authorization()) != authorization_
                || address(cultivationEngine.authorization()) != authorization_
                || address(cultivationEngine.plantRegistry()) != plantRegistry_
        ) revert HCInvalidState();
    }

    /// @notice Accept a single harvest of a READY plant with an already sealed canonical expression.
    /// @dev Deliberately does not mint a product or release cultivation capacity.
        if (plantId == 0) revert HCInvalidId();
        if (_accepted[plantId].accepted) revert HCInvalidState();
        if (
            address(cultivationEngine.emergencyState()) == address(0)
    function acceptHarvest(
                || cultivationEngine.emergencyState().isRestricted(EmergencyDomains.CULTIVATION)
        uint64 plantId
        ) revert HCEmergencyRestrictionActive(EmergencyDomains.CULTIVATION);
    ) external returns (HarvestAcceptance memory acceptance) {

        PlantRegistry.PlantRecord memory plant = plantRegistry.getPlant(plantId);
        if (plant.stage != PlantRegistry.PlantStage.READY || plant.grower != msg.sender) {
            revert HCInvalidState();
        }
        CultivationEngine.CultivationState memory cultivation = cultivationEngine.getState(plantId);
        bytes32 rulesetId = cultivationEngine.sealedRulesetId(plantId);
        bytes32 contentHash = cultivationEngine.sealedRulesetContentHash(plantId);
        if (
                || cultivationEngine.expressionForPlant(plantId) != cultivation.expressionHash
                || plant.genomeId != plantRegistry.genomeOf(plantId)
        ) revert HCInvalidState();

        authorization.requireAuthorized(
            !cultivation.expressionLocked || cultivation.expressionHash == bytes32(0) || rulesetId == bytes32(0)
            AuthorizationRequest(
                || contentHash == bytes32(0)
                msg.sender, ModuleIds.HARVEST_ENGINE, ActionIds.HARVEST_ACCEPT, bytes32(uint256(plantId)), 0
            )
        );

        acceptance = HarvestAcceptance({
            plantId: plantId,
            genomeId: plant.genomeId,
            expressionHash: cultivation.expressionHash,
            rulesetId: rulesetId,
            rulesetContentHash: contentHash,
            grower: plant.grower,
            parcelId: plant.landParcelId,
            publicPlotId: plantRegistry.publicPlotOfPlant(plantId),
            acceptedAt: uint64(block.timestamp),
            accepted: true
        });
        _accepted[plantId] = acceptance;
        emit HarvestAccepted(
            acceptance.plantId,
            acceptance.genomeId,
            acceptance.grower,
            acceptance.parcelId,
            acceptance.expressionHash,
            acceptance.rulesetId,
            acceptance.rulesetContentHash,
            acceptance.publicPlotId,
            acceptance.acceptedAt
        );
    }

        acceptance = _accepted[plantId];
        if (!acceptance.accepted) revert HCInvalidState();
    }

        return _accepted[plantId].accepted;
    function getHarvest(
    }
        uint64 plantId
}
    ) external view returns (HarvestAcceptance memory acceptance) {
