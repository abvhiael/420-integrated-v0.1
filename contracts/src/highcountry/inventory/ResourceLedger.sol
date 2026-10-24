// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { HCZeroAddress, HCInvalidId, HCInvalidState } from "../errors/HighCountryErrors.sol";

/// @notice R04.1 canonical balance book. Only its immutable InventoryRegistry may post movements.
/// @dev All quantities are integral units of the registered resource type; no native currency custody.
contract ResourceLedger {
    struct Balance {
        uint256 available;
        uint256 reserved;
        uint256 consumed;
    }
    address public immutable inventoryRegistry;
    mapping(bytes32 => mapping(address => Balance)) private _balances;
    mapping(bytes32 => uint256) public issued;
    mapping(bytes32 => uint256) public availableTotal;
    mapping(bytes32 => uint256) public reservedTotal;
    mapping(bytes32 => uint256) public consumed;
    mapping(bytes32 => bool) public applied;

    struct Reservation {
        bytes32 resource;
        address owner;
        uint256 remaining;
        bool exists;
    }
    mapping(bytes32 => Reservation) public reservations;
    mapping(bytes32 => mapping(address => uint256)) public lockedReserved;

    event Movement(
        bytes32 indexed operationId,
        bytes32 indexed resourceId,
        address indexed owner,
        address counterparty,
        uint8 kind,
        uint256 amount
    );

    modifier onlyInventory() {
        if (msg.sender != inventoryRegistry) revert HCInvalidState();
        _;
    }

    constructor(
        address inventoryRegistry_
    ) {
        if (inventoryRegistry_ == address(0)) revert HCZeroAddress();
        inventoryRegistry = inventoryRegistry_;
    }

    function balance(
        bytes32 id,
        address owner
    ) external view returns (Balance memory) {
        return _balances[id][owner];
    }

    /// @notice Canonical aggregate proof for a typed resource, independent of owner enumeration.
    function reconciles(
        bytes32 id
    ) external view returns (bool) {
        return issued[id] >= consumed[id] && issued[id] - consumed[id] == availableTotal[id] + reservedTotal[id];
    }

    function _once(
        bytes32 op,
        bytes32 id,
        uint256 amount
    ) private {
        if (op == bytes32(0) || id == bytes32(0) || amount == 0) revert HCInvalidId();
        if (applied[op]) revert HCInvalidState();
        applied[op] = true;
    }

    function acquire(
        bytes32 op,
        bytes32 id,
        address owner,
        uint256 amount
    ) external onlyInventory {
        _once(op, id, amount);
        if (owner == address(0)) revert HCZeroAddress();
        _balances[id][owner].available += amount;
        availableTotal[id] += amount;
        issued[id] += amount;
        emit Movement(op, id, owner, address(0), 0, amount);
    }

    function reserve(
        bytes32 op,
        bytes32 id,
        address owner,
        uint256 amount
    ) external onlyInventory {
        _once(op, id, amount);
        Balance storage b = _balances[id][owner];
        if (b.available < amount) revert HCInvalidState();
        b.available -= amount;
        b.reserved += amount;
        availableTotal[id] -= amount;
        reservedTotal[id] += amount;
        emit Movement(op, id, owner, address(0), 1, amount);
    }

    function release(
        bytes32 op,
        bytes32 id,
        address owner,
        uint256 amount
    ) external onlyInventory {
        _once(op, id, amount);
        Balance storage b = _balances[id][owner];
        if (b.reserved < amount || b.reserved - lockedReserved[id][owner] < amount) revert HCInvalidState();
        b.reserved -= amount;
        b.available += amount;
        reservedTotal[id] -= amount;
        availableTotal[id] += amount;
        emit Movement(op, id, owner, address(0), 2, amount);
    }

    function consume(
        bytes32 op,
        bytes32 id,
        address owner,
        uint256 amount,
        bool fromReserve
    ) external onlyInventory {
        _once(op, id, amount);
        Balance storage b = _balances[id][owner];
        if (fromReserve) {
            if (b.reserved < amount || b.reserved - lockedReserved[id][owner] < amount) revert HCInvalidState();
            b.reserved -= amount;
        } else {
            if (b.available < amount) revert HCInvalidState();
            b.available -= amount;
        }
        if (fromReserve) reservedTotal[id] -= amount;
        else availableTotal[id] -= amount;
        b.consumed += amount;
        consumed[id] += amount;
        emit Movement(op, id, owner, address(0), 3, amount);
    }

    /// @notice Atomic handoff of existing reserved stock; never issues or burns units.
    function transferReserved(
        bytes32 op,
        bytes32 id,
        address from,
        address to,
        uint256 amount
    ) external onlyInventory {
        _once(op, id, amount);
        if (from == address(0) || to == address(0) || from == to) revert HCInvalidState();
        Balance storage source = _balances[id][from];
        if (source.reserved < amount || source.reserved - lockedReserved[id][from] < amount) {
            revert HCInvalidState();
        }
        source.reserved -= amount;
        _balances[id][to].available += amount;
        reservedTotal[id] -= amount;
        availableTotal[id] += amount;
        emit Movement(op, id, from, to, 5, amount);
    }

    /// @notice Reserve stock for a single immutable operation; unrelated operations cannot draw it.
    function reserveTagged(
        bytes32 op,
        bytes32 id,
        address owner,
        uint256 amount
    ) external onlyInventory {
        _once(op, id, amount);
        if (owner == address(0) || reservations[op].exists) revert HCInvalidState();
        Balance storage b = _balances[id][owner];
        if (b.available < amount) revert HCInvalidState();
        b.available -= amount;
        b.reserved += amount;
        availableTotal[id] -= amount;
        reservedTotal[id] += amount;
        lockedReserved[id][owner] += amount;
        reservations[op] = Reservation(id, owner, amount, true);
        emit Movement(op, id, owner, address(0), 1, amount);
    }

    /// @dev Consume only the specified reservation, never a different workflow's stock.
    function consumeTagged(
        bytes32 op,
        bytes32 reserveOp,
        bytes32 id,
        address owner,
        uint256 amount
    ) external onlyInventory {
        _once(op, id, amount);
        _debitTag(reserveOp, id, owner, amount);
        Balance storage b = _balances[id][owner];
        b.reserved -= amount;
        b.consumed += amount;
        lockedReserved[id][owner] -= amount;
        reservedTotal[id] -= amount;
        consumed[id] += amount;
        emit Movement(op, id, owner, address(0), 3, amount);
    }

    function releaseTagged(
        bytes32 op,
        bytes32 reserveOp,
        bytes32 id,
        address owner,
        uint256 amount
    ) external onlyInventory {
        _once(op, id, amount);
        _debitTag(reserveOp, id, owner, amount);
        Balance storage b = _balances[id][owner];
        b.reserved -= amount;
        b.available += amount;
        lockedReserved[id][owner] -= amount;
        reservedTotal[id] -= amount;
        availableTotal[id] += amount;
        emit Movement(op, id, owner, address(0), 2, amount);
    }

    function transferTagged(
        bytes32 op,
        bytes32 reserveOp,
        bytes32 id,
        address from,
        address to,
        uint256 amount
    ) external onlyInventory {
        _once(op, id, amount);
        if (to == address(0) || from == to) revert HCInvalidState();
        _debitTag(reserveOp, id, from, amount);
        _balances[id][from].reserved -= amount;
        _balances[id][to].available += amount;
        lockedReserved[id][from] -= amount;
        reservedTotal[id] -= amount;
        availableTotal[id] += amount;
        emit Movement(op, id, from, to, 5, amount);
    }

    function _debitTag(
        bytes32 reserveOp,
        bytes32 id,
        address owner,
        uint256 amount
    ) private {
        Reservation storage r = reservations[reserveOp];
        if (!r.exists || r.resource != id || r.owner != owner || r.remaining < amount) revert HCInvalidState();
        r.remaining -= amount;
    }

    function transferAvailable(
        bytes32 op,
        bytes32 id,
        address from,
        address to,
        uint256 amount
    ) external onlyInventory {
        _once(op, id, amount);
        if (from == address(0) || to == address(0) || from == to) revert HCInvalidState();
        Balance storage source = _balances[id][from];
        if (source.available < amount) revert HCInvalidState();
        source.available -= amount;
        _balances[id][to].available += amount;
        emit Movement(op, id, from, to, 4, amount);
    }
}
