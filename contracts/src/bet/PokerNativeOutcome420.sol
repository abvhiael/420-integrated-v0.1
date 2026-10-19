// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./PokerLiveCardReveals420.sol";
import "./PokerCanonicalRake420.sol";
import "./PokerHandRank420.sol";

/// @notice Deterministic on-chain NLHE outcome calculation from native state and
/// proven live-card openings. Never accepts operator-supplied winners or chip totals.
contract PokerNativeOutcome420 {
    PokerNLHEBetting420 public immutable engine;
    PokerLiveCardReveals420 public immutable reveals;
    PokerCanonicalRake420 public immutable rakeEngine;
    PokerHandRank420 public immutable rankings;
    error InvalidState();error InvalidPot();

    constructor(address engine_,address reveals_,address rake_,address ranks_){
        if(engine_==address(0)||reveals_==address(0)||rake_==address(0)||ranks_==address(0))
            revert InvalidState();
        engine=PokerNLHEBetting420(engine_);
        reveals=PokerLiveCardReveals420(reveals_);
        rakeEngine=PokerCanonicalRake420(rake_);
        rankings=PokerHandRank420(ranks_);
        if(address(reveals.engine())!=engine_||
           address(rakeEngine.tables())!=address(engine.deals().tables()))revert InvalidState();
    }
    function _active(uint16 mask,uint8 seat)private pure returns(bool){
        return (mask&(uint16(1)<<seat))!=0;
    }
    function _nextSeat(uint16 mask,uint8 afterSeat)private pure returns(uint8) {
        for(uint8 j=1;j<=9;j++){
            uint8 s=uint8((uint256(afterSeat)+j)%9);
            if(_active(mask,s))return s;
        }
        revert InvalidState();
    }
    /// @dev Hole-card deal order is dealer for heads-up, first seat after button
    /// for multiway, and repeats identically for second hole-card pass.
    function _holeCards(bytes32 handId,PokerNLHEBetting420.Game memory g,uint8 seat)
        private view returns(uint8 firstCard,uint8 secondCard){
        uint8 n = 0;
        for(uint8 i=0;i<9;i++)if(_active(g.seatsMask,i))n++;
        uint8 cursor=n==2?g.button:_nextSeat(g.seatsMask,g.button);
        uint8 slot=0;
        while(cursor!=seat){
            cursor=_nextSeat(g.seatsMask,cursor);
            slot++;
            if(slot>=n)revert InvalidState();
        }
        PokerLiveCardReveals420.Slot memory a=reveals.slotOf(handId,slot);
        PokerLiveCardReveals420.Slot memory z=reveals.slotOf(handId,slot+n);
        if(!a.opened||!z.opened)revert InvalidState();
        return (a.card,z.card);
    }
    function _ranks(bytes32 handId,PokerNLHEBetting420.Game memory g)
        private view returns(uint256[9] memory scores){
        if(!reveals.isStageComplete(handId,1)||!reveals.isStageComplete(handId,2)||
           !reveals.isStageComplete(handId,3)||!reveals.isStageComplete(handId,4))
            revert InvalidState();
        uint8 n = 0;
        for(uint8 i=0;i<9;i++)if(_active(g.seatsMask,i))n++;
        uint8 start=2*n;
        uint8[5] memory board;
        board[0]=reveals.slotOf(handId,start+1).card;
        board[1]=reveals.slotOf(handId,start+2).card;
        board[2]=reveals.slotOf(handId,start+3).card;
        board[3]=reveals.slotOf(handId,start+5).card;
        board[4]=reveals.slotOf(handId,start+7).card;
        for(uint8 seat=0;seat<9;seat++){
            if(!_active(g.seatsMask,seat)||engine.playerOf(handId,seat).folded)continue;
            (uint8 c1,uint8 c2)=_holeCards(handId,g,seat);
            uint8[7] memory cards=[c1,c2,board[0],board[1],board[2],board[3],board[4]];
            scores[seat]=rankings.rank7(cards);
        }
    }
    /// @notice Calculates every seat's exact final escrow balance, rake and
    /// uncalled refunds from native on-chain actions and selectively revealed cards.
    function calculate(bytes32 handId,PokerCanonicalRake420.Policy calldata policy)
        external view returns(uint256[9] memory finalChips,uint256 fee) {
        PokerNLHEBetting420.Game memory g=engine.gameOf(handId);
        bool contested=g.phase==PokerNLHEBetting420.Phase.SHOWDOWN;
        if(!g.initialized||(!contested&&g.phase!=PokerNLHEBetting420.Phase.UNCONTESTED))
            revert InvalidState();
        if(engine.ledger().activeHand(g.tableId)!=handId)revert InvalidState();
        if(address(engine.revealForTable(g.tableId))!=address(reveals))revert InvalidState();
        uint256[9] memory deposits = [uint256(0),0,0,0,0,0,0,0,0];
        bool[9] memory folded = [false,false,false,false,false,false,false,false,false];
        uint8 alive = 0;
        uint8 lone = 0;
        uint256 originalPot = 0;
        uint256 maxContribution = 0;
        uint256 secondContribution = 0;
        uint8 top = 0;
        uint8 topCount = 0;
        for(uint8 seat=0;seat<9;seat++){
            PokerNLHEBetting420.Player memory p=engine.playerOf(handId,seat);
            PokerSeatLedger420.Seat memory s=engine.ledger().seatOf(g.tableId,seat);
            finalChips[seat]=s.chips;
            if(!_active(g.seatsMask,seat))continue;
            finalChips[seat]=p.stack;
            deposits[seat]=p.contributed;
            folded[seat]=p.folded;
            originalPot+=p.contributed;
            if(!p.folded){alive++;lone=seat;}
            if(p.contributed>maxContribution){secondContribution=maxContribution;
                maxContribution=p.contributed;top=seat;topCount=1;
            }else if(p.contributed==maxContribution){topCount++;}
            else if(p.contributed>secondContribution)secondContribution=p.contributed;
        }
        if(originalPot!=g.pot || originalPot>g.initialChips ||
           originalPot+_remainingStacks(handId,g.seatsMask)!=g.initialChips)
            revert InvalidPot();
        if((contested&&alive<2)||(!contested&&alive!=1))revert InvalidState();
        // Uncalled excess belongs to its originating seat, never a contested side pot.
        uint256 refund = 0;
        if(topCount==1&&maxContribution>secondContribution) {
            refund=maxContribution-secondContribution;
            deposits[top]-=refund;finalChips[top]+=refund;
        }
        uint256 gross=originalPot-refund;
        bool flopSeen=engine.flopOpened(handId);
        fee=rakeEngine.rake(g.tableId,policy,gross,flopSeen,!contested);
        if(fee>gross)revert InvalidPot();
        if(!contested){
            finalChips[lone]+=gross-fee;
        }else{
            uint256[9] memory scores=_ranks(handId,g);
            _awardPots(deposits,folded,scores,g.button,fee,gross,finalChips);
        }
        uint256 afterTotal = 0;
        for(uint8 i=0;i<9;i++)if(_active(g.seatsMask,i))afterTotal+=finalChips[i];
        if(afterTotal+fee!=g.initialChips)revert InvalidPot();
    }
    function _remainingStacks(bytes32 handId,uint16 mask)private view returns(uint256 sum){
        for(uint8 i=0;i<9;i++)if(_active(mask,i))sum+=engine.playerOf(handId,i).stack;
    }
    function _awardPots(uint256[9] memory deposits,bool[9] memory folded,
        uint256[9] memory scores,uint8 button,uint256 rake,uint256 gross,
        uint256[9] memory finalChips)private pure {
        uint256 previous = 0;
        uint256 remainingRake=rake;
        for(uint8 stage=0;stage<9;stage++){
            uint256 tier=type(uint256).max;
            uint8 supporters = 0;
            for(uint8 i=0;i<9;i++)if(deposits[i]>previous&&deposits[i]<tier)
                tier=deposits[i];
            if(tier==type(uint256).max)break;
            for(uint8 i=0;i<9;i++)if(deposits[i]>=tier)supporters++;
            uint256 pot=(tier-previous)*supporters;
            uint256 cut = 0;
            bool last=true;
            for(uint8 i=0;i<9;i++)if(deposits[i]>tier)last=false;
            if(last)cut=remainingRake;
            else {
                if(gross==0||rake>type(uint256).max/pot)revert InvalidPot();
                cut=(rake*pot)/gross;
            }
            if(cut>pot||cut>remainingRake)revert InvalidPot();
            remainingRake-=cut;
            uint256 best=0;uint16 winners=0;uint8 count=0;
            for(uint8 i=0;i<9;i++)if(deposits[i]>=tier&&!folded[i]){
                if(winners==0||scores[i]>best){best=scores[i];winners=uint16(1)<<i;count=1;}
                else if(scores[i]==best){winners|=uint16(1)<<i;count++;}
            }
            if(count==0)revert InvalidPot();
            uint256 each=(pot-cut)/count;
            uint256 odd=(pot-cut)%count;
            for(uint8 j=1;j<=9;j++){
                uint8 seat=uint8((uint256(button)+j)%9);
                if((winners&(uint16(1)<<seat))!=0){
                    finalChips[seat]+=each;
                    if(odd!=0){finalChips[seat]++;odd--;}
                }
            }
            previous=tier;
        }
        if(remainingRake!=0)revert InvalidPot();
    }
}
