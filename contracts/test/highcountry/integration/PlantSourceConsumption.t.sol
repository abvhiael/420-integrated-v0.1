// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import { PublicPlantCapacityFixture } from "./PublicPlantCapacity.t.sol";
import { PublicCultivationAccess } from "../../../src/highcountry/land/PublicCultivationAccess.sol";
import { PlantRegistry } from "../../../src/highcountry/cultivation/PlantRegistry.sol";
import { SeedRegistry } from "../../../src/highcountry/genetics/SeedRegistry.sol";
import { CloneRegistry } from "../../../src/highcountry/genetics/CloneRegistry.sol";
import { ActionIds } from "../../../src/highcountry/constants/ActionIds.sol";
import { ModuleIds } from "../../../src/highcountry/constants/ModuleIds.sol";
import {
    HCInvalidState,
    HCInvalidId,
    HCAlreadyExists,
    HCNotFound,
    HCUnauthorized,
    HCCapacityExceeded
} from "../../../src/highcountry/errors/HighCountryErrors.sol";

/// @dev Adversarial dependency, never accepted as production resource evidence.
contract ReentrantSeedDependency {
    address public immutable authorization;
    address public immutable genomeRegistry;
    address public plantRegistry;
    address private immutable owner;
    bytes32 private immutable genome;
    bool private attacking;
    bool public callbackRejected;

    constructor(
        address auth,
        address genomes,
        address owner_,
        bytes32 genome_
    ) {
        authorization = auth;
        genomeRegistry = genomes;
        owner = owner_;
        genome = genome_;
    }

    function setConsumer(
        address plants
    ) external {
        plantRegistry = plants;
    }

    function getSeedLot(
        uint64 id
    ) external view returns (SeedRegistry.SeedLot memory) {
        return SeedRegistry.SeedLot(id, genome, 0, owner, 2, bytes32(0), true);
    }

    function consumeForPlant(
        uint64,
        uint64
    ) external {
        if (attacking) return;
        attacking = true;
        (bool ok, bytes memory reason) = plantRegistry.call(
            abi.encodeCall(
                PlantRegistry.registerPlantFromSource, (2, genome, owner, 1, 0, PlantRegistry.PlantSourceKind.SEED, 1)
            )
        );
        callbackRejected = !ok && reason.length >= 4 && bytes4(reason) == HCInvalidState.selector;
        require(callbackRejected, "reentrant admission succeeded");
    }
}

contract PlantSourceConsumptionTest is PublicPlantCapacityFixture {
    function _plantGrant(
        uint64 id
    ) private {
        _grant(address(this), ModuleIds.PLANT_REGISTRY, ActionIds.PLANT_REGISTER, bytes32(uint256(id)));
    }

    function _seedApproval(
        uint64 source,
        uint64 id,
        address owner,
        uint64 parcel,
        uint64 plot
    ) private {
        vm.prank(owner);
        seeds.approvePlant(source, id, parcel, plot);
    }

    function _admit(
        uint64 id,
        uint64 source,
        PlantRegistry.PlantSourceKind kind,
        address grower,
        uint64 parcel,
        uint64 plot
    ) private {
        _plantGrant(id);
        plants.registerPlantFromSource(id, GENOME, grower, parcel, plot, kind, source);
    }

    function _clone(
        uint64 id,
        address owner
    ) private {
        if (!mothers.exists(1)) {
            _grant(address(this), ModuleIds.MOTHER_REGISTRY, ActionIds.MOTHER_REGISTER, bytes32(uint256(1)));
            mothers.registerMother(1, GENOME, address(this), 10, keccak256("mother"));
        }
        _grant(address(this), ModuleIds.CLONE_REGISTRY, ActionIds.CLONE_REGISTER, bytes32(uint256(id)));
        _grant(address(clones), ModuleIds.MOTHER_REGISTRY, ActionIds.MOTHER_CONSUME_CUTTING, bytes32(uint256(1)));
        clones.registerClone(id, GENOME, 1, owner, keccak256("clone"));
        _grant(address(plants), ModuleIds.CLONE_REGISTRY, ActionIds.CLONE_CONSUME, bytes32(uint256(id)));
    }

    function _assertUnused(
        uint64 source,
        uint64 id
    ) private view {
        require(
            !plants.exists(id) && seeds.consumedQuantity(source) == 0 && seeds.seedLotForPlant(id) == 0,
            "rollback failed"
        );
        require(plants.activePlantsByParcel(1) == 0 && plants.privatePlantsByParcel(1) == 0, "capacity rollback failed");
    }

    function testFiniteSeedLotConsumesOnePerPlantAndCannotOverdraw() public {
        _issueSeeds(1000, address(this), 2);
        _seedApproval(1000, 1, address(this), 1, 0);
        _admit(1, 1000, PlantRegistry.PlantSourceKind.SEED, address(this), 1, 0);
        _seedApproval(1000, 2, address(this), 1, 0);
        _admit(2, 1000, PlantRegistry.PlantSourceKind.SEED, address(this), 1, 0);
        require(
            seeds.getSeedLot(1000).quantity == 2 && seeds.remainingQuantity(1000) == 0
                && seeds.consumedQuantity(1000) == 2,
            "seed conservation"
        );
        _plantGrant(3);
        _reject(
            address(plants),
            abi.encodeCall(
                plants.registerPlantFromSource,
                (3, GENOME, address(this), 1, 0, PlantRegistry.PlantSourceKind.SEED, 1000)
            ),
            HCInvalidState.selector
        );
        require(!plants.exists(3) && plants.activePlantsByParcel(1) == 2, "overdraw changed state");
    }

    function testCloneConsumedOnceAndCannotTransferOrRegrowAfterTermination() public {
        _clone(1000, address(this));
        clones.approvePlant(1000, 1, 1, 0);
        _admit(1, 1000, PlantRegistry.PlantSourceKind.CLONE, address(this), 1, 0);
        require(clones.consumedByPlant(1000) == 1 && clones.cloneForPlant(1) == 1000, "clone provenance");
        _finish(1);
        _plantGrant(2);
        _reject(
            address(plants),
            abi.encodeCall(
                plants.registerPlantFromSource,
                (2, GENOME, address(this), 1, 0, PlantRegistry.PlantSourceKind.CLONE, 1000)
            ),
            HCInvalidState.selector
        );
        _reject(address(clones), abi.encodeCall(clones.transfer, (1000, ALICE)), HCInvalidState.selector);
        require(
            !plants.exists(2) && plants.activePlantsByParcel(1) == 0 && clones.consumedByPlant(1000) == 1,
            "clone resurrected"
        );
    }

    function testOwnerApprovalRequiredEvenForCapabilityAuthorizedIssuer() public {
        _issueSeeds(1000, address(this), 1);
        _plantGrant(1);
        _reject(
            address(plants),
            abi.encodeCall(
                plants.registerPlantFromSource,
                (1, GENOME, address(this), 1, 0, PlantRegistry.PlantSourceKind.SEED, 1000)
            ),
            HCInvalidState.selector
        );
        _assertUnused(1000, 1);
        _seedApproval(1000, 1, address(this), 1, 0);
        _admit(1, 1000, PlantRegistry.PlantSourceKind.SEED, address(this), 1, 0);
        require(seeds.plantApproval(1000, 1) == bytes32(0), "approval not consumed");
    }

    function testApprovalBindsPlantParcelAndPublicPlot() public {
        _issueSeeds(1000, address(this), 1);
        _plot(1, 1);
        _allocate(1, address(this), 1);
        _seedApproval(1000, 1, address(this), 1, 1);
        _plantGrant(1);
        _plantGrant(2);
        _reject(
            address(plants),
            abi.encodeCall(
                plants.registerPlantFromSource,
                (1, GENOME, address(this), 1, 0, PlantRegistry.PlantSourceKind.SEED, 1000)
            ),
            HCInvalidState.selector
        );
        _reject(
            address(plants),
            abi.encodeCall(
                plants.registerPlantFromSource,
                (2, GENOME, address(this), 1, 1, PlantRegistry.PlantSourceKind.SEED, 1000)
            ),
            HCInvalidState.selector
        );
        _assertUnused(1000, 1);
        _admit(1, 1000, PlantRegistry.PlantSourceKind.SEED, address(this), 1, 1);
        require(plants.activePublicPlants(1, address(this)) == 1, "public source admission");
    }

    function testNonownerCannotApproveAndRevocationPreservesResources() public {
        _issueSeeds(1000, address(this), 1);
        vm.prank(ALICE);
        _reject(address(seeds), abi.encodeCall(seeds.approvePlant, (1000, 1, 1, 0)), HCUnauthorized.selector);
        _seedApproval(1000, 1, address(this), 1, 0);
        seeds.revokePlantApproval(1000, 1);
        _plantGrant(1);
        _reject(
            address(plants),
            abi.encodeCall(
                plants.registerPlantFromSource,
                (1, GENOME, address(this), 1, 0, PlantRegistry.PlantSourceKind.SEED, 1000)
            ),
            HCInvalidState.selector
        );
        _assertUnused(1000, 1);
    }

    function testSeedTransferInvalidatesPriorApprovalEvenAfterTransferBack() public {
        _issueSeeds(1000, address(this), 2);
        _seedApproval(1000, 1, address(this), 1, 0);
        _grant(address(this), ModuleIds.SEED_REGISTRY, ActionIds.SEED_TRANSFER, bytes32(uint256(1000)));
        seeds.transfer(1000, ALICE);
        seeds.transfer(1000, address(this));
        _plantGrant(1);
        _reject(
            address(plants),
            abi.encodeCall(
                plants.registerPlantFromSource,
                (1, GENOME, address(this), 1, 0, PlantRegistry.PlantSourceKind.SEED, 1000)
            ),
            HCInvalidState.selector
        );
        _assertUnused(1000, 1);
        require(seeds.ownershipEpoch(1000) == 2, "ownership epoch");
        _seedApproval(1000, 1, address(this), 1, 0);
        _admit(1, 1000, PlantRegistry.PlantSourceKind.SEED, address(this), 1, 0);
    }

    function testCloneApprovalRevocationAndOwnershipEpochAreEnforced() public {
        _clone(1000, address(this));
        clones.approvePlant(1000, 1, 1, 0);
        vm.prank(ALICE);
        _reject(address(clones), abi.encodeCall(clones.revokePlantApproval, (1000, 1)), HCUnauthorized.selector);
        clones.revokePlantApproval(1000, 1);
        _plantGrant(1);
        _reject(
            address(plants),
            abi.encodeCall(
                plants.registerPlantFromSource,
                (1, GENOME, address(this), 1, 0, PlantRegistry.PlantSourceKind.CLONE, 1000)
            ),
            HCInvalidState.selector
        );
        clones.approvePlant(1000, 1, 1, 0);
        _grant(address(this), ModuleIds.CLONE_REGISTRY, ActionIds.CLONE_TRANSFER, bytes32(uint256(1000)));
        clones.transfer(1000, ALICE);
        clones.transfer(1000, address(this));
        _reject(
            address(plants),
            abi.encodeCall(
                plants.registerPlantFromSource,
                (1, GENOME, address(this), 1, 0, PlantRegistry.PlantSourceKind.CLONE, 1000)
            ),
            HCInvalidState.selector
        );
        clones.approvePlant(1000, 1, 1, 0);
        _admit(1, 1000, PlantRegistry.PlantSourceKind.CLONE, address(this), 1, 0);
    }

    function testWrongOwnerGenomeMissingSourceAndZeroSourceDenied() public {
        _issueSeeds(1000, address(this), 1);
        _plantGrant(1);
        _reject(
            address(plants),
            abi.encodeCall(
                plants.registerPlantFromSource, (1, GENOME, ALICE, 1, 0, PlantRegistry.PlantSourceKind.SEED, 1000)
            ),
            HCInvalidState.selector
        );
        _reject(
            address(plants),
            abi.encodeCall(
                plants.registerPlantFromSource,
                (1, keccak256("other"), address(this), 1, 0, PlantRegistry.PlantSourceKind.SEED, 1000)
            ),
            HCInvalidState.selector
        );
        _reject(
            address(plants),
            abi.encodeCall(
                plants.registerPlantFromSource,
                (1, GENOME, address(this), 1, 0, PlantRegistry.PlantSourceKind.SEED, 9999)
            ),
            HCNotFound.selector
        );
        _reject(
            address(plants),
            abi.encodeCall(
                plants.registerPlantFromSource, (1, GENOME, address(this), 1, 0, PlantRegistry.PlantSourceKind.SEED, 0)
            ),
            HCInvalidId.selector
        );
        _reject(
            address(plants),
            abi.encodeCall(
                plants.registerPlantFromSource,
                (1, GENOME, address(this), 1, 0, PlantRegistry.PlantSourceKind.NONE, 1000)
            ),
            HCInvalidId.selector
        );
        _assertUnused(1000, 1);
    }

    function testLegacySourceLessPathsNeverMintEvenWithValidGrants() public {
        _plot(1, 1);
        _allocate(1, address(this), 1);
        _plantGrant(1);
        _reject(
            address(plants),
            abi.encodeCall(plants.registerPlant, (1, GENOME, address(this), 1)),
            HCInvalidState.selector
        );
        _reject(
            address(plants),
            abi.encodeCall(plants.registerPublicPlant, (1, GENOME, address(this), 1)),
            HCInvalidState.selector
        );
        require(!plants.exists(1) && plants.activePlantsByParcel(1) == 0, "legacy bypass");
    }

    function testOnlyBoundPlantRegistryCanConsumeEvenWithHolderCapability() public {
        _issueSeeds(1000, address(this), 1);
        _seedApproval(1000, 1, address(this), 1, 0);
        _grant(address(this), ModuleIds.SEED_REGISTRY, ActionIds.SEED_CONSUME, bytes32(uint256(1000)));
        _reject(address(seeds), abi.encodeCall(seeds.consumeForPlant, (1000, 1)), HCInvalidState.selector);
        _clone(1000, address(this));
        clones.approvePlant(1000, 1, 1, 0);
        _grant(address(this), ModuleIds.CLONE_REGISTRY, ActionIds.CLONE_CONSUME, bytes32(uint256(1000)));
        _reject(address(clones), abi.encodeCall(clones.consumeForPlant, (1000, 1)), HCInvalidState.selector);
        _assertUnused(1000, 1);
        require(clones.consumedByPlant(1000) == 0, "direct clone consumption");
    }

    function testDownstreamConsumptionFailureRollsBackPlantCapacitySourceAndApproval() public {
        _issueSeeds(1000, address(this), 1);
        _seedApproval(1000, 1, address(this), 1, 0);
        _plantGrant(1);
        bytes32 approval = seeds.plantApproval(1000, 1);
        bytes32 replacement =
            _grant(address(plants), ModuleIds.SEED_REGISTRY, ActionIds.SEED_CONSUME, bytes32(uint256(1000)));
        caps.revokeGrant(replacement);
        _reject(
            address(plants),
            abi.encodeCall(
                plants.registerPlantFromSource,
                (1, GENOME, address(this), 1, 0, PlantRegistry.PlantSourceKind.SEED, 1000)
            ),
            HCUnauthorized.selector
        );
        _assertUnused(1000, 1);
        (PlantRegistry.PlantSourceKind kind,) = plants.sourceOfPlant(1);
        require(
            kind == PlantRegistry.PlantSourceKind.NONE && seeds.plantApproval(1000, 1) == approval,
            "rollback provenance or consent"
        );
        _grant(address(plants), ModuleIds.SEED_REGISTRY, ActionIds.SEED_CONSUME, bytes32(uint256(1000)));
        _admit(1, 1000, PlantRegistry.PlantSourceKind.SEED, address(this), 1, 0);
    }

    function testCloneConsumptionFailureRollsBackAndCanRetry() public {
        _clone(1000, address(this));
        clones.approvePlant(1000, 1, 1, 0);
        _plantGrant(1);
        bytes32 approval = clones.plantApproval(1000, 1);
        bytes32 g = _grant(address(plants), ModuleIds.CLONE_REGISTRY, ActionIds.CLONE_CONSUME, bytes32(uint256(1000)));
        caps.revokeGrant(g);
        _reject(
            address(plants),
            abi.encodeCall(
                plants.registerPlantFromSource,
                (1, GENOME, address(this), 1, 0, PlantRegistry.PlantSourceKind.CLONE, 1000)
            ),
            HCUnauthorized.selector
        );
        require(
            !plants.exists(1) && plants.activePlantsByParcel(1) == 0 && clones.consumedByPlant(1000) == 0
                && clones.plantApproval(1000, 1) == approval,
            "clone rollback"
        );
        _grant(address(plants), ModuleIds.CLONE_REGISTRY, ActionIds.CLONE_CONSUME, bytes32(uint256(1000)));
        _admit(1, 1000, PlantRegistry.PlantSourceKind.CLONE, address(this), 1, 0);
    }

    function testUnauthorizedAdmissionDoesNotConsumeOwnerApproval() public {
        _issueSeeds(1000, address(this), 1);
        _seedApproval(1000, 1, address(this), 1, 0);
        bytes32 approval = seeds.plantApproval(1000, 1);
        _reject(
            address(plants),
            abi.encodeCall(
                plants.registerPlantFromSource,
                (1, GENOME, address(this), 1, 0, PlantRegistry.PlantSourceKind.SEED, 1000)
            ),
            HCUnauthorized.selector
        );
        _assertUnused(1000, 1);
        require(seeds.plantApproval(1000, 1) == approval, "failed admission lost consent");
    }

    function testCapacityFailurePreservesSeedAndClone() public {
        _plot(1, 4);
        _issueSeeds(1000, address(this), 1);
        _seedApproval(1000, 1, address(this), 1, 0);
        _plantGrant(1);
        _reject(
            address(plants),
            abi.encodeCall(
                plants.registerPlantFromSource,
                (1, GENOME, address(this), 1, 0, PlantRegistry.PlantSourceKind.SEED, 1000)
            ),
            HCCapacityExceeded.selector
        );
        _assertUnused(1000, 1);
        _clone(1000, address(this));
        clones.approvePlant(1000, 1, 1, 0);
        _reject(
            address(plants),
            abi.encodeCall(
                plants.registerPlantFromSource,
                (1, GENOME, address(this), 1, 0, PlantRegistry.PlantSourceKind.CLONE, 1000)
            ),
            HCCapacityExceeded.selector
        );
        require(clones.consumedByPlant(1000) == 0, "capacity lost clone");
    }

    function testTerminationNeverRefundsSourceAndDuplicatePlantCannotConsumeAnotherSource() public {
        _issueSeeds(1000, address(this), 2);
        _seedApproval(1000, 1, address(this), 1, 0);
        _admit(1, 1000, PlantRegistry.PlantSourceKind.SEED, address(this), 1, 0);
        _finish(1);
        require(seeds.remainingQuantity(1000) == 1, "termination refunded seed");
        _seedApproval(1000, 1, address(this), 1, 0);
        _reject(
            address(plants),
            abi.encodeCall(
                plants.registerPlantFromSource,
                (1, GENOME, address(this), 1, 0, PlantRegistry.PlantSourceKind.SEED, 1000)
            ),
            HCAlreadyExists.selector
        );
        require(seeds.consumedQuantity(1000) == 1, "duplicate consumed seed");
    }

    function testExhaustedSeedLotCannotTransferOrApproveMorePlants() public {
        _issueSeeds(1000, address(this), 1);
        _seedApproval(1000, 1, address(this), 1, 0);
        _admit(1, 1000, PlantRegistry.PlantSourceKind.SEED, address(this), 1, 0);
        _reject(address(seeds), abi.encodeCall(seeds.transfer, (1000, ALICE)), HCInvalidState.selector);
        _reject(address(seeds), abi.encodeCall(seeds.approvePlant, (1000, 2, 1, 0)), HCInvalidState.selector);
    }

    function testPartialSeedTransferMovesOnlyRemainingUnitsAndRequiresNewOwnerConsent() public {
        _issueSeeds(1000, address(this), 2);
        _seedApproval(1000, 1, address(this), 1, 0);
        _admit(1, 1000, PlantRegistry.PlantSourceKind.SEED, address(this), 1, 0);
        _grant(address(this), ModuleIds.SEED_REGISTRY, ActionIds.SEED_TRANSFER, bytes32(uint256(1000)));
        seeds.transfer(1000, ALICE);
        _plot(1, 1);
        _allocate(1, ALICE, 1);
        _seedApproval(1000, 2, ALICE, 1, 1);
        _admit(2, 1000, PlantRegistry.PlantSourceKind.SEED, ALICE, 1, 1);
        require(
            plants.getPlant(1).grower == address(this) && plants.getPlant(2).grower == ALICE
                && seeds.consumedQuantity(1000) == 2,
            "history or remainder transfer"
        );
    }

    function testSourceBindingsAreOneTimeAndFailClosedWithoutAuthority() public {
        _reject(address(seeds), abi.encodeCall(seeds.bindPlantRegistry, (address(plants))), HCInvalidState.selector);
        _reject(address(clones), abi.encodeCall(clones.bindPlantRegistry, (address(plants))), HCInvalidState.selector);
        SeedRegistry other = new SeedRegistry(address(auth), address(genomes));
        vm.prank(ALICE);
        _reject(address(other), abi.encodeCall(other.bindPlantRegistry, (address(plants))), HCUnauthorized.selector);
        _reject(address(other), abi.encodeCall(other.bindPlantRegistry, (ALICE)), HCInvalidState.selector);
    }

    function testMaliciousDependencyCannotReenterAdmission() public {
        PublicCultivationAccess otherPlots = new PublicCultivationAccess(address(auth), address(land));
        ReentrantSeedDependency dependency =
            new ReentrantSeedDependency(address(auth), address(genomes), address(this), GENOME);
        CloneRegistry otherClones = new CloneRegistry(address(auth), address(genomes), address(mothers));
        PlantRegistry otherPlants = new PlantRegistry(
            address(auth),
            address(genomes),
            address(land),
            address(otherPlots),
            address(dependency),
            address(otherClones)
        );
        _grant(
            address(this), ModuleIds.PLANT_REGISTRY, ActionIds.PLANT_BIND_EMERGENCY, otherPlants.EMERGENCY_BIND_SCOPE()
        );
        otherPlants.bindEmergencyState(address(emergency));
        dependency.setConsumer(address(otherPlants));
        otherClones.bindPlantRegistry(address(otherPlants));
        otherPlots.bindPlantRegistry(address(otherPlants));
        _plantGrant(1);
        _plantGrant(2);
        otherPlants.registerPlantFromSource(1, GENOME, address(this), 1, 0, PlantRegistry.PlantSourceKind.SEED, 1);
        require(
            dependency.callbackRejected() && otherPlants.exists(1) && !otherPlants.exists(2)
                && otherPlants.activePlantsByParcel(1) == 1,
            "callback altered admission"
        );
    }

    function testMaximumSeedQuantityDoesNotOverflowConsumption() public {
        _issueSeeds(1000, address(this), type(uint32).max);
        _seedApproval(1000, 1, address(this), 1, 0);
        _admit(1, 1000, PlantRegistry.PlantSourceKind.SEED, address(this), 1, 0);
        require(
            seeds.consumedQuantity(1000) == 1 && seeds.remainingQuantity(1000) == type(uint32).max - 1,
            "maximum seed accounting"
        );
    }

    function testFuzzFiniteSeedConservation(
        uint8 amount
    ) public {
        uint32 quantity = uint32(amount % 4) + 1;
        _issueSeeds(1000, address(this), quantity);
        for (uint64 id = 1; id <= quantity; ++id) {
            _seedApproval(1000, id, address(this), 1, 0);
            _admit(id, 1000, PlantRegistry.PlantSourceKind.SEED, address(this), 1, 0);
        }
        require(
            seeds.consumedQuantity(1000) == quantity && seeds.remainingQuantity(1000) == 0, "fuzz source conservation"
        );
        _finish(1);
        require(seeds.consumedQuantity(1000) == quantity, "fuzz refund");
    }
}
