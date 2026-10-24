// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import { R04EmergencyConsumer } from "../security/R04EmergencyConsumer.sol";
import { EmergencyDomains } from "../constants/EmergencyDomains.sol";
import { ManufacturingEngine } from "../manufacturing/ManufacturingEngine.sol";
import { EquipmentRegistry } from "./EquipmentRegistry.sol";
import { EquipmentClassCatalogueV1 } from "./EquipmentClassCatalogueV1.sol";
import { InventoryRegistry } from "../inventory/InventoryRegistry.sol";

/// @notice Converts one actual completed manufacturing output into one catalogue-pinned earned item.
/// @dev Requires independent equipment issuer permission and current owner inventory consent. Holds no custody.
contract ManufacturedEquipmentIssuer is R04EmergencyConsumer {
    error InvalidManufacturedEquipment();

    struct Rule {
        bytes32 typeId;
        bytes32 resource;
        uint256 quantity;
    }
    ManufacturingEngine public immutable manufacturing;
    EquipmentRegistry public immutable equipment;
    EquipmentClassCatalogueV1 public immutable catalogue;
    InventoryRegistry public immutable inventory;
    address public immutable administrator;
    mapping(bytes32 => Rule) public rules;
    mapping(bytes32 => bool) public issuedJob;
    event RecipeBound(bytes32 indexed recipe, bytes32 indexed typeId, bytes32 resource, uint256 quantity);
    event ManufacturedItemIssued(bytes32 indexed job, bytes32 indexed item, address indexed owner);

    constructor(
        address root,
        address manufacturing_,
        address equipment_
    ) R04EmergencyConsumer(root) {
        if (manufacturing_.code.length == 0 || equipment_.code.length == 0) revert InvalidManufacturedEquipment();
        manufacturing = ManufacturingEngine(manufacturing_);
        equipment = EquipmentRegistry(equipment_);
        catalogue = new EquipmentClassCatalogueV1();
        if (manufacturing.r04AuthorizationRoot() != root || equipment.r04AuthorizationRoot() != root) {
            revert InvalidManufacturedEquipment();
        }
        inventory = manufacturing.inventory();
        administrator = msg.sender;
    }

    function bindRecipe(
        bytes32 recipe,
        bytes32 typeId,
        bytes32 resource,
        uint256 quantity
    ) external {
        if (msg.sender != administrator || rules[recipe].typeId != bytes32(0) || quantity == 0) {
            revert InvalidManufacturedEquipment();
        }
        ManufacturingEngine.Recipe memory r = manufacturing.recipe(recipe);
        if (equipment.equipmentType(typeId).catalogueVersion != r.version) revert InvalidManufacturedEquipment();
        if (r.version == catalogue.CATALOGUE_VERSION()) {
            bool validClass;
            for (uint8 category; category < 5; ++category) {
                for (uint8 tier; tier < 2; ++tier) {
                    EquipmentClassCatalogueV1.Definition memory d = catalogue.definition(category, tier);
                    if (d.typeId != typeId) continue;
                    if (
                        r.inputs[0] != d.repairResource || r.inputAmounts[0] != d.craftParts
                            || r.inputs[1] != d.operatingResource || r.inputAmounts[1] != d.craftOperatingInput
                            || r.outputs[0] != d.craftOutput || r.outputAmounts[0] != 1
                            || r.outputs[1] != bytes32(0) || r.outputAmounts[1] != 0
                            || resource != d.craftOutput || quantity != 1
                    ) revert InvalidManufacturedEquipment();
                    validClass = true;
                }
            }
            if (!validClass) revert InvalidManufacturedEquipment();
        }
        bool matchOutput;
        for (uint256 i; i < 2; i++) {
            if (r.outputs[i] == resource && r.outputAmounts[i] == quantity) matchOutput = true;
        }
        if (resource == bytes32(0) || !matchOutput) revert InvalidManufacturedEquipment();
        rules[recipe] = Rule(typeId, resource, quantity);
        emit RecipeBound(recipe, typeId, resource, quantity);
    }

    function issueFromManufacturing(
        bytes32 job
    ) external r04Unrestricted(EmergencyDomains.MANUFACTURING) returns (bytes32 item) {
        ManufacturingEngine.Job memory j = manufacturing.job(job);
        Rule memory r = rules[j.recipeId];
        if (
            j.owner != msg.sender || j.status != ManufacturingEngine.Status.COMPLETED || issuedJob[job]
                || r.typeId == bytes32(0)
        ) revert InvalidManufacturedEquipment();
        issuedJob[job] = true;
        bytes32 earning =
            keccak256(abi.encode("HC.MANUFACTURED.EARNING.V1", block.chainid, address(manufacturing), job));
        item = keccak256(abi.encode("HC.MANUFACTURED.ITEM.V1", block.chainid, address(this), job));
        inventory.reserveFor(keccak256(abi.encode(earning, "RESERVE")), r.resource, j.owner, r.quantity);
        inventory.consumeReservedFor(keccak256(abi.encode(earning, "CONSUME")), r.resource, j.owner, r.quantity);
        equipment.issue(item, r.typeId, j.owner, earning);
        emit ManufacturedItemIssued(job, item, j.owner);
    }
}
