// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerTournamentQueuedAdmissions420.sol";
import "./PokerTournamentChipPurchases420.sol";
contract PokerTournamentPurchaseClosure420 is PokerTournamentPurchasesModule420 {
    using PokerTournamentTableBalance420 for PokerTournamentTableBalance420.Layout;
    using PokerTournamentStandings420 for PokerTournamentStandings420.Book;
    using PokerTournamentStructure420 for PokerTournamentStructure420.Clock;
    using PokerTournamentStructure420 for PokerTournamentStructure420.Hands;
    constructor(address e,address b,address x,address h)PokerTournamentPurchasesModule420(e,b,x,h){}
    function expireRebuy(bytes32 id,bytes32 person)external onlyHost guarded { _state().standings[id].expireRebuy(person,uint64(block.timestamp)); }
    function processRound(bytes32 id,uint32 limit)external onlyHost guarded {
        if(limit==0||limit>32)revert Invalid();State storage s=_state();Event storage e=s.events[id];PokerTournamentStandings420.Book storage standings=s.standings[id];
        if((e.phase!=Phase.PLAYING&&e.phase!=Phase.PROCESSING)||e.resolved!=e.expected||e.expected==0||standings.pending!=0)revert WrongPhase();e.phase=Phase.PROCESSING;
        for(uint32 n;n<limit&&e.processCursor<standings.people.length;n++){
            bytes32 person=standings.people[e.processCursor++];PokerTournamentTableBalance420.Player storage p=s.seating[id].people[person];
            if(p.seated&&p.chips==0){if(standings.byPerson[person].status!=PokerTournamentStandings420.Status.ELIMINATED)revert Invalid();uint32 table=p.table;if(s.actorPerson[id][p.payer]==person)delete s.actorPerson[id][p.payer];s.seating[id].removeZero(person,s.seating[id].revision);++s.seatVersion[tableId(id,table)];}
        }
        if(e.processCursor<standings.people.length)return;
        if(!IC6AdmissionHost420(address(this)).resolveAtBarrier(id,limit))return;
        if(!standings.tiers(limit))return;
        e.roundRoot=keccak256(abi.encode(e.roundRoot,_purchases().events[id].purchaseRoot));
        for(uint256 i;i<_purchases().events[id].roundTables.length;i++){
            uint32 table=_purchases().events[id].roundTables[i];bytes32 key=tableId(id,table);bytes32 hand=s.plans[key].hand;Frozen storage f=s.frozen[hand];
            if(!s.plans[key].resolved||!f.settled||f.aborted||f.round!=e.round)revert Invalid();
            PokerNLHEStorage420.SettlementReceipt memory receipt=_engine().settlementReceipt(hand);
            e.roundRoot=keccak256(abi.encode(e.roundRoot,key,hand,receipt.terminalTranscript,receipt.finalChips));
            uint16 mask=s.seating[id].tables[table].mask;if(mask!=0){PokerNLHEStorage420.Game memory g=_engine().gameOf(hand);uint8 b=_next(mask,g.button);uint8 count=PokerTournamentTableBalance420._count(mask);
                if(count==2&&_next(mask,b)==g.bigBlindSeat)b=g.bigBlindSeat;
                s.seating[id].tables[table].button=b;s.seating[id].tables[table].nextBB=count==2?_next(mask,b):_next(mask,_next(mask,b));
            }
        }
        standings.close();emit RoundClosed(id,e.round,e.roundRoot,standings.live);
        if(standings.finished){e.phase=Phase.FINISHING;e.clock.finish(e.hands,block.timestamp,_config(id).recoveryGrace);return;}
        e.phase=Phase.DRAWING;if(_entropy().configuration(e.profile)!=e.profileHash)revert Invalid();
        e.drawRequest=_entropy().request(e.purpose,e.roundRoot,e.profile,e.entropyTimeout);
    }
    function _next(uint16 mask,uint8 from)private pure returns(uint8){for(uint8 i=1;i<=9;i++){uint8 seat=uint8((uint256(from)+i)%9);if((mask&(uint16(1)<<seat))!=0)return seat;}revert Invalid();}
    function finalizeStandings(bytes32 id,uint32 limit)external onlyHost guarded {
        Event storage e=_state().events[id];if(e.phase!=Phase.FINISHING)revert WrongPhase();
        if(_state().standings[id].finalize(limit)){e.phase=Phase.COMPLETE;emit TournamentComplete(id,_state().standings[id].champion,_state().standings[id].resultRoot);}
    }
    function pause(bytes32 id)external onlyHost guarded {
        _cap(id,PAUSE);Event storage e=_state().events[id];if(e.phase!=Phase.PLAYING||e.clock.state!=PokerTournamentStructure420.State.RUNNING)revert WrongPhase();
        e.clock.pause(block.timestamp,_config(id).recoveryGrace);e.phase=Phase.PAUSED;
    }
    function resume(bytes32 id)external onlyHost guarded {
        _cap(id,PAUSE);Event storage e=_state().events[id];if(_purchases().events[id].breakState==BreakState.OPEN)revert WrongPhase();if(e.phase!=Phase.PAUSED)revert WrongPhase();e.clock.resume(block.timestamp,_config(id).recoveryGrace);e.phase=Phase.PLAYING;
    }
    function observePause(bytes32 id)external onlyHost guarded {
        Event storage e=_state().events[id];if(e.phase!=Phase.PAUSED)revert WrongPhase();
        PurchaseEvent storage p=_purchases().events[id];if(p.breakState==BreakState.OPEN){
            if(block.timestamp>=uint256(p.closesAt)+_config(id).recoveryGrace){e.clock.state=PokerTournamentStructure420.State.RECOVERY_REQUIRED;e.phase=Phase.RECOVERY_REQUIRED;emit RecoveryRequired(id,0);}return;
        }e.clock.observe(block.timestamp,_config(id).recoveryGrace);
        if(e.clock.state==PokerTournamentStructure420.State.RECOVERY_REQUIRED){e.phase=Phase.RECOVERY_REQUIRED;emit RecoveryRequired(id,0);}
    }
}
