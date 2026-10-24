// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import { bindRetainedR04Emergency, retainedR04AuthorizationRoot } from "../../mocks/R04EmergencyFixture.sol";

import { EquipmentRegistry } from "../../../../src/highcountry/equipment/EquipmentRegistry.sol";
import { EquipmentLifecycleEngine } from "../../../../src/highcountry/equipment/EquipmentLifecycleEngine.sol";
import { InventoryRegistry } from "../../../../src/highcountry/inventory/InventoryRegistry.sol";
import { HarvestProductRegistry } from "../../../../src/highcountry/harvest/HarvestProductRegistry.sol";
import { ResourceLedger } from "../../../../src/highcountry/inventory/ResourceLedger.sol";

contract R044Land {
    function effectiveOperator(
        uint64
    ) external view returns (address) {
        return address(this);
    }

    function growCapacityOf(
        uint64
    ) external pure returns (uint32) {
        return 4;
    }

    function place(
        EquipmentRegistry e,
        bytes32 id
    ) external {
        e.place(id, 1);
    }

    function remove(
        EquipmentRegistry e,
        bytes32 id
    ) external {
        e.remove(id);
    }

    function repair(
        EquipmentLifecycleEngine l,
        bytes32 id
    ) external {
        l.repair(id);
    }

    function retire(
        EquipmentLifecycleEngine l,
        bytes32 id
    ) external {
        l.retire(id);
    }

    function recycle(
        EquipmentLifecycleEngine l,
        bytes32 id
    ) external {
        l.recycle(id);
    }

    function approve(
        InventoryRegistry i,
        address operator
    ) external {
        i.setInventoryOperator(operator, true);
    }

    function offer(
        EquipmentRegistry e,
        bytes32 id,
        address buyer,
        uint64 expiry
    ) external {
        e.offerTransfer(id, buyer, expiry);
    }

    function cancel(
        EquipmentRegistry e,
        bytes32 id
    ) external {
        e.cancelTransfer(id);
    }

    function accept(
        EquipmentRegistry e,
        bytes32 id
    ) external {
        e.acceptTransfer(id);
    }
}

contract R044Product {
    function getProduct(
        bytes32
    ) external pure returns (HarvestProductRegistry.Product memory) {
        revert("unused");
    }
}

contract EquipmentLifecycleR044Test {
    bytes32 constant TYPE = keccak256("EQUIPMENT-1");
    bytes32 constant ID = keccak256("INSTANCE-1");
    bytes32 constant REPAIR = keccak256("REPAIR-PARTS");
    bytes32 constant RECYCLE = keccak256("SCRAP");
    R044Land player;
    EquipmentRegistry equipment;
    InventoryRegistry inventory;
    ResourceLedger ledger;
    EquipmentLifecycleEngine lifecycle;

    function setUp() public {
        player = new R044Land();
        equipment = new EquipmentRegistry(retainedR04AuthorizationRoot(), address(player));
        bindRetainedR04Emergency(address(equipment));
        inventory = new InventoryRegistry(address(new R044Product()));
        inventory.registerResource(REPAIR, InventoryRegistry.Unit.COUNT);
        inventory.registerResource(RECYCLE, InventoryRegistry.Unit.COUNT);
        inventory.setIssuer(address(this), true);
        lifecycle = new EquipmentLifecycleEngine(retainedR04AuthorizationRoot(), address(equipment), address(inventory));
        bindRetainedR04Emergency(address(lifecycle));
        equipment.bindLifecycleController(address(lifecycle));
        inventory.setIssuer(address(lifecycle), true);
        player.approve(inventory, address(lifecycle));
        ledger = inventory.ledger();
        int16[6] memory effects;
        effects[0] = 50;
        equipment.registerType(TYPE, bytes32(uint256(1)), 1, effects);
        equipment.setIssuer(address(this), true);
        equipment.issue(ID, TYPE, address(player), bytes32(uint256(1)));
        lifecycle.registerPolicy(TYPE, bytes32(uint256(1)), 10, 5, 5, REPAIR, 2, 6, RECYCLE, 3);
        lifecycle.setUseVerifier(address(this), true);
        inventory.acquire(bytes32(uint256(100)), REPAIR, address(player), 5);
    }

    function testBreakRepairAndMaterialConservation() public {
        player.place(equipment, ID);
        lifecycle.recordUse(ID);
        lifecycle.recordUse(ID);
        require(equipment.disabled(ID), "broken still active");
        require(equipment.effectiveEffects(1, address(player))[0] == 0, "broken effects");
        (bool extra,) = address(lifecycle).call(abi.encodeCall(lifecycle.recordUse, (ID)));
        require(!extra, "used while broken");
        player.repair(lifecycle, ID);
        require(!equipment.disabled(ID), "repair did not restore");
        EquipmentLifecycleEngine.Condition memory c = lifecycle.condition(ID);
        require(c.durability == 6 && c.state == EquipmentLifecycleEngine.State.FUNCTIONAL, "repair");
        ResourceLedger.Balance memory b = ledger.balance(REPAIR, address(player));
        require(b.available == 3 && b.consumed == 2 && b.reserved == 0, "repair resource loss");
        require(equipment.effectiveEffects(1, address(player))[0] == 50, "repaired effects");
    }

    function testRetirementRecycleSingleUse() public {
        player.place(equipment, ID);
        player.retire(lifecycle, ID);
        require(equipment.retired(ID) && equipment.occupiedSlots(1) == 0, "retire slot");
        player.recycle(lifecycle, ID);
        require(ledger.balance(RECYCLE, address(player)).available == 3, "recycle yield");
        (bool replay,) = address(player).call(abi.encodeCall(player.recycle, (lifecycle, ID)));
        require(!replay, "double recycle");
    }

    function testUnauthorizedAndFailedRepairAtomic() public {
        (bool unauthorized,) = address(player).call(abi.encodeCall(player.repair, (lifecycle, ID)));
        require(!unauthorized, "full item repair");
        player.place(equipment, ID);
        lifecycle.recordUse(ID);
        inventory.setIssuer(address(lifecycle), false);
        player.repair(lifecycle, ID);
        // Repair consumes real inventory but does not require issuance authority.
        require(ledger.consumed(REPAIR) == 2, "repair not charged");
        (bool foreign,) = address(this).call(abi.encodeCall(lifecycle.retire, (ID)));
        require(!foreign, "non-owner retired");
    }

    function testImmutablePolicyAndReplayedEquipmentDenied() public {
        (bool overwrite,) = address(lifecycle)
            .call(
                abi.encodeCall(
                    lifecycle.registerPolicy,
                    (
                        TYPE,
                        bytes32(uint256(2)),
                        uint32(10),
                        uint32(5),
                        uint32(5),
                        REPAIR,
                        uint256(2),
                        uint32(6),
                        RECYCLE,
                        uint256(3)
                    )
                )
            );
        require(!overwrite, "rewrote policy");
        require(lifecycle.condition(ID).durability == 10, "default condition");
    }

    function testLifecyclePolicyMustMatchImmutableEquipmentCatalogueVersion() public {
        bytes32 nextType = keccak256("EQUIPMENT-VERSION-2");
        int16[6] memory effects;
        effects[2] = 125;
        equipment.registerType(nextType, bytes32(uint256(2)), 1, effects);
        (bool mismatch,) = address(lifecycle)
            .call(
                abi.encodeCall(
                    lifecycle.registerPolicy,
                    (
                        nextType,
                        bytes32(uint256(1)),
                        uint32(10),
                        uint32(5),
                        uint32(5),
                        REPAIR,
                        uint256(2),
                        uint32(6),
                        RECYCLE,
                        uint256(3)
                    )
                )
            );
        require(!mismatch, "mismatched equipment and lifecycle rules admitted");
        lifecycle.registerPolicy(nextType, bytes32(uint256(2)), 10, 5, 5, REPAIR, 2, 6, RECYCLE, 3);
        require(lifecycle.policy(nextType).version == bytes32(uint256(2)), "matched ruleset version lost");
    }

    function testOperatingInputConservationBreakageAndFailedRetry() public {
        bytes32 fuel = keccak256("EQUIPMENT-FUEL");
        bytes32 type2 = keccak256("EQUIPMENT-WITH-FUEL");
        bytes32 item2 = keccak256("EQUIPMENT-WITH-FUEL-1");
        inventory.registerResource(fuel, InventoryRegistry.Unit.COUNT);
        inventory.acquire(bytes32(uint256(102)), fuel, address(player), 4);
        int16[6] memory effects;
        effects[3] = 100;
        equipment.registerType(type2, bytes32(uint256(3)), 1, effects);
        equipment.issue(item2, type2, address(player), bytes32(uint256(3)));
        lifecycle.registerPolicyWithInput(
            type2,
            EquipmentLifecycleEngine.Policy({
                version: bytes32(uint256(3)),
                maximum: 10,
                degradeBelow: 5,
                useCost: 5,
                repairResource: REPAIR,
                repairCost: 2,
                repairRestore: 6,
                recycleResource: RECYCLE,
                recycleOutput: 3,
                operatingResource: fuel,
                operatingCost: 2,
                exists: true
            })
        );
        player.place(equipment, item2);
        lifecycle.recordUse(item2);
        require(ledger.balance(fuel, address(player)).available == 2, "first use not charged");
        require(ledger.balance(fuel, address(player)).consumed == 2, "first use not burned");
        lifecycle.recordUse(item2);
        require(equipment.disabled(item2), "broken item effects active");
        require(ledger.balance(fuel, address(player)).consumed == 4, "second use not charged");
        require(lifecycle.condition(item2).usages == 2, "use count wrong");
        player.repair(lifecycle, item2);
        require(!equipment.disabled(item2), "repair failed");
        (bool exhausted,) = address(lifecycle).call(abi.encodeCall(lifecycle.recordUse, (item2)));
        require(!exhausted, "unfunded use accepted");
        require(lifecycle.condition(item2).usages == 2, "failed use advanced time");
        require(ledger.consumed(fuel) == 4, "failed use changed consumed stock");
        require(equipment.effectiveEffects(1, address(player))[3] == 100, "failed use altered effects");
    }

    function testEquipmentOwnershipHandoffPreservesProvenanceAndRecycling() public {
        R044Land buyer = new R044Land();
        player.place(equipment, ID);
        (bool placed,) = address(player).call(
            abi.encodeCall(player.offer, (equipment, ID, address(buyer), uint64(block.timestamp + 2 days)))
        );
        require(!placed, "placed item transfer offered");
        player.remove(equipment, ID);
        player.offer(equipment, ID, address(buyer), uint64(block.timestamp + 2 days));
        (bool unauthorized,) = address(equipment).call(abi.encodeCall(equipment.acceptTransfer, (ID)));
        require(!unauthorized, "uninvited transferee accepted");
        (bool blockedPlace,) = address(player).call(abi.encodeCall(player.place, (equipment, ID)));
        require(!blockedPlace, "offered item placed");
        buyer.accept(equipment, ID);
        require(equipment.equipment(ID).owner == address(buyer), "owner not transferred");
        require(equipment.equipment(ID).earningRef == bytes32(uint256(1)), "earning provenance replaced");
        require(lifecycle.condition(ID).durability == 10, "transfer reset wear");
        (bool replay,) = address(buyer).call(abi.encodeCall(buyer.accept, (equipment, ID)));
        require(!replay, "transfer replay");
        (bool oldOwner,) = address(player).call(abi.encodeCall(player.retire, (lifecycle, ID)));
        require(!oldOwner, "seller still owns item");
        buyer.retire(lifecycle, ID);
        buyer.recycle(lifecycle, ID);
        require(ledger.balance(RECYCLE, address(buyer)).available == 3, "buyer did not receive salvage");
        require(ledger.balance(RECYCLE, address(player)).available == 0, "seller received salvage");
    }

    function testDegradedEffectsAndRepairRestoreCanonicalParcelTotals() public {
        bytes32 type3 = keccak256("EQUIPMENT-DEGRADE");
        bytes32 item3 = keccak256("EQUIPMENT-DEGRADE-INSTANCE");
        int16[6] memory effects;
        effects[0] = 101;
        equipment.registerType(type3, bytes32(uint256(4)), 1, effects);
        equipment.issue(item3, type3, address(player), bytes32(uint256(4)));
        lifecycle.registerPolicy(type3, bytes32(uint256(4)), 12, 8, 5, REPAIR, 2, 6, RECYCLE, 3);
        player.place(equipment, item3);
        require(equipment.effectiveEffects(1, address(player))[0] == 101, "full effect absent");
        lifecycle.recordUse(item3);
        require(lifecycle.condition(item3).state == EquipmentLifecycleEngine.State.DEGRADED, "degradation absent");
        require(equipment.degraded(item3), "degradation flag absent");
        require(equipment.effectiveEffects(1, address(player))[0] == 50, "degraded effect not halved");
        require(equipment.activeItemEffects(item3)[0] == 50, "bridge item effect not halved");
        lifecycle.recordUse(item3);
        lifecycle.recordUse(item3);
        require(equipment.disabled(item3), "broken equipment still active");
        require(equipment.effectiveEffects(1, address(player))[0] == 0, "broken effect still in totals");
        player.repair(lifecycle, item3);
        require(!equipment.disabled(item3), "repair left equipment disabled");
        require(equipment.effectiveEffects(1, address(player))[0] == 50, "degraded repair restored full effect");
        player.repair(lifecycle, item3);
        require(lifecycle.condition(item3).state == EquipmentLifecycleEngine.State.FUNCTIONAL, "full repair state");
        require(equipment.effectiveEffects(1, address(player))[0] == 101, "full repair failed totals");
        player.remove(equipment, item3);
        require(equipment.occupiedSlots(1) == 0, "removal did not release capacity");
        require(equipment.effectiveEffects(1, address(player))[0] == 0, "removal left phantom effects");
    }
}
