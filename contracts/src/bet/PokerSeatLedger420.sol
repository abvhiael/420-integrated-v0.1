// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./PokerTableRegistry420.sol";
import "./BetIds420.sol";

interface IPokerToken420 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @notice Cash-game seating and actual escrowed-chip ledger. Does not authorize hands.
/// @dev Separate from LP bankroll. Every chip has a corresponding ERC20 asset held here.
///      Unsettled hand balances cannot be withdrawn; no hand engine is authorized in 5A.3.
contract PokerSeatLedger420 {
    struct Seat { address player; uint256 chips; bool sittingOut; uint64 epoch; }
    PokerTableRegistry420 public immutable tables;
    BetAuthorization420 public immutable authorization;
    mapping(bytes32 => mapping(uint8 => Seat)) private seats;
    mapping(bytes32 => mapping(address => uint8)) public playerSeatPlusOne;
    mapping(bytes32 => uint256) public totalChips;
    mapping(bytes32 => uint64) public seatingEpoch;
    mapping(bytes32 => uint256) public reservedInHand;
    uint256 private _entered;

    error ZeroAddress(); error Unauthorized(); error NotOpen(); error InvalidSeat();
    error Occupied(); error AlreadySeated(); error NotSeated(); error InvalidAmount();
    error BuyInLimit(); error Locked(); error TransferFailed(); error TokenDelta();
    error Reentrancy(); error EmergencyHalt();

    event Seated(bytes32 indexed tableId, uint8 indexed seat, address indexed player, uint256 chips, uint64 epoch);
    event TopUp(bytes32 indexed tableId, uint8 indexed seat, uint256 amount, uint256 chips);
    event SitOut(bytes32 indexed tableId, uint8 indexed seat, bool sittingOut);
    event Left(bytes32 indexed tableId, uint8 indexed seat, address indexed player, uint256 returned);

    constructor(address tables_) {
        if (tables_ == address(0)) revert ZeroAddress();
        tables = PokerTableRegistry420(tables_);
        authorization = tables.authorization();
    }
    modifier nonReentrant() {
        if (_entered != 0) revert Reentrancy();
        _entered = 1;
        _;
        _entered = 0;
    }

    function seatOf(bytes32 id, uint8 seat) external view returns (Seat memory) { return seats[id][seat]; }

    function buyIn(bytes32 id, uint8 seat, uint256 amount) external nonReentrant {
        PokerTableRegistry420.Table memory t = _openTable(id);
        if (seat >= t.config.seats) revert InvalidSeat();
        if (seats[id][seat].player != address(0)) revert Occupied();
        if (playerSeatPlusOne[id][msg.sender] != 0) revert AlreadySeated();
        if (amount < t.config.minBuyIn || amount > t.config.maxBuyIn) revert BuyInLimit();
        _authorize(id, BetIds420.ACTION_POKER_BUY_IN, amount);
        _deposit(t.config.asset, amount);
        uint64 epoch = ++seatingEpoch[id];
        seats[id][seat] = Seat(msg.sender, amount, false, epoch);
        playerSeatPlusOne[id][msg.sender] = seat + 1;
        totalChips[id] += amount;
        emit Seated(id, seat, msg.sender, amount, epoch);
    }

    function topUp(bytes32 id, uint256 amount) external nonReentrant {
        PokerTableRegistry420.Table memory t = _openTable(id);
        if (reservedInHand[id] != 0) revert Locked();
        uint8 plusOne = playerSeatPlusOne[id][msg.sender];
        if (plusOne == 0) revert NotSeated();
        Seat storage s = seats[id][plusOne - 1];
        if (amount == 0 || s.chips + amount > t.config.maxBuyIn) revert BuyInLimit();
        _authorize(id, BetIds420.ACTION_POKER_TOP_UP, amount);
        _deposit(t.config.asset, amount);
        s.chips += amount;
        totalChips[id] += amount;
        emit TopUp(id, plusOne - 1, amount, s.chips);
    }

    function sitOut(bytes32 id, bool value) external {
        _table(id);
        uint8 plusOne = playerSeatPlusOne[id][msg.sender];
        if (plusOne == 0) revert NotSeated();
        if (reservedInHand[id] != 0) revert Locked();
        _authorize(id, BetIds420.ACTION_POKER_SIT_OUT, 0);
        seats[id][plusOne - 1].sittingOut = value;
        emit SitOut(id, plusOne - 1, value);
    }

    /// @notice Safe cashout remains available when table is paused/closed.
    function leave(bytes32 id) external nonReentrant {
        PokerTableRegistry420.Table memory t = _table(id);
        uint8 plusOne = playerSeatPlusOne[id][msg.sender];
        if (plusOne == 0) revert NotSeated();
        if (reservedInHand[id] != 0) revert Locked();
        Seat storage s = seats[id][plusOne - 1];
        uint256 amount = s.chips;
        _authorize(id, BetIds420.ACTION_POKER_LEAVE, 0);
        _authorize(id, BetIds420.ACTION_POKER_WITHDRAW, amount);
        delete seats[id][plusOne - 1];
        delete playerSeatPlusOne[id][msg.sender];
        totalChips[id] -= amount;
        _withdraw(t.config.asset, msg.sender, amount);
        emit Left(id, plusOne - 1, msg.sender, amount);
    }

    function _table(bytes32 id) private view returns (PokerTableRegistry420.Table memory) {
        return tables.getTable(id);
    }
    function _openTable(bytes32 id) private view returns (PokerTableRegistry420.Table memory t) {
        t = _table(id);
        if (t.status != PokerTableRegistry420.Status.OPEN) revert NotOpen();
        if (!tables.operators().isActive(t.config.operatorId)) revert NotOpen();
        if (tables.emergency().isHalted(BetTypes420.EmergencyDomain.POKER_NEW_TABLES,t.config.gameVersionId))
            revert EmergencyHalt();
        if (reservedInHand[id] != 0) revert Locked();
    }
    function _authorize(bytes32 id, bytes32 action, uint256 amount) private view {
        if (!authorization.isAuthorized(msg.sender, action, authorization.scopeForTable(id), amount))
            revert Unauthorized();
    }
    function _deposit(address asset, uint256 amount) private {
        IPokerToken420 token = IPokerToken420(asset);
        uint256 beforeBalance = token.balanceOf(address(this));
        if (!token.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        uint256 afterBalance = token.balanceOf(address(this));
        if (afterBalance < beforeBalance || afterBalance - beforeBalance != amount) revert TokenDelta();
    }
    function _withdraw(address asset, address player, uint256 amount) private {
        IPokerToken420 token = IPokerToken420(asset);
        uint256 beforeVault = token.balanceOf(address(this));
        uint256 beforePlayer = token.balanceOf(player);
        if (!token.transfer(player, amount)) revert TransferFailed();
        uint256 afterVault = token.balanceOf(address(this));
        uint256 afterPlayer = token.balanceOf(player);
        if (beforeVault < afterVault || beforeVault - afterVault != amount
            || afterPlayer < beforePlayer || afterPlayer - beforePlayer != amount) revert TokenDelta();
    }
}
