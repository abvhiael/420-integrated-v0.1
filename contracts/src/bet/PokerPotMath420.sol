// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Exact integer arithmetic for proportional pot charges.
library PokerPotMath420 {
    error InvalidRatio();
    error InvalidPot();

    /// @dev floor(amount * numerator / denominator), including full uint256 pots.
    /// The numerator is bounded by the denominator. The rare overflow path uses
    /// binary long division: quotient and remainder are bounded at every step.
    function portion(uint256 amount,uint256 numerator,uint256 denominator)
        internal pure returns(uint256 quotient) {
        if(denominator==0||numerator>denominator)
            revert InvalidRatio();
        if(numerator==0||amount==0)return 0;
        if(amount<=type(uint256).max/numerator)return amount*numerator/denominator;
        uint256 remainder=0;
        for(uint256 bit=256;bit>0;){
            --bit;
            uint256 carry=0;
            if(remainder>=denominator-remainder){
                remainder-=denominator-remainder;carry=1;
            }else remainder*=2;
            if(((amount>>bit)&1)!=0){
                if(remainder>=denominator-numerator){
                    remainder-=denominator-numerator;++carry;
                }else remainder+=numerator;
            }
            quotient=quotient*2+carry;
        }
    }

    /// @dev Deposits must already exclude the unique uncalled excess. Physical
    /// seats stay indexed 0..8, including holes in a sparse table.
    function award(uint256[9] memory deposits,bool[9] memory folded,
        uint256[9] memory scores,uint8 button,uint256 rake,uint256 gross,
        uint256[9] memory finalChips) internal pure {
        if(button>=9||rake>gross)revert InvalidPot();
        uint256 total=0;
        for(uint8 i=0;i<9;i++)total+=deposits[i];
        if(total!=gross)revert InvalidPot();
        uint256 previous = 0;
        uint256 charged=0;
        uint256 cumulative=0;
        for(uint8 stage=0;stage<9;stage++){
            uint256 tier=type(uint256).max;
            bool found=false;
            uint8 supporters = 0;
            for(uint8 i=0;i<9;i++)if(deposits[i]>previous&&(!found||deposits[i]<tier)){
                tier=deposits[i];found=true;
            }
            if(!found)break;
            for(uint8 i=0;i<9;i++)if(deposits[i]>=tier)supporters++;
            uint256 pot=(tier-previous)*supporters;
            cumulative+=pot;
            // Cumulative apportionment carries fractional charges forward.
            // Each cut is bounded by its own pot; the final charge is exact.
            uint256 nextCharge=portion(rake,cumulative,gross);
            uint256 cut=nextCharge-charged;
            charged=nextCharge;
            if(cut>pot)revert InvalidPot();
            _split(deposits,folded,scores,button,tier,pot-cut,finalChips);
            previous=tier;
        }
        if(charged!=rake)revert InvalidPot();
    }
    function _split(uint256[9] memory deposits,bool[9] memory folded,
        uint256[9] memory scores,uint8 button,uint256 tier,uint256 net,
        uint256[9] memory finalChips)private pure {
            uint256 best=0;uint16 winners=0;uint8 count=0;
            for(uint8 i=0;i<9;i++)if(deposits[i]>=tier&&!folded[i]){
                if(winners==0||scores[i]>best){best=scores[i];winners=uint16(1)<<i;count=1;}
                else if(scores[i]==best){winners|=uint16(1)<<i;count++;}
            }
            if(count==0)revert InvalidPot();
            uint256 each=net/count;
            uint256 odd=net%count;
            for(uint8 j=1;j<=9;j++){
                uint8 seat=uint8((uint256(button)+j)%9);
                if((winners&(uint16(1)<<seat))!=0){
                    finalChips[seat]+=each;
                    if(odd!=0){finalChips[seat]++;odd--;}
                }
            }

    }
}
