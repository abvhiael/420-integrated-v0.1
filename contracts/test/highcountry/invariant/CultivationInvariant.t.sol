// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ICapabilityRegistry420 } from "../../../src/interfaces/genesis/ICapabilityRegistry420.sol";
import { HighCountryAuthorization } from "../../../src/highcountry/auth/HighCountryAuthorization.sol";
import { ActionIds } from "../../../src/highcountry/constants/ActionIds.sol";
import { ModuleIds } from "../../../src/highcountry/constants/ModuleIds.sol";
import { GenesisRegistry } from "../../../src/highcountry/genesis/GenesisRegistry.sol";
import { GenomeRegistry } from "../../../src/highcountry/genetics/GenomeRegistry.sol";
import { PlantRegistry } from "../../../src/highcountry/cultivation/PlantRegistry.sol";
import { CultivationEngine } from "../../../src/highcountry/cultivation/CultivationEngine.sol";
import { GenesisRoots } from "../../../src/highcountry/types/HighCountryTypes.sol";
import { MockCapabilityRegistry } from "../mocks/MockCapabilityRegistry.sol";

interface VmHC6Invariant { function warp(uint256) external; }

contract MockLandRegistryHC6Invariant {
    struct Parcel { address operator; uint32 capacity; uint16 regionId; bool exists; }
    mapping(uint64 => Parcel) private _parcels;
    function configure(uint64 parcelId, address operator, uint32 capacity, uint16 regionId) external { _parcels[parcelId] = Parcel(operator, capacity, regionId, true); }
    function exists(uint64 parcelId) external view returns (bool) { return _parcels[parcelId].exists; }
    function effectiveOperator(uint64 parcelId) external view returns (address) { return _parcels[parcelId].operator; }
    function growCapacityOf(uint64 parcelId) external view returns (uint32) { return _parcels[parcelId].capacity; }
    function regionIdOf(uint64 parcelId) external view returns (uint16) { return _parcels[parcelId].regionId; }
}

contract CultivationInvariantTest {
    VmHC6Invariant private constant vm = VmHC6Invariant(address(uint160(uint256(keccak256("hevm cheat code")))));
    MockCapabilityRegistry private caps;
    HighCountryAuthorization private auth;
    GenesisRegistry private genesis;
    GenomeRegistry private genomes;
    MockLandRegistryHC6Invariant private land;
    PlantRegistry private plants;
    CultivationEngine private cultivation;
    bytes32 private genomeId = keccak256("hc6:inv:genome");
    bytes32 private rulesetId = keccak256("hc6:inv:ruleset");
    bytes32 private expressionHash;
    uint64 private plantedAt;
    uint16 private expectedStress;
    uint16 private expectedQuality;

    function setUp() public {
        caps = new MockCapabilityRegistry(); auth = new HighCountryAuthorization(address(caps)); genesis = new GenesisRegistry(address(auth)); genomes = new GenomeRegistry(address(auth), address(genesis)); land = new MockLandRegistryHC6Invariant(); land.configure(21, address(this), 2, 2); plants = new PlantRegistry(address(auth), address(genomes), address(land)); cultivation = new CultivationEngine(address(auth), address(plants));
        _grant(address(this), ModuleIds.GENESIS_REGISTRY, ActionIds.GENESIS_SET_ROOTS, bytes32(0), keccak256("hc6:inv:roots")); _grant(address(this), ModuleIds.GENESIS_REGISTRY, ActionIds.GENESIS_FINALIZE, bytes32(0), keccak256("hc6:inv:finalize")); genesis.setRoots(_roots()); genesis.finalizeGenesis();
        _grant(address(this), ModuleIds.GENOME_REGISTRY, ActionIds.GENOME_REGISTER, genomeId, keccak256("hc6:inv:genome:grant")); genomes.registerGenome(genomeId, keccak256("hc6:inv:line"), keccak256("hc6:inv:meta"), _loci());
        _grant(address(this), ModuleIds.PLANT_REGISTRY, ActionIds.PLANT_REGISTER, bytes32(uint256(1)), keccak256("hc6:inv:p1:create")); _grant(address(this), ModuleIds.PLANT_REGISTRY, ActionIds.PLANT_ADVANCE, bytes32(uint256(1)), keccak256("hc6:inv:p1:advance")); plants.registerPlant(1, genomeId, address(this), 21); plantedAt = plants.getPlant(1).plantedAt;
        uint256 total = uint256(plants.GERMINATION_DURATION()) + plants.SEEDLING_DURATION() + plants.VEGETATIVE_DURATION() + plants.FLOWERING_DURATION(); vm.warp(uint256(plantedAt) + total + 1 days); plants.syncOfflineGrowth(1);
        _grant(address(this), ModuleIds.PLANT_REGISTRY, ActionIds.PLANT_REGISTER, bytes32(uint256(2)), keccak256("hc6:inv:p2:create")); _grant(address(this), ModuleIds.CULTIVATION_ENGINE, ActionIds.CULTIVATION_UPDATE, bytes32(uint256(2)), keccak256("hc6:inv:p2:env")); _grant(address(this), ModuleIds.CULTIVATION_ENGINE, ActionIds.PHENOTYPE_EXPRESS, bytes32(uint256(2)), keccak256("hc6:inv:p2:express")); plants.registerPlant(2, genomeId, address(this), 21);
        CultivationEngine.EnvironmentSnapshot memory env = CultivationEngine.EnvironmentSnapshot({temperature:1800,humidity:3500,light:9500,water:3000,nutrients:8500,airflow:1500}); (expectedStress, expectedQuality) = cultivation.deriveScores(env); cultivation.updateEnvironment(2, env); expressionHash = cultivation.expressPhenotype(2, genomeId, rulesetId);
        CultivationEngine.EnvironmentSnapshot memory replacement = CultivationEngine.EnvironmentSnapshot({temperature:2400,humidity:6000,light:7000,water:6000,nutrients:6000,airflow:5000}); (bool changed,) = address(cultivation).call(abi.encodeWithSelector(cultivation.updateEnvironment.selector, uint64(2), replacement)); require(!changed, "HC-INV-CULTIVATION-017 setup: sealed environment changed");
    }

    function invariant_HC_INV_CULTIVATION_016_LifecycleIdentityAndCapacityStayConserved() public view {
        PlantRegistry.PlantRecord memory p = plants.getPlant(1); require(p.id == 1, "HC-INV-CULTIVATION-016: plant id changed"); require(p.genomeId == genomeId, "HC-INV-CULTIVATION-016: genome changed"); require(p.landParcelId == 21 && p.regionId == 2, "HC-INV-CULTIVATION-016: land binding changed"); require(p.stage == PlantRegistry.PlantStage.READY, "HC-INV-CULTIVATION-016: lifecycle regressed"); require(p.lastAdvancedAt >= plantedAt, "HC-INV-CULTIVATION-016: lifecycle timestamp regressed"); require(plants.activePlantsByParcel(21) == 2, "HC-INV-CULTIVATION-016: active count drifted"); require(plants.activePlantsByParcel(21) <= land.growCapacityOf(21), "HC-INV-CULTIVATION-016: parcel over capacity");
    }

    function invariant_HC_INV_CULTIVATION_017_PhenotypeAndEnvironmentStaySealed() public view {
        CultivationEngine.CultivationState memory s = cultivation.getState(2); require(s.expressionLocked, "HC-INV-CULTIVATION-017: phenotype unlocked"); require(s.expressionHash == expressionHash, "HC-INV-CULTIVATION-017: expression changed"); require(s.environment.temperature == 1800 && s.environment.humidity == 3500 && s.environment.light == 9500 && s.environment.water == 3000 && s.environment.nutrients == 8500 && s.environment.airflow == 1500, "HC-INV-CULTIVATION-017: environment changed"); require(s.stressBps == expectedStress && s.qualityBps == expectedQuality, "HC-INV-CULTIVATION-017: scores changed");
    }

    function invariant_HC_INV_CULTIVATION_018_ScoresRemainBoundedAndConserved() public view {
        CultivationEngine.CultivationState memory s = cultivation.getState(2); require(s.stressBps <= cultivation.BPS(), "HC-INV-CULTIVATION-018: stress out of bounds"); require(s.qualityBps <= cultivation.BPS(), "HC-INV-CULTIVATION-018: quality out of bounds"); require(uint256(s.stressBps) + s.qualityBps == cultivation.BPS(), "HC-INV-CULTIVATION-018: score conservation broken"); require(s.environment.temperature >= cultivation.TEMPERATURE_MIN() && s.environment.temperature <= cultivation.TEMPERATURE_MAX(), "HC-INV-CULTIVATION-018: temperature out of bounds"); require(s.environment.humidity <= cultivation.CONTROL_MAX() && s.environment.light <= cultivation.CONTROL_MAX() && s.environment.water <= cultivation.CONTROL_MAX() && s.environment.nutrients <= cultivation.CONTROL_MAX() && s.environment.airflow <= cultivation.CONTROL_MAX(), "HC-INV-CULTIVATION-018: control out of bounds");
    }

    function _grant(address principal, bytes32 moduleId, bytes32 actionId, bytes32 scopeHash, bytes32 grantId) private { ICapabilityRegistry420.CapabilityGrant memory grant = ICapabilityRegistry420.CapabilityGrant({principal:principal,componentId:moduleId,capabilityId:actionId,scopeHash:scopeHash,perCallLimit:0,periodLimit:0,periodSeconds:0,validFrom:0,validUntil:uint64(block.timestamp + 365 days),revoked:false}); caps.setGrant(grantId, grant, 0); }
    function _loci() private pure returns (bytes32[28] memory loci) { for (uint256 i = 0; i < 28; ++i) loci[i] = keccak256(abi.encode("hc6:inv:locus", i)); }
    function _roots() private pure returns (GenesisRoots memory) { return GenesisRoots({manifestRoot:keccak256("m"),parameterRoot:keccak256("p"),rulesetRoot:keccak256("r"),landRoot:keccak256("l"),randomnessRoot:keccak256("x"),qualificationRoot:keccak256("q")}); }
}
