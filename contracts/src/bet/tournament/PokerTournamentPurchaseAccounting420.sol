// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerTournamentPolicy420.sol";

/// @notice Financial arithmetic only. An eligibility preview is never hand evidence.
library PokerTournamentPurchaseAccounting420 {
    error InvalidPurchase();
    struct Quote { uint256 prize; uint256 fee; uint256 total; uint256 chips; }
    function quote(uint128 buyIn,uint128 stack) internal pure returns(Quote memory q) {
        if(stack==0)revert InvalidPurchase();
        q=Quote(buyIn,PokerTournamentPolicy420.fee(buyIn),uint256(buyIn)+PokerTournamentPolicy420.fee(buyIn),stack);
    }
    /// @dev Caller must independently establish every gameplay fact before using this result.
    function extraAllowed(PokerTournamentPolicy420.Config memory c,uint16 used,uint256 chips,
        bool eliminated,bool safeBoundary,uint64 started,uint16 level,uint256 now_,uint64 choiceDeadline)
        internal pure returns(bool)
    {
        if(c.purchaseKind==PokerTournamentPolicy420.PurchaseKind.FREEZEOUT||used>=c.extraCap||chips!=0||!safeBoundary||
            !PokerTournamentPolicy420.windowOpen(started,c.extraDuration,c.extraLevel,level,now_))return false;
        if(c.purchaseKind==PokerTournamentPolicy420.PurchaseKind.RE_ENTRY)return eliminated;
        return !eliminated&&choiceDeadline>now_;
    }
}
