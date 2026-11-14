// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Bounds-checked canonical RLP. Integer semantics are checked separately.
library EthereumRLP420 {
    error InvalidRLP();
    struct Item {uint256 start; uint256 payload; uint256 length; uint256 total; bool list;}
    function item(bytes memory raw,uint256 at) internal pure returns(Item memory r){
        if(at>=raw.length) revert InvalidRLP();
        uint256 tag=uint8(raw[at]);r.start=at;
        if(tag<0x80){r.payload=at;r.length=1;r.total=1;return r;}
        uint256 prefix=1;
        if(tag<=0xb7){r.length=tag-0x80;}
        else if(tag<=0xbf){uint256 n=tag-0xb7;r.length=lengthOf(raw,at+1,n);prefix+=n;if(r.length<56)revert InvalidRLP();}
        else if(tag<=0xf7){r.list=true;r.length=tag-0xc0;}
        else {r.list=true;uint256 n=tag-0xf7;r.length=lengthOf(raw,at+1,n);prefix+=n;if(r.length<56)revert InvalidRLP();}
        r.payload=at+prefix;
        if(r.payload>raw.length || r.length>raw.length-r.payload) revert InvalidRLP();
        r.total=prefix+r.length;
        if(!r.list && r.length==1 && uint8(raw[r.payload])<0x80)revert InvalidRLP();
    }
    function lengthOf(bytes memory raw,uint256 at,uint256 n) private pure returns(uint256 value){
        if(n==0 || n>8 || at>=raw.length || n>raw.length-at || raw[at]==0) revert InvalidRLP();
        for(uint256 i;i<n;++i)value=(value<<8)|uint8(raw[at+i]);
    }
    function validate(bytes memory raw) internal pure {
        if(raw.length==0 || raw.length>131072)revert InvalidRLP();
        Item memory root=item(raw,0);if(root.total!=raw.length)revert InvalidRLP();
        validateItem(raw,root,0);
    }
    function validateItem(bytes memory raw,Item memory r,uint256 depth) private pure {
        if(depth>32)revert InvalidRLP();
        if(!r.list)return;
        uint256 at=r.payload;uint256 end=at+r.length;
        while(at<end){Item memory c=item(raw,at);if(c.total>end-at)revert InvalidRLP();validateItem(raw,c,depth+1);at+=c.total;}
        if(at!=end)revert InvalidRLP();
    }
    function children(bytes memory raw,Item memory r) internal pure returns(Item[] memory out){
        if(!r.list)revert InvalidRLP();
        uint256 end=r.payload+r.length;uint256 at=r.payload;uint256 count;
        while(at<end){Item memory c=item(raw,at);if(c.total>end-at || ++count>4096)revert InvalidRLP();at+=c.total;}
        if(at!=end)revert InvalidRLP();
        out=new Item[](count);at=r.payload;
        for(uint256 i;i<count;++i){out[i]=item(raw,at);at+=out[i].total;}
    }
    function slice(bytes memory raw,uint256 at,uint256 n) internal pure returns(bytes memory out){
        if(at>raw.length || n>raw.length-at)revert InvalidRLP();out=new bytes(n);
        for(uint256 i;i<n;++i)out[i]=raw[at+i];
    }
    function data(bytes memory raw,Item memory r) internal pure returns(bytes memory){if(r.list)revert InvalidRLP();return slice(raw,r.payload,r.length);}
    function encoded(bytes memory raw,Item memory r) internal pure returns(bytes memory){return slice(raw,r.start,r.total);}
    function integer(bytes memory raw,Item memory r) internal pure returns(uint256 value){
        if(r.list || r.length>32 || (r.length>0 && raw[r.payload]==0))revert InvalidRLP();
        for(uint256 i;i<r.length;++i)value=(value<<8)|uint8(raw[r.payload+i]);
    }
    function word(bytes memory raw,Item memory r) internal pure returns(bytes32 v){
        if(r.list || r.length!=32)revert InvalidRLP();uint256 at=r.payload;assembly("memory-safe"){v:=mload(add(add(raw,32),at))}
    }
    function account(bytes memory raw,Item memory r) internal pure returns(address value){
        if(r.list || r.length!=20)revert InvalidRLP();for(uint256 i;i<20;++i)value=address((uint160(value)<<8)|uint8(raw[r.payload+i]));
    }
    function indexKey(uint64 value) internal pure returns(bytes memory out){
        if(value==0)return hex"80";
        if(value<128){out=new bytes(1);out[0]=bytes1(uint8(value));return out;}
        uint256 n;uint64 x=value;while(x!=0){++n;x>>=8;}out=new bytes(n+1);out[0]=bytes1(uint8(0x80+n));
        for(uint256 i;i<n;++i)out[n-i]=bytes1(uint8(value>>(8*i)));
    }
}
