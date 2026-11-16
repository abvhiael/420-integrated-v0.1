// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Legacy native Curecoin transactions include nTime after nVersion.
/// They are not Bitcoin/Solana token packets and their txids include this field.
library CurecoinWire420 {
    struct Input {bytes32 txid;uint32 index;bytes script;uint32 sequence;}
    struct Output {uint64 amount;bytes script;}
    struct Transaction {bytes32 id;uint32 time;Input[] inputs;Output[] outputs;uint32 lockTime;bytes comment;}
    error Malformed();
    function le(bytes memory b,uint256 p,uint256 n) internal pure returns(uint256 v){if(p>b.length||n>b.length-p||n>32)revert Malformed();for(uint256 i;i<n;++i)v|=uint256(uint8(b[p+i]))<<(8*i);}
    function cut(bytes memory b,uint256 p,uint256 n) internal pure returns(bytes memory out){if(p>b.length||n>b.length-p)revert Malformed();out=new bytes(n);for(uint256 i;i<n;++i)out[i]=b[p+i];}
    function hashAt(bytes memory b,uint256 p) internal pure returns(bytes32 h){if(p>b.length||32>b.length-p)revert Malformed();assembly{h:=mload(add(add(b,32),p))}}
    function variable(bytes memory b,uint256 p) internal pure returns(uint256 v,uint256 end){
        uint256 a=le(b,p,1);++p;if(a<253)return(a,p);uint256 n=a==253?2:a==254?4:8;v=le(b,p,n);
        if((n==2&&v<253)||(n==4&&v<=65535)||(n==8&&v<=type(uint32).max))revert Malformed();return(v,p+n);
    }
    function script(bytes memory b,uint256 p) private pure returns(bytes memory s,uint256 end){(uint256 n,uint256 v)=variable(b,p);if(n>10000)revert Malformed();return(cut(b,v,n),v+n);}
    function parse(bytes memory raw) internal pure returns(Transaction memory t){
        if(raw.length<14||raw.length>1_000_000||le(raw,0,4)==0)revert Malformed();t.time=uint32(le(raw,4,4));
        (uint256 n,uint256 p)=variable(raw,8);if(n==0||n>1000)revert Malformed();t.inputs=new Input[](n);
        for(uint256 i;i<n;++i){t.inputs[i].txid=hashAt(raw,p);t.inputs[i].index=uint32(le(raw,p+32,4));p+=36;(t.inputs[i].script,p)=script(raw,p);t.inputs[i].sequence=uint32(le(raw,p,4));p+=4;}
        (n,p)=variable(raw,p);if(n==0||n>1000)revert Malformed();t.outputs=new Output[](n);uint256 total;
        for(uint256 i;i<n;++i){uint256 value=le(raw,p,8);p+=8;if(value>156_000_000_000_000)revert Malformed();total+=value;if(total>156_000_000_000_000)revert Malformed();t.outputs[i].amount=uint64(value);(t.outputs[i].script,p)=script(raw,p);}
        t.lockTime=uint32(le(raw,p,4));p+=4;(uint256 commentSize,uint256 commentStart)=variable(raw,p);if(commentSize>268)revert Malformed();t.comment=cut(raw,commentStart,commentSize);p=commentStart+commentSize;if(p!=raw.length)revert Malformed();t.id=sha256(abi.encodePacked(sha256(raw)));
    }
    function merkle(bytes32 leaf,uint32 index,uint32 count,bytes32[] memory branch,bytes32 root) internal pure {
        if(count==0||index>=count||branch.length>32)revert Malformed();uint256 p;uint256 width=count;uint256 i=index;
        while(width>1){if(p>=branch.length)revert Malformed();bytes32 sibling=branch[p++];
            if((i^1)>=width?sibling!=leaf:sibling==leaf)revert Malformed();
            leaf=sha256(abi.encodePacked(sha256(i&1==0?abi.encodePacked(leaf,sibling):abi.encodePacked(sibling,leaf))));
            i>>=1;width=(width+1)>>1;
        }
        if(p!=branch.length||leaf!=root)revert Malformed();
    }
}
