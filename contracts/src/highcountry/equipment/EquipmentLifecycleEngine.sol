// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { EquipmentRegistry } from "./EquipmentRegistry.sol";
import { InventoryRegistry } from "../inventory/InventoryRegistry.sol";
import { HCInvalidState, HCZeroAddress } from "../errors/HighCountryErrors.sol";

/// @notice R04.4 item-specific durability, breakage, recovery, recycling and final retirement.
/// @dev R04.2 equipment identity/placement is canonical; R04.1 ledger conserves all material costs.
contract EquipmentLifecycleEngine {
    enum State { NONE, FUNCTIONAL, DEGRADED, BROKEN, RETIRED, RECYCLED }
    struct Policy {
        bytes32 version;
        uint32 maximum;
        uint32 degradeBelow;
        uint32 useCost;
        bytes32 repairResource;
        uint256 repairCost;
        uint32 repairRestore;
        bytes32 recycleResource;
        uint256 recycleOutput;
        bool exists;
    }
    struct Condition {
        uint32 durability;
        State state;
        uint64 usages;
    }

    EquipmentRegistry public immutable equipment;
    InventoryRegistry public immutable inventory;
    address public immutable administrator;
    mapping(bytes32 => Policy) private _policies;
    mapping(bytes32 => Condition) private _condition;
    mapping(address => bool) public useVerifiers;
    bool private entered;

    event PolicyRegistered(bytes32 indexed typeId, bytes32 indexed version);
    event VerifierSet(address indexed verifier, bool approved);
    event ConditionUpdated(bytes32 indexed equipmentId, State state, uint32 durability);
    event EquipmentRecycled(bytes32 indexed equipmentId, address indexed owner, uint256 recovered);

    modifier guarded() {
        if (entered) revert HCInvalidState();
        entered = true;
        _;
        entered = false;
    }
    modifier onlyAdmin() {
        if (msg.sender != administrator) revert HCInvalidState();
        _;
    }
    constructor(address equipment_, address inventory_) {
        if (equipment_ == address(0) || inventory_ == address(0)
            || equipment_.code.length == 0 || inventory_.code.length == 0) revert HCZeroAddress();
        equipment = EquipmentRegistry(equipment_);
        inventory = InventoryRegistry(inventory_);
        administrator = msg.sender;
    }

    /// @notice Immutable policy for an earned equipment type; cannot rewrite existing item costs.
    function registerPolicy(
        bytes32 typeId, bytes32 version, uint32 maximum, uint32 degradeBelow, uint32 useCost,
        bytes32 repairResource, uint256 repairCost, uint32 repairRestore,
        bytes32 recycleResource, uint256 recycleOutput
    ) external onlyAdmin {
        if (typeId == bytes32(0) || version == bytes32(0) || _policies[typeId].exists
            || maximum == 0 || degradeBelow == 0 || degradeBelow >= maximum
            || useCost == 0 || useCost > maximum || repairRestore == 0 || repairRestore > maximum
            || repairResource == bytes32(0) || repairCost == 0
            || recycleResource == bytes32(0) || recycleOutput == 0) revert HCInvalidState();
        equipment.equipmentType(typeId);
        _policies[typeId] = Policy(version,maximum,degradeBelow,useCost,repairResource,repairCost,repairRestore,
            recycleResource,recycleOutput,true);
        emit PolicyRegistered(typeId,version);
    }

    function setUseVerifier(address verifier, bool approved) external onlyAdmin {
        if (verifier == address(0)) revert HCZeroAddress();
        useVerifiers[verifier] = approved;
        emit VerifierSet(verifier,approved);
    }

    function policy(bytes32 typeId) external view returns (Policy memory p) {
        p = _policies[typeId];
        if (!p.exists) revert HCInvalidState();
    }

    function condition(bytes32 id) external view returns (Condition memory c) {
        EquipmentRegistry.Equipment memory item = equipment.equipment(id);
        c = _condition[id];
        if (c.state == State.NONE) {
            if (!_policies[item.typeId].exists) revert HCInvalidState();
            c = Condition(_policies[item.typeId].maximum,State.FUNCTIONAL,0);
        }
    }

    function _load(bytes32 id) private returns (EquipmentRegistry.Equipment memory item, Condition storage c, Policy storage p) {
        item = equipment.equipment(id);
        p = _policies[item.typeId];
        if (!p.exists) revert HCInvalidState();
        c = _condition[id];
        if (c.state == State.NONE) {
            c.durability = p.maximum;
            c.state = State.FUNCTIONAL;
        }
    }

    /// @notice Only a trusted simulation verifier can prove a completed equipment use.
    function recordUse(bytes32 id) external guarded {
        if (!useVerifiers[msg.sender]) revert HCInvalidState();
        (EquipmentRegistry.Equipment memory item, Condition storage c, Policy storage p) = _load(id);
        if (c.state != State.FUNCTIONAL && c.state != State.DEGRADED) revert HCInvalidState();
        if (item.parcelId == 0 || equipment.retired(id)) revert HCInvalidState();
        if (equipment.land().effectiveOperator(item.parcelId) != item.owner) revert HCInvalidState();
        c.durability = c.durability > p.useCost ? c.durability - p.useCost : 0;
        ++c.usages;
        State next = c.durability == 0 ? State.BROKEN :
            c.durability < p.degradeBelow ? State.DEGRADED : State.FUNCTIONAL;
        if (next == State.BROKEN) equipment.setLifecycleDisabled(id,true);
        c.state = next;
        emit ConditionUpdated(id,next,c.durability);
    }

    function repair(bytes32 id) external guarded {
        (EquipmentRegistry.Equipment memory item, Condition storage c, Policy storage p) = _load(id);
        if (item.owner != msg.sender || c.state == State.RETIRED || c.state == State.RECYCLED
            || c.durability == p.maximum) revert HCInvalidState();
        bytes32 op = keccak256(abi.encode("HC.EQUIPMENT.REPAIR.V1", block.chainid,address(this),id,c.usages,c.durability));
        inventory.reserveFor(op,p.repairResource,msg.sender,p.repairCost);
        inventory.consumeReservedFor(keccak256(abi.encode(op,"CONSUME")),p.repairResource,msg.sender,p.repairCost);
        c.durability = uint32(uint256(c.durability) + p.repairRestore > p.maximum
            ? p.maximum : uint256(c.durability) + p.repairRestore);
        State next = c.durability < p.degradeBelow ? State.DEGRADED : State.FUNCTIONAL;
        if (c.state == State.BROKEN) equipment.setLifecycleDisabled(id,false);
        c.state = next;
        emit ConditionUpdated(id,next,c.durability);
    }

    function retire(bytes32 id) external guarded {
        (EquipmentRegistry.Equipment memory item, Condition storage c,) = _load(id);
        if (item.owner != msg.sender || c.state == State.RETIRED || c.state == State.RECYCLED) revert HCInvalidState();
        if (c.state != State.BROKEN) equipment.setLifecycleDisabled(id,true);
        equipment.retireEquipment(id);
        c.state = State.RETIRED;
        emit ConditionUpdated(id,State.RETIRED,c.durability);
    }

    /// @notice Recycling is a one-time recovery and may never create a second result.
    function recycle(bytes32 id) external guarded {
        (EquipmentRegistry.Equipment memory item, Condition storage c, Policy storage p) = _load(id);
        if (item.owner != msg.sender || c.state != State.RETIRED) revert HCInvalidState();
        c.state = State.RECYCLED;
        bytes32 op = keccak256(abi.encode("HC.EQUIPMENT.RECYCLE.V1",block.chainid,address(this),id));
        inventory.acquire(op,p.recycleResource,msg.sender,p.recycleOutput);
        emit EquipmentRecycled(id,msg.sender,p.recycleOutput);
        emit ConditionUpdated(id,State.RECYCLED,c.durability);
    }
}
