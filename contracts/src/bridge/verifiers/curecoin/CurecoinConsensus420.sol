// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Exact current native Curecoin consensus arithmetic, pinned to upstream
/// a3eb106715638e316eb03af383dc27aad2e89536. Does not turn a header into a UTXO proof.
library CurecoinConsensus420 {
    uint256 internal constant COIN=1_000_000;
    uint256 internal constant MAX_MONEY=156_000_000*COIN;
    uint256 internal constant STAKE_LIMIT=type(uint256).max>>24;
    uint256 internal constant WORK_LIMIT=type(uint256).max>>20;
    uint64 internal constant HF=257322;
    error InvalidConsensus();
    function little(uint256 value,uint256 n) internal pure returns(bytes memory out){out=new bytes(n);for(uint256 i;i<n;++i)out[i]=bytes1(uint8(value>>(8*i)));}
    function reverse(bytes32 h) internal pure returns(uint256 n){for(uint256 i;i<32;++i)n|=uint256(uint8(h[i]))<<(8*i);}
    function compact(uint256 t) internal pure returns(uint32 out){
        if(t==0)return 0;uint256 size;uint256 x=t;while(x!=0){++size;x>>=8;}
        uint256 word=size<=3?t<<(8*(3-size)):t>>(8*(size-3));
        if(word&0x800000!=0){word>>=8;++size;}return uint32((size<<24)|word);
    }
    function limit(uint64 height,bool pos) internal pure returns(uint256){return !pos||height<=14060?WORK_LIMIT:height<=15000?type(uint256).max>>30:STAKE_LIMIT;}
    function target(uint32 bits,bool pos,uint64 height) internal pure returns(uint256 t){
        uint256 size=bits>>24;uint256 word=bits&0x7fffff;
        if(word==0||bits&0x800000!=0||size>32)revert InvalidConsensus();
        t=size<=3?word>>(8*(3-size)):word<<(8*(size-3));
        if(t==0||t>limit(height,pos)||compact(t)!=bits)revert InvalidConsensus();
    }
    function trust(uint32 bits,bool pos,uint64 height) internal pure returns(uint256){uint256 t=target(bits,pos,height);return pos?(type(uint256).max-t)/(t+1)+1:1;}
    function minimumAge(uint64 height) internal pure returns(uint256){return height<=HF+1?30 days:4 days;}
    function nextBits(uint32 previous,uint32 lastTime,uint32 olderTime,bool pos,uint64 height,uint64 lastTypeHeight) internal pure returns(uint32){
        uint256 t=target(previous,false,0);uint256 spacing=height<=HF+1?600:240;
        if(!pos){spacing*=1+uint256(height)-1-lastTypeHeight;if(spacing>7200)spacing=7200;}
        uint256 interval=14400/spacing;int256 signedNumerator=int256((interval-1)*spacing)+2*(int256(uint256(lastTime))-int256(uint256(olderTime)));
        if(signedNumerator<=0)revert InvalidConsensus();uint256 numerator=uint256(signedNumerator);uint256 denominator=(interval+1)*spacing;uint256 cap=limit(height,pos);
        if(numerator>(cap*denominator)/t)return compact(cap);
        uint256 result=t*numerator/denominator;if(result==0)revert InvalidConsensus();return compact(result);
    }
    function kind(uint64 height,bool pos) internal pure {if(!pos&&height>HF)revert InvalidConsensus();}
    function coinDayWeight(uint64 amount,uint32 txTime,uint32 stakeTime,uint64 height) internal pure returns(uint256){
        return coinDayWeightAge(amount,txTime,stakeTime,uint32(minimumAge(height)));
    }
    function coinDayWeightAge(uint64 amount,uint32 txTime,uint32 stakeTime,uint32 age) internal pure returns(uint256){
        if(age!=30 days&&age!=4 days)revert InvalidConsensus();if(amount==0||amount>MAX_MONEY||uint256(stakeTime)<uint256(txTime)+age)revert InvalidConsensus();
        uint256 elapsed=uint256(stakeTime)-txTime;if(elapsed>90 days)elapsed=90 days;
        return uint256(amount)*(elapsed-age)/COIN/1 days;
    }
    function kernel(uint64 stakeModifier,uint32 blockFromTime,uint32 txOffset,uint32 txPrevTime,uint32 index,uint32 stakeTime) internal pure returns(bytes32){
        return sha256(abi.encodePacked(sha256(bytes.concat(little(stakeModifier,8),little(blockFromTime,4),little(txOffset,4),little(txPrevTime,4),little(index,4),little(stakeTime,4)))));
    }
    function checkKernel(uint32 bits,uint64 stakeModifier,uint32 fromTime,uint32 offset,uint32 prevTime,uint32 index,uint32 time,uint64 amount,uint64 height,uint32 age) internal pure returns(bytes32 h){
        if(uint256(fromTime)+age>time||prevTime>fromTime)revert InvalidConsensus();
        uint256 weight=coinDayWeightAge(amount,prevTime,time,age);uint256 t=target(bits,true,height);
        h=kernel(stakeModifier,fromTime,offset,prevTime,index,time);
        // Native kernel accepts equality; its weighted target is an unbounded integer.
        if(!meetsKernelTarget(h,t,weight))revert InvalidConsensus();
    }
    function meetsKernelTarget(bytes32 h,uint256 t,uint256 weight) internal pure returns(bool){return weight>type(uint256).max/t||reverse(h)<=weight*t;}
    function timestamp(uint32 time,uint32 parentTime,uint32 median,uint256 now_) internal pure {
        if(time<=median||uint256(time)+2 hours<parentTime||time>now_+2 hours)revert InvalidConsensus();
    }
}
