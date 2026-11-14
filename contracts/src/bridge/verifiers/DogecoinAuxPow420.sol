// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./DogecoinTransaction420.sol";
/// @notice Dogecoin Core mainnet AuxPoW relationships; parent work is checked separately.
library DogecoinAuxPow420 {
    struct Proof {bytes coinbase;bytes32[] parentBranch;uint32 parentIndex;bytes32[] chainBranch;uint32 chainIndex;bytes parentHeader;}
    error InvalidAuxPow();
    function branch(bytes32 leaf,uint256 index,bytes32[] memory nodes) internal pure returns(bytes32){
        for(uint256 i;i<nodes.length;++i){leaf=index&1==0?BridgeCrypto420.sha256d(abi.encodePacked(leaf,nodes[i])):BridgeCrypto420.sha256d(abi.encodePacked(nodes[i],leaf));index>>=1;}return leaf;
    }
    function expectedIndex(uint32 nonce,uint256 height) internal pure returns(uint32){unchecked{uint32 x=nonce*1103515245+12345;x+=98;x=x*1103515245+12345;return x%uint32(uint256(1)<<height);}}
    function find(bytes memory hay,bytes memory needle,uint256 start) private pure returns(uint256){
        if(needle.length>hay.length)return type(uint256).max;
        for(uint256 i=start;i<=hay.length-needle.length;++i){bool same=true;for(uint256 j;j<needle.length;++j)if(hay[i+j]!=needle[j]){same=false;break;}if(same)return i;}return type(uint256).max;
    }
    function validate(bytes memory child,bytes memory encoded,uint64 height) internal pure returns(bytes memory parent){
        if(child.length!=80)revert InvalidAuxPow();uint32 version=uint32(BridgeWire420.readLE(child,0,4));bool aux=version&256!=0;bool legacy=version==1 || version==2;
        if((!legacy && version>>16!=98) || (height<371337 && aux) || (height>=371337 && legacy))revert InvalidAuxPow();
        int32 base=int32(version)%256;if((height>=1034383 && base<3)||(height>=3464751 && base<4))revert InvalidAuxPow();
        if(!aux){if(encoded.length!=0)revert InvalidAuxPow();return child;}
        if(encoded.length>1_100_000)revert InvalidAuxPow();Proof memory p=abi.decode(encoded,(Proof));
        if(keccak256(encoded)!=keccak256(abi.encode(p)) || p.parentHeader.length!=80 || p.parentIndex!=0 || p.parentBranch.length>32 || p.chainBranch.length>30 || p.chainIndex>>p.chainBranch.length!=0)revert InvalidAuxPow();
        if(BridgeWire420.readLE(p.parentHeader,0,4)>>16==98)revert InvalidAuxPow();
        DogecoinTransaction420.Parsed memory tx_=DogecoinTransaction420.parseParent(p.coinbase);
        if(branch(tx_.txid,0,p.parentBranch)!=bytes32(BridgeWire420.readBE(p.parentHeader,36,32)))revert InvalidAuxPow();
        bytes32 root=branch(BridgeCrypto420.sha256d(child),p.chainIndex,p.chainBranch);bytes memory reversed=new bytes(32);for(uint256 i;i<32;++i)reversed[i]=root[31-i];
        bytes memory script=tx_.firstScript;uint256 at=find(script,reversed,0);if(at==type(uint256).max)revert InvalidAuxPow();
        uint256 magic=find(script,hex"fabe6d6d",0);
        if(magic!=type(uint256).max){if(find(script,hex"fabe6d6d",magic+1)!=type(uint256).max || magic+4!=at)revert InvalidAuxPow();}
        else if(at>20)revert InvalidAuxPow();
        at+=32;if(script.length-at<8)revert InvalidAuxPow();
        uint256 size=BridgeWire420.readLE(script,at,4);uint32 nonce=uint32(BridgeWire420.readLE(script,at+4,4));
        if(size!=uint256(1)<<p.chainBranch.length || p.chainIndex!=expectedIndex(nonce,p.chainBranch.length))revert InvalidAuxPow();
        return p.parentHeader;
    }
}
