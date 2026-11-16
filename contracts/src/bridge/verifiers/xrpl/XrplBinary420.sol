// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Bounded canonical XRPL STObject reader; object/array boundaries remain structural.
library XrplBinary420 {
    struct Field { uint256 kind; uint256 nth; uint256 start; uint256 value; uint256 size; uint256 end; }
    error Malformed();
    function uintBE(bytes memory b,uint256 p,uint256 n) internal pure returns(uint256 out){
        if(n>32||p>b.length||n>b.length-p)revert Malformed();
        for(uint256 i;i<n;++i)out=(out<<8)|uint8(b[p+i]);
    }
    function cut(bytes memory b,uint256 p,uint256 n) internal pure returns(bytes memory out){
        if(p>b.length||n>b.length-p)revert Malformed();out=new bytes(n);
        for(uint256 i;i<n;++i)out[i]=b[p+i];
    }
    function header(bytes memory b,uint256 p) internal pure returns(uint256 t,uint256 f,uint256 end){
        if(p>=b.length)revert Malformed();uint8 c=uint8(b[p++]);t=c>>4;f=c&15;
        if(t==0){if(p>=b.length||(t=uint8(b[p++]))<16)revert Malformed();}
        if(f==0){if(p>=b.length||(f=uint8(b[p++]))<16)revert Malformed();}
        return(t,f,p);
    }
    function length(bytes memory b,uint256 p) internal pure returns(uint256 n,uint256 end){
        if(p>=b.length)revert Malformed();uint256 a=uint8(b[p++]);
        if(a<=192)n=a;
        else if(a<=240){if(p>=b.length)revert Malformed();n=193+(a-193)*256+uint8(b[p++]);}
        else if(a<=254){if(p+2>b.length)revert Malformed();n=12481+(a-241)*65536+uintBE(b,p,2);p+=2;}
        else revert Malformed();
        if(n>b.length-p)revert Malformed();return(n,p);
    }
    function variable(bytes memory b) internal pure returns(bytes memory){
        uint256 n=b.length;
        if(n<=192)return bytes.concat(bytes1(uint8(n)),b);
        if(n<=12480){uint256 x=n-193;return bytes.concat(bytes1(uint8(193+(x>>8))),bytes1(uint8(x)),b);}
        if(n<=918744){uint256 x=n-12481;return bytes.concat(bytes1(uint8(241+(x>>16))),bytes2(uint16(x)),b);}
        revert Malformed();
    }
    function field(bytes memory b,uint256 p,uint256 depth) internal pure returns(Field memory x){
        if(depth>12)revert Malformed();x.start=p;(x.kind,x.nth,p)=header(b,p);x.value=p;
        uint256 t=x.kind;
        if(t==1)x.size=2;
        else if(t==2)x.size=4;
        else if(t==3)x.size=8;
        else if(t==4)x.size=16;
        else if(t==5)x.size=32;
        else if(t==6){if(p>=b.length)revert Malformed();x.size=uint8(b[p])&128==0?8:48;}
        else if(t==7||t==8||t==19){(x.size,x.value)=length(b,p);if(t==8&&x.size!=20)revert Malformed();if(t==19&&x.size%32!=0)revert Malformed();}
        else if(t==14||t==15){x.end=containerEnd(b,p,t,depth+1);x.size=x.end-p;return x;}
        else if(t==16)x.size=1;
        else if(t==17)x.size=20;
        else revert Malformed();
        if(x.value>b.length||x.size>b.length-x.value)revert Malformed();x.end=x.value+x.size;
    }
    function containerEnd(bytes memory b,uint256 p,uint256 kind,uint256 depth) private pure returns(uint256){
        uint256 last;
        while(p<b.length){
            (uint256 t,uint256 f,uint256 next)=header(b,p);
            if(t==kind&&f==1)return next;
            if((t==14||t==15)&&f==1)revert Malformed();
            uint256 order=(t<<16)|f;
            if(kind==15){if(t!=14)revert Malformed();}
            else{if(order<=last)revert Malformed();last=order;}
            p=field(b,p,depth).end;
        }
        revert Malformed();
    }
}
