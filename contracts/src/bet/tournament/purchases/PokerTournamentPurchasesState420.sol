// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../PokerTournamentHostState420.sol";
import "./PokerTournamentPurchaseEscrow420.sol";
import "./PokerTournamentPurchaseQueue420.sol";

/// @dev Original host storage is retained for the genuine C5 ledger/bootstrap/balance modules.
/// Additional C6 state has its own slot; existing deployments have no migration/upgrade endpoint.
abstract contract PokerTournamentPurchasesState420 is PokerTournamentHostState420 {
    using PokerTournamentPurchaseQueue420 for PokerTournamentPurchaseQueue420.Queue;
    bytes32 public constant PURCHASE_DOMAIN=keccak256("420.BET.POKER.TOURNAMENT.PURCHASE.HOST.V1");
    enum BreakState { NONE,OPEN,CLOSED }
    struct PurchaseEvent {
        bytes32 plan;bytes32 planDigest;bool addOn;uint32 window;BreakState breakState;
        uint64 openedAt;uint64 closesAt;uint64 eligibleReceipt;Phase restorePhase;
        bytes32 purchaseRoot;PokerTournamentPurchaseQueue420.Queue queue;
        uint32[] roundTables;mapping(bytes32=>bool) claimed;
    }
    struct PurchaseState {bool receiptEntered;mapping(bytes32=>PurchaseEvent) events;}
    bytes32 private constant PURCHASE_SLOT=keccak256("420.bet.tournament.host.purchases.v1");
    event C6PurchaseRootSeed(bytes32 indexed eventId,bytes32 root);
    event C6PurchaseRoot(bytes32 indexed eventId,bytes32 root,bytes encoded);
    event AddOnBreakOpened(bytes32 indexed eventId,uint64 openedAt,uint64 closesAt);
    event AddOnBreakClosed(bytes32 indexed eventId,uint64 closesAt);
    event PurchaseActivated(bytes32 indexed eventId,uint64 receipt,bytes32 person,uint32 generation,uint256 chips);
    constructor(address e,address b,address x)PokerTournamentHostState420(e,b,x){}
    function _purchases()internal pure returns(PurchaseState storage s){bytes32 slot=PURCHASE_SLOT;assembly("memory-safe"){s.slot:=slot}}
    function _bank()internal view returns(PokerTournamentPurchaseEscrow420){return PokerTournamentPurchaseEscrow420(address(escrow));}
    function _bankOnly()internal view{if(msg.sender!=address(escrow))revert Unauthorized();}
    modifier receiptGuarded(){_bankOnly();PurchaseState storage p=_purchases();if(p.receiptEntered||_state().ledgerEntered)revert Reentrancy();p.receiptEntered=true;_;p.receiptEntered=false;}
    function _risk(bytes32 id)internal view returns(bool){
        PokerTournamentPolicy420.Config memory c=_config(id);if(c.gameVersion==0)return false;
        PokerTournamentPolicyRegistry420.Record memory r=escrow.policies().get(escrow.eventOf(id).policy);
        return r.status==PokerTournamentPolicyRegistry420.Status.PUBLISHED&&operators.isActive(c.operatorId)&&
            !emergency.isHalted(BetTypes420.EmergencyDomain.NEW_WAGERS,0)&&!emergency.isHalted(BetTypes420.EmergencyDomain.GAME_VERSION,c.gameVersion)&&
            !emergency.isHalted(BetTypes420.EmergencyDomain.POKER_TOURNAMENT_REGISTRATION,id);
    }
    function _identityValid(bytes32 id,PokerTournamentPurchaseEscrowState420.Entry memory x,uint64 receipt)internal view returns(bool){
        try escrow.personKey(x.subject,escrow.receiptCredential(id,receipt),x.payer)returns(bytes32 person){return person==x.person;}catch{return false;}
    }
    function _eligibility(bytes32 id,bytes32 person,PokerTournamentPurchaseEscrowState420.Kind kind)internal view returns(bool,uint32,uint16){return _eligibility(id,person,kind,false);}
    function _eligibility(bytes32 id,bytes32 person,PokerTournamentPurchaseEscrowState420.Kind kind,bool funded)internal view returns(bool allowed,uint32 generation,uint16 level){
        State storage s=_state();Event storage e=s.events[id];PokerTournamentStandings420.Book storage b=s.standings[id];
        if(!e.started||b.finished||!_risk(id)||(!funded&&_bank().pendingReceipt(id,person)!=0))return(false,0,0);
        PokerTournamentStandings420.Person storage p=b.byPerson[person];PokerTournamentPolicy420.Config memory c=_config(id);level=_level(id);generation=p.generation;
        bool taking=e.phase==Phase.PLAYING||e.phase==Phase.READY||e.phase==Phase.DRAWING||e.phase==Phase.BALANCING;
        if(kind==PokerTournamentPurchaseEscrowState420.Kind.LATE)return(taking&&p.status==PokerTournamentStandings420.Status.NONE&&(funded?escrow.eventOf(id).reservedPlayers<=c.maxPlayers:escrow.eventOf(id).reservedPlayers<c.maxPlayers)&&PokerTournamentPolicy420.windowOpen(e.clock.startedAt,c.lateDuration,c.lateLevel,level,block.timestamp),generation,level);
        PokerTournamentTableBalance420.Player storage stack=s.seating[id].people[person];
        if(kind==PokerTournamentPurchaseEscrowState420.Kind.ADD_ON){PurchaseEvent storage x=_purchases().events[id];return(x.addOn&&x.breakState==BreakState.OPEN&&e.phase==Phase.PAUSED&&block.timestamp>=x.openedAt&&block.timestamp<x.closesAt&&!x.claimed[person]&&p.status==PokerTournamentStandings420.Status.ACTIVE&&stack.seated&&stack.chips>0&&p.receipt<=x.eligibleReceipt&&e.hands.activeCount==0,generation,level);}
        if(!taking||stack.chips!=0||p.hand==0||!s.frozen[p.hand].settled||!s.consumed[p.hand]||s.seating[id].tables[stack.table].busy||p.extraPurchases>=c.extraCap||!PokerTournamentPolicy420.windowOpen(e.clock.startedAt,c.extraDuration,c.extraLevel,level,block.timestamp))return(false,generation,level);
        if(kind==PokerTournamentPurchaseEscrowState420.Kind.RE_ENTRY)return(c.purchaseKind==PokerTournamentPolicy420.PurchaseKind.RE_ENTRY&&p.status==PokerTournamentStandings420.Status.ELIMINATED,generation,level);
        if(kind==PokerTournamentPurchaseEscrowState420.Kind.REBUY)return(c.purchaseKind==PokerTournamentPolicy420.PurchaseKind.REBUY&&p.status==PokerTournamentStandings420.Status.REBUY_PENDING&&stack.seated&&block.timestamp<p.rebuyUntil,generation,level);
        return(false,generation,level);
    }
    function _refundEligible(bytes32 id,uint64 receipt)internal view returns(bool){
        PokerTournamentPurchaseEscrowState420.Receipt memory r=_bank().receiptOf(id,receipt);PokerTournamentPurchaseEscrowState420.Entry memory x=_bank().entryOf(id,receipt);Event storage e=_state().events[id];
        return r.status==PokerTournamentPurchaseEscrowState420.ReceiptStatus.QUEUED&&(block.timestamp>=r.readyUntil||e.phase==Phase.RECOVERY_REQUIRED||e.phase==Phase.FINISHING||e.phase==Phase.COMPLETE||!_identityValid(id,x,receipt)||!_risk(id));
    }
    function _receiptBytes(bytes32 id,uint64 receipt)internal view returns(bytes memory){
        PokerTournamentPurchaseEscrowState420.Entry memory x=_bank().entryOf(id,receipt);PokerTournamentPurchaseEscrowState420.Receipt memory r=_bank().receiptOf(id,receipt);
        return abi.encode(id,receipt,uint8(r.kind),uint8(r.status),x.person,x.payer,x.nonce,x.buyIn,x.fee,x.chips,r.acceptedAt,r.readyUntil,r.previous);
    }
    function _rootReceipt(bytes32 id,uint64 receipt)internal{PurchaseEvent storage p=_purchases().events[id];bytes memory data=_receiptBytes(id,receipt);p.purchaseRoot=keccak256(abi.encode(p.purchaseRoot,keccak256(data)));emit C6PurchaseRoot(id,p.purchaseRoot,data);}
    function _fundedReceipt(bytes32 id,uint64 receipt,PokerTournamentPurchaseEscrowState420.Kind kind,PokerTournamentPurchaseEscrowState420.ReceiptStatus status)internal view returns(PokerTournamentPurchaseEscrowState420.Entry memory x,PokerTournamentPurchaseEscrowState420.Receipt memory r){
        x=_bank().entryOf(id,receipt);r=_bank().receiptOf(id,receipt);PokerTournamentPurchaseAccounting420.Quote memory q=escrow.quote(id);
        if(x.payer==address(0)||x.refunded||x.chips!=q.chips||x.buyIn!=q.prize||x.fee!=q.fee||r.kind!=kind||r.status!=status||!_identityValid(id,x,receipt))revert Invalid();
    }
}

abstract contract PokerTournamentPurchasesModule420 is PokerTournamentPurchasesState420 {
    address public immutable host;
    constructor(address e,address b,address x,address h)PokerTournamentPurchasesState420(e,b,x){if(h==address(0))revert Invalid();host=h;}
    modifier onlyHost(){if(address(this)!=host)revert Unauthorized();_;}
}
