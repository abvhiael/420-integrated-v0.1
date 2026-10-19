// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./PokerActionKeys420.sol";
import "./PokerPrivateShuffleGate420.sol";
import "./PokerActionDisputeClock420.sol";
import "./PokerCanonicalRake420.sol";

interface IPokerNativeOutcome420 {
    function calculate(bytes32 handId,PokerCanonicalRake420.Policy calldata policy)
        external view returns(uint256[9] memory finalChips,uint256 fee);
}
interface IPokerAuthenticatedStreet420 {
    function isStageComplete(bytes32 handId,uint8 street) external view returns(bool);
}

/// @notice Native on-chain NLHE betting state machine. No controller can insert
/// arbitrary stacks, skip a betting transition, reopen an illegal underraise,
/// or choose the player to act. Settlement must consume these stored values.
/// @dev Does not itself implement seven-card hand ranking or finalize funds.
///      The latter MUST run against cryptographically authenticated revelations.
contract PokerNLHEBetting420 {
    bytes32 public constant ACTION_DOMAIN=keccak256("420.BET.POKER.NLHE.AUTHENTICATED.ACTION.V1");
    bytes32 public constant STATE_DOMAIN=keccak256("420.BET.POKER.NLHE.STATE.V1");
    bytes32 public constant ACTION_BIND_OUTCOME=keccak256("BET_POKER_BIND_CANONICAL_OUTCOME.V1");
    bytes32 public constant ACTION_BIND_REVEALS=keccak256("BET_POKER_BIND_REVEAL_ENGINE.V1");

    enum Phase {NONE,PREFLOP,AWAIT_FLOP,FLOP,AWAIT_TURN,TURN,AWAIT_RIVER,RIVER,SHOWDOWN,UNCONTESTED}
    enum Move {FOLD,CHECK,CALL,RAISE}
    struct Player {
        uint256 stack;
        uint256 bet;
        uint256 contributed;
        uint256 lastFacing;
        bool acted;
        bool folded;
        bool allIn;
    }
    struct Game {
        bytes32 tableId;
        bytes32 stateRoot;
        uint16 seatsMask;
        uint16 pendingMask;
        uint8 button;
        uint8 smallBlindSeat;
        uint8 bigBlindSeat;
        uint8 toAct;
        uint64 nonce;
        uint64 deadline;
        uint32 actionTimeout;
        uint256 currentBet;
        uint256 minRaise;
        uint256 initialChips;
        uint256 pot;
        Phase phase;
        bool initialized;
    }
    PokerConfidentialDeal420 public immutable deals;
    PokerSeatLedger420 public immutable ledger;
    PokerPrivateShuffleGate420 public immutable shuffle;
    PokerActionKeys420 public immutable keys;
    PokerActionDisputeClock420 public immutable disputes;
    BetAuthorization420 public immutable authorization;
    IPokerAuthenticatedStreet420 public streetReveals;
    mapping(bytes32=>Game) private games;
    mapping(bytes32=>mapping(uint8=>Player)) private players;
    mapping(bytes32=>uint8) public lastButton;
    mapping(bytes32=>bool) public hasButton;
    mapping(bytes32=>bool) public flopOpened;
    mapping(bytes32=>bool) public handSettled;
    mapping(bytes32=>address) public outcomeForTable;
    event OutcomeBound(bytes32 indexed tableId,address outcome);
    event NativeHandSettled(bytes32 indexed handId,bytes32 indexed tableId,uint256 rake);

    error InvalidConfiguration();error InvalidState();error WrongTurn();
    error Unauthorized();error InvalidAction();error Expired();error WaitingForReveal();
    event HandStarted(bytes32 indexed handId,uint8 button,uint8 smallBlindSeat,uint8 bigBlindSeat);
    event NLHEAction(bytes32 indexed handId,uint64 nonce,uint8 seat,Move action,uint256 chips,bytes32 stateRoot);
    event NLHETimeout(bytes32 indexed handId,uint8 indexed seat,uint64 nonce,Move autoAction);
    event StreetOpened(bytes32 indexed handId,uint8 street);
    event RevealsBound(address indexed gate);

    constructor(address deals_,address shuffle_,address keys_,address disputes_) {
        if(deals_==address(0)||shuffle_==address(0)||keys_==address(0)||disputes_==address(0))
            revert InvalidConfiguration();
        deals=PokerConfidentialDeal420(deals_);
        ledger=deals.ledger();
        shuffle=PokerPrivateShuffleGate420(shuffle_);
        keys=PokerActionKeys420(keys_);
        disputes=PokerActionDisputeClock420(disputes_);
        authorization=deals.authorization();
        if(address(shuffle.deals())!=deals_||address(keys.deals())!=deals_||
           address(disputes.deals())!=deals_)
            revert InvalidConfiguration();
    }

    function bindReveals(bytes32 tableId,address gate) external {
        if(address(streetReveals)!=address(0)||gate==address(0)||gate.code.length==0)
            revert InvalidConfiguration();
        if(!authorization.isAuthorized(msg.sender,ACTION_BIND_REVEALS,
            authorization.scopeForTable(tableId),0))revert Unauthorized();
        streetReveals=IPokerAuthenticatedStreet420(gate);
        emit RevealsBound(gate);
    }
    /// @notice One-time table-governance approval of canonical native payout calculator.
    /// @dev No address may provide arbitrarily chosen settlement amounts after binding.
    function bindOutcome(bytes32 tableId,address calculator) external {
        if(outcomeForTable[tableId]!=address(0)||calculator==address(0)||
           calculator.code.length==0)revert InvalidConfiguration();
        if(!authorization.isAuthorized(msg.sender,ACTION_BIND_OUTCOME,
            authorization.scopeForTable(tableId),0))revert Unauthorized();
        outcomeForTable[tableId]=calculator;
        emit OutcomeBound(tableId,calculator);
    }
    /// @notice A permissionless, all-or-nothing on-chain escrow settlement.
    /// @dev Uses the FULL actual betting transcript, revealed board/hole cards,
    ///      exact immutable rake policy and native 5-of-7/side-pot recomputation.
    function settle(bytes32 handId,PokerCanonicalRake420.Policy calldata policy) external {
        Game storage g=games[handId];
        if(!g.initialized||handSettled[handId]||
           (g.phase!=Phase.SHOWDOWN&&g.phase!=Phase.UNCONTESTED)||
           disputes.isFrozen(handId)||outcomeForTable[g.tableId]==address(0)||
           ledger.activeHand(g.tableId)!=handId)revert InvalidState();
        if(address(streetReveals)==address(0))revert InvalidState();
        (uint256[9] memory balances,uint256 fee)=
            IPokerNativeOutcome420(outcomeForTable[g.tableId]).calculate(handId,policy);
        handSettled[handId]=true;
        ledger.settleReservedHand(g.tableId,handId,balances,fee);
        emit NativeHandSettled(handId,g.tableId,fee);
    }
    function gameOf(bytes32 handId) external view returns(Game memory){return games[handId];}
    function playerOf(bytes32 handId,uint8 seat) external view returns(Player memory){return players[handId][seat];}
    function _mask(uint8 seat) private pure returns(uint16){return uint16(1)<<seat;}
    function _participates(uint16 mask,uint8 i)private pure returns(bool){return (mask&_mask(i))!=0;}
    function _nextSeat(uint16 mask,uint8 from)private pure returns(uint8){
        for(uint8 j=1;j<=9;j++){
            uint8 i=uint8((uint256(from)+j)%9);
            if(_participates(mask,i))return i;
        }
        revert InvalidState();
    }
    function _pendingFor(bytes32 handId,uint16 mask)private view returns(uint16 pending) {
        for(uint8 i=0;i<9;i++)if(_participates(mask,i)){
            Player storage p=players[handId][i];
            if(!p.folded&&!p.allIn)pending|=_mask(i);
        }
    }
    function _nextToAct(bytes32 handId,uint16 mask,uint8 from)private view returns(uint8) {
        for(uint8 j=1;j<=9;j++){
            uint8 i=uint8((uint256(from)+j)%9);
            if(_participates(mask,i)){
                Player storage p=players[handId][i];
                if(!p.folded&&!p.allIn)return i;
            }
        }
        return type(uint8).max;
    }
    function _alive(bytes32 handId,uint16 mask)private view returns(uint8 count) {
        for(uint8 i=0;i<9;i++)if(_participates(mask,i)&&!players[handId][i].folded)count++;
    }
    function _liveToAct(bytes32 handId,uint16 mask)private view returns(uint8 count) {
        for(uint8 i=0;i<9;i++)if(_participates(mask,i)){
            Player storage p=players[handId][i];if(!p.folded&&!p.allIn)count++;
        }
    }
    function _debit(bytes32 handId,Game storage g,uint8 seat,uint256 amount,bool streetBet)private {
        Player storage p=players[handId][seat];
        if(amount>p.stack)revert InvalidAction();
        p.stack-=amount;p.contributed+=amount;g.pot+=amount;
        if(streetBet)p.bet+=amount;
        if(p.stack==0)p.allIn=true;
    }

    /// @notice Reserve funds before shuffling; any authenticated participant may
    /// initiate their already-authorized hand, but cannot choose its seats/stacks.
    function reserve(bytes32 handId) external {
        PokerConfidentialDeal420.Hand memory h=deals.getHand(handId);
        if(h.state!=PokerConfidentialDeal420.State.AWAITING &&
           h.state!=PokerConfidentialDeal420.State.COMMITTED)revert InvalidState();
        bool permitted=msg.sender==deals.tables().getTable(h.tableId).controller;
        uint16 mask=deals.handSeatMask(handId);
        for(uint8 i=0;i<9;i++)if(_participates(mask,i)&&
            ledger.seatOf(h.tableId,i).player==msg.sender)permitted=true;
        if(!permitted||ledger.settlementCoordinator(h.tableId)!=address(this)||
           h.seatSnapshotHash!=deals.snapshotFor(h.tableId,mask))
            revert Unauthorized();
        ledger.reserveHand(h.tableId,handId,mask,h.epoch);
    }
    function start(bytes32 handId,uint256 ante,uint32 timeoutSecs) external {
        PokerConfidentialDeal420.Hand memory h=deals.getHand(handId);
        if(h.state!=PokerConfidentialDeal420.State.COMMITTED||
           !shuffle.isProofComplete(handId)||timeoutSecs<30||timeoutSecs>3600||ante!=0)
            revert InvalidState();
        Game storage g=games[handId];
        if(disputes.isFrozen(handId)||g.initialized||ledger.activeHand(h.tableId)!=handId||
           ledger.seatingEpoch(h.tableId)!=h.epoch||
           h.seatSnapshotHash!=deals.snapshotFor(h.tableId,deals.handSeatMask(handId)))
            revert InvalidState();
        PokerTableRegistry420.Table memory t=deals.tables().getTable(h.tableId);
        uint16 mask=deals.handSeatMask(handId);
        uint8 button;
        if(!hasButton[h.tableId]){
            button=_nextSeat(mask,8);hasButton[h.tableId]=true;
        } else button=_nextSeat(mask,lastButton[h.tableId]);
        lastButton[h.tableId]=button;
        uint8 n;
        for(uint8 i=0;i<9;i++)if(_participates(mask,i))n++;
        uint8 sb=n==2?button:_nextSeat(mask,button);
        uint8 bb=_nextSeat(mask,sb);
        g.tableId=h.tableId;g.seatsMask=mask;g.button=button;
        g.smallBlindSeat=sb;g.bigBlindSeat=bb;g.actionTimeout=timeoutSecs;
        g.phase=Phase.PREFLOP;g.minRaise=t.config.bigBlind;g.initialized=true;
        for(uint8 i=0;i<9;i++)if(_participates(mask,i)){
            PokerSeatLedger420.Seat memory s=ledger.seatOf(h.tableId,i);
            if(s.player==address(0)||s.sittingOut||s.chips==0)revert InvalidState();
            Player storage p=players[handId][i];
            p.stack=s.chips;g.initialChips+=s.chips;
            _debit(handId,g,i,ante<p.stack?ante:p.stack,false);
        }
        _debit(handId,g,sb,t.config.smallBlind<players[handId][sb].stack?
            t.config.smallBlind:players[handId][sb].stack,true);
        _debit(handId,g,bb,t.config.bigBlind<players[handId][bb].stack?
            t.config.bigBlind:players[handId][bb].stack,true);
        // The nominal big blind remains the minimum live preflop amount
        // even when the big-blind seat posts less because they are all-in.
        g.currentBet=t.config.bigBlind;
        g.pendingMask=_pendingFor(handId,mask);
        g.toAct=n==2 && (g.pendingMask&_mask(sb))!=0?sb:
            _nextToAct(handId,mask,bb);
        g.deadline=uint64(block.timestamp+timeoutSecs);
        g.stateRoot=keccak256(abi.encode(STATE_DOMAIN,block.chainid,address(this),handId,
            h.tableId,h.rulesetId,h.configHash,h.seatSnapshotHash,
            button,sb,bb,mask,ante,g.initialChips,g.pot));
        if(g.pendingMask==0)_endRound(handId,g);
        emit HandStarted(handId,button,sb,bb);
    }
    function action(bytes32 handId,uint8 seat,Move move,uint256 chips,
        uint64 expiry,bytes32 expectedRoot,bytes calldata signature) external {
        Game storage g=games[handId];
        if(!g.initialized || !_isBetting(g.phase)||disputes.isFrozen(handId))revert InvalidState();
        if(block.timestamp>g.deadline)revert Expired();
        if(seat!=g.toAct||(g.pendingMask&_mask(seat))==0)revert WrongTurn();
        if(expectedRoot!=g.stateRoot)revert InvalidAction();
        bytes32 moveHash=keccak256(abi.encode(ACTION_DOMAIN,handId,uint8(g.phase),
            seat,uint8(move),chips));
        keys.checkSignature(handId,seat,g.nonce+1,expectedRoot,moveHash,expiry,signature);
        _apply(handId,g,seat,move,chips);
    }
    function timeout(bytes32 handId) external {
        Game storage g=games[handId];
        if(!g.initialized||!_isBetting(g.phase)||g.pendingMask==0||disputes.isFrozen(handId))
            revert InvalidState();
        if(block.timestamp<=g.deadline)revert TooEarly();
        uint8 seat=g.toAct;
        Player storage p=players[handId][seat];
        Move move=p.bet<g.currentBet?Move.FOLD:Move.CHECK;
        uint64 nonce=g.nonce+1;
        _apply(handId,g,seat,move,0);
        emit NLHETimeout(handId,seat,nonce,move);
    }
    error TooEarly();
    function _isBetting(Phase phase)private pure returns(bool){
        return phase==Phase.PREFLOP||phase==Phase.FLOP||
            phase==Phase.TURN||phase==Phase.RIVER;
    }
    function _apply(bytes32 handId,Game storage g,uint8 seat,Move move,uint256 chips)private {
        Player storage p=players[handId][seat];
        if(p.folded||p.allIn)revert InvalidAction();
        uint256 owed=g.currentBet>p.bet?g.currentBet-p.bet:0;
        if(move==Move.FOLD){
            if(chips!=0)revert InvalidAction();p.folded=true;
        }else if(move==Move.CHECK){
            if(chips!=0||owed!=0)revert InvalidAction();
        }else if(move==Move.CALL){
            uint256 required=owed>p.stack?p.stack:owed;
            if(owed==0||chips!=required)revert InvalidAction();
            _debit(handId,g,seat,chips,true);
        }else if(move==Move.RAISE){
            if(_liveToAct(handId,g.seatsMask)<2)revert InvalidAction();
            if(chips<=owed||chips>p.stack)revert InvalidAction();
            if(p.acted && g.currentBet-p.lastFacing<g.minRaise)
                revert InvalidAction();
            uint256 increment=p.bet+chips-g.currentBet;
            bool full=increment>=g.minRaise;
            if(!full&&chips!=p.stack)revert InvalidAction();
            _debit(handId,g,seat,chips,true);
            g.currentBet=p.bet;
            if(full){
                g.minRaise=increment;
                g.pendingMask=_pendingFor(handId,g.seatsMask)&~_mask(seat);
            }else{
                for(uint8 i=0;i<9;i++)if(i!=seat&&_participates(g.seatsMask,i)){
                    Player storage other=players[handId][i];
                    if(!other.folded&&!other.allIn&&other.bet<g.currentBet)
                        g.pendingMask|=_mask(i);
                }
            }
        }else revert InvalidAction();
        p.acted=true;p.lastFacing=g.currentBet;
        g.pendingMask&=~_mask(seat);
        g.nonce++;
        g.stateRoot=keccak256(abi.encode(STATE_DOMAIN,block.chainid,address(this),
            handId,g.stateRoot,g.nonce,seat,move,chips,
            g.currentBet,g.minRaise,g.pot,g.pendingMask,p.stack,p.bet,p.contributed,p.folded,p.allIn));
        emit NLHEAction(handId,g.nonce,seat,move,chips,g.stateRoot);
        if(_alive(handId,g.seatsMask)==1){
            g.phase=Phase.UNCONTESTED;g.pendingMask=0;g.toAct=type(uint8).max;
        }else if(g.pendingMask==0)_endRound(handId,g);
        else{
            g.toAct=_nextPending(handId,g.seatsMask,g.pendingMask,seat);
            g.deadline=uint64(block.timestamp+g.actionTimeout);
        }
    }
    function _nextPending(bytes32 handId,uint16 mask,uint16 pending,uint8 from)
        private pure returns(uint8){
        handId;mask;
        for(uint8 j=1;j<=9;j++){
            uint8 i=uint8((uint256(from)+j)%9);
            if((pending&_mask(i))!=0)return i;
        }
        revert InvalidState();
    }
    function _endRound(bytes32 handId,Game storage g)private{
        g.pendingMask=0;g.toAct=type(uint8).max;
        if(g.phase==Phase.PREFLOP)g.phase=Phase.AWAIT_FLOP;
        else if(g.phase==Phase.FLOP)g.phase=Phase.AWAIT_TURN;
        else if(g.phase==Phase.TURN)g.phase=Phase.AWAIT_RIVER;
        else if(g.phase==Phase.RIVER)g.phase=Phase.SHOWDOWN;
        else revert InvalidState();
        g.stateRoot=keccak256(abi.encode(STATE_DOMAIN,handId,g.stateRoot,uint8(g.phase),g.pot));
    }
    function canRevealStreet(bytes32 handId,uint8 street)external view returns(bool){
        Phase phase=games[handId].phase;
        return (street==1&&phase==Phase.AWAIT_FLOP)||
               (street==2&&phase==Phase.AWAIT_TURN)||
               (street==3&&phase==Phase.AWAIT_RIVER)||
               (street==4&&phase==Phase.SHOWDOWN);
    }
    /// @notice The bound reveal gate must independently establish all required
    ///      ciphertext membership, partial shares and canonical card proofs.
    function advanceRevealedStreet(bytes32 handId,uint8 street)external {
        Game storage g=games[handId];
        if(msg.sender!=address(streetReveals)||msg.sender==address(0))revert Unauthorized();
        if(disputes.isFrozen(handId))revert InvalidState();
        if(!this.canRevealStreet(handId,street)||
           !streetReveals.isStageComplete(handId,street))revert WaitingForReveal();
        g.phase=street==1?Phase.FLOP:street==2?Phase.TURN:Phase.RIVER;
        if(street==1)flopOpened[handId]=true;
        for(uint8 i=0;i<9;i++)if(_participates(g.seatsMask,i)){
            Player storage p=players[handId][i];p.bet=0;p.acted=false;p.lastFacing=0;
        }
        g.currentBet=0;
        g.minRaise=deals.tables().getTable(g.tableId).config.bigBlind;
        if(_liveToAct(handId,g.seatsMask)<=1){
            _endRound(handId,g);return;
        }
        g.pendingMask=_pendingFor(handId,g.seatsMask);
        g.toAct=_nextToAct(handId,g.seatsMask,g.button);
        g.deadline=uint64(block.timestamp+g.actionTimeout);
        g.stateRoot=keccak256(abi.encode(STATE_DOMAIN,handId,g.stateRoot,uint8(g.phase)));
        emit StreetOpened(handId,street);
    }
}
