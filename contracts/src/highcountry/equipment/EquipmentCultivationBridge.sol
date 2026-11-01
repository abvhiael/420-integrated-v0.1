// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import { EquipmentRegistry } from "./EquipmentRegistry.sol";
import { EquipmentLifecycleEngine } from "./EquipmentLifecycleEngine.sol";
import { CultivationEngine } from "../cultivation/CultivationEngine.sol";
import { PlantRegistry } from "../cultivation/PlantRegistry.sol";
import { InventoryRegistry } from "../inventory/InventoryRegistry.sol";
import { R04EmergencyConsumer } from "../security/R04EmergencyConsumer.sol";
import { EmergencyDomains } from "../constants/EmergencyDomains.sol";

contract EquipmentCultivationBridge is R04EmergencyConsumer {
    error InvalidEquipmentUse();
    EquipmentRegistry public immutable equipment;
    EquipmentLifecycleEngine public immutable lifecycle;
    CultivationEngine public immutable cultivation;
    PlantRegistry public immutable plants;

    InventoryRegistry public immutable inventory;
    address public immutable administrator;
    bytes32 public constant WATER_RESOURCE = keccak256("HC.UTILITY.WATER.CAPACITY.V1");
    bytes32 public constant POWER_RESOURCE = keccak256("HC.UTILITY.ELECTRICITY.CAPACITY.V1");

    struct UtilityPolicy {
        bytes32 version;
        uint256 water;
        uint256 electricity;
        bool exists;
    }
    mapping(bytes32 => UtilityPolicy) private _utilityPolicies;
    mapping(uint64 => uint256) public plantOperationNonce;
    event UtilityPolicyRegistered(
        bytes32 indexed equipmentType, bytes32 indexed version, uint256 water, uint256 electricity
    );
    event UtilitiesConsumed(
        uint64 indexed plant, bytes32 indexed equipmentId, address indexed grower, uint256 water, uint256 electricity
    );

    constructor(
        address r04Authorization_,
        address equipment_,
        address lifecycle_,
        address cultivation_,
        address plants_
    ) R04EmergencyConsumer(r04Authorization_) {
        equipment = EquipmentRegistry(equipment_);
        lifecycle = EquipmentLifecycleEngine(lifecycle_);
        cultivation = CultivationEngine(cultivation_);
        plants = PlantRegistry(plants_);
        inventory = lifecycle.inventory();
        administrator = msg.sender;
        if (
            address(lifecycle.equipment()) != equipment_ || address(cultivation.plantRegistry()) != plants_
                || address(equipment.land()) != address(plants.landRegistry())
        ) revert InvalidEquipmentUse();
    }

    function registerUtilityPolicy(
        bytes32 typeId,
        bytes32 version,
        uint256 water,
        uint256 electricity
    ) external {
        if (
            msg.sender != administrator || typeId == bytes32(0) || version == bytes32(0) || water == 0
                || electricity == 0 || _utilityPolicies[typeId].exists
        ) revert InvalidEquipmentUse();
        equipment.equipmentType(typeId);
        _utilityPolicies[typeId] = UtilityPolicy(version, water, electricity, true);
        emit UtilityPolicyRegistered(typeId, version, water, electricity);
    }

    function utilityPolicy(
        bytes32 typeId
    ) external view returns (UtilityPolicy memory p) {
        p = _utilityPolicies[typeId];
        if (!p.exists) revert InvalidEquipmentUse();
    }

    function applyEnvironment(
        uint64 plant,
        bytes32 itemId,
        CultivationEngine.EnvironmentSnapshot calldata base
    ) external r04Unrestricted(EmergencyDomains.MANUFACTURING) {
        PlantRegistry.PlantRecord memory p = plants.getPlant(plant);
        EquipmentRegistry.Equipment memory item = equipment.equipment(itemId);
        if (
            p.grower != msg.sender || item.owner != msg.sender || item.parcelId != p.landParcelId
                || equipment.land().effectiveOperator(p.landParcelId) != msg.sender || equipment.disabled(itemId)
                || equipment.retired(itemId)
        ) revert InvalidEquipmentUse();
        UtilityPolicy memory costs = _utilityPolicies[item.typeId];
        if (!costs.exists) revert InvalidEquipmentUse();
        (InventoryRegistry.Unit waterUnit, bool waterActive, bool waterExists,) = inventory.resources(WATER_RESOURCE);
        (InventoryRegistry.Unit powerUnit, bool powerActive, bool powerExists,) = inventory.resources(POWER_RESOURCE);
        if (
            !waterExists || !waterActive || waterUnit != InventoryRegistry.Unit.CAPACITY || !powerExists || !powerActive
                || powerUnit != InventoryRegistry.Unit.CAPACITY
        ) revert InvalidEquipmentUse();
        uint256 nonce = ++plantOperationNonce[plant];
        bytes32 operation = keccak256(
            abi.encode("HC.UTILITIES.ENVIRONMENT.V1", block.chainid, address(this), plant, itemId, msg.sender, nonce)
        );
        inventory.reserveFor(keccak256(abi.encode(operation, "WATER.RESERVE")), WATER_RESOURCE, msg.sender, costs.water);
        inventory.reserveFor(
            keccak256(abi.encode(operation, "POWER.RESERVE")), POWER_RESOURCE, msg.sender, costs.electricity
        );
        inventory.consumeReservedFor(
            keccak256(abi.encode(operation, "WATER.CONSUME")), WATER_RESOURCE, msg.sender, costs.water
        );
        inventory.consumeReservedFor(
            keccak256(abi.encode(operation, "POWER.CONSUME")), POWER_RESOURCE, msg.sender, costs.electricity
        );
        lifecycle.recordUse(itemId);
        int256[6] memory delta = equipment.activeItemEffects(itemId);
        uint16[6] memory input = [base.temperature, base.humidity, base.light, base.water, base.nutrients, base.airflow];
        for (uint256 i; i < 6; i++) {
            int256 n = int256(uint256(input[i])) + (equipment.disabled(itemId) ? int256(0) : delta[i]);
            if (n < 0 || n > int256(uint256(type(uint16).max))) revert InvalidEquipmentUse();
            input[i] = uint16(uint256(n));
        }
        cultivation.updateEnvironment(
            plant, CultivationEngine.EnvironmentSnapshot(input[0], input[1], input[2], input[3], input[4], input[5])
        );
        emit UtilitiesConsumed(plant, itemId, msg.sender, costs.water, costs.electricity);
    }
}
