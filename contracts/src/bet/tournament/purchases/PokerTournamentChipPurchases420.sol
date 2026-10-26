// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerTournamentPurchasesState420.sol";

contract PokerTournamentChipPurchases420 is PokerTournamentPurchasesModule420 {
    using PokerTournamentStandings420 for PokerTournamentStandings420.Book;
    constructor(address e,address b,address x,address h)PokerTournamentPurchasesModule420(e,b,x,h){}
    function acceptRebuy(bytes32 id,uint64 receipt)external onlyHost receiptGuarded{
        (PokerTournamentPurchaseEscrowState420.Entry memory x,PokerTournamentPurchaseEscrowState420.Receipt memory r)=_fundedReceipt(id,receipt,PokerTournamentPurchaseEscrowState420.Kind.REBUY,PokerTournamentPurchaseEscrowState420.ReceiptStatus.ACTIVATED);
        (bool allowed,uint32 generation,uint16 level)=_eligibility(id,x.person,PokerTournamentPurchaseEscrowState420.Kind.REBUY);
        State storage s=_state();Event storage e=s.events[id];PokerTournamentStandings420.Person storage person=s.standings[id].byPerson[x.person];PokerTournamentTableBalance420.Player storage p=s.seating[id].people[x.person];
        if(!allowed||generation!=r.generation||level!=r.level||r.previous!=person.receipt||r.acceptedAt!=block.timestamp||x.nonce<=p.nonce||_bank().activeReceipt(id,x.person)!=receipt||s.seating[id].consumedReceipt[receipt])revert Invalid();
        if(s.actorPerson[id][x.payer]!=0&&s.actorPerson[id][x.payer]!=x.person)revert Invalid();
        s.standings[id].restore(x.person,receipt,_config(id),e.clock.startedAt,level,uint64(block.timestamp));
        if(s.actorPerson[id][p.payer]==x.person)delete s.actorPerson[id][p.payer];s.actorPerson[id][x.payer]=x.person;
        p.chips=uint128(x.chips);p.payer=x.payer;p.receipt=receipt;p.nonce=x.nonce;++p.placementEpoch;
        ++s.seating[id].tables[p.table].epoch;++s.seating[id].revision;++s.seatVersion[tableId(id,p.table)];s.seating[id].consumedReceipt[receipt]=true;
        s.subject[id][x.person]=x.subject;s.credential[id][x.person]=escrow.receiptCredential(id,receipt);e.issuedChips+=x.chips;_rootReceipt(id,receipt);
        emit PurchaseActivated(id,receipt,x.person,person.generation,x.chips);
    }
    function acceptAddOn(bytes32 id,uint64 receipt)external onlyHost receiptGuarded{
        (PokerTournamentPurchaseEscrowState420.Entry memory x,PokerTournamentPurchaseEscrowState420.Receipt memory r)=_fundedReceipt(id,receipt,PokerTournamentPurchaseEscrowState420.Kind.ADD_ON,PokerTournamentPurchaseEscrowState420.ReceiptStatus.ACTIVATED);
        (bool allowed,uint32 generation,uint16 level)=_eligibility(id,x.person,PokerTournamentPurchaseEscrowState420.Kind.ADD_ON);
        State storage s=_state();Event storage e=s.events[id];PokerTournamentStandings420.Person storage person=s.standings[id].byPerson[x.person];PokerTournamentTableBalance420.Player storage p=s.seating[id].people[x.person];
        if(!allowed||generation!=r.generation||level!=r.level||r.previous!=person.receipt||r.acceptedAt!=block.timestamp||x.nonce<=p.nonce||_bank().activeReceipt(id,x.person)!=receipt||_bank().addOnReceipt(id,x.person)!=receipt||s.seating[id].consumedReceipt[receipt]||s.actorPerson[id][x.payer]!=x.person||p.payer!=x.payer)revert Invalid();
        uint256 chips=uint256(p.chips)+x.chips;if(chips>type(uint128).max)revert Invalid();_purchases().events[id].claimed[x.person]=true;
        p.chips=uint128(chips);p.receipt=receipt;p.nonce=x.nonce;++p.placementEpoch;person.receipt=receipt;
        ++s.seating[id].tables[p.table].epoch;++s.seating[id].revision;++s.seatVersion[tableId(id,p.table)];s.seating[id].consumedReceipt[receipt]=true;
        e.issuedChips+=x.chips;_rootReceipt(id,receipt);emit PurchaseActivated(id,receipt,x.person,person.generation,x.chips);
    }
    function openAddOnBreak(bytes32 id)external onlyHost guarded{_open(id);}
    function closeAddOnBreak(bytes32 id)external onlyHost guarded{_close(id);}
    function ensurePurchaseBoundary(bytes32 id)external onlyHost returns(bool){
        State storage s=_state();if(msg.sender!=address(this)||!s.entered||s.ledgerEntered)revert Unauthorized();PurchaseEvent storage p=_purchases().events[id];
        if(p.breakState==BreakState.OPEN){if(block.timestamp<p.closesAt)return false;_close(id);if(s.events[id].phase==Phase.RECOVERY_REQUIRED)return false;}
        if(_due(id)){_open(id);return false;}
        return p.queue.length==0;
    }
    function _due(bytes32 id)private view returns(bool){
        PurchaseEvent storage p=_purchases().events[id];Event storage e=_state().events[id];PokerTournamentPolicy420.Config memory c=_config(id);
        return p.addOn&&p.breakState==BreakState.NONE&&e.started&&!_state().standings[id].finished&&!PokerTournamentPolicy420.windowOpen(e.clock.startedAt,c.extraDuration,c.extraLevel,_level(id),block.timestamp);
    }
    function _open(bytes32 id)private{
        State storage s=_state();Event storage e=s.events[id];PurchaseEvent storage p=_purchases().events[id];
        if(!_due(id)||(e.phase!=Phase.READY&&e.phase!=Phase.PREPARING)||e.clock.state!=PokerTournamentStructure420.State.RUNNING||e.hands.activeCount!=0||s.standings[id].pending!=0||s.standings[id].live<2||p.queue.length!=0||block.timestamp+p.window>type(uint64).max)revert WrongPhase();
        p.openedAt=uint64(block.timestamp);p.closesAt=uint64(block.timestamp+p.window);p.eligibleReceipt=escrow.eventOf(id).receipts;p.restorePhase=e.phase;p.breakState=BreakState.OPEN;
        // A published break does not reset or spend the original emergency-pause budget.
        e.clock.pausedAt=uint64(block.timestamp);e.clock.observedAt=uint64(block.timestamp);e.clock.state=PokerTournamentStructure420.State.PAUSED;++e.clock.revision;e.phase=Phase.PAUSED;
        emit AddOnBreakOpened(id,p.openedAt,p.closesAt);
    }
    function _close(bytes32 id)private{
        Event storage e=_state().events[id];PurchaseEvent storage p=_purchases().events[id];
        if(p.breakState!=BreakState.OPEN||e.phase!=Phase.PAUSED||block.timestamp<p.closesAt||block.timestamp>type(uint64).max)revert WrongPhase();
        e.clock.observedAt=uint64(block.timestamp);
        if(block.timestamp>=uint256(p.closesAt)+_config(id).recoveryGrace){e.clock.state=PokerTournamentStructure420.State.RECOVERY_REQUIRED;e.phase=Phase.RECOVERY_REQUIRED;emit RecoveryRequired(id,0);return;}
        // Only the published window freezes blinds; keeper delay after its end does not.
        e.clock.pausedTotal+=p.closesAt-p.openedAt;e.clock.pausedAt=0;e.clock.state=PokerTournamentStructure420.State.RUNNING;++e.clock.revision;
        p.breakState=BreakState.CLOSED;e.phase=p.restorePhase;emit AddOnBreakClosed(id,p.closesAt);
    }
}
interface IC6ChipPurchaseHost420 {function ensurePurchaseBoundary(bytes32)external returns(bool);}
