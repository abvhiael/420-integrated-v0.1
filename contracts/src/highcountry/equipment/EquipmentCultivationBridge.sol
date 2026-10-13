// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import {EquipmentRegistry} from "./EquipmentRegistry.sol";
import {EquipmentLifecycleEngine} from "./EquipmentLifecycleEngine.sol";
import {CultivationEngine} from "../cultivation/CultivationEngine.sol";
import {PlantRegistry} from "../cultivation/PlantRegistry.sol";
import {R04EmergencyConsumer} from "../security/R04EmergencyConsumer.sol";
import {EmergencyDomains} from "../constants/EmergencyDomains.sol";
contract EquipmentCultivationBridge is R04EmergencyConsumer {
    error InvalidEquipmentUse();
    EquipmentRegistry public immutable equipment;
    EquipmentLifecycleEngine public immutable lifecycle;
    CultivationEngine public immutable cultivation;
    PlantRegistry public immutable plants;
    constructor(address equipment_, address lifecycle_, address cultivation_, address plants_) {
        equipment = EquipmentRegistry(equipment_);
        lifecycle = EquipmentLifecycleEngine(lifecycle_);
        cultivation = CultivationEngine(cultivation_);
        plants = PlantRegistry(plants_);
        if (address(lifecycle.equipment()) != equipment_ || address(cultivation.plantRegistry()) != plants_
            || address(equipment.land()) != address(plants.landRegistry())) revert InvalidEquipmentUse();
    }
    function applyEnvironment(uint64 plant, bytes32 itemId, CultivationEngine.EnvironmentSnapshot calldata base)
        external r04Unrestricted(EmergencyDomains.MANUFACTURING) {
        PlantRegistry.PlantRecord memory p = plants.getPlant(plant);
        EquipmentRegistry.Equipment memory item = equipment.equipment(itemId);
        if (p.grower != msg.sender || item.owner != msg.sender || item.parcelId != p.landParcelId
            || equipment.land().effectiveOperator(p.landParcelId) != msg.sender
            || equipment.disabled(itemId) || equipment.retired(itemId)) revert InvalidEquipmentUse();
        lifecycle.recordUse(itemId);
        int16[6] memory delta = equipment.equipmentType(item.typeId).effects;
        uint16[6] memory input = [base.temperature,base.humidity,base.light,base.water,base.nutrients,base.airflow];
        for (uint256 i; i < 6; i++) {
            int256 n = int256(uint256(input[i])) + (equipment.disabled(itemId) ? int256(0) : int256(delta[i]));
            if (n < 0 || n > type(uint16).max) revert InvalidEquipmentUse();
            input[i] = uint16(uint256(n));
        }
        cultivation.updateEnvironment(plant, CultivationEngine.EnvironmentSnapshot(
            input[0],input[1],input[2],input[3],input[4],input[5]));
    }
}
