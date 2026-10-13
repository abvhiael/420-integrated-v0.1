// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import {bindRetainedR04Emergency,retainedR04AuthorizationRoot} from "../../mocks/R04EmergencyFixture.sol";

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
}

