// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library CurecoinSignature420 {
    uint256 private constant P=0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f;
    uint256 private constant N=0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141;
    error InvalidSignature();
    function number(bytes memory b,uint256 p,uint256 n) private pure returns(uint256 out){if(n>32||p>b.length||n>b.length-p)revert InvalidSignature();for(uint256 i;i<n;++i)out=(out<<8)|uint8(b[p+i]);}
    function keyAddress(bytes memory pub) internal view returns(address){
        uint256 x;uint256 y;
        if(pub.length==65&&(pub[0]==0x04||pub[0]==0x06||pub[0]==0x07)){x=number(pub,1,32);y=number(pub,33,32);if(pub[0]!=0x04&&(y&1)!=(uint8(pub[0])&1))revert InvalidSignature();}
        else if(pub.length==33&&(pub[0]==0x02||pub[0]==0x03)){
            x=number(pub,1,32);uint256 rhs=addmod(mulmod(mulmod(x,x,P),x,P),7,P);
            bytes memory input=abi.encode(uint256(32),uint256(32),uint256(32),rhs,(P+1)/4,P);bytes memory output=new bytes(32);bool ok;
            assembly{ok:=staticcall(gas(),5,add(input,32),mload(input),add(output,32),32) y:=mload(add(output,32))}
            if(!ok)revert InvalidSignature();if(y&1!=uint8(pub[0])&1)y=P-y;
        }else revert InvalidSignature();
        if(x>=P||y>=P||mulmod(y,y,P)!=addmod(mulmod(mulmod(x,x,P),x,P),7,P))revert InvalidSignature();
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes32(x),bytes32(y))))));
    }
    function scalar(bytes memory sig,uint256 p) private pure returns(uint256 value,uint256 end){
        if(p+2>sig.length||sig[p++]!=0x02)revert InvalidSignature();uint256 len=uint8(sig[p++]);
        if(len==0||len>33||len>sig.length-p||uint8(sig[p])&128!=0)revert InvalidSignature();
        if(len>1&&sig[p]==0&&uint8(sig[p+1])&128==0)revert InvalidSignature();
        if(len==33){if(sig[p]!=0)revert InvalidSignature();++p;--len;}
        value=number(sig,p,len);end=p+len;if(value==0||value>=N)revert InvalidSignature();
    }
    function verify(bytes32 digest,bytes memory signature,bytes memory publicKey) internal view {
        if(signature.length<8||signature.length>72||signature[0]!=0x30||uint8(signature[1])!=signature.length-2)revert InvalidSignature();
        (uint256 r,uint256 p)=scalar(signature,2);(uint256 s,uint256 end)=scalar(signature,p);if(end!=signature.length)revert InvalidSignature();
        address expected=keyAddress(publicKey);
        // Native CKey::Verify does not impose Ethereum's low-s restriction.
        if(ecrecover(digest,27,bytes32(r),bytes32(s))!=expected&&ecrecover(digest,28,bytes32(r),bytes32(s))!=expected)revert InvalidSignature();
    }
}
