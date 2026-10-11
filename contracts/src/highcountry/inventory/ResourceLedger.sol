// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { HCZeroAddress, HCInvalidId, HCInvalidState } from "../errors/HighCountryErrors.sol";

/// @notice R04.1 canonical balance book. Only its immutable InventoryRegistry may post movements.
/// @dev All quantities are integral units of the registered resource type; no native currency custody.
contract ResourceLedger {
    struct Balance { uint256 available; uint256 reserved; uint256 consumed; }
    address public immutable inventoryRegistry;
    mapping(bytes32 => mapping(address => Balance)) private _balances;
    mapping(bytes32 => uint256) public issued;
    mapping(bytes32 => uint256) public consumed;
    mapping(bytes32 => bool) public applied;

    event Movement(bytes32 indexed operationId, bytes32 indexed resourceId, address indexed owner, address counterparty, uint8 kind, uint256 amount);

    modifier onlyInventory() {
        if (msg.sender != inventoryRegistry) revert HCInvalidState();
        _;
    }

    constructor(address inventoryRegistry_) {
        if (inventoryRegistry_ == address(0)) revert HCZeroAddress();
        inventoryRegistry = inventoryRegistry_;
    }

    function balance(bytes32 id, address owner) external view returns (Balance memory) {
        return _balances[id][owner];
    }

    function _once(bytes32 op, bytes32 id, uint256 amount) private {
        if (op == bytes32(0) || id == bytes32(0) || amount == 0) revert HCInvalidId();
        if (applied[op]) revert HCInvalidState();
        applied[op] = true;
    }

    function acquire(bytes32 op, bytes32 id, address owner, uint256 amount) external onlyInventory {
        _once(op, id, amount);
        if (owner == address(0)) revert HCZeroAddress();
        _balances[id][owner].available += amount;
        issued[id] += amount;
        emit Movement(op, id, owner, address(0), 0, amount);
    }

    function reserve(bytes32 op, bytes32 id, address owner, uint256 amount) external onlyInventory {
        _once(op, id, amount);
        Balance storage b = _balances[id][owner];
        if (b.available < amount) revert HCInvalidState();
        b.available -= amount;
        b.reserved += amount;
        emit Movement(op, id, owner, address(0), 1, amount);
    }

    function release(bytes32 op, bytes32 id, address owner, uint256 amount) external onlyInventory {
        _once(op, id, amount);
        Balance storage b = _balances[id][owner];
        if (b.reserved < amount) revert HCInvalidState();
        b.reserved -= amount;
        b.available += amount;
        emit Movement(op, id, owner, address(0), 2, amount);
    }

    function consume(bytes32 op, bytes32 id, address owner, uint256 amount, bool fromReserve) external onlyInventory {
        _once(op, id, amount);
        Balance storage b = _balances[id][owner];
        if (fromReserve) {
            if (b.reserved < amount) revert HCInvalidState();
            b.reserved -= amount;
        } else {
            if (b.available < amount) revert HCInvalidState();
            b.available -= amount;
        }
        b.consumed += amount;
        consumed[id] += amount;
        emit Movement(op, id, owner, address(0), 3, amount);
    }

    function transferAvailable(bytes32 op, bytes32 id, address from, address to, uint256 amount) external onlyInventory {
        _once(op, id, amount);
        if (from == address(0) || to == address(0) || from == to) revert HCInvalidState();
        Balance storage source = _balances[id][from];
        if (source.available < amount) revert HCInvalidState();
        source.available -= amount;
        _balances[id][to].available += amount;
        emit Movement(op, id, from, to, 4, amount);
    }
}
