// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./DobbscoinWire420.sol";

/// @notice Mainnet target/activation/AuxPoW commitment checks. Scrypt computation,
/// retarget context and best-chain selection require authenticated native replay.
library DobbscoinConsensus420 {
    uint256 internal constant POW_LIMIT=type(uint256).max>>20;
    uint32 internal constant LIMIT_BITS=0x1e0fffff;
    uint64 internal constant AUX_HEIGHT=2_000_000;
    error InvalidConsensus();
    struct AuxPow {bytes coinbase;bytes32[] parentBranch;uint32 parentIndex;bytes32[] chainBranch;uint32 chainIndex;bytes parentHeader;}
    function reverse(bytes32 value) internal pure returns(bytes32 out){for(uint256 i;i<32;++i)out|=bytes32(uint256(uint8(value[i]))<<(8*i));}
    function target(uint32 bits) internal pure returns(uint256 value){
        uint256 size=bits>>24;uint256 word=bits&0x7fffff;
        if(word==0||bits&0x800000!=0||size>34||(word>0xff&&size>33)||(word>0xffff&&size>32))revert InvalidConsensus();
        value=size<=3?word>>(8*(3-size)):word<<(8*(size-3));if(value==0||value>POW_LIMIT)revert InvalidConsensus();
    }
    function work(uint32 bits) internal pure returns(uint256){uint256 t=target(bits);return (~t/(t+1))+1;}
    function branch(bytes32 hash,uint256 index,bytes32[] memory siblings) internal pure returns(bytes32){
        if(siblings.length>32||index>>siblings.length!=0)revert InvalidConsensus();
        for(uint256 i;i<siblings.length;++i){hash=index&1==0?BridgeCrypto420.sha256d(abi.encodePacked(hash,siblings[i])):BridgeCrypto420.sha256d(abi.encodePacked(siblings[i],hash));index>>=1;}return hash;
    }
    function expectedIndex(uint32 nonce,uint256 height) internal pure returns(uint32 result){
        if(height>30)revert InvalidConsensus();unchecked{result=nonce*1103515245+12345;result+=176;result=result*1103515245+12345;}return result%uint32(1<<height);
    }
    function activation(bytes memory header,uint64 height) internal pure returns(bool aux){
        if(header.length!=80)revert InvalidConsensus();uint32 version=uint32(BridgeWire420.readLE(header,0,4));aux=version&256!=0;
        if(height<AUX_HEIGHT){if(aux||version>>16!=0)revert InvalidConsensus();}else if(version>>16!=176)revert InvalidConsensus();
    }
    function find(bytes memory script,bytes memory needle,uint256 start) private pure returns(uint256){
        for(uint256 i=start;i+needle.length<=script.length;++i){bool match_=true;for(uint256 j;j<needle.length;++j){if(script[i+j]!=needle[j]){match_=false;break;}}if(match_)return i;}return type(uint256).max;
    }
    function checkAux(bytes memory child,AuxPow memory a) internal pure {
        if(a.parentHeader.length!=80||a.parentIndex!=0||a.chainBranch.length>30||BridgeWire420.readLE(a.parentHeader,0,4)>>16==176)revert InvalidConsensus();
        DobbscoinWire420.Transaction memory t=DobbscoinWire420.parse(a.coinbase,true);
        bytes32 parentRoot=t.id;
        // Native parent branches have no 32-level consensus cap; parent index is zero.
        for(uint256 i;i<a.parentBranch.length;++i)parentRoot=BridgeCrypto420.sha256d(abi.encodePacked(parentRoot,a.parentBranch[i]));
        if(parentRoot!=DobbscoinWire420.hashAt(a.parentHeader,36))revert InvalidConsensus();
        bytes32 root=reverse(branch(BridgeCrypto420.sha256d(child),a.chainIndex,a.chainBranch));
        bytes memory script=t.firstScript;uint256 pos=find(script,abi.encodePacked(root),0);uint256 head=find(script,hex"fabe6d6d",0);
        if(pos==type(uint256).max)revert InvalidConsensus();
        if(head!=type(uint256).max){if(find(script,hex"fabe6d6d",head+1)!=type(uint256).max||pos!=head+4)revert InvalidConsensus();}else if(pos>20)revert InvalidConsensus();
        if(BridgeWire420.readLE(script,pos+32,4)!=(1<<a.chainBranch.length)||a.chainIndex!=expectedIndex(uint32(BridgeWire420.readLE(script,pos+36,4)),a.chainBranch.length))revert InvalidConsensus();
    }
}
