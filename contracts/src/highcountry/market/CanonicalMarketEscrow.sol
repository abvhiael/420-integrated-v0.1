// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import {R04EmergencyConsumer} from "../security/R04EmergencyConsumer.sol";
import {EmergencyDomains} from "../constants/EmergencyDomains.sol";

import { InventoryRegistry } from "../inventory/InventoryRegistry.sol";
import { HCInvalidState, HCZeroAddress } from "../errors/HighCountryErrors.sol";

/// @notice R04.8 owner-authorized canonical inventory escrow. No BUDS or native $420 custody.
/// @dev Production market operator MUST prove independently reserved BUDS before a transfer.
contract CanonicalMarketEscrow is R04EmergencyConsumer {
    enum Status {
        None,
        Active,
        Sold,
        Cancelled,
        Expired
    }

    struct Listing {
        address owner;
        bytes32 asset;
        uint256 quantity;
        uint64 expiresAt;
        Status status;
    }

    InventoryRegistry public immutable inventory;
    address public immutable marketOperator;
    mapping(bytes32 => Listing) private _listings;
    event EscrowListed(
        bytes32 indexed listingId, address indexed owner, bytes32 indexed asset, uint256 quantity, uint64 expiresAt
    );
    event EscrowSettled(bytes32 indexed listingId, bytes32 indexed operationId, address indexed buyer);
    event EscrowClosed(bytes32 indexed listingId, Status status);
    event ManualRecoveryRequired(
        bytes32 indexed listingId, address indexed owner, bytes32 indexed asset, uint256 quantity
    );

    constructor(address r04Authorization_, 
        address inventory_,
        address marketOperator_
    ) R04EmergencyConsumer(r04Authorization_) {
        if (inventory_ == address(0) || inventory_.code.length == 0 || marketOperator_ == address(0)) {
            revert HCZeroAddress();
        }
        inventory = InventoryRegistry(inventory_);
        marketOperator = marketOperator_;
    }

    function listing(
        bytes32 id
    ) external view returns (Listing memory) {
        return _listings[id];
    }

    function reserveOperation(
        bytes32 id
    ) public view returns (bytes32) {
        return keccak256(abi.encode("HC.MARKET.RESERVE.V1", block.chainid, address(this), id));
    }

    function releaseOperation(
        bytes32 id
    ) public view returns (bytes32) {
        return keccak256(abi.encode("HC.MARKET.RELEASE.V1", block.chainid, address(this), id));
    }

    function transferOperation(
        bytes32 id,
        address buyer
    ) public view returns (bytes32) {
        return keccak256(abi.encode("HC.MARKET.TRANSFER.V1", block.chainid, address(this), id, buyer));
    }

    /// @notice Seller must grant inventory operator consent to this contract explicitly.
    /// @dev Frozen quantity, owner, asset, expiry. No caller-created listing for another player.
    function list(
        bytes32 id,
        bytes32 asset,
        uint256 quantity,
        uint64 expiresAt
    ) external  r04Unrestricted(EmergencyDomains.MARKET) {
        if (
            id == bytes32(0) || asset == bytes32(0) || quantity == 0 || expiresAt <= block.timestamp
                || _listings[id].status != Status.None
        ) revert HCInvalidState();
        _listings[id] = Listing(msg.sender, asset, quantity, expiresAt, Status.Active);
        inventory.reserveFor(reserveOperation(id), asset, msg.sender, quantity);
        emit EscrowListed(id, msg.sender, asset, quantity, expiresAt);
    }

    /// @notice Called only by designated settlement operator, after durable BUDS reservation.
    /// @dev External inventory call cannot be reentered to settle twice because status changes first.
    function settle(
        bytes32 id,
        address buyer
    ) external r04Unrestricted(EmergencyDomains.MARKET) returns (bytes32 op) {
        Listing storage l = _listings[id];
        if (
            msg.sender != marketOperator || l.status != Status.Active || block.timestamp >= l.expiresAt
                || buyer == address(0) || buyer == l.owner
        ) revert HCInvalidState();
        l.status = Status.Sold;
        op = transferOperation(id, buyer);
        inventory.transferReservedFor(op, l.asset, l.owner, buyer, l.quantity);
        emit EscrowSettled(id, op, buyer);
    }

    function cancel(
        bytes32 id
    ) external {
        Listing storage l = _listings[id];
        if (l.status != Status.Active || msg.sender != l.owner) revert HCInvalidState();
        l.status = Status.Cancelled;
        _releaseOrRequireManualRecovery(id, l);
        emit EscrowClosed(id, Status.Cancelled);
    }

    function expire(
        bytes32 id
    ) external {
        Listing storage l = _listings[id];
        if (l.status != Status.Active || block.timestamp < l.expiresAt) revert HCInvalidState();
        l.status = Status.Expired;
        _releaseOrRequireManualRecovery(id, l);
        emit EscrowClosed(id, Status.Expired);
    }

    /// @dev If consent is revoked, terminate the listing and preserve the owner's

    ///      native InventoryRegistry.release recovery right; never leave a sellable escrow.
    function _releaseOrRequireManualRecovery(
        bytes32 id,
        Listing storage l
    ) private {
        try inventory.releaseFor(releaseOperation(id), l.asset, l.owner, l.quantity) { }
        catch {
            emit ManualRecoveryRequired(id, l.owner, l.asset, l.quantity);
        }
    }
}

