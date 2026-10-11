// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { HCInvalidId, HCInvalidState, HCZeroAddress } from "../errors/HighCountryErrors.sol";

interface IEquipmentLandAuthority {
    function effectiveOperator(
        uint64 parcelId
    ) external view returns (address);
    function growCapacityOf(
        uint64 parcelId
    ) external view returns (uint32);
}

/// @notice R04.2 immutable, version-pinned earned equipment with land-authorized placement.
/// @dev Effects are signed changes to HC's six simulation controls, never wallet/entitlement multipliers.
///      Existing CultivationEngine remains authoritative for applied environment snapshots.
contract EquipmentRegistry {
    struct EquipmentType {
        bytes32 catalogueVersion;
        int16[6] effects;
        uint16 slotCost;
        bool exists;
    }

    struct Equipment {
        bytes32 typeId;
        bytes32 earningRef;
        address owner;
        uint64 parcelId;
        bool exists;
    }

    address public immutable administrator;
    IEquipmentLandAuthority public immutable land;
    mapping(address => bool) public issuers;
    mapping(bytes32 => EquipmentType) private _types;
    mapping(bytes32 => Equipment) private _equipment;
    mapping(bytes32 => bool) public usedEarningRef;
    mapping(uint64 => uint256) public occupiedSlots;
    mapping(uint64 => address) public placementOperator;
    mapping(uint64 => int256[6]) private _totals;
    uint256 public issuedCount;
    address public lifecycleController;
    mapping(bytes32 => bool) public disabled;
    mapping(bytes32 => bool) public retired;

    event LifecycleControllerSet(address indexed controller);
    event EquipmentEffectStatus(bytes32 indexed equipmentId, bool disabled);
    event EquipmentRetired(bytes32 indexed equipmentId);

    event TypeRegistered(bytes32 indexed typeId, bytes32 indexed catalogueVersion, uint16 slotCost);
    event IssuerSet(address indexed issuer, bool approved);
    event EquipmentEarned(
        bytes32 indexed equipmentId, bytes32 indexed typeId, address indexed owner, bytes32 earningRef
    );
    event EquipmentPlaced(bytes32 indexed equipmentId, uint64 indexed parcelId, address indexed owner);
    event EquipmentRemoved(bytes32 indexed equipmentId, uint64 indexed parcelId);

    modifier onlyAdmin() {
        if (msg.sender != administrator) revert HCInvalidState();
        _;
    }

    constructor(
        address land_
    ) {
        if (land_ == address(0) || land_.code.length == 0) revert HCZeroAddress();
        administrator = msg.sender;
        land = IEquipmentLandAuthority(land_);
    }

    function setIssuer(
        address issuer,
        bool approved
    ) external onlyAdmin {
        if (issuer == address(0)) revert HCZeroAddress();
        issuers[issuer] = approved;
        emit IssuerSet(issuer, approved);
    }

    /// @notice Version is immutable per typeId: upgrades require a distinct new typeId.
    function registerType(
        bytes32 typeId,
        bytes32 version,
        uint16 slotCost,
        int16[6] calldata effects
    ) external onlyAdmin {
        if (typeId == bytes32(0) || version == bytes32(0) || slotCost == 0 || _types[typeId].exists) {
            revert HCInvalidState();
        }
        for (uint256 i; i < 6; ++i) {
            if (effects[i] < -10000 || effects[i] > 10000) revert HCInvalidState();
        }
        _types[typeId] = EquipmentType(version, effects, slotCost, true);
        emit TypeRegistered(typeId, version, slotCost);
    }

    function equipmentType(
        bytes32 typeId
    ) external view returns (EquipmentType memory) {
        EquipmentType memory record = _types[typeId];
        if (!record.exists) revert HCInvalidState();
        return record;
    }

    function equipment(
        bytes32 equipmentId
    ) external view returns (Equipment memory) {
        Equipment memory record = _equipment[equipmentId];
        if (!record.exists) revert HCInvalidState();
        return record;
    }

    /// @notice Only authorized gameplay issuer may attest an independently earned item.
    /// @dev A local claim, wallet link or token balance cannot itself issue equipment.
    function issue(
        bytes32 equipmentId,
        bytes32 typeId,
        address owner,
        bytes32 earningRef
    ) external {
        if (
            !issuers[msg.sender] || owner == address(0) || equipmentId == bytes32(0) || earningRef == bytes32(0)
                || !_types[typeId].exists || _equipment[equipmentId].exists || usedEarningRef[earningRef]
        ) {
            revert HCInvalidState();
        }
        usedEarningRef[earningRef] = true;
        _equipment[equipmentId] = Equipment(typeId, earningRef, owner, 0, true);
        ++issuedCount;
        emit EquipmentEarned(equipmentId, typeId, owner, earningRef);
    }

    /// @notice Lifecycle authority is bound once, permanently, to prevent arbitrary status toggles.
    function bindLifecycleController(address controller) external onlyAdmin {
        if (lifecycleController != address(0) || controller == address(0) || controller.code.length == 0) {
            revert HCInvalidState();
        }
        lifecycleController = controller;
        emit LifecycleControllerSet(controller);
    }

    function setLifecycleDisabled(bytes32 equipmentId, bool isDisabled) external {
        if (msg.sender != lifecycleController || retired[equipmentId]) revert HCInvalidState();
        Equipment storage item = _equipment[equipmentId];
        if (!item.exists || disabled[equipmentId] == isDisabled) revert HCInvalidState();
        if (item.parcelId != 0) {
            int256 direction = isDisabled ? int256(-1) : int256(1);
            for (uint256 i; i < 6; ++i) {
                _totals[item.parcelId][i] += direction * _types[item.typeId].effects[i];
            }
        }
        disabled[equipmentId] = isDisabled;
        emit EquipmentEffectStatus(equipmentId, isDisabled);
    }

    function retireEquipment(bytes32 equipmentId) external {
        if (msg.sender != lifecycleController || retired[equipmentId]) revert HCInvalidState();
        Equipment storage item = _equipment[equipmentId];
        if (!item.exists || !disabled[equipmentId]) revert HCInvalidState();
        if (item.parcelId != 0) {
            uint64 parcelId = item.parcelId;
            item.parcelId = 0;
            occupiedSlots[parcelId] -= _types[item.typeId].slotCost;
            if (occupiedSlots[parcelId] == 0) placementOperator[parcelId] = address(0);
        }
        retired[equipmentId] = true;
        emit EquipmentRetired(equipmentId);
    }

    /// @notice Slots are bounded by authoritative parcel capacity and current operator.
    function place(
        bytes32 equipmentId,
        uint64 parcelId
    ) external {
        Equipment storage item = _equipment[equipmentId];
        if (!item.exists || retired[equipmentId] || disabled[equipmentId] || item.owner != msg.sender || item.parcelId != 0 || parcelId == 0) {
            revert HCInvalidState();
        }
        if (land.effectiveOperator(parcelId) != msg.sender) revert HCInvalidState();
        EquipmentType storage kind = _types[item.typeId];
        if (occupiedSlots[parcelId] != 0 && placementOperator[parcelId] != msg.sender) revert HCInvalidState();
        if (occupiedSlots[parcelId] + kind.slotCost > land.growCapacityOf(parcelId)) revert HCInvalidState();
        placementOperator[parcelId] = msg.sender;
        item.parcelId = parcelId;
        occupiedSlots[parcelId] += kind.slotCost;
        for (uint256 i; i < 6; ++i) {
            _totals[parcelId][i] += kind.effects[i];
        }
        emit EquipmentPlaced(equipmentId, parcelId, msg.sender);
    }

    function remove(
        bytes32 equipmentId
    ) external {
        Equipment storage item = _equipment[equipmentId];
        if (!item.exists || item.owner != msg.sender || item.parcelId == 0) revert HCInvalidState();
        uint64 parcelId = item.parcelId;
        EquipmentType storage kind = _types[item.typeId];
        item.parcelId = 0;
        occupiedSlots[parcelId] -= kind.slotCost;
        if (occupiedSlots[parcelId] == 0) placementOperator[parcelId] = address(0);
        for (uint256 i; i < 6; ++i) {
            if (!disabled[equipmentId]) _totals[parcelId][i] -= kind.effects[i];
        }
        emit EquipmentRemoved(equipmentId, parcelId);
    }

    /// @notice Aggregated effects are inactive after land operator changes.
    /// @dev Do not treat this view as permission to skip CultivationEngine source/ruleset checks.
    function effectiveEffects(
        uint64 parcelId,
        address operator
    ) external view returns (int256[6] memory values) {
        if (operator == address(0) || land.effectiveOperator(parcelId) != operator) revert HCInvalidState();
        if (occupiedSlots[parcelId] != 0 && placementOperator[parcelId] != operator) revert HCInvalidState();
        return _totals[parcelId];
    }
}
