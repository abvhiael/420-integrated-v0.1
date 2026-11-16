// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Exact current native PotCoin consensus arithmetic, pinned to upstream
/// 24b987951186417af909a9cf1ea4da736e782c0f. Does not turn a header into a UTXO proof.
library PotcoinConsensus420 {
    uint256 internal constant COIN=100_000_000;
    uint256 internal constant MAX_MONEY=420_000_000*COIN;
    uint256 internal constant STAKE_LIMIT=type(uint256).max>>24;
    uint256 internal constant WORK_LIMIT=type(uint256).max>>20;
    uint32 internal constant SPACING=258; // upstream unsigned int nTargetSpacing = 4.3 * 60
    error InvalidConsensus();
    function little(uint256 value,uint256 n) internal pure returns(bytes memory out){out=new bytes(n);for(uint256 i;i<n;++i)out[i]=bytes1(uint8(value>>(8*i)));}
    function reverse(bytes32 h) internal pure returns(uint256 n){for(uint256 i;i<32;++i)n|=uint256(uint8(h[i]))<<(8*i);}
    function compact(uint256 t) internal pure returns(uint32 out){
        if(t==0)return 0;uint256 size;uint256 x=t;while(x!=0){++size;x>>=8;}
        uint256 word=size<=3?t<<(8*(3-size)):t>>(8*(size-3));
        if(word&0x800000!=0){word>>=8;++size;}return uint32((size<<24)|word);
    }
    function target(uint32 bits,bool pos) internal pure returns(uint256 t){
        uint256 size=bits>>24;uint256 word=bits&0x7fffff;
        if(word==0||bits&0x800000!=0||size>32)revert InvalidConsensus();
        t=size<=3?word>>(8*(3-size)):word<<(8*(size-3));
        if(t==0||t>(pos?STAKE_LIMIT:WORK_LIMIT)||compact(t)!=bits)revert InvalidConsensus();
    }
    function trust(uint32 bits,bool pos) internal pure returns(uint256){uint256 t=target(bits,pos);return (type(uint256).max-t)/(t+1)+1;}
    function nextBits(uint32 previous,uint32 lastTime,uint32 olderTime,bool pos) internal pure returns(uint32){
        uint256 t=target(previous,pos);uint256 spacing=lastTime<olderTime?SPACING:uint256(lastTime)-olderTime;
        uint256 numerator=12*uint256(SPACING)+2*spacing;uint256 denominator=14*uint256(SPACING);
        uint256 limit=pos?STAKE_LIMIT:WORK_LIMIT;
        // Equivalent to native unbounded CBigNum arithmetic, without a uint256 intermediate overflow.
        if(numerator>(limit*denominator)/t)return compact(limit);
        uint256 result=t*numerator/denominator;if(result==0||result>limit)result=limit;return compact(result);
    }
    function kind(uint64 height,bool pos) internal pure {if((pos&&height<20)||(!pos&&height>500))revert InvalidConsensus();}
    function coinDayWeight(uint64 amount,uint32 txTime,uint32 stakeTime) internal pure returns(uint256){
        if(amount==0||amount>MAX_MONEY||uint256(stakeTime)<uint256(txTime)+900)revert InvalidConsensus();
        uint256 age=uint256(stakeTime)-txTime-900;if(age>25 days)age=25 days;
        return uint256(amount)*age/COIN/1 days;
    }
    function kernel(uint64 stakeModifier,uint32 blockFromTime,uint32 txOffset,uint32 txPrevTime,uint32 index,uint32 stakeTime) internal pure returns(bytes32){
        return sha256(abi.encodePacked(sha256(bytes.concat(little(stakeModifier,8),little(blockFromTime,4),little(txOffset,4),little(txPrevTime,4),little(index,4),little(stakeTime,4)))));
    }
    function checkKernel(uint32 bits,uint64 stakeModifier,uint32 fromTime,uint32 offset,uint32 prevTime,uint32 index,uint32 time,uint64 amount) internal pure returns(bytes32 h){
        if(uint256(fromTime)+900>time||prevTime>fromTime)revert InvalidConsensus();
        uint256 weight=coinDayWeight(amount,prevTime,time);if(weight==0)revert InvalidConsensus();uint256 t=target(bits,true);
        h=kernel(stakeModifier,fromTime,offset,prevTime,index,time);
        // Native comparison is strictly '<', not '<='; its weighted target is an unbounded integer.
        if(weight<=type(uint256).max/t&&reverse(h)>=weight*t)revert InvalidConsensus();
    }
    function timestamp(uint32 time,uint32 parentTime,uint32 median,uint256 now_) internal pure {
        if(time<=median||uint256(time)+60<parentTime||time>now_+60)revert InvalidConsensus();
    }
}
