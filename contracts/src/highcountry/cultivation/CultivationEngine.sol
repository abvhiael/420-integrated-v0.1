// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ActionIds } from "../constants/ActionIds.sol";
import { ModuleIds } from "../constants/ModuleIds.sol";
import { HCInvalidId, HCInvalidState, HCNotFound, HCZeroAddress } from "../errors/HighCountryErrors.sol";
import { IHighCountryAuthorization } from "../interfaces/IHighCountryAuthorization.sol";
import { AuthorizationRequest } from "../types/HighCountryTypes.sol";

interface IPlantRegistryCultivation {
    function exists(uint64 plantId) external view returns (bool);
}

contract CultivationEngine {
    uint16 public constant BPS = 10_000;
    uint16 public constant TEMPERATURE_MIN = 1_000;
    uint16 public constant TEMPERATURE_MAX = 4_000;
    uint16 public constant CONTROL_MAX = 10_000;

    struct EnvironmentSnapshot {
        uint16 temperature;
        uint16 humidity;
        uint16 light;
        uint16 water;
        uint16 nutrients;
        uint16 airflow;
    }

    struct CultivationState {
        uint64 plantId;
        EnvironmentSnapshot environment;
        bytes32 expressionHash;
        uint64 updatedAt;
        uint16 stressBps;
        uint16 qualityBps;
        bool expressionLocked;
        bool exists;
    }

    IHighCountryAuthorization public immutable authorization;
    IPlantRegistryCultivation public immutable plantRegistry;
    mapping(uint64 => CultivationState) private _states;

    event EnvironmentUpdated(uint64 indexed plantId, uint16 stressBps, uint16 qualityBps, uint64 timestamp);
    event PhenotypeExpressed(uint64 indexed plantId, bytes32 indexed expressionHash, uint16 stressBps, uint16 qualityBps, uint64 timestamp);

    constructor(address authorization_, address plantRegistry_) {
        if (authorization_ == address(0) || plantRegistry_ == address(0)) revert HCZeroAddress();
        authorization = IHighCountryAuthorization(authorization_);
        plantRegistry = IPlantRegistryCultivation(plantRegistry_);
    }

    function updateEnvironment(uint64 plantId, EnvironmentSnapshot calldata environment) external {
        if (plantId == 0) revert HCInvalidId();
        if (!plantRegistry.exists(plantId)) revert HCNotFound();
        if (_states[plantId].expressionLocked) revert HCInvalidState();
        _validateEnvironment(environment);
        _auth(ActionIds.CULTIVATION_UPDATE, plantId);
        (uint16 stressBps, uint16 qualityBps) = deriveScores(environment);
        _states[plantId] = CultivationState({plantId: plantId, environment: environment, expressionHash: bytes32(0), updatedAt: uint64(block.timestamp), stressBps: stressBps, qualityBps: qualityBps, expressionLocked: false, exists: true});
        emit EnvironmentUpdated(plantId, stressBps, qualityBps, uint64(block.timestamp));
    }

    function expressPhenotype(uint64 plantId, bytes32 genomeId, bytes32 rulesetId) external returns (bytes32 expressionHash) {
        CultivationState storage s = _states[plantId];
        if (!s.exists) revert HCNotFound();
        if (s.expressionLocked || genomeId == bytes32(0) || rulesetId == bytes32(0)) revert HCInvalidState();
        _auth(ActionIds.PHENOTYPE_EXPRESS, plantId);
        expressionHash = keccak256(abi.encode("HC.PHENOTYPE.EXPRESSION.V1", plantId, genomeId, rulesetId, s.environment, s.stressBps, s.qualityBps));
        s.expressionHash = expressionHash;
        s.expressionLocked = true;
        s.updatedAt = uint64(block.timestamp);
        emit PhenotypeExpressed(plantId, expressionHash, s.stressBps, s.qualityBps, s.updatedAt);
    }

    function deriveScores(EnvironmentSnapshot memory environment) public pure returns (uint16 stressBps, uint16 qualityBps) {
        _validateEnvironment(environment);
        uint256 stress = _dimensionStress(environment.temperature, 2_000, 2_800, TEMPERATURE_MIN, TEMPERATURE_MAX)
            + _dimensionStress(environment.humidity, 4_500, 7_000, 0, CONTROL_MAX)
            + _dimensionStress(environment.light, 5_000, 9_000, 0, CONTROL_MAX)
            + _dimensionStress(environment.water, 4_000, 7_500, 0, CONTROL_MAX)
            + _dimensionStress(environment.nutrients, 4_000, 8_000, 0, CONTROL_MAX)
            + _dimensionStress(environment.airflow, 2_500, 7_500, 0, CONTROL_MAX);
        stressBps = uint16(stress / 6);
        qualityBps = BPS - stressBps;
    }

    function getState(uint64 plantId) external view returns (CultivationState memory) {
        CultivationState memory s = _states[plantId];
        if (!s.exists) revert HCNotFound();
        return s;
    }

    function _validateEnvironment(EnvironmentSnapshot memory environment) private pure {
        if (environment.temperature < TEMPERATURE_MIN || environment.temperature > TEMPERATURE_MAX) revert HCInvalidState();
        if (environment.humidity > CONTROL_MAX || environment.light > CONTROL_MAX || environment.water > CONTROL_MAX || environment.nutrients > CONTROL_MAX || environment.airflow > CONTROL_MAX) revert HCInvalidState();
    }

    function _dimensionStress(uint16 value, uint16 idealMin, uint16 idealMax, uint16 absoluteMin, uint16 absoluteMax) private pure returns (uint256) {
        if (value >= idealMin && value <= idealMax) return 0;
        if (value < idealMin) return ((uint256(idealMin) - value) * BPS) / (uint256(idealMin) - absoluteMin);
        return ((uint256(value) - idealMax) * BPS) / (uint256(absoluteMax) - idealMax);
    }

    function _auth(bytes32 actionId, uint64 plantId) private view {
        authorization.requireAuthorized(AuthorizationRequest(msg.sender, ModuleIds.CULTIVATION_ENGINE, actionId, bytes32(uint256(plantId)), 0));
    }
}
