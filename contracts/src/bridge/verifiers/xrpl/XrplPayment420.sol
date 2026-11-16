// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./XrplBinary420.sol";

library XrplPayment420 {
    struct Payment {bytes20 source;bytes20 gateway;uint64 drops;uint32 tag;bool hasTag;bytes memo;}
    error InvalidPayment();
    function nativeAmount(bytes memory raw,uint256 p,uint256 size) internal pure returns(uint64 drops){
        if(size!=8)revert InvalidPayment();uint64 n=uint64(XrplBinary420.uintBE(raw,p,8));
        if(n&0xc000000000000000!=0x4000000000000000)revert InvalidPayment();drops=n&0x3fffffffffffffff;
        if(drops==0||drops>100_000_000_000_000_000)revert InvalidPayment();
    }
    function memo(bytes memory raw,XrplBinary420.Field memory array) private pure returns(bytes memory data){
        XrplBinary420.Field memory object=XrplBinary420.field(raw,array.value,1);
        if(object.kind!=14||object.nth!=10||object.end+1!=array.end||raw[object.end]!=0xf1)revert InvalidPayment();
        uint256 p=object.value;
        while(p<object.end-1){XrplBinary420.Field memory f=XrplBinary420.field(raw,p,2);p=f.end;
            if(f.kind!=7||f.nth<12||f.nth>14)revert InvalidPayment();
            if(f.nth==13)data=XrplBinary420.cut(raw,f.value,f.size);
        }
    }
    function parse(bytes memory tx_,bytes memory metadata) internal pure returns(Payment memory t){
        if(tx_.length<20||tx_.length>16384||metadata.length==0||metadata.length>65536)revert InvalidPayment();
        uint256 p;uint256 last;bool paymentType;
        while(p<tx_.length){
            XrplBinary420.Field memory f=XrplBinary420.field(tx_,p,0);uint256 order=(f.kind<<16)|f.nth;
            if(order<=last)revert InvalidPayment();last=order;p=f.end;
            if(f.kind==1&&f.nth==2){if(XrplBinary420.uintBE(tx_,f.value,2)!=0)revert InvalidPayment();paymentType=true;}
            else if(f.kind==2){
                uint32 n=uint32(XrplBinary420.uintBE(tx_,f.value,4));
                if(f.nth==2&&n&0x20000!=0)revert InvalidPayment();
                if(f.nth==1&&n!=0)revert InvalidPayment();
                if(f.nth==14){t.tag=n;t.hasTag=true;}
            }else if(f.kind==5){ }
            else if(f.kind==6){if(f.nth==1)t.drops=nativeAmount(tx_,f.value,f.size);else if(f.nth!=8)revert InvalidPayment();}
            else if(f.kind==7&&(f.nth==3||f.nth==4)){ }
            else if(f.kind==8){
                bytes20 account=bytes20(uint160(XrplBinary420.uintBE(tx_,f.value,20)));
                if(f.nth==1)t.source=account;else if(f.nth==3)t.gateway=account;else revert InvalidPayment();
            }else if(f.kind==15&&f.nth==9)t.memo=memo(tx_,f);
            else if(f.kind==15&&f.nth==3){ /* Multisign authorization inherits authenticated ledger validity. */ }
            else revert InvalidPayment();
        }
        if(!paymentType||t.source==0||t.gateway==0||t.source==t.gateway||t.drops==0)revert InvalidPayment();
        p=0;last=0;bool success;
        while(p<metadata.length){
            XrplBinary420.Field memory f=XrplBinary420.field(metadata,p,0);uint256 order=(f.kind<<16)|f.nth;
            if(order<=last)revert InvalidPayment();last=order;p=f.end;
            if(f.kind==16&&f.nth==3){if(XrplBinary420.uintBE(metadata,f.value,1)!=0)revert InvalidPayment();success=true;}
            else if(f.kind==6&&f.nth==18){if(nativeAmount(metadata,f.value,f.size)!=t.drops)revert InvalidPayment();}
            else if((f.kind==2&&f.nth==28)||(f.kind==15&&f.nth==8)){ }
            else revert InvalidPayment();
        }
        if(!success)revert InvalidPayment();
    }
}
