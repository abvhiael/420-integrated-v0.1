// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerTournamentHostAdmission420.sol";
contract PokerTournamentHostBalance420 is PokerTournamentHostModule420 {
    using PokerTournamentTableBalance420 for PokerTournamentTableBalance420.Layout;
    constructor(address e,address b,address x,address h)PokerTournamentHostModule420(e,b,x,h){}
    function requireEntropyRecovery(bytes32 id)external onlyHost guarded {
        Event storage e=_state().events[id];bool expired=(e.phase==Phase.PREPARING&&_entropy().preparationExpired(e.purpose))||(e.phase==Phase.DRAWING&&_entropy().expired(e.drawRequest));
        if(!expired)revert WrongPhase();e.phase=Phase.RECOVERY_REQUIRED;emit RecoveryRequired(id,0);
    }
    function balance(bytes32 id)external onlyHost guarded returns(PokerTournamentTableBalance420.Result result){
        State storage s=_state();Event storage e=s.events[id];PokerTournamentTableBalance420.Layout storage seats=s.seating[id];
        if(e.phase==Phase.DRAWING){e.drawSeed=_entropy().result(e.drawRequest);if(e.drawSeed==0)revert Invalid();e.phase=Phase.BALANCING;}
        if(e.phase!=Phase.BALANCING||e.hands.activeCount!=0||s.standings[id].pending!=0||seats.players!=s.standings[id].live)revert WrongPhase();
        if(seats.open.length>1&&seats.players<=uint256(seats.capacity)*(seats.open.length-1)){
            PokerTournamentTableBalance420.Move[] memory moves;(result,moves)=seats.breakHighest(seats.revision,e.drawSeed);
            for(uint256 i;i<moves.length;i++){++s.seatVersion[tableId(id,moves[i].from)];++s.seatVersion[tableId(id,moves[i].to)];}
            return result;
        }
        PokerTournamentTableBalance420.Move memory move_;(result,move_)=seats.balanceOne(seats.revision);
        if(result==PokerTournamentTableBalance420.Result.MOVED){++s.seatVersion[tableId(id,move_.from)];++s.seatVersion[tableId(id,move_.to)];return result;}
        if(result!=PokerTournamentTableBalance420.Result.BALANCED)return result;
        (uint8 low,uint8 high,,)=seats.bounds();if(low<2||high>low+1)revert Invalid();
        if(seats.open.length==1){uint32 last=seats.open[0];if(!e.finalTable||e.finalTableId!=last)emit FinalTable(id,last,seats.players);e.finalTable=true;e.finalTableId=last;}
        else {e.finalTable=false;e.finalTableId=0;}
        e.phase=Phase.READY;
    }
}
