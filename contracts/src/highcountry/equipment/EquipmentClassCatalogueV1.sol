// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Deterministic baseline equipment class manifest, subject to administrator admission.
/// @dev This contract grants no issuance, ownership, inventory, or economic privileges.
///      The registry and lifecycle policy must use the same immutable version and typeId.
contract EquipmentClassCatalogueV1 {
    enum Class {
        LIGHTING,
        VENTILATION,
        IRRIGATION,
        NUTRIENTS,
        CLIMATE
    }

    struct Definition {
        bytes32 typeId;
        bytes32 version;
        uint16 slots;
        int16[6] effects;
        uint32 maximum;
        uint32 degradeBelow;
        uint32 useCost;
        bytes32 operatingResource;
        uint256 operatingCost;
        bytes32 repairResource;
        uint256 repairCost;
        uint32 repairRestore;
        bytes32 recycleResource;
        uint256 recycleOutput;
        bytes32 craftOutput;
        uint256 craftParts;
        uint256 craftOperatingInput;
    }

    bytes32 public constant CATALOGUE_VERSION = keccak256("HC.EQUIPMENT.CATALOGUE.V1");
    bytes32 public constant POWER_UNITS = keccak256("HC.RESOURCE.POWER.COUNT.V1");
    bytes32 public constant WATER_UNITS = keccak256("HC.RESOURCE.WATER.COUNT.V1");
    bytes32 public constant NUTRIENT_UNITS = keccak256("HC.RESOURCE.NUTRIENTS.COUNT.V1");
    bytes32 public constant REPAIR_PARTS = keccak256("HC.RESOURCE.SPARE_PARTS.COUNT.V1");
    bytes32 public constant RECYCLED_SCRAP = keccak256("HC.RESOURCE.RECYCLED_SCRAP.COUNT.V1");

    function definition(
        uint8 equipmentClass,
        uint8 tier
    ) external pure returns (Definition memory d) {
        require(equipmentClass <= uint8(Class.CLIMATE) && tier <= 1, "equipment catalogue index");
        bool advanced = tier == 1;
        d.version = CATALOGUE_VERSION;
        d.typeId = keccak256(abi.encode("HC.EQUIPMENT.CLASS.V1", equipmentClass, tier));
        d.slots = advanced ? 2 : 1;
        d.maximum = advanced ? 160 : 100;
        d.degradeBelow = advanced ? 48 : 30;
        d.useCost = advanced ? 16 : 10;
        d.operatingCost = advanced ? 2 : 1;
        d.repairResource = REPAIR_PARTS;
        d.repairCost = advanced ? 4 : 2;
        d.repairRestore = advanced ? 96 : 60;
        d.recycleResource = RECYCLED_SCRAP;
        d.recycleOutput = advanced ? 2 : 1;
        d.craftOutput = keccak256(abi.encode("HC.EQUIPMENT.CRAFT.OUTPUT.V1", d.typeId));
        d.craftParts = advanced ? 6 : 3;
        d.craftOperatingInput = advanced ? 4 : 2;

        if (equipmentClass == uint8(Class.LIGHTING)) {
            d.operatingResource = POWER_UNITS;
            d.effects[2] = advanced ? int16(1200) : int16(600);
        } else if (equipmentClass == uint8(Class.VENTILATION)) {
            d.operatingResource = POWER_UNITS;
            d.effects[1] = advanced ? int16(-400) : int16(-200);
            d.effects[5] = advanced ? int16(1200) : int16(600);
        } else if (equipmentClass == uint8(Class.IRRIGATION)) {
            d.operatingResource = WATER_UNITS;
            d.effects[3] = advanced ? int16(1200) : int16(600);
        } else if (equipmentClass == uint8(Class.NUTRIENTS)) {
            d.operatingResource = NUTRIENT_UNITS;
            d.effects[4] = advanced ? int16(1200) : int16(600);
        } else {
            d.operatingResource = POWER_UNITS;
            d.effects[0] = advanced ? int16(-200) : int16(-100);
            d.effects[1] = advanced ? int16(600) : int16(300);
        }
    }
}
