// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import { PublicPlantCapacityFixture } from "../integration/PublicPlantCapacity.t.sol";
import { InvariantTarget420 } from "../../helpers/InvariantTarget420.sol";
import { SeedRegistry } from "../../../src/highcountry/genetics/SeedRegistry.sol";
import { PlantRegistry } from "../../../src/highcountry/cultivation/PlantRegistry.sol";
import { PublicCultivationAccess } from "../../../src/highcountry/land/PublicCultivationAccess.sol";
import { ActionIds } from "../../../src/highcountry/constants/ActionIds.sol";
import { ModuleIds } from "../../../src/highcountry/constants/ModuleIds.sol";

interface VmPlotInvariant {
    function prank(
        address
    ) external;
    function warp(
        uint256
    ) external;
}

contract PublicPlantCapacityHandler {
    VmPlotInvariant private constant vm = VmPlotInvariant(address(uint160(uint256(keccak256("hevm cheat code")))));
    PlantRegistry private immutable plants;
    PublicCultivationAccess private immutable plots;
    bytes32 private immutable genome;
    address private immutable owner;
    SeedRegistry private immutable seeds;

    constructor(
        PlantRegistry plants_,
        PublicCultivationAccess plots_,
        bytes32 genome_,
        address owner_,
        SeedRegistry seeds_
    ) {
        plants = plants_;
        plots = plots_;
        genome = genome_;
        owner = owner_;
        seeds = seeds_;
    }

    function stepAdmit(
        uint8 salt,
        bool publicPlant
    ) external {
        uint64 id = uint64(salt % 16) + 1;
        if (publicPlant) {
            seeds.approvePlant(103, id, 1, 1);
            address(plants)
                .call(
                    abi.encodeCall(
                        plants.registerPlantFromSource,
                        (id, genome, address(this), 1, 1, PlantRegistry.PlantSourceKind.SEED, 103)
                    )
                );
        } else {
            vm.prank(owner);
            seeds.approvePlant(100, id, 1, 0);
            address(plants)
                .call(
                    abi.encodeCall(
                        plants.registerPlantFromSource,
                        (id, genome, owner, 1, 0, PlantRegistry.PlantSourceKind.SEED, 100)
                    )
                );
        }
    }

    function stepTerminate(
        uint8 salt
    ) external {
        uint64 id = uint64(salt % 16) + 1;
        if (!plants.exists(id)) return;
        vm.warp(block.timestamp + 17 days);
        address(plants).call(abi.encodeCall(plants.syncOfflineGrowth, (id)));
        address(plants).call(abi.encodeCall(plants.advanceStage, (id, PlantRegistry.PlantStage.TERMINATED)));
    }

    function stepAllocation(
        bool release_
    ) external {
        if (release_) {
            uint32 occupied = plants.activePublicPlants(1, address(this));
            (bool ok,) = address(plots).call(abi.encodeCall(plots.release, (1)));
            require(occupied == 0 || !ok, "occupied allocation released");
        } else {
            address(plots).call(abi.encodeCall(plots.allocate, (1, 2)));
        }
    }
}

contract PublicPlantCapacityInvariantTest is PublicPlantCapacityFixture, InvariantTarget420 {
    PublicPlantCapacityHandler private handler;

    function setUp() public override {
        super.setUp();
        _plot(1, 2);
        handler = new PublicPlantCapacityHandler(plants, plots, GENOME, address(this), seeds);
        _allocate(1, address(handler), 2);
        _issueSeeds(103, address(handler), 32);
        for (uint64 id = 1; id <= 16; ++id) {
            _grant(address(handler), ModuleIds.PLANT_REGISTRY, ActionIds.PLANT_REGISTER, bytes32(uint256(id)));
            _grant(address(handler), ModuleIds.PLANT_REGISTRY, ActionIds.PLANT_ADVANCE, bytes32(uint256(id)));
        }
        targetContract(address(handler));
    }

    function invariantCapacityAndAllocationConservation() public view {
        uint32 privateCount;
        uint32 issuedPrivate;
        uint32 issuedPublic;
        uint32 publicCount;
        for (uint64 id = 1; id <= 16; ++id) {
            if (!plants.exists(id)) continue;
            PlantRegistry.PlantRecord memory p = plants.getPlant(id);
            (PlantRegistry.PlantSourceKind kind, uint64 sourceId) = plants.sourceOfPlant(id);
            require(kind == PlantRegistry.PlantSourceKind.SEED && seeds.seedLotForPlant(id) == sourceId, "source drift");
            if (sourceId == 100) {
                ++issuedPrivate;
            } else {
                require(sourceId == 103, "wrong source");
                ++issuedPublic;
            }
            if (p.stage == PlantRegistry.PlantStage.TERMINATED) continue;
            if (plants.publicPlotOfPlant(id) == 0) ++privateCount;
            else ++publicCount;
        }
        require(
            issuedPrivate == seeds.consumedQuantity(100) && issuedPublic == seeds.consumedQuantity(103),
            "source consumption drift"
        );
        require(privateCount == plants.privatePlantsByParcel(1), "private ledger drift");
        require(publicCount == plants.activePublicPlants(1, address(handler)), "public ledger drift");
        require(privateCount + publicCount == plants.activePlantsByParcel(1), "parcel ledger drift");
        require(uint256(privateCount) + plots.publicCapacityOnParcel(1) <= 4, "parcel overbooked");
        require(publicCount <= plots.allocationOf(1, address(handler)), "allocation overbooked");
        PublicCultivationAccess.PublicPlot memory plot = plots.getPlot(1);
        require(plot.allocatedCapacity + plots.availableCapacity(1) == plot.growCapacity, "plot conservation");
    }
}
