// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../purchases/PokerTournamentPurchasesHost420.sol";
/// @notice Genuine C6 hand authority with read-only financial safety observations.
contract PokerTournamentPrizeHost420 is PokerTournamentPurchasesHost420 {
    constructor(address e,address b,address x)PokerTournamentPurchasesHost420(e,b,x){}
    function financialFacts(bytes32 id)external view returns(uint32 activeHands,uint32 pending,uint32 queued,uint64 recoveryAnchor){
        Event storage e=_state().events[id];PurchaseEvent storage p=_purchases().events[id];
        activeHands=e.hands.activeCount;pending=_state().standings[id].pending;queued=p.queue.length;recoveryAnchor=e.clock.firstPause;
        if(recoveryAnchor==0&&p.breakState==BreakState.OPEN)recoveryAnchor=p.closesAt;
    }
    function financialHand(bytes32 id,uint32 table)external view returns(bytes32){return _state().plans[tableId(id,table)].hand;}
}
