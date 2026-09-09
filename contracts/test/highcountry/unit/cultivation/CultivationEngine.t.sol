// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ICapabilityRegistry420 } from "../../../../src/interfaces/genesis/ICapabilityRegistry420.sol";
import { HighCountryAuthorization } from "../../../../src/highcountry/auth/HighCountryAuthorization.sol";
import { ActionIds } from "../../../../src/highcountry/constants/ActionIds.sol";
import { ModuleIds } from "../../../../src/highcountry/constants/ModuleIds.sol";
import { GenesisRegistry } from "../../../../src/highcountry/genesis/GenesisRegistry.sol";
import { GenomeRegistry } from "../../../../src/highcountry/genetics/GenomeRegistry.sol";
import { PlantRegistry } from "../../../../src/highcountry/cultivation/PlantRegistry.sol";
import { CultivationEngine } from "../../../../src/highcountry/cultivation/CultivationEngine.sol";
import { GenesisRoots } from "../../../../src/highcountry/types/HighCountryTypes.sol";
import { MockCapabilityRegistry } from "../../mocks/MockCapabilityRegistry.sol";

interface Vm { function warp(uint256) external; }

contract MockLandRegistryHC6 {
    struct Parcel { address operator; uint32 capacity; uint16 regionId; bool exists; }
    mapping(uint64 => Parcel) private _parcels;
    function configure(uint64 parcelId, address operator, uint32 capacity, uint16 regionId) external { _parcels[parcelId] = Parcel(operator, capacity, regionId, true); }
    function exists(uint64 parcelId) external view returns (bool) { return _parcels[parcelId].exists; }
    function effectiveOperator(uint64 parcelId) external view returns (address) { return _parcels[parcelId].operator; }
    function growCapacityOf(uint64 parcelId) external view returns (uint32) { return _parcels[parcelId].capacity; }
    function regionIdOf(uint64 parcelId) external view returns (uint16) { return _parcels[parcelId].regionId; }
}

contract CultivationEngineTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    MockCapabilityRegistry private caps;
    HighCountryAuthorization private auth;
    GenesisRegistry private genesis;
    GenomeRegistry private genomes;
    MockLandRegistryHC6 private land;
    PlantRegistry private plants;
    CultivationEngine private cultivation;
    bytes32 private genomeId;

    constructor() {
        caps = new MockCapabilityRegistry(); auth = new HighCountryAuthorization(address(caps)); genesis = new GenesisRegistry(address(auth));
        genomes = new GenomeRegistry(address(auth), address(genesis)); land = new MockLandRegistryHC6();
        land.configure(11, address(this), 2, 1); land.configure(12, address(this), 2, 2); land.configure(13, address(this), 2, 3); land.configure(14, address(0xBEEF), 1, 1); land.configure(15, address(this), 1, 2);
        plants = new PlantRegistry(address(auth), address(genomes), address(land)); cultivation = new CultivationEngine(address(auth), address(plants));
        _grant(address(this), ModuleIds.GENESIS_REGISTRY, ActionIds.GENESIS_SET_ROOTS, bytes32(0), keccak256("hc6:roots"));
        _grant(address(this), ModuleIds.GENESIS_REGISTRY, ActionIds.GENESIS_FINALIZE, bytes32(0), keccak256("hc6:finalize"));
        genesis.setRoots(_roots()); genesis.finalizeGenesis();
        genomeId = keccak256("hc6:genome");
        _grant(address(this), ModuleIds.GENOME_REGISTRY, ActionIds.GENOME_REGISTER, genomeId, keccak256("hc6:genome:grant"));
        genomes.registerGenome(genomeId, keccak256("hc6:line"), keccak256("hc6:meta"), _loci());
    }

    function testPlantLifecycleMovesForwardOnlyAfterRequiredTime() public {
        _grant(address(this), ModuleIds.PLANT_REGISTRY, ActionIds.PLANT_REGISTER, bytes32(uint256(1)), keccak256("hc6:plant:create"));
        _grant(address(this), ModuleIds.PLANT_REGISTRY, ActionIds.PLANT_ADVANCE, bytes32(uint256(1)), keccak256("hc6:plant:advance"));
        plants.registerPlant(1, genomeId, address(this), 11);
        (bool early,) = address(plants).call(abi.encodeWithSelector(plants.advanceStage.selector, 1, PlantRegistry.PlantStage.SEEDLING)); require(!early, "plant advanced before germination elapsed");
        PlantRegistry.PlantRecord memory beforeAdvance = plants.getPlant(1); require(beforeAdvance.regionId == 1, "canonical parcel region not retained");
        vm.warp(uint256(beforeAdvance.plantedAt) + plants.GERMINATION_DURATION()); plants.advanceStage(1, PlantRegistry.PlantStage.SEEDLING);
        PlantRegistry.PlantRecord memory p = plants.getPlant(1); require(p.stage == PlantRegistry.PlantStage.SEEDLING, "stage did not advance"); require(p.lastAdvancedAt == beforeAdvance.plantedAt + plants.GERMINATION_DURATION(), "effective timestamp drifted");
        (bool backward,) = address(plants).call(abi.encodeWithSelector(plants.advanceStage.selector, 1, PlantRegistry.PlantStage.GERMINATION)); require(!backward, "backward lifecycle allowed");
    }

    function testOfflineGrowthCatchesUpDeterministically() public {
        uint64 plantId = 3;
        _grant(address(this), ModuleIds.PLANT_REGISTRY, ActionIds.PLANT_REGISTER, bytes32(uint256(plantId)), keccak256("hc6:plant3:create"));
        _grant(address(this), ModuleIds.PLANT_REGISTRY, ActionIds.PLANT_ADVANCE, bytes32(uint256(plantId)), keccak256("hc6:plant3:advance"));
        plants.registerPlant(plantId, genomeId, address(this), 13); PlantRegistry.PlantRecord memory start = plants.getPlant(plantId);
        uint256 total = uint256(plants.GERMINATION_DURATION()) + plants.SEEDLING_DURATION() + plants.VEGETATIVE_DURATION() + plants.FLOWERING_DURATION();
        vm.warp(uint256(start.plantedAt) + total + 12 hours); (PlantRegistry.PlantStage stage, uint8 advanced) = plants.syncOfflineGrowth(plantId);
        require(stage == PlantRegistry.PlantStage.READY && advanced == 4, "offline growth mismatch");
        PlantRegistry.PlantRecord memory p = plants.getPlant(plantId); require(p.lastAdvancedAt == start.plantedAt + total, "offline progression lost stage boundaries"); require(plants.nextStageAt(plantId) == 0, "ready plant still has timed next stage");
        (, uint8 secondAdvance) = plants.syncOfflineGrowth(plantId); require(secondAdvance == 0, "offline sync advanced ready plant");
    }

    function testLandOperatorAndCapacityGatePlantRegistration() public {
        _grant(address(this), ModuleIds.PLANT_REGISTRY, ActionIds.PLANT_REGISTER, bytes32(uint256(4)), keccak256("hc6:plant4:create"));
        (bool wrongOperator,) = address(plants).call(abi.encodeWithSelector(plants.registerPlant.selector, uint64(4), genomeId, address(this), uint64(14))); require(!wrongOperator, "non-operator registered plant on parcel");
        _grant(address(this), ModuleIds.PLANT_REGISTRY, ActionIds.PLANT_REGISTER, bytes32(uint256(5)), keccak256("hc6:plant5:create")); plants.registerPlant(5, genomeId, address(this), 15); require(plants.activePlantsByParcel(15) == 1, "active parcel count missing");
        _grant(address(this), ModuleIds.PLANT_REGISTRY, ActionIds.PLANT_REGISTER, bytes32(uint256(6)), keccak256("hc6:plant6:create"));
        (bool overCapacity,) = address(plants).call(abi.encodeWithSelector(plants.registerPlant.selector, uint64(6), genomeId, address(this), uint64(15))); require(!overCapacity, "parcel grow capacity exceeded");
    }

    function testEnvironmentBoundsAndStressQualityDerivation() public {
        uint64 plantId = 7; _grant(address(this), ModuleIds.PLANT_REGISTRY, ActionIds.PLANT_REGISTER, bytes32(uint256(plantId)), keccak256("hc6:plant7:create")); _grant(address(this), ModuleIds.CULTIVATION_ENGINE, ActionIds.CULTIVATION_UPDATE, bytes32(uint256(plantId)), keccak256("hc6:plant7:env")); plants.registerPlant(plantId, genomeId, address(this), 11);
        CultivationEngine.EnvironmentSnapshot memory ideal = CultivationEngine.EnvironmentSnapshot({temperature:2400,humidity:6000,light:7000,water:6000,nutrients:6000,airflow:5000});
        (uint16 idealStress, uint16 idealQuality) = cultivation.deriveScores(ideal); require(idealStress == 0 && idealQuality == cultivation.BPS(), "ideal environment did not yield full quality");
        CultivationEngine.EnvironmentSnapshot memory stressed = CultivationEngine.EnvironmentSnapshot({temperature:1000,humidity:0,light:10000,water:0,nutrients:10000,airflow:0});
        (uint16 stress, uint16 quality) = cultivation.deriveScores(stressed); require(stress > 0 && quality < cultivation.BPS(), "stress not derived"); require(uint256(stress) + quality == cultivation.BPS(), "stress/quality conservation broken"); cultivation.updateEnvironment(plantId, stressed);
        CultivationEngine.CultivationState memory s = cultivation.getState(plantId); require(s.stressBps == stress && s.qualityBps == quality, "derived scores not retained");
        CultivationEngine.EnvironmentSnapshot memory badTemperature = ideal; badTemperature.temperature = cultivation.TEMPERATURE_MIN() - 1; (bool temperatureOk,) = address(cultivation).call(abi.encodeWithSelector(cultivation.updateEnvironment.selector, plantId, badTemperature)); require(!temperatureOk, "out-of-range temperature accepted");
        CultivationEngine.EnvironmentSnapshot memory badHumidity = ideal; badHumidity.humidity = cultivation.CONTROL_MAX() + 1; (bool humidityOk,) = address(cultivation).call(abi.encodeWithSelector(cultivation.updateEnvironment.selector, plantId, badHumidity)); require(!humidityOk, "out-of-range normalized control accepted");
    }

    function testSixDimensionEnvironmentLocksIntoPhenotypeExpression() public {
        _grant(address(this), ModuleIds.PLANT_REGISTRY, ActionIds.PLANT_REGISTER, bytes32(uint256(2)), keccak256("hc6:plant2:create")); _grant(address(this), ModuleIds.CULTIVATION_ENGINE, ActionIds.CULTIVATION_UPDATE, bytes32(uint256(2)), keccak256("hc6:env")); _grant(address(this), ModuleIds.CULTIVATION_ENGINE, ActionIds.PHENOTYPE_EXPRESS, bytes32(uint256(2)), keccak256("hc6:express")); plants.registerPlant(2, genomeId, address(this), 12);
        CultivationEngine.EnvironmentSnapshot memory env = CultivationEngine.EnvironmentSnapshot({temperature:2400,humidity:6200,light:7800,water:5400,nutrients:6600,airflow:4100}); cultivation.updateEnvironment(2, env); (uint16 stress, uint16 quality) = cultivation.deriveScores(env); bytes32 expression = cultivation.expressPhenotype(2, genomeId, keccak256("hc6:ruleset")); require(expression != bytes32(0), "expression missing");
        CultivationEngine.CultivationState memory s = cultivation.getState(2); require(s.environment.temperature == 2400 && s.environment.airflow == 4100, "environment not retained"); require(s.stressBps == stress && s.qualityBps == quality, "phenotype scores changed"); require(s.expressionLocked && s.expressionHash == expression, "expression not locked");
        (bool updateOk,) = address(cultivation).call(abi.encodeWithSelector(cultivation.updateEnvironment.selector, 2, env)); require(!updateOk, "environment changed after expression"); (bool expressOk,) = address(cultivation).call(abi.encodeWithSelector(cultivation.expressPhenotype.selector, 2, genomeId, keccak256("hc6:ruleset:reroll"))); require(!expressOk, "phenotype rerolled");
    }

    function _grant(address principal, bytes32 moduleId, bytes32 actionId, bytes32 scopeHash, bytes32 grantId) private {
        ICapabilityRegistry420.CapabilityGrant memory grant = ICapabilityRegistry420.CapabilityGrant({principal:principal,componentId:moduleId,capabilityId:actionId,scopeHash:scopeHash,perCallLimit:0,periodLimit:0,periodSeconds:0,validFrom:0,validUntil:uint64(block.timestamp + 365 days),revoked:false}); caps.setGrant(grantId, grant, 0);
    }
    function _loci() private pure returns (bytes32[28] memory loci) { for (uint256 i = 0; i < 28; ++i) loci[i] = keccak256(abi.encode("hc6:locus", i)); }
    function _roots() private pure returns (GenesisRoots memory) { return GenesisRoots({manifestRoot:keccak256("m"),parameterRoot:keccak256("p"),rulesetRoot:keccak256("r"),landRoot:keccak256("l"),randomnessRoot:keccak256("x"),qualificationRoot:keccak256("q")}); }
}
