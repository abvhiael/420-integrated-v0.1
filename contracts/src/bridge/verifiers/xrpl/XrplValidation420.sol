// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./XrplBinary420.sol";

library XrplValidation420 {
    struct Validation { bytes32 ledger; uint32 sequence; uint32 time; uint32 flags; bytes signingKey; bytes signature; bytes signingData; }
    error InvalidValidation();
    function parse(bytes memory raw) internal pure returns(Validation memory v){
        if(raw.length<100||raw.length>4096)revert InvalidValidation();uint256 p;uint256 last;uint256 sigStart;uint256 sigEnd;bool flags;
        while(p<raw.length){
            XrplBinary420.Field memory f=XrplBinary420.field(raw,p,0);uint256 order=(f.kind<<16)|f.nth;
            if(order<=last)revert InvalidValidation();last=order;p=f.end;
            if(f.kind==2){
                uint32 n=uint32(XrplBinary420.uintBE(raw,f.value,4));
                if(f.nth==2){v.flags=n;flags=true;}else if(f.nth==6)v.sequence=n;else if(f.nth==9)v.time=n;
                else if(f.nth!=7&&f.nth!=24)revert InvalidValidation();
            }else if(f.kind==3&&(f.nth==10||f.nth==11)){ }
            else if(f.kind==5&&(f.nth==1||f.nth==23||f.nth==25)){if(f.nth==1)v.ledger=bytes32(XrplBinary420.uintBE(raw,f.value,32));}
            else if(f.kind==6&&f.nth>=22&&f.nth<=24){if(f.size!=8)revert InvalidValidation();}
            else if(f.kind==7&&f.nth==3){if(f.size!=33||(raw[f.value]!=0x02&&raw[f.value]!=0x03))revert InvalidValidation();v.signingKey=XrplBinary420.cut(raw,f.value,f.size);}
            else if(f.kind==7&&f.nth==6){v.signature=XrplBinary420.cut(raw,f.value,f.size);sigStart=f.start;sigEnd=f.end;}
            else if(f.kind==19&&f.nth==3){ }
            else revert InvalidValidation();
        }
        if(!flags||v.flags&1==0||v.sequence==0||v.time==0||v.ledger==0||v.signingKey.length!=33||sigEnd==0)revert InvalidValidation();
        v.signingData=bytes.concat(bytes4(0x56414c00),XrplBinary420.cut(raw,0,sigStart),XrplBinary420.cut(raw,sigEnd,raw.length-sigEnd));
    }
    function scalar(bytes memory sig,uint256 p) private pure returns(uint256 n,uint256 end){
        if(p+2>sig.length||sig[p++]!=0x02)revert InvalidValidation();uint256 len=uint8(sig[p++]);
        if(len==0||len>33||len>sig.length-p||uint8(sig[p])&128!=0)revert InvalidValidation();
        if(len>1&&sig[p]==0&&uint8(sig[p+1])&128==0)revert InvalidValidation();
        if(len==33){if(sig[p]!=0)revert InvalidValidation();++p;--len;}
        n=XrplBinary420.uintBE(sig,p,len);end=p+len;
        if(n==0||n>=0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141)revert InvalidValidation();
    }
    function authenticate(bytes32 hash,bytes memory sig,uint32 flags,address expected) internal pure {
        if(sig.length<8||sig.length>72||sig[0]!=0x30||uint8(sig[1])!=sig.length-2||expected==address(0))revert InvalidValidation();
        (uint256 r,uint256 p)=scalar(sig,2);(uint256 s,uint256 end)=scalar(sig,p);
        if(end!=sig.length||(flags&0x80000000!=0&&s>0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0))revert InvalidValidation();
        if(ecrecover(hash,27,bytes32(r),bytes32(s))!=expected&&ecrecover(hash,28,bytes32(r),bytes32(s))!=expected)revert InvalidValidation();
    }
}
