// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { HarvestProductRegistry } from "../harvest/HarvestProductRegistry.sol";
import { ResourceLedger } from "./ResourceLedger.sol";
import { HCZeroAddress, HCInvalidId, HCInvalidState } from "../errors/HighCountryErrors.sol";

/// @notice R04.1 inventory authority: typed lot identity and permissioned posting to ResourceLedger.
/// @dev HarvestProductRegistry remains immutable issuance history; ledger balances are spendable stock.
contract InventoryRegistry {
    enum Unit {
        NONE,
        GRAM,
        COUNT,
        CAPACITY
    }

    struct Resource {
        Unit unit;
        bool active;
        bool exists;
        bool harvestOnly;
    }

    struct Lot {
        bytes32 productId;
        bytes32 resourceId;
        address grower;
        uint256 initialAmount;
        bool exists;
    }

    address public immutable administrator;
    HarvestProductRegistry public immutable harvestProducts;
    ResourceLedger public immutable ledger;
    mapping(address => bool) public issuers;
    mapping(address => mapping(address => bool)) public inventoryOperators;

    event InventoryOperatorUpdated(address indexed owner, address indexed operator, bool approved);
    mapping(bytes32 => Resource) public resources;
    mapping(bytes32 => Lot) private _lots;
    mapping(bytes32 => bool) public importedProduct;

    bytes32 public constant FLOWER_RESOURCE = keccak256("HC.RESOURCE.FLOWER.GRAM.V1");

    event ResourceRegistered(bytes32 indexed id, Unit unit, bool harvestOnly);
    event ResourceActive(bytes32 indexed id, bool active);
    event IssuerUpdated(address indexed issuer, bool allowed);
    event LotImported(bytes32 indexed productId, bytes32 indexed lotId, address indexed grower, uint256 grams);

    modifier onlyAdmin() {
        if (msg.sender != administrator) revert HCInvalidState();
        _;
    }

    constructor(
        address harvestProducts_
    ) {
        if (harvestProducts_ == address(0) || harvestProducts_.code.length == 0) revert HCZeroAddress();
        administrator = msg.sender;
        harvestProducts = HarvestProductRegistry(harvestProducts_);
        ledger = new ResourceLedger(address(this));
        resources[FLOWER_RESOURCE] = Resource(Unit.GRAM, true, true, true);
        emit ResourceRegistered(FLOWER_RESOURCE, Unit.GRAM, true);
    }

    function setIssuer(
        address issuer,
        bool allowed
    ) external onlyAdmin {
        if (issuer == address(0)) revert HCZeroAddress();
        issuers[issuer] = allowed;
        emit IssuerUpdated(issuer, allowed);
    }

    function registerResource(
        bytes32 id,
        Unit unit
    ) external onlyAdmin {
        if (id == bytes32(0) || unit == Unit.NONE || resources[id].exists) revert HCInvalidState();
        resources[id] = Resource(unit, true, true, false);
        emit ResourceRegistered(id, unit, false);
    }

    function setResourceActive(
        bytes32 id,
        bool active
    ) external onlyAdmin {
        if (!resources[id].exists) revert HCInvalidState();
        resources[id].active = active;
        emit ResourceActive(id, active);
    }

    function importHarvest(
        bytes32 productId
    ) external returns (bytes32 lotId) {
        if (productId == bytes32(0) || importedProduct[productId]) revert HCInvalidState();
        HarvestProductRegistry.Product memory p = harvestProducts.getProduct(productId);
        if (!p.registered || p.productId != productId || p.grower == address(0)) revert HCInvalidState();
        // A zero-output harvest has an immutable receipt but must not become a tradable lot.
        if (p.quantityGrams == 0) revert HCInvalidState();
        lotId = keccak256(abi.encode("HC.INVENTORY.LOT.V1", block.chainid, address(this), productId));
        if (_lots[lotId].exists) revert HCInvalidState();
        importedProduct[productId] = true;
        _lots[lotId] = Lot(productId, FLOWER_RESOURCE, p.grower, p.quantityGrams, true);
        ledger.acquire(keccak256(abi.encode("HC.INVENTORY.IMPORT.V1", productId)), lotId, p.grower, p.quantityGrams);
        emit LotImported(productId, lotId, p.grower, p.quantityGrams);
    }

    function lot(
        bytes32 lotId
    ) external view returns (Lot memory) {
        Lot memory l = _lots[lotId];
        if (!l.exists) revert HCInvalidState();
        return l;
    }

    function acquire(
        bytes32 op,
        bytes32 id,
        address owner,
        uint256 amount
    ) external {
        Resource memory r = resources[id];
        if (!issuers[msg.sender] || !r.exists || !r.active || r.harvestOnly) revert HCInvalidState();
        ledger.acquire(op, id, owner, amount);
    }

    /// @notice Explicit opt-in for registered manufacturing modules; never a wallet entitlement.
    function setInventoryOperator(
        address operator,
        bool approved
    ) external {
        if (operator == address(0) || operator == msg.sender) revert HCInvalidState();
        inventoryOperators[msg.sender][operator] = approved;
        emit InventoryOperatorUpdated(msg.sender, operator, approved);
    }

    function reserveFor(
        bytes32 op,
        bytes32 id,
        address owner,
        uint256 amount
    ) external {
        if (!inventoryOperators[owner][msg.sender]) revert HCInvalidState();
        _ensureActive(id);
        ledger.reserve(op, id, owner, amount);
    }

    function releaseFor(
        bytes32 op,
        bytes32 id,
        address owner,
        uint256 amount
    ) external {
        if (!inventoryOperators[owner][msg.sender]) revert HCInvalidState();
        _ensureActive(id);
        ledger.release(op, id, owner, amount);
    }

    function consumeReservedFor(
        bytes32 op,
        bytes32 id,
        address owner,
        uint256 amount
    ) external {
        if (!inventoryOperators[owner][msg.sender]) revert HCInvalidState();
        _ensureActive(id);
        ledger.consume(op, id, owner, amount, true);
    }

    function reserve(
        bytes32 op,
        bytes32 id,
        uint256 amount
    ) external {
        _ensureActive(id);
        ledger.reserve(op, id, msg.sender, amount);
    }

    function release(
        bytes32 op,
        bytes32 id,
        uint256 amount
    ) external {
        _ensureActive(id);
        ledger.release(op, id, msg.sender, amount);
    }

    function consume(
        bytes32 op,
        bytes32 id,
        uint256 amount,
        bool fromReserve
    ) external {
        _ensureActive(id);
        ledger.consume(op, id, msg.sender, amount, fromReserve);
    }

    function transferAvailable(
        bytes32 op,
        bytes32 id,
        address to,
        uint256 amount
    ) external {
        _ensureActive(id);
        ledger.transferAvailable(op, id, msg.sender, to, amount);
    }

    function _ensureActive(
        bytes32 id
    ) private view {
        // Harvest lots are uniquely issued and typed through their canonical provenance record.
        if (_lots[id].exists) return;
        Resource memory r = resources[id];
        if (!r.exists || !r.active || r.harvestOnly) revert HCInvalidState();
    }
}
