// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Bounds-checked wire-format utilities. No implicit truncation or trailing bytes.
library BridgeWire420 {
    error Truncated();
    error NonCanonical();
    error InvalidAddress();

    function readLE(bytes memory data,uint256 offset,uint256 width) internal pure returns(uint256 v) {
        if(width==0 || width>32) revert NonCanonical();
        if(offset>data.length || width>data.length-offset) revert Truncated();
        for(uint256 i;i<width;++i) v |= uint256(uint8(data[offset+i])) << (8*i);
    }
    function readBE(bytes memory data,uint256 offset,uint256 width) internal pure returns(uint256 v) {
        if(width==0 || width>32) revert NonCanonical();
        if(offset>data.length || width>data.length-offset) revert Truncated();
        for(uint256 i;i<width;++i) v=(v<<8)|uint8(data[offset+i]);
    }
    function encodeLE(uint256 value,uint256 width) internal pure returns(bytes memory out) {
        if(width==0 || width>32 || (width<32 && value>>(8*width)!=0)) revert NonCanonical();
        out=new bytes(width);
        for(uint256 i;i<width;++i) out[i]=bytes1(uint8(value>>(8*i)));
    }
    function encodeBE(uint256 value,uint256 width) internal pure returns(bytes memory out) {
        out=encodeLE(value,width);
        for(uint256 i;i<width/2;++i) (out[i],out[width-1-i])=(out[width-1-i],out[i]);
    }
    function compactSize(bytes memory data,uint256 at) internal pure returns(uint64 value,uint256 next) {
        uint256 tag=readLE(data,at,1);
        if(tag<253) return(uint64(tag),at+1);
        uint256 width=tag==253?2:tag==254?4:8;
        uint256 n=readLE(data,at+1,width);
        if(n<(width==2?253:width==4?65536:4294967296)) revert NonCanonical();
        return(uint64(n),at+1+width);
    }
    function encodeCompactSize(uint64 value) internal pure returns(bytes memory) {
        if(value<253) return encodeLE(value,1);
        if(value<=65535) return abi.encodePacked(bytes1(0xfd),encodeLE(value,2));
        if(value<=4294967295) return abi.encodePacked(bytes1(0xfe),encodeLE(value,4));
        return abi.encodePacked(bytes1(0xff),encodeLE(value,8));
    }
    function requireEnd(bytes memory data,uint256 offset) internal pure {
        if(offset!=data.length) revert NonCanonical();
    }
    /// @notice Canonical binary EVM address, not a human-readable address string.
    function evmAddress(bytes memory data) internal pure returns(address a) {
        if(data.length!=20) revert InvalidAddress();
        a=address(uint160(readBE(data,0,20)));
        if(a==address(0)) revert InvalidAddress();
    }
    /// @notice TRON mainnet binary address: 0x41 followed by exactly 20 bytes.
    function tronAddress(bytes memory data) internal pure returns(bytes20 a) {
        if(data.length!=21 || data[0]!=0x41) revert InvalidAddress();
        a=bytes20(uint160(readBE(data,1,20)));
        if(a==bytes20(0)) revert InvalidAddress();
    }
}
