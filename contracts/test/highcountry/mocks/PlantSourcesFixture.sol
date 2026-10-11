// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import { SeedRegistry } from "../../../src/highcountry/genetics/SeedRegistry.sol";
import { CloneRegistry } from "../../../src/highcountry/genetics/CloneRegistry.sol";
import { MotherRegistry } from "../../../src/highcountry/genetics/MotherRegistry.sol";
import { PlantRegistry } from "../../../src/highcountry/cultivation/PlantRegistry.sol";
import { ICapabilityRegistry420 } from "../../../src/interfaces/genesis/ICapabilityRegistry420.sol";
import { ActionIds } from "../../../src/highcountry/constants/ActionIds.sol";
import { ModuleIds } from "../../../src/highcountry/constants/ModuleIds.sol";
import { MockCapabilityRegistry } from "./MockCapabilityRegistry.sol";

interface VmHCSourceFixture {
    function prank(
        address
    ) external;
}

abstract contract PlantSourcesFixture {
    VmHCSourceFixture internal constant sourceVm =
        VmHCSourceFixture(address(uint160(uint256(keccak256("hevm cheat code")))));
    SeedRegistry internal sourceSeeds;
    CloneRegistry internal sourceClones;

    function _createPlantSources(
        address auth,
        address genomes
    ) internal {
        sourceSeeds = new SeedRegistry(auth, genomes);
        MotherRegistry mothers = new MotherRegistry(auth, genomes);
        sourceClones = new CloneRegistry(auth, genomes, address(mothers));
    }

    function _sourceGrant(
        MockCapabilityRegistry caps,
        address who,
        bytes32 module,
        bytes32 action,
        bytes32 scope,
        uint256 amount
    ) internal {
        ICapabilityRegistry420.CapabilityGrant memory g =
            ICapabilityRegistry420.CapabilityGrant(who, module, action, scope, 0, 0, 0, 0, 0, false);
        caps.setGrant(keccak256(abi.encode(who, module, action, scope)), g, amount);
    }

    function _bindPlantSources(
        MockCapabilityRegistry caps,
        PlantRegistry plants
    ) internal {
        _sourceGrant(
            caps, address(this), ModuleIds.SEED_REGISTRY, ActionIds.SEED_BIND_PLANTS, sourceSeeds.BIND_SCOPE(), 0
        );
        _sourceGrant(
            caps, address(this), ModuleIds.CLONE_REGISTRY, ActionIds.CLONE_BIND_PLANTS, sourceClones.BIND_SCOPE(), 0
        );
        sourceSeeds.bindPlantRegistry(address(plants));
        sourceClones.bindPlantRegistry(address(plants));
    }

    function _preparePlantSource(
        MockCapabilityRegistry caps,
        PlantRegistry plants,
        uint64 id,
        bytes32 genome,
        address grower,
        uint64 parcel
    ) internal {
        _sourceGrant(caps, address(this), ModuleIds.SEED_REGISTRY, ActionIds.SEED_REGISTER, bytes32(uint256(id)), 1);
        sourceSeeds.registerSeedLot(id, genome, 0, grower, 1, keccak256("fixture-source"));
        _sourceGrant(caps, address(plants), ModuleIds.SEED_REGISTRY, ActionIds.SEED_CONSUME, bytes32(uint256(id)), 1);
        sourceVm.prank(grower);
        sourceSeeds.approvePlant(id, id, parcel, 0);
    }

    function _sourcePlant(
        MockCapabilityRegistry caps,
        PlantRegistry plants,
        uint64 id,
        bytes32 genome,
        address grower,
        uint64 parcel
    ) internal {
        _preparePlantSource(caps, plants, id, genome, grower, parcel);
        plants.registerPlantFromSource(id, genome, grower, parcel, 0, PlantRegistry.PlantSourceKind.SEED, id);
    }
}
