// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerTournamentQueuedAdmissions420.sol";
import "./PokerTournamentChipPurchases420.sol";
contract PokerTournamentPurchaseRounds420 is PokerTournamentPurchasesModule420 {
    using PokerTournamentTableBalance420 for PokerTournamentTableBalance420.Layout;
    using PokerTournamentStandings420 for PokerTournamentStandings420.Book;
    using PokerTournamentStructure420 for PokerTournamentStructure420.Clock;
    using PokerTournamentStructure420 for PokerTournamentStructure420.Hands;
    constructor(address e,address b,address x,address h)PokerTournamentPurchasesModule420(e,b,x,h){}
    function prepareRound(bytes32 id)external onlyHost guarded {
        State storage s=_state();Event storage e=s.events[id];if(!IC6ChipPurchaseHost420(address(this)).ensurePurchaseBoundary(id))return;if(e.phase!=Phase.READY||s.standings[id].finished||s.standings[id].live<2)revert WrongPhase();
        escrow.tick(id);if(escrow.eventOf(id).state!=PokerTournamentRuntimeEscrow420.State.STARTING)revert WrongPhase();
        e.purpose=keccak256(abi.encode(DOMAIN,e.context,e.round+1,e.roundRoot,e.drawSeed,s.seating[id].revision,_purchases().events[id].purchaseRoot));e.phase=Phase.PREPARING;_entropy().prepare(e.purpose);
    }
    function openRound(bytes32 id)external onlyHost guarded {
        State storage s=_state();Event storage e=s.events[id];if(!IC6ChipPurchaseHost420(address(this)).ensurePurchaseBoundary(id))return;if(e.phase!=Phase.PREPARING)revert WrongPhase();_entropy().freeze(e.purpose);
        s.standings[id].open();++e.round;e.expected=uint32(s.seating[id].open.length);e.resolved=0;e.processCursor=0;e.rootCursor=0;e.drawRequest=0;e.phase=Phase.PLAYING;
        e.roundRoot=keccak256(abi.encode(DOMAIN,e.context,e.purpose,e.round,e.expected,_purchases().events[id].purchaseRoot));
        delete _purchases().events[id].roundTables;
        for(uint256 i;i<s.seating[id].open.length;i++){uint32 table=s.seating[id].open[i];bytes32 key=tableId(id,table);Plan storage p=s.plans[key];if(s.activeHand[key]!=0||s.seating[id].tables[table].busy)revert Locked();p.hand=0;p.round=e.round;p.resolved=false;_purchases().events[id].roundTables.push(table);}
    }
    function beginHand(bytes32 id,uint32 table)external onlyHost guarded returns(bytes32 hand){
        State storage s=_state();Event storage e=s.events[id];bytes32 key=tableId(id,table);Plan storage p=s.plans[key];PokerTournamentPolicy420.Config memory c=_config(id);
        if(e.phase!=Phase.PLAYING||!s.seating[id].active[table]||p.round!=e.round||p.hand!=0||s.activeHand[key]!=0||!s.tableRefs[key].configured)revert WrongPhase();
        escrow.tick(id);if(escrow.eventOf(id).state!=PokerTournamentRuntimeEscrow420.State.STARTING)revert WrongPhase();
        if(emergency.isHalted(BetTypes420.EmergencyDomain.NEW_WAGERS,0)||emergency.isHalted(BetTypes420.EmergencyDomain.GAME_VERSION,c.gameVersion)||emergency.isHalted(BetTypes420.EmergencyDomain.POKER_NEW_HANDS,key))revert Unauthorized();
        if(e.clock.state==PokerTournamentStructure420.State.NONE)e.clock.start(e.context,c.maxTables,c.recoveryGrace,e.levels,block.timestamp);
        if(e.clock.state!=PokerTournamentStructure420.State.RUNNING)revert WrongPhase();
        PokerTournamentStructure420.Position memory position=PokerTournamentStructure420.at(e.levels,e.clock.elapsed(block.timestamp));p.level=position.level;p.smallBlind=position.smallBlind;p.bigBlind=position.bigBlind;
        PokerConfidentialDeal420 deals=PokerConfidentialDeal420(s.deals);uint16 mask=s.seating[id].tables[table].mask;
        bytes32 snapshot=deals.snapshotFor(key,mask);bytes32 prior=keccak256(abi.encode(DOMAIN,e.context,e.purpose,e.round,e.roundRoot,s.seating[id].revision,key));
        hand=deals.begin(key,deals.lastNonce(key)+1,uint64(block.timestamp+3600),prior,snapshot,mask);p.hand=hand;
        Frozen storage f=s.frozen[hand];if(f.eventId!=0)revert Invalid();f.eventId=id;f.table=key;f.round=e.round;f.mask=mask;f.epoch=s.seatVersion[key];
        for(uint8 i;i<9;i++)if((mask&(uint16(1)<<i))!=0){f.people[i]=_person(key,i);f.initialChips[i]=_seat(key,i).chips;f.total+=f.initialChips[i];}
        e.hands.lock(e.clock,e.levels,e.context,key,hand,block.timestamp);s.seating[id].lock(s.seating[id].context,table,hand,s.seating[id].revision);
        _engine().reserve(hand);emit HandPlanned(id,hand,key,e.round,p.level,p.smallBlind,p.bigBlind);
    }
    function startHand(bytes32 hand)external onlyHost guarded {
        State storage s=_state();Frozen storage f=s.frozen[hand];Event storage e=s.events[f.eventId];if(e.phase!=Phase.PLAYING||f.eventId==0||s.activeHand[f.table]!=hand)revert WrongPhase();
        escrow.tick(f.eventId);if(escrow.eventOf(f.eventId).state!=PokerTournamentRuntimeEscrow420.State.STARTING)revert WrongPhase();
        // allAcknowledged includes the proof book's pre-initialization admission gate.
        // Preserve its actual successful result before the canonical engine changes that phase.
        if(!_engine().shuffle().isProofComplete(hand)||!_engine().deliveryForTable(f.table).allAcknowledged(hand))revert Invalid();
        f.admission=keccak256(abi.encode(DOMAIN,e.context,hand,f.snapshot));
        _engine().start(hand,0,e.turnSeconds);
        if(!e.started){e.started=true;escrow.confirmStarted(f.eventId,hand);}
    }
}
