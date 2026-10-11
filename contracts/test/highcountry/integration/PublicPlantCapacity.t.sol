// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import { EmergencyState } from "../../../src/highcountry/security/EmergencyState.sol";

import { CapabilityRegistry420 } from "../../../src/system/CapabilityRegistry420.sol";
import { HighCountryAuthorization } from "../../../src/highcountry/auth/HighCountryAuthorization.sol";
import { GenesisRegistry } from "../../../src/highcountry/genesis/GenesisRegistry.sol";
import { SeedRegistry } from "../../../src/highcountry/genetics/SeedRegistry.sol";
import { CloneRegistry } from "../../../src/highcountry/genetics/CloneRegistry.sol";
import { MotherRegistry } from "../../../src/highcountry/genetics/MotherRegistry.sol";
import { GenomeRegistry } from "../../../src/highcountry/genetics/GenomeRegistry.sol";
import { RegionRegistry } from "../../../src/highcountry/world/RegionRegistry.sol";
import { LandRegistry } from "../../../src/highcountry/land/LandRegistry.sol";
import { PublicCultivationAccess } from "../../../src/highcountry/land/PublicCultivationAccess.sol";
import { PlantRegistry } from "../../../src/highcountry/cultivation/PlantRegistry.sol";
import { CultivationEngine } from "../../../src/highcountry/cultivation/CultivationEngine.sol";
import { ActionIds } from "../../../src/highcountry/constants/ActionIds.sol";
import { ModuleIds } from "../../../src/highcountry/constants/ModuleIds.sol";
import { GenesisRoots } from "../../../src/highcountry/types/HighCountryTypes.sol";
import {
    HCCapacityExceeded,
    HCInvalidState,
    HCNotFound,
    HCAlreadyExists,
    HCUnauthorized
} from "../../../src/highcountry/errors/HighCountryErrors.sol";

interface VmHCPlot {
    function prank(
        address
    ) external;
    function warp(
        uint256
    ) external;
}

contract PublicPlantCapacityFixture {
    VmHCPlot internal constant vm = VmHCPlot(address(uint160(uint256(keccak256("hevm cheat code")))));
    CapabilityRegistry420 internal caps;
    HighCountryAuthorization internal auth;
    GenesisRegistry internal genesis;
    GenomeRegistry internal genomes;
    RegionRegistry internal regions;
    LandRegistry internal land;
    PublicCultivationAccess internal plots;
    PlantRegistry internal plants;
    EmergencyState internal emergency;
    SeedRegistry internal seeds;
    CloneRegistry internal clones;
    MotherRegistry internal mothers;
    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    bytes32 internal constant GENOME = keccak256("capacity-genome");
    uint256 internal serial;

    function setUp() public virtual {
        caps = new CapabilityRegistry420();
        auth = new HighCountryAuthorization(address(caps));
        genesis = new GenesisRegistry(address(auth));
        regions = new RegionRegistry(address(auth), address(genesis));
        genomes = new GenomeRegistry(address(auth), address(genesis));
        land = new LandRegistry(address(auth), address(regions), address(genesis));
        plots = new PublicCultivationAccess(address(auth), address(land));
        seeds = new SeedRegistry(address(auth), address(genomes));
        mothers = new MotherRegistry(address(auth), address(genomes));
        clones = new CloneRegistry(address(auth), address(genomes), address(mothers));
        plants = new PlantRegistry(
            address(auth), address(genomes), address(land), address(plots), address(seeds), address(clones)
        );
        caps.registerProtocolComponent(ModuleIds.GENESIS_REGISTRY, address(this));
        caps.registerProtocolComponent(ModuleIds.REGION_REGISTRY, address(this));
        caps.registerProtocolComponent(ModuleIds.GENOME_REGISTRY, address(this));
        caps.registerProtocolComponent(ModuleIds.LAND_REGISTRY, address(this));
        caps.registerProtocolComponent(ModuleIds.PUBLIC_CULTIVATION_ACCESS, address(this));
        caps.registerProtocolComponent(ModuleIds.PLANT_REGISTRY, address(this));
        caps.registerProtocolComponent(ModuleIds.EMERGENCY_STATE, address(this));
        emergency = new EmergencyState(address(auth));
        _grant(address(this), ModuleIds.PLANT_REGISTRY, ActionIds.PLANT_BIND_EMERGENCY, plants.EMERGENCY_BIND_SCOPE());
        plants.bindEmergencyState(address(emergency));

        caps.registerProtocolComponent(ModuleIds.SEED_REGISTRY, address(this));
        caps.registerProtocolComponent(ModuleIds.CLONE_REGISTRY, address(this));
        caps.registerProtocolComponent(ModuleIds.MOTHER_REGISTRY, address(this));
        _grant(address(this), ModuleIds.GENESIS_REGISTRY, ActionIds.GENESIS_SET_ROOTS, genesis.ADMIN_SCOPE());
        _grant(address(this), ModuleIds.GENESIS_REGISTRY, ActionIds.GENESIS_FINALIZE, genesis.ADMIN_SCOPE());
        genesis.setRoots(
            GenesisRoots(keccak256("m"), keccak256("p"), keccak256("r"), keccak256("l"), keccak256("x"), keccak256("q"))
        );
        _grant(address(this), ModuleIds.REGION_REGISTRY, ActionIds.REGION_REGISTER, bytes32(uint256(1)));
        regions.registerFoundingRegion(1, keccak256("meta"), keccak256("climate"), keccak256("rules"));
        genesis.finalizeGenesis();
        _grant(address(this), ModuleIds.GENOME_REGISTRY, ActionIds.GENOME_REGISTER, GENOME);
        bytes32[28] memory loci;
        genomes.registerGenome(GENOME, keccak256("line"), keccak256("meta"), loci);
        _grant(address(this), ModuleIds.LAND_REGISTRY, ActionIds.LAND_REGISTER, bytes32(uint256(1)));
        land.registerParcel(1, 1, address(this), 4, keccak256("land"), keccak256("meta"));
        _grant(
            address(this), ModuleIds.PUBLIC_CULTIVATION_ACCESS, ActionIds.PUBLIC_PLOT_BIND_PLANTS, plots.BIND_SCOPE()
        );
        plots.bindPlantRegistry(address(plants));
        _grant(address(this), ModuleIds.SEED_REGISTRY, ActionIds.SEED_BIND_PLANTS, seeds.BIND_SCOPE());
        _grant(address(this), ModuleIds.CLONE_REGISTRY, ActionIds.CLONE_BIND_PLANTS, clones.BIND_SCOPE());
        seeds.bindPlantRegistry(address(plants));
        clones.bindPlantRegistry(address(plants));
        _grant(address(this), ModuleIds.MOTHER_REGISTRY, ActionIds.MOTHER_BIND_CLONES, mothers.BIND_SCOPE());
        mothers.bindCloneRegistry(address(clones));
        _issueSeeds(100, address(this), type(uint32).max);
        _issueSeeds(101, ALICE, type(uint32).max);
        _issueSeeds(102, BOB, type(uint32).max);
    }

    function _issueSeeds(
        uint64 id,
        address who,
        uint32 quantity
    ) internal {
        _grant(address(this), ModuleIds.SEED_REGISTRY, ActionIds.SEED_REGISTER, bytes32(uint256(id)));
        seeds.registerSeedLot(id, GENOME, 0, who, quantity, keccak256("plant-source"));
        _grant(address(plants), ModuleIds.SEED_REGISTRY, ActionIds.SEED_CONSUME, bytes32(uint256(id)));
    }

    function _sourceId(
        address who
    ) internal view returns (uint64) {
        return who == ALICE ? 101 : who == BOB ? 102 : 100;
    }

    function _preparePlant(
        uint64 id,
        address who,
        uint64 parcel,
        uint64 plot
    ) internal {
        vm.prank(who);
        seeds.approvePlant(_sourceId(who), id, parcel, plot);
    }

    function _grant(
        address who,
        bytes32 module,
        bytes32 action,
        bytes32 scope
    ) internal returns (bytes32 id) {
        id = keccak256(abi.encode(++serial, who, module, action, scope));
        caps.createGrant(id, who, module, action, scope, 0, 0, 0, 0, 0);
    }

    function _plot(
        uint64 id,
        uint32 capacity
    ) internal {
        _grant(address(this), ModuleIds.PUBLIC_CULTIVATION_ACCESS, ActionIds.PUBLIC_PLOT_REGISTER, bytes32(uint256(id)));
        plots.registerPublicPlot(id, 1, capacity);
    }

    function _allocate(
        uint64 id,
        address who,
        uint32 capacity
    ) internal {
        _grant(who, ModuleIds.PUBLIC_CULTIVATION_ACCESS, ActionIds.PUBLIC_PLOT_ALLOCATE, bytes32(uint256(id)));
        _grant(who, ModuleIds.PUBLIC_CULTIVATION_ACCESS, ActionIds.PUBLIC_PLOT_RELEASE, bytes32(uint256(id)));
        vm.prank(who);
        plots.allocate(id, capacity);
    }

    function _public(
        uint64 id,
        address who,
        uint64 plot
    ) internal {
        _grant(address(this), ModuleIds.PLANT_REGISTRY, ActionIds.PLANT_REGISTER, bytes32(uint256(id)));
        uint64 parcel = plots.getPlot(plot).parcelId;
        _preparePlant(id, who, parcel, plot);
        plants.registerPlantFromSource(
            id, GENOME, who, parcel, plot, PlantRegistry.PlantSourceKind.SEED, _sourceId(who)
        );
    }

    function _private(
        uint64 id
    ) internal {
        _grant(address(this), ModuleIds.PLANT_REGISTRY, ActionIds.PLANT_REGISTER, bytes32(uint256(id)));
        _preparePlant(id, address(this), 1, 0);
        plants.registerPlantFromSource(id, GENOME, address(this), 1, 0, PlantRegistry.PlantSourceKind.SEED, 100);
    }

    function _reject(
        address target,
        bytes memory input,
        bytes4 selector
    ) internal {
        (bool ok, bytes memory reason) = target.call(input);
        require(!ok && reason.length >= 4 && bytes4(reason) == selector, "unexpected rejection");
    }

    function _finish(
        uint64 id
    ) internal {
        _grant(address(this), ModuleIds.PLANT_REGISTRY, ActionIds.PLANT_ADVANCE, bytes32(uint256(id)));
        vm.warp(block.timestamp + 17 days);
        plants.syncOfflineGrowth(id);
        require(plants.getPlant(id).stage == PlantRegistry.PlantStage.READY, "not ready");
        plants.advanceStage(id, PlantRegistry.PlantStage.TERMINATED);
    }
}

contract PublicPlantCapacityTest is PublicPlantCapacityFixture {
    function testAllocatedNonownerCultivatesAndReleaseWaitsForTermination() public {
        _plot(1, 2);
        _allocate(1, ALICE, 2);
        _public(1, ALICE, 1);
        require(land.effectiveOperator(1) != ALICE && plants.getPlant(1).grower == ALICE, "public admission");
        vm.prank(ALICE);
        _reject(address(plots), abi.encodeCall(plots.release, (1)), HCInvalidState.selector);
        _finish(1);
        require(plants.activePublicPlants(1, ALICE) == 0 && plants.activePlantsByParcel(1) == 0, "capacity leak");
        vm.prank(ALICE);
        plots.release(1);
        _allocate(1, BOB, 2);
        _public(2, BOB, 1);
        require(plants.activePublicPlants(1, BOB) == 1, "reallocation failed");
        _reject(
            address(plants),
            abi.encodeCall(plants.advanceStage, (1, PlantRegistry.PlantStage.TERMINATED)),
            HCInvalidState.selector
        );
        require(plants.activePlantsByParcel(1) == 1, "double release");
    }

    function testPrivatePlantsPreventLaterOverreservation() public {
        _private(1);
        _private(2);
        _private(3);
        _grant(address(this), ModuleIds.PUBLIC_CULTIVATION_ACCESS, ActionIds.PUBLIC_PLOT_REGISTER, bytes32(uint256(1)));
        _reject(address(plots), abi.encodeCall(plots.registerPublicPlot, (1, 1, 2)), HCCapacityExceeded.selector);
        require(plots.publicCapacityOnParcel(1) == 0 && !plots.exists(1), "failed reservation persisted");
        _plot(1, 1);
        _allocate(1, ALICE, 1);
        _public(4, ALICE, 1);
        require(plants.activePlantsByParcel(1) == 4, "capacity not usable");
    }

    function testReservationsProtectUnusedPublicSlotsFromPrivatePlants() public {
        _plot(1, 3);
        _private(1);
        _grant(address(this), ModuleIds.PLANT_REGISTRY, ActionIds.PLANT_REGISTER, bytes32(uint256(2)));
        _reject(
            address(plants),
            abi.encodeCall(
                plants.registerPlantFromSource,
                (2, GENOME, address(this), 1, 0, PlantRegistry.PlantSourceKind.SEED, _sourceId(address(this)))
            ),
            HCCapacityExceeded.selector
        );
        require(!plants.exists(2) && plants.privatePlantsByParcel(1) == 1, "failed admission persisted");
        _allocate(1, ALICE, 3);
        _public(2, ALICE, 1);
        _public(3, ALICE, 1);
        _public(4, ALICE, 1);
        require(plants.activePlantsByParcel(1) == 4, "total wrong");
    }

    function testAllocationIsGrowerAndPlotSpecific() public {
        _plot(1, 2);
        _plot(2, 2);
        _allocate(1, ALICE, 1);
        _allocate(2, BOB, 1);
        _grant(address(this), ModuleIds.PLANT_REGISTRY, ActionIds.PLANT_REGISTER, bytes32(uint256(1)));
        _reject(
            address(plants),
            abi.encodeCall(
                plants.registerPlantFromSource,
                (1, GENOME, BOB, 1, 1, PlantRegistry.PlantSourceKind.SEED, _sourceId(BOB))
            ),
            HCCapacityExceeded.selector
        );
        _reject(
            address(plants),
            abi.encodeCall(
                plants.registerPlantFromSource,
                (1, GENOME, ALICE, 1, 2, PlantRegistry.PlantSourceKind.SEED, _sourceId(ALICE))
            ),
            HCCapacityExceeded.selector
        );
        _public(1, ALICE, 1);
        _grant(address(this), ModuleIds.PLANT_REGISTRY, ActionIds.PLANT_REGISTER, bytes32(uint256(2)));
        _reject(
            address(plants),
            abi.encodeCall(
                plants.registerPlantFromSource,
                (2, GENOME, ALICE, 1, 1, PlantRegistry.PlantSourceKind.SEED, _sourceId(ALICE))
            ),
            HCCapacityExceeded.selector
        );
        require(plants.activePublicPlants(1, ALICE) == 1 && !plants.exists(2), "overbooked");
    }

    function testUnauthorizedAdmissionAndRevocationRollBackCounters() public {
        _plot(1, 1);
        _allocate(1, ALICE, 1);
        _reject(
            address(plants),
            abi.encodeCall(
                plants.registerPlantFromSource,
                (1, GENOME, ALICE, 1, 1, PlantRegistry.PlantSourceKind.SEED, _sourceId(ALICE))
            ),
            HCUnauthorized.selector
        );
        bytes32 id = _grant(address(this), ModuleIds.PLANT_REGISTRY, ActionIds.PLANT_REGISTER, bytes32(uint256(1)));
        caps.revokeGrant(id);
        _reject(
            address(plants),
            abi.encodeCall(
                plants.registerPlantFromSource,
                (1, GENOME, ALICE, 1, 1, PlantRegistry.PlantSourceKind.SEED, _sourceId(ALICE))
            ),
            HCUnauthorized.selector
        );
        require(plants.activePublicPlants(1, ALICE) == 0 && plots.allocationOf(1, ALICE) == 1, "rollback failed");
    }

    function testPublicPlantFlowsThroughCultivationEngine() public {
        _plot(1, 1);
        _allocate(1, ALICE, 1);
        _public(1, ALICE, 1);
        CultivationEngine engine = new CultivationEngine(address(auth), address(plants));
        caps.registerProtocolComponent(ModuleIds.CULTIVATION_ENGINE, address(this));
        _grant(
            address(this),
            ModuleIds.CULTIVATION_ENGINE,
            ActionIds.CULTIVATION_BIND_EMERGENCY,
            engine.EMERGENCY_BIND_SCOPE()
        );
        engine.bindEmergencyState(address(emergency));
        _grant(address(this), ModuleIds.CULTIVATION_ENGINE, ActionIds.CULTIVATION_UPDATE, bytes32(uint256(1)));
        engine.updateEnvironment(1, CultivationEngine.EnvironmentSnapshot(2200, 6000, 7000, 6000, 6000, 5000));
        require(plants.getPlant(1).regionId == 1, "region mismatch");
    }

    function testBindingIsOneTimeAndUnauthorizedBindingFails() public {
        _reject(address(plots), abi.encodeCall(plots.bindPlantRegistry, (address(plants))), HCInvalidState.selector);
        PublicCultivationAccess other = new PublicCultivationAccess(address(auth), address(land));
        PlantRegistry otherPlants = new PlantRegistry(
            address(auth), address(genomes), address(land), address(other), address(seeds), address(clones)
        );
        _grant(
            address(this), ModuleIds.PLANT_REGISTRY, ActionIds.PLANT_BIND_EMERGENCY, otherPlants.EMERGENCY_BIND_SCOPE()
        );
        otherPlants.bindEmergencyState(address(emergency));
        vm.prank(BOB);
        _reject(
            address(other), abi.encodeCall(other.bindPlantRegistry, (address(otherPlants))), HCUnauthorized.selector
        );
        _reject(address(other), abi.encodeCall(other.bindPlantRegistry, (address(plants))), HCInvalidState.selector);
        _reject(address(other), abi.encodeCall(other.bindPlantRegistry, (ALICE)), HCInvalidState.selector);
        _reject(address(other), abi.encodeCall(other.registerPublicPlot, (1, 1, 1)), HCInvalidState.selector);
        _reject(
            address(otherPlants),
            abi.encodeCall(
                otherPlants.registerPlantFromSource,
                (1, GENOME, address(this), 1, 0, PlantRegistry.PlantSourceKind.SEED, 100)
            ),
            HCInvalidState.selector
        );
    }

    function testDuplicateMissingGenomeAndUnknownPlotDoNotConsumeCapacity() public {
        _plot(1, 1);
        _allocate(1, ALICE, 1);
        _reject(
            address(plants),
            abi.encodeCall(
                plants.registerPlantFromSource,
                (1, keccak256("unknown"), ALICE, 1, 1, PlantRegistry.PlantSourceKind.SEED, _sourceId(ALICE))
            ),
            HCInvalidState.selector
        );
        _reject(
            address(plants),
            abi.encodeCall(
                plants.registerPlantFromSource,
                (1, GENOME, ALICE, 1, 99, PlantRegistry.PlantSourceKind.SEED, _sourceId(ALICE))
            ),
            HCNotFound.selector
        );
        _public(1, ALICE, 1);
        _reject(
            address(plants),
            abi.encodeCall(
                plants.registerPlantFromSource,
                (1, GENOME, ALICE, 1, 1, PlantRegistry.PlantSourceKind.SEED, _sourceId(ALICE))
            ),
            HCAlreadyExists.selector
        );
        require(plants.activePublicPlants(1, ALICE) == 1, "duplicate consumed capacity");
    }

    function testPrivateTerminationFreesReservationSpaceButPublicTerminationKeepsReservation() public {
        _private(1);
        _finish(1);
        _plot(1, 4);
        _allocate(1, ALICE, 4);
        _public(2, ALICE, 1);
        _finish(2);
        require(plants.privatePlantsByParcel(1) == 0 && plots.publicCapacityOnParcel(1) == 4, "wrong capacity release");
        _grant(address(this), ModuleIds.PLANT_REGISTRY, ActionIds.PLANT_REGISTER, bytes32(uint256(3)));
        _reject(
            address(plants),
            abi.encodeCall(
                plants.registerPlantFromSource,
                (3, GENOME, address(this), 1, 0, PlantRegistry.PlantSourceKind.SEED, _sourceId(address(this)))
            ),
            HCCapacityExceeded.selector
        );
        _public(3, ALICE, 1);
    }

    function testReadyAndUnauthorizedTerminationKeepAllocationOccupied() public {
        _plot(1, 1);
        _allocate(1, ALICE, 1);
        _public(1, ALICE, 1);
        bytes32 grant = _grant(address(this), ModuleIds.PLANT_REGISTRY, ActionIds.PLANT_ADVANCE, bytes32(uint256(1)));
        vm.warp(block.timestamp + 17 days);
        plants.syncOfflineGrowth(1);
        vm.prank(ALICE);
        _reject(address(plots), abi.encodeCall(plots.release, (1)), HCInvalidState.selector);
        caps.revokeGrant(grant);
        _reject(
            address(plants),
            abi.encodeCall(plants.advanceStage, (1, PlantRegistry.PlantStage.TERMINATED)),
            HCUnauthorized.selector
        );
        require(plants.activePublicPlants(1, ALICE) == 1 && plants.activePlantsByParcel(1) == 1, "unauthorized release");
    }

    function testOperatorChangesDoNotEraseOrDuplicateOccupancy() public {
        _private(1);
        _plot(1, 2);
        _allocate(1, ALICE, 2);
        _public(2, ALICE, 1);
        _grant(address(this), ModuleIds.LAND_REGISTRY, ActionIds.LAND_SET_OCCUPANCY, bytes32(uint256(1)));
        land.setOccupancy(1, BOB, LandRegistry.OccupancyKind.LEASE, keccak256("lease"));
        _grant(address(this), ModuleIds.PLANT_REGISTRY, ActionIds.PLANT_REGISTER, bytes32(uint256(3)));
        _reject(
            address(plants),
            abi.encodeCall(
                plants.registerPlantFromSource,
                (3, GENOME, address(this), 1, 0, PlantRegistry.PlantSourceKind.SEED, _sourceId(address(this)))
            ),
            HCInvalidState.selector
        );
        _preparePlant(3, BOB, 1, 0);
        plants.registerPlantFromSource(3, GENOME, BOB, 1, 0, PlantRegistry.PlantSourceKind.SEED, 102);
        _grant(address(this), ModuleIds.PLANT_REGISTRY, ActionIds.PLANT_REGISTER, bytes32(uint256(4)));
        _reject(
            address(plants),
            abi.encodeCall(
                plants.registerPlantFromSource,
                (4, GENOME, BOB, 1, 0, PlantRegistry.PlantSourceKind.SEED, _sourceId(BOB))
            ),
            HCCapacityExceeded.selector
        );
        require(
            plants.getPlant(1).grower == address(this) && plants.activePublicPlants(1, ALICE) == 1,
            "occupancy rewritten"
        );
    }

    function testMaximumCapacityUsesWideReservationArithmetic() public {
        _grant(address(this), ModuleIds.LAND_REGISTRY, ActionIds.LAND_REGISTER, bytes32(uint256(2)));
        land.registerParcel(2, 1, address(this), type(uint32).max, keccak256("land"), keccak256("meta"));
        _grant(address(this), ModuleIds.PUBLIC_CULTIVATION_ACCESS, ActionIds.PUBLIC_PLOT_REGISTER, bytes32(uint256(2)));
        plots.registerPublicPlot(2, 2, type(uint32).max);
        _allocate(2, ALICE, type(uint32).max);
        _public(1, ALICE, 2);
        _grant(address(this), ModuleIds.PUBLIC_CULTIVATION_ACCESS, ActionIds.PUBLIC_PLOT_REGISTER, bytes32(uint256(3)));
        _reject(address(plots), abi.encodeCall(plots.registerPublicPlot, (3, 2, 1)), HCCapacityExceeded.selector);
        require(
            plots.publicCapacityOnParcel(2) == type(uint32).max && plants.activePlantsByParcel(2) == 1, "overflow drift"
        );
    }

    function testEmergencyStopsAdmissionAndGrowthButPreservesTerminationAndRecovery() public {
        _private(1);
        _grant(address(this), ModuleIds.PLANT_REGISTRY, ActionIds.PLANT_ADVANCE, bytes32(uint256(1)));
        vm.warp(block.timestamp + 17 days);
        plants.syncOfflineGrowth(1);
        require(plants.getPlant(1).stage == PlantRegistry.PlantStage.READY, "not ready");
        _grant(
            address(this),
            ModuleIds.EMERGENCY_STATE,
            ActionIds.EMERGENCY_RESTRICT,
            keccak256("HC.EMERGENCY.CULTIVATION")
        );
        emergency.setRestricted(keccak256("HC.EMERGENCY.CULTIVATION"), true);
        _reject(
            address(plants),
            abi.encodeCall(plants.syncOfflineGrowth, (uint64(1))),
            bytes4(keccak256("HCEmergencyRestrictionActive(bytes32)"))
        );
        _reject(
            address(plants),
            abi.encodeCall(plants.registerPlant, (uint64(2), GENOME, address(this), uint64(1))),
            HCInvalidState.selector
        );
        plants.advanceStage(1, PlantRegistry.PlantStage.TERMINATED);
        require(plants.activePlantsByParcel(1) == 0 && plants.privatePlantsByParcel(1) == 0, "capacity not conserved");
        _reject(
            address(plants),
            abi.encodeCall(plants.advanceStage, (uint64(1), PlantRegistry.PlantStage.TERMINATED)),
            bytes4(keccak256("HCEmergencyRestrictionActive(bytes32)"))
        );
        (bool ok,) = address(emergency)
            .call(abi.encodeCall(emergency.setRestricted, (keccak256("HC.EMERGENCY.CULTIVATION"), false)));
        require(!ok, "unauthorized release");
        _grant(
            address(this), ModuleIds.EMERGENCY_STATE, ActionIds.EMERGENCY_RELEASE, keccak256("HC.EMERGENCY.CULTIVATION")
        );
        emergency.setRestricted(keccak256("HC.EMERGENCY.CULTIVATION"), false);
        _private(2);
        require(plants.activePlantsByParcel(1) == 1, "recovery failed");
    }

    function testFuzzMixedCapacityConservation(
        uint8 requested
    ) public {
        uint32 reserved = uint32(requested % 5);
        if (reserved != 0) {
            _plot(1, reserved);
            _allocate(1, ALICE, reserved);
        }
        uint64 id = 1;
        for (uint32 i; i < 4 - reserved; ++i) {
            _private(id++);
        }
        for (uint32 i; i < reserved; ++i) {
            _public(id++, ALICE, 1);
        }
        require(plants.activePlantsByParcel(1) == 4, "mixed conservation");
        require(
            uint256(plants.privatePlantsByParcel(1)) + plots.publicCapacityOnParcel(1) == 4, "reservation conservation"
        );
        _finish(1);
        require(plants.activePlantsByParcel(1) == 3, "termination conservation");
    }
}
