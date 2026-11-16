// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../BridgeWire420.sol";
import "../BridgeCrypto420.sol";

/// @notice Equihash (200,9) validation with personalized BLAKE2b via EIP-152.
/// Does not establish difficulty context, ancestry, notarization or global tip.
library PirateEquihash420 {
    error InvalidEquihash();error Blake2Unavailable();error InvalidTarget();
    uint256 internal constant POW_LIMIT=0x0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f;
    function target(uint32 bits) internal pure returns(uint256 t){
        uint256 size=bits>>24;uint256 word=bits&0x007fffff;
        if(word==0||(bits&0x00800000)!=0||size>34||(word>0xff&&size>33)||(word>0xffff&&size>32))revert InvalidTarget();
        t=size<=3?word>>(8*(3-size)):word<<(8*(size-3));if(t==0||t>POW_LIMIT)revert InvalidTarget();
    }
    function blockWork(bytes memory header) internal pure returns(uint256){if(header.length!=1487)revert InvalidTarget();uint256 t=target(uint32(BridgeWire420.readLE(header,104,4)));return (~t/(t+1))+1;}
    function initial() private pure returns(uint64[8] memory h){
        h=[uint64(0x6a09e667f3bcc908)^uint64(0x01010032),0xbb67ae8584caa73b,0x3c6ef372fe94f82b,0xa54ff53a5f1d36f1,0x510e527fade682d1,0x9b05688c2b3e6c1f,0x1f83d9abfb41bd6b^uint64(0x576f50687361635a),0x5be0cd19137e2179^uint64(200|(uint64(9)<<32))];
    }
    function swap64(uint64 x) private pure returns(uint64) {
        x=((x&0x00ff00ff00ff00ff)<<8)|((x&0xff00ff00ff00ff00)>>8);
        x=((x&0x0000ffff0000ffff)<<16)|((x&0xffff0000ffff0000)>>16);
        return (x<<32)|(x>>32);
    }
    function compress(uint64[8] memory h,bytes memory block_,uint64 count,bool last) private view returns(uint64[8] memory out){
        bytes memory input=new bytes(256);bytes memory result=new bytes(96);
        assembly ("memory-safe"){mstore(add(input,32),shl(224,12))}
        for(uint256 i;i<8;++i){uint64 v=swap64(h[i]);assembly ("memory-safe"){mstore(add(add(input,36),mul(i,8)),shl(192,v))}}
        assembly ("memory-safe"){
            mcopy(add(input,100),add(block_,32),128)
        }
        uint64 counter=swap64(count);assembly ("memory-safe"){mstore(add(input,228),shl(192,counter))}
        input[212]=last?bytes1(0x01):bytes1(0x00);bool ok;uint256 returned;
        assembly ("memory-safe"){ok:=staticcall(gas(),9,add(input,32),213,add(result,32),64) returned:=returndatasize()}
        if(!ok||returned!=64)revert Blake2Unavailable();
        for(uint256 i;i<8;++i){uint64 v;assembly ("memory-safe"){v:=shr(192,mload(add(add(result,32),mul(i,8))))}out[i]=swap64(v);}
    }
    function verify(bytes memory header) internal view returns(bytes32 id){
        if(header.length!=1487)revert InvalidEquihash();
        id=BridgeCrypto420.sha256d(header);uint256 powHash=BridgeWire420.readLE(abi.encodePacked(id),0,32);
        if(powHash>target(uint32(BridgeWire420.readLE(header,104,4))))revert InvalidTarget();
        verifySolution(header);
    }
    /// @dev Puzzle-only primitive, independent of target. Bridge admission MUST
    /// call verify(), which also checks hash-versus-target. Separate primitives
    /// let adversarial tests reach collision/order checks without re-mining PoW.
    function verifySolution(bytes memory header) internal view {
        if(header.length!=1487||header[140]!=0xfd||header[141]!=0x40||header[142]!=0x05)revert InvalidEquihash();
        bytes memory first=new bytes(128);for(uint256 i;i<128;++i)first[i]=header[i];uint64[8] memory pre=compress(initial(),first,128,false);
        uint256[] memory hashes=new uint256[](512);uint256[] memory indices=new uint256[](512);uint256[] memory seen=new uint256[](8192);
        uint256 accumulator;uint256 available;uint256 cursor=143;
        for(uint256 i;i<512;++i){
            while(available<21){accumulator=(accumulator<<8)|uint8(header[cursor++]);available+=8;}
            available-=21;uint256 index=(accumulator>>available)&0x1fffff;indices[i]=index;
            uint256 mask=uint256(1)<<(index&255);if(seen[index>>8]&mask!=0)revert InvalidEquihash();seen[index>>8]|=mask;
            bytes memory finalBlock=new bytes(128);for(uint256 j;j<12;++j)finalBlock[j]=header[128+j];
            uint256 group=index/2;for(uint256 j;j<4;++j)finalBlock[12+j]=bytes1(uint8(group>>(8*j)));
            uint64[8] memory digest=compress(pre,finalBlock,144,true);bytes memory raw=new bytes(96);
            for(uint256 j;j<8;++j){uint64 v=swap64(digest[j]);assembly ("memory-safe"){mstore(add(add(raw,32),mul(j,8)),shl(192,v))}}
            uint256 hash;uint256 offset=(index&1)*25;assembly ("memory-safe"){hash:=shr(56,mload(add(add(raw,32),offset)))}hashes[i]=hash;
        }
        uint256 length=512;uint256 width=200;
        for(uint256 round;round<9;++round){
            for(uint256 i;i<length;i+=2){
                if(indices[i]>=indices[i+1]||hashes[i]>>(width-20)!=hashes[i+1]>>(width-20))revert InvalidEquihash();
                hashes[i/2]=hashes[i]^hashes[i+1];indices[i/2]=indices[i];
            }
            length/=2;width-=20;
        }
        if(hashes[0]!=0)revert InvalidEquihash();
    }
}
