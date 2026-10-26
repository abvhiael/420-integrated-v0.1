// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerTournamentHostAdmission420.sol";
contract PokerTournamentHostLedger420 is PokerTournamentHostModule420 {
    using PokerTournamentTableBalance420 for PokerTournamentTableBalance420.Layout;
    using PokerTournamentStandings420 for PokerTournamentStandings420.Book;
    using PokerTournamentStructure420 for PokerTournamentStructure420.Hands;
    constructor(address e,address b,address x,address h)PokerTournamentHostModule420(e,b,x,h){}
    modifier ledgerGuarded(){State storage s=_state();if(s.ledgerEntered)revert Reentrancy();s.ledgerEntered=true;_;s.ledgerEntered=false;}
    function reserveHand(bytes32 table,bytes32 hand,uint16 mask,uint64 epoch)external onlyHost ledgerGuarded returns(bytes32 snapshot){
        _onlyEngine();State storage s=_state();TableRef storage t=s.tableRefs[table];Event storage e=s.events[t.eventId];Frozen storage f=s.frozen[hand];
        if(e.phase!=Phase.PLAYING||s.activeHand[table]!=0||s.consumed[hand]||f.reserved||f.table!=table||f.mask!=mask||mask==0||f.epoch!=epoch||epoch!=s.seatVersion[table]||s.plans[table].hand!=hand||f.round!=e.round)revert Locked();
        snapshot=keccak256(abi.encode(keccak256("420.BET.POKER.ESCROW.SNAPSHOT.V1"),block.chainid,address(this),table,hand,mask,epoch));
        uint256 total=0;uint8 count=0;
        for(uint8 i;i<9;i++)if((mask&(uint16(1)<<i))!=0){
            if(!_eligible(table,i))revert Invalid();PokerSeatLedger420.Seat memory p=_seat(table,i);if(p.chips!=f.initialChips[i]||_person(table,i)!=f.people[i])revert Invalid();
            total+=p.chips;++count;snapshot=keccak256(abi.encode(snapshot,i,p.player,p.chips,p.sittingOut,p.epoch));
        }
        if(count<2||total!=f.total||total==0)revert Invalid();f.reserved=true;f.snapshot=snapshot;s.activeHand[table]=hand;
    }
    function settleReservedHand(bytes32 table,bytes32 hand,uint256[9] calldata after_,uint256 rake)external onlyHost ledgerGuarded {
        _onlyEngine();State storage s=_state();Frozen storage f=s.frozen[hand];TableRef storage t=s.tableRefs[table];Event storage e=s.events[t.eventId];
        if(s.activeHand[table]!=hand||!f.reserved||f.settled||f.aborted||s.consumed[hand]||f.table!=table||f.round!=e.round||rake!=0||s.seatVersion[table]!=f.epoch)revert Invalid();
        PokerTournamentNLHE420 engine=_engine();PokerNLHEStorage420.SettlementReceipt memory r=engine.settlementReceipt(hand);
        if(!engine.handSettled(hand)||engine.handAborted(hand)||r.tableId!=table||r.terminalTranscript==0||r.escrowSnapshot!=f.snapshot||r.seatsMask!=f.mask||r.rake!=0||r.calculatorCodeHash==0||r.calculatorCodeHash!=engine.outcomeCodeHash(table)||keccak256(abi.encode(r.finalChips))!=keccak256(abi.encode(after_)))revert Invalid();
        uint256 total=0;uint256[9] memory ending=[uint256(0),0,0,0,0,0,0,0,0];
        for(uint8 i;i<9;i++){
            if((f.mask&(uint16(1)<<i))==0){if(after_[i]!=0)revert Invalid();continue;}
            PokerTournamentTableBalance420.Player storage p=s.seating[t.eventId].people[f.people[i]];
            if(_person(table,i)!=p.person||p.chips!=f.initialChips[i]||after_[i]>type(uint128).max)revert Invalid();
            ending[i]=after_[i];total+=after_[i];p.chips=uint128(after_[i]);++p.blindHistory;
        }
        if(total!=f.total)revert Invalid();
        s.standings[t.eventId].observe(hand,t.id,f.people,f.mask,f.initialChips,ending,_config(t.eventId),e.clock.startedAt,_level(t.eventId),uint64(block.timestamp));
        f.settled=true;s.consumed[hand]=true;delete s.activeHand[table];s.plans[table].resolved=true;++e.resolved;
        s.seating[t.eventId].unlock(s.seating[t.eventId].context,t.id,hand,s.seating[t.eventId].revision);
        e.hands.close(e.context,table,hand);emit HandObserved(t.eventId,hand,e.round,r.terminalTranscript);
    }
    function cancelReservedHand(bytes32 table,bytes32 hand)external onlyHost ledgerGuarded {
        _onlyEngine();State storage s=_state();Frozen storage f=s.frozen[hand];TableRef storage t=s.tableRefs[table];
        if(s.activeHand[table]!=hand||f.table!=table||!f.reserved||f.settled||f.aborted||!_engine().handAborted(hand))revert Invalid();
        f.aborted=true;s.consumed[hand]=true;delete s.activeHand[table];s.events[t.eventId].phase=Phase.RECOVERY_REQUIRED;
        s.seating[t.eventId].unlock(s.seating[t.eventId].context,t.id,hand,s.seating[t.eventId].revision);s.events[t.eventId].hands.close(s.events[t.eventId].context,table,hand);
        emit RecoveryRequired(t.eventId,hand);
    }
    function markTimedOut(bytes32 table,bytes32 hand,uint8 seat)external onlyHost ledgerGuarded {
        _onlyEngine();State storage s=_state();if(s.activeHand[table]!=hand||seat>=9||(s.frozen[hand].mask&(uint16(1)<<seat))==0)revert Invalid();
        s.timedOut[s.tableRefs[table].eventId][_person(table,seat)]=true;
        // A tournament disconnect/timeout never removes a stack from mandatory future blinds.
    }
}
