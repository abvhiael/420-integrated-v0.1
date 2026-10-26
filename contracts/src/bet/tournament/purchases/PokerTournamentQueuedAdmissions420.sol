// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerTournamentPurchasesState420.sol";

contract PokerTournamentQueuedAdmissions420 is PokerTournamentPurchasesModule420 {
    using PokerTournamentPurchaseQueue420 for PokerTournamentPurchaseQueue420.Queue;
    using PokerTournamentTableBalance420 for PokerTournamentTableBalance420.Layout;
    constructor(address e,address b,address x,address h)PokerTournamentPurchasesModule420(e,b,x,h){}
    function acceptPaidRequest(bytes32 id,uint64 receipt)external onlyHost receiptGuarded{
        PokerTournamentPurchaseEscrowState420.Receipt memory r=_bank().receiptOf(id,receipt);
        if(r.kind!=PokerTournamentPurchaseEscrowState420.Kind.RE_ENTRY&&r.kind!=PokerTournamentPurchaseEscrowState420.Kind.LATE)revert Invalid();
        (PokerTournamentPurchaseEscrowState420.Entry memory x,)=_fundedReceipt(id,receipt,r.kind,PokerTournamentPurchaseEscrowState420.ReceiptStatus.QUEUED);
        (bool allowed,uint32 generation,uint16 level)=_eligibility(id,x.person,r.kind,true);
        if(!allowed||r.generation!=generation||r.level!=level||r.acceptedAt!=block.timestamp||r.readyUntil!=block.timestamp+_config(id).purchaseReadiness||_bank().pendingReceipt(id,x.person)!=receipt)revert Invalid();
        bytes32 active=_state().actorPerson[id][x.payer];if(active!=0&&active!=x.person)revert Invalid();
        _purchases().events[id].queue.append(receipt,_config(id).maxPlayers);_rootReceipt(id,receipt);
    }
    function discardPaidRequest(bytes32 id,uint64 receipt)external onlyHost receiptGuarded{
        PokerTournamentPurchaseEscrowState420.Receipt memory r=_bank().receiptOf(id,receipt);
        if(r.status!=PokerTournamentPurchaseEscrowState420.ReceiptStatus.ACTIVATED&&r.status!=PokerTournamentPurchaseEscrowState420.ReceiptStatus.REFUNDED)revert Invalid();
        _purchases().events[id].queue.remove(receipt);_rootReceipt(id,receipt);
    }
    function resolveRequests(bytes32 id,uint32 limit)external onlyHost guarded returns(bool){
        Event storage e=_state().events[id];if(e.phase!=Phase.READY&&e.phase!=Phase.PROCESSING)revert WrongPhase();return _resolve(id,limit);
    }
    /// @dev Only the fixed round module's outer guarded transaction can call this nested path.
    function resolveAtBarrier(bytes32 id,uint32 limit)external onlyHost returns(bool){
        State storage s=_state();Event storage e=s.events[id];if(msg.sender!=address(this)||!s.entered||s.ledgerEntered||e.phase!=Phase.PROCESSING||e.resolved!=e.expected||e.hands.activeCount!=0)revert Unauthorized();return _resolve(id,limit);
    }
    function _resolve(bytes32 id,uint32 limit)private returns(bool done){
        if(limit==0||limit>32)revert Invalid();State storage s=_state();Event storage e=s.events[id];PurchaseEvent storage p=_purchases().events[id];
        if(e.hands.activeCount!=0||s.standings[id].pending!=0)revert Locked();
        bool wasReady=e.phase==Phase.READY;uint64 revision=s.seating[id].revision;
        for(uint32 n;n<limit&&p.queue.head!=0;n++){
            uint64 receipt=p.queue.head;PokerTournamentPurchaseEscrowState420.Receipt memory r=_bank().receiptOf(id,receipt);
            if(_refundEligible(id,receipt)){_bank().refundUnseated(id,receipt);continue;}
            if(!_risk(id))break;
            // An admission failure rolls back this subcall only. Its fully funded receipt
            // remains refundable at the immutable readiness deadline.
            try IC6AdmissionHost420(address(this)).activateQueuedRequest(id,receipt){}catch{break;}
            if(r.kind!=PokerTournamentPurchaseEscrowState420.Kind.RE_ENTRY&&r.kind!=PokerTournamentPurchaseEscrowState420.Kind.LATE)revert Invalid();
        }
        done=p.queue.length==0;if(done&&wasReady&&revision!=s.seating[id].revision)e.phase=Phase.BALANCING;return done;
    }
    function activateQueuedRequest(bytes32 id,uint64 receipt)external onlyHost{
        State storage s=_state();Event storage e=s.events[id];PokerTournamentStandings420.Book storage b=s.standings[id];
        if(msg.sender!=address(this)||!s.entered||s.ledgerEntered||e.hands.activeCount!=0||(e.phase!=Phase.READY&&e.phase!=Phase.PROCESSING)||b.pending!=0||b.finished||!_risk(id)||_purchases().events[id].queue.head!=receipt)revert Unauthorized();
        PokerTournamentPurchaseEscrowState420.Receipt memory r=_bank().receiptOf(id,receipt);(PokerTournamentPurchaseEscrowState420.Entry memory x,)=_fundedReceipt(id,receipt,r.kind,PokerTournamentPurchaseEscrowState420.ReceiptStatus.QUEUED);
        if(block.timestamp>=r.readyUntil||_bank().pendingReceipt(id,x.person)!=receipt||s.actorPerson[id][x.payer]!=0||s.seating[id].consumedReceipt[receipt])revert Invalid();
        PokerTournamentStandings420.Person storage person=b.byPerson[x.person];PokerTournamentPolicy420.Config memory c=_config(id);
        if(r.kind==PokerTournamentPurchaseEscrowState420.Kind.RE_ENTRY){
            if(c.purchaseKind!=PokerTournamentPolicy420.PurchaseKind.RE_ENTRY||person.status!=PokerTournamentStandings420.Status.ELIMINATED||person.generation!=r.generation||person.receipt!=r.previous||person.extraPurchases>=c.extraCap||person.hand==0||!s.frozen[person.hand].settled||!PokerTournamentPolicy420.windowOpen(e.clock.startedAt,c.extraDuration,c.extraLevel,r.level,r.acceptedAt)||s.seating[id].people[x.person].seated||s.seating[id].people[x.person].chips!=0)revert Invalid();
            person.status=PokerTournamentStandings420.Status.ACTIVE;++person.generation;++person.extraPurchases;++b.live;
            person.receipt=receipt;person.rebuyUntil=0;person.eliminatedWave=0;person.eliminatedTable=0;person.handStart=0;person.hand=0;person.tier=0;
        }else if(r.kind==PokerTournamentPurchaseEscrowState420.Kind.LATE){
            if(person.status!=PokerTournamentStandings420.Status.NONE||b.people.length>=c.maxPlayers||!PokerTournamentPolicy420.windowOpen(e.clock.startedAt,c.lateDuration,c.lateLevel,r.level,r.acceptedAt)||r.generation!=0||r.previous!=0)revert Invalid();
            person.status=PokerTournamentStandings420.Status.ACTIVE;person.generation=1;person.receipt=receipt;b.people.push(x.person);++b.live;
        }else revert Invalid();
        PokerTournamentTableBalance420.Player memory entrant=PokerTournamentTableBalance420.Player(x.person,x.payer,receipt,x.nonce,uint128(x.chips),0,0,0,0,0,0,false);
        (uint32 table,)=s.seating[id].admit(entrant,r.kind==PokerTournamentPurchaseEscrowState420.Kind.LATE?PokerTournamentTableBalance420.Purchase.NEW_PLAYER:PokerTournamentTableBalance420.Purchase.RE_ENTRY,e.drawSeed,s.seating[id].revision);
        bytes32 key=tableId(id,table);if(!s.tableRefs[key].configured||s.seating[id].people[x.person].generation!=person.generation)revert Invalid();++s.seatVersion[key];
        s.actorPerson[id][x.payer]=x.person;s.subject[id][x.person]=x.subject;s.credential[id][x.person]=escrow.receiptCredential(id,receipt);e.issuedChips+=x.chips;
        _bank().activateQueued(id,receipt);emit PurchaseActivated(id,receipt,x.person,person.generation,x.chips);
    }
}
interface IC6AdmissionHost420 {
    function activateQueuedRequest(bytes32,uint64)external;
    function resolveAtBarrier(bytes32,uint32)external returns(bool);
}
