// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library AssetMath420 {
    enum Rounding { DOWN, UP }

    function scale(
        uint256 amount,
        uint8 fromDecimals,
        uint8 toDecimals,
        Rounding rounding
    ) internal pure returns(uint256 result,uint256 dust) {
        if(fromDecimals==toDecimals) return(amount,0);

        if(fromDecimals<toDecimals){
            uint256 factor=10**uint256(toDecimals-fromDecimals);
            return(amount*factor,0);
        }

        uint256 divisor=10**uint256(fromDecimals-toDecimals);
        result=amount/divisor;
        dust=amount%divisor;

        if(rounding==Rounding.UP && dust>0){
            result+=1;
        }
    }
}
