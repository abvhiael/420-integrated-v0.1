// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Deterministic native five-of-seven Texas Hold'em evaluator.
/// @dev Card encoding matches independently exercised Node/Go test vectors:
///      id = suit*13 + rankIndex, rankIndex=0 => 2, 12 => Ace.
contract PokerHandRank420 {
    error InvalidCard();

    function rank7(uint8[7] memory cards) public pure returns(uint256 best) {
        uint256 seen;
        for(uint8 i=0;i<7;i++){
            if(cards[i]>=52||(seen&(uint256(1)<<cards[i]))!=0)revert InvalidCard();
            seen|=uint256(1)<<cards[i];
        }
        for(uint8 a=0;a<3;a++)
        for(uint8 b=a+1;b<4;b++)
        for(uint8 c=b+1;c<5;c++)
        for(uint8 d=c+1;d<6;d++)
        for(uint8 e=d+1;e<7;e++){
            uint8[5] memory five=[cards[a],cards[b],cards[c],cards[d],cards[e]];
            uint256 score=_rank5(five);
            if(score>best)best=score;
        }
    }
    function rank5(uint8[5] memory cards) external pure returns(uint256){
        uint256 seen;
        for(uint8 i=0;i<5;i++){
            if(cards[i]>=52||(seen&(uint256(1)<<cards[i]))!=0)revert InvalidCard();
            seen|=uint256(1)<<cards[i];
        }
        return _rank5(cards);
    }
    function _rank5(uint8[5] memory cards) private pure returns(uint256){
        uint8[15] memory cnt;
        uint8[4] memory suits;
        for(uint8 i=0;i<5;i++){cnt[(cards[i]%13)+2]++;suits[cards[i]/13]++;}
        bool flush=suits[0]==5||suits[1]==5||suits[2]==5||suits[3]==5;
        uint8 straight;
        for(uint8 high=14;high>=5;high--){
            bool all=true;
            for(uint8 j=0;j<5;j++){
                uint8 rank=high-j;
                if(high==5&&rank==1)rank=14;
                if(cnt[rank]==0){all=false;break;}
            }
            if(all){straight=high;break;}
        }
        uint8 four;
        uint8 trip;
        uint8 hiPair;
        uint8 lowPair;
        uint8[5] memory kickers;
        uint8 cursor;
        for(uint8 rank=14;rank>=2;rank--){
            if(cnt[rank]==4)four=rank;
            else if(cnt[rank]==3)trip=rank;
            else if(cnt[rank]==2){
                if(hiPair==0)hiPair=rank;else lowPair=rank;
            }
            for(uint8 j=0;j<cnt[rank];j++)kickers[cursor++]=rank;
        }
        uint8[5] memory ordered;
        uint8 category;
        if(flush&&straight!=0){category=8;ordered[0]=straight;}
        else if(four!=0){
            category=7;ordered[0]=four;
            for(uint8 rank=14;rank>=2;rank--)if(cnt[rank]==1){ordered[1]=rank;break;}
        }else if(trip!=0&&hiPair!=0){category=6;ordered[0]=trip;ordered[1]=hiPair;}
        else if(flush){category=5;ordered=kickers;}
        else if(straight!=0){category=4;ordered[0]=straight;}
        else if(trip!=0){
            category=3;ordered[0]=trip;cursor=1;
            for(uint8 rank=14;rank>=2;rank--)if(cnt[rank]==1)ordered[cursor++]=rank;
        }else if(hiPair!=0&&lowPair!=0){
            category=2;ordered[0]=hiPair;ordered[1]=lowPair;
            for(uint8 rank=14;rank>=2;rank--)if(cnt[rank]==1)ordered[2]=rank;
        }else if(hiPair!=0){
            category=1;ordered[0]=hiPair;cursor=1;
            for(uint8 rank=14;rank>=2;rank--)if(cnt[rank]==1)ordered[cursor++]=rank;
        }else{ordered=kickers;}
        uint256 score=category;
        for(uint8 i=0;i<5;i++)score=score*15+ordered[i];
        return score;
    }
}
