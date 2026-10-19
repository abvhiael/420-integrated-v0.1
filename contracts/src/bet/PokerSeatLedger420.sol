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
    bytes32 public constant ACTION_BIND_SETTLEMENT=keccak256("BET_POKER_BIND_SETTLEMENT.V1");
    mapping(bytes32=>address) public settlementCoordinator;
    mapping(bytes32=>address) public rakeDestination;
    mapping(bytes32=>bytes32) public activeHand;
    mapping(bytes32=>uint16) public lockedMask;
    mapping(bytes32=>uint64) public lockedEpoch;
    mapping(bytes32=>bytes32) public lockedSnapshot;
    mapping(bytes32=>uint256) public lockedTotal;
    mapping(bytes32=>bool) public handConsumed;

    error ZeroAddress(); error Unauthorized(); error NotOpen(); error InvalidSeat();
    error Occupied(); error AlreadySeated(); error NotSeated(); error InvalidAmount();
    error BuyInLimit(); error Locked(); error TransferFailed(); error TokenDelta();
    error Reentrancy(); error EmergencyHalt();
    error SettlementInvalid(); error SettlementUnauthorized(); error SettlementReplay();

    event Seated(bytes32 indexed tableId, uint8 indexed seat, address indexed player, uint256 chips, uint64 epoch);
    event TopUp(bytes32 indexed tableId, uint8 indexed seat, uint256 amount, uint256 chips);
    event SitOut(bytes32 indexed tableId, uint8 indexed seat, bool sittingOut);
    event Left(bytes32 indexed tableId, uint8 indexed seat, address indexed player, uint256 returned);

    event SettlementBound(bytes32 indexed tableId,address coordinator,address rakeRecipient);
    event HandReserved(bytes32 indexed tableId,bytes32 indexed handId,uint256 chips,bytes32 snapshot);
    event HandCancelled(bytes32 indexed tableId,bytes32 indexed handId);
    event HandSettled(bytes32 indexed tableId,bytes32 indexed handId,uint256 rake,uint256 remaining);

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

    /// @notice Governance-authorized, immutable table-local settlement consumer binding.
    /// @dev A table cannot change executors or rake destination after binding.
    function bindSettlement(bytes32 id,address consumer,address rakeRecipient) external nonReentrant {
        _table(id);
        if(consumer==address(0)||consumer.code.length==0||rakeRecipient==address(0))
            revert SettlementInvalid();
        if(settlementCoordinator[id]!=address(0))revert SettlementInvalid();
        if(!authorization.isAuthorized(msg.sender,ACTION_BIND_SETTLEMENT,
            authorization.scopeForTable(id),0))revert SettlementUnauthorized();
        settlementCoordinator[id]=consumer;
        rakeDestination[id]=rakeRecipient;
        emit SettlementBound(id,consumer,rakeRecipient);
    }
    /// @notice Freeze the actual seat balances of a hand; no withdrawal or top-up while locked.
    /// @dev Caller must be pre-bound to table by governance. It MUST separately prove
    ///      that the hand was canonically begun with precisely this seat set/epoch.
    function reserveHand(bytes32 id,bytes32 handId,uint16 mask,uint64 epoch)
        external nonReentrant returns(bytes32 snapshot) {
        if(msg.sender!=settlementCoordinator[id]||handId==bytes32(0)||mask==0)
            revert SettlementUnauthorized();
        if(activeHand[id]!=bytes32(0)||handConsumed[handId])revert Locked();
        PokerTableRegistry420.Table memory t=_openTable(id);
        if(epoch!=seatingEpoch[id] || (uint256(mask)>>t.config.seats)!=0)
            revert SettlementInvalid();
        uint256 sum = 0;
        snapshot=keccak256(abi.encode(
            keccak256("420.BET.POKER.ESCROW.SNAPSHOT.V1"),block.chainid,address(this),
            id,handId,mask,epoch
        ));
        uint256 count = 0;
        for(uint8 i=0;i<t.config.seats;i++){
            if((mask&(uint16(1)<<i))==0)continue;
            Seat memory s=seats[id][i];
            if(s.player==address(0)||s.sittingOut||s.chips==0)revert SettlementInvalid();
            sum+=s.chips;count++;
            snapshot=keccak256(abi.encode(snapshot,i,s.player,s.chips,s.sittingOut,s.epoch));
        }
        if(count<2||sum==0)revert SettlementInvalid();
        activeHand[id]=handId;lockedMask[id]=mask;lockedEpoch[id]=epoch;
        lockedSnapshot[id]=snapshot;lockedTotal[id]=sum;reservedInHand[id]=sum;
        emit HandReserved(id,handId,sum,snapshot);
    }
    /// @notice Restore original escrow balances on canonically authorized void/recovery.
    function cancelReservedHand(bytes32 id,bytes32 handId) external nonReentrant {
        _checkLockedCaller(id,handId);
        _assertUnchanged(id,handId);
        _unlock(id,handId);
        emit HandCancelled(id,handId);
    }
    /// @notice One atomic replay-protected chip redistribution with rake leaving custody.
    /// @dev The authorized consumer MUST verify sound shuffle, rules, decryption and
    ///      canonical payout proofs before calling; this ledger rechecks conservation.
    function settleReservedHand(bytes32 id,bytes32 handId,uint256[9] calldata finalChips,
        uint256 rake) external nonReentrant {
        _checkLockedCaller(id,handId);
        _assertUnchanged(id,handId);
        PokerTableRegistry420.Table memory t=_table(id);
        uint16 mask=lockedMask[id];
        uint256 total = 0;
        for(uint8 i=0;i<t.config.seats;i++){
            if((mask&(uint16(1)<<i))!=0) total+=finalChips[i];
            else if(finalChips[i]!=seats[id][i].chips)revert SettlementInvalid();
        }
        if(total>lockedTotal[id] || lockedTotal[id]-total!=rake)
            revert SettlementInvalid();
        for(uint8 i=0;i<t.config.seats;i++){
            if((mask&(uint16(1)<<i))!=0) seats[id][i].chips=finalChips[i];
        }
        totalChips[id]-=rake;
        _unlock(id,handId);
        if(rake!=0)_withdraw(t.config.asset,rakeDestination[id],rake);
        emit HandSettled(id,handId,rake,total);
    }
    function _checkLockedCaller(bytes32 id,bytes32 handId) private view {
        if(msg.sender!=settlementCoordinator[id]||msg.sender==address(0))
            revert SettlementUnauthorized();
        if(activeHand[id]!=handId||handId==bytes32(0)||reservedInHand[id]==0)
            revert SettlementInvalid();
        if(handConsumed[handId])revert SettlementReplay();
    }
    function _assertUnchanged(bytes32 id,bytes32 handId) private view {
        if(seatingEpoch[id]!=lockedEpoch[id])revert SettlementInvalid();
        PokerTableRegistry420.Table memory t=_table(id);
        uint16 mask=lockedMask[id];
        bytes32 snapshot=keccak256(abi.encode(
            keccak256("420.BET.POKER.ESCROW.SNAPSHOT.V1"),block.chainid,address(this),
            id,handId,mask,lockedEpoch[id]
        ));
        for(uint8 i=0;i<t.config.seats;i++){
            if((mask&(uint16(1)<<i))==0)continue;
            Seat memory s=seats[id][i];
            snapshot=keccak256(abi.encode(snapshot,i,s.player,s.chips,s.sittingOut,s.epoch));
        }
        if(snapshot!=lockedSnapshot[id])revert SettlementInvalid();
    }
    function _unlock(bytes32 id,bytes32 handId) private {
        handConsumed[handId]=true;activeHand[id]=bytes32(0);
        reservedInHand[id]=0;lockedMask[id]=0;lockedEpoch[id]=0;
        lockedSnapshot[id]=bytes32(0);lockedTotal[id]=0;
    }

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

    function sitOut(bytes32 id, bool value) external nonReentrant {
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
