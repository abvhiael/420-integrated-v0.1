// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BridgeCrypto420.sol";
import "./BridgeWire420.sol";
import "./LitecoinScrypt420.sol";
import "./DogecoinAuxPow420.sol";

/// @notice Mainnet header-only SPV chain anchored at Dogecoin genesis.
/// @dev Selects strictly greater cumulative work, retaining competing branches.
/// Does not validate full blocks or prove that a relayer has supplied the globally best chain.
contract DogecoinHeaderChain420 {
    uint256 public constant POW_LIMIT=0x00000fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
    bytes32 public constant GENESIS=0x9156352c1818b32e90c9e792efd6a11a82fe7956a630f03bbee236cedae3911a;
    struct Header {bytes32 parent; bytes32 merkleRoot; uint256 work; uint64 height; uint32 time; uint32 bits; uint32 periodStart;}
    mapping(bytes32=>Header) private headers;
    bytes32 public bestTip;
    LitecoinScrypt420 public immutable scrypt;
    error InvalidHeader();
    error UnknownParent();
    error InvalidTarget();
    error InvalidTimestamp();
    event HeaderAccepted(bytes32 indexed hash,bytes32 indexed parent,uint64 height,uint256 work);
    event BestTipChanged(bytes32 indexed previous,bytes32 indexed current);
    constructor(){
        scrypt=new LitecoinScrypt420();
        headers[GENESIS]=Header(0,0x696ad20e2dd4365c7459b4a4a5af743d5e92c6da3229e6532cd605f6533f2a5b,blockWork(decodeTarget(0x1e0ffff0)),0,1386325540,0x1e0ffff0,1386325540);
        bestTip=GENESIS;
    }
    function getHeader(bytes32 hash) external view returns(Header memory){
        Header memory h=headers[hash];if(h.work==0) revert UnknownParent();return h;
    }
    function decodeTarget(uint32 bits) public pure returns(uint256 target){
        uint256 size=bits>>24;uint256 word=bits&0x007fffff;
        if(word==0 || bits&0x00800000!=0 || size>34 || (word>0xff && size>33) || (word>0xffff && size>32))revert InvalidTarget();
        target=size<=3?word>>(8*(3-size)):word<<(8*(size-3));if(target==0 || target>POW_LIMIT)revert InvalidTarget();
    }
    function encodeTarget(uint256 target) public pure returns(uint32){
        if(target==0 || target>POW_LIMIT) revert InvalidTarget();
        uint256 n=target;uint256 size;
        while(n!=0){++size;n>>=8;}
        uint256 word=size<=3?target<<(8*(3-size)):target>>(8*(size-3));
        if((word&0x00800000)!=0){word>>=8;++size;}
        return uint32((size<<24)|word);
    }
    function blockWork(uint256 target) public pure returns(uint256){
        if(target==0 || target>POW_LIMIT) revert InvalidTarget();
        return (type(uint256).max-target)/(target+1)+1;
    }
    function expectedBits(bytes32 parent) public view returns(uint32){
        Header storage p=headers[parent];if(p.work==0) revert UnknownParent();
        uint64 next=p.height+1;int256 span;uint256 nominal;int256 lower;int256 upper;
        if(next>=145000){
            Header storage before_=headers[p.parent];if(before_.work==0)revert UnknownParent();
            span=int256(uint256(p.time))-int256(uint256(before_.time));span=60+(span-60)/8;nominal=60;lower=45;upper=90;
        }else{
            if(next%240!=0)return p.bits;
            span=int256(uint256(p.time))-int256(uint256(p.periodStart));nominal=14400;
            lower=next>10000?int256(3600):next>5000?int256(1800):int256(900);upper=57600;
        }
        if(span<lower)span=lower;if(span>upper)span=upper;
        uint256 target=decodeTarget(p.bits)*uint256(span)/nominal;if(target>POW_LIMIT)target=POW_LIMIT;
        return encodeTarget(target);
    }
    function medianTimePast(bytes32 parent) public view returns(uint32){
        uint32[11] memory times;uint256 count;
        while(parent!=0 && count<11){
            Header storage h=headers[parent];if(h.work==0) revert UnknownParent();
            uint32 t=h.time;uint256 i=count;
            while(i>0 && times[i-1]>t){times[i]=times[i-1];--i;}
            times[i]=t;++count;parent=h.parent;
        }
        if(count==0) revert UnknownParent();
        return times[count/2];
    }
    function submit(bytes calldata raw,bytes calldata aux) external returns(bytes32){return _submit(raw,aux);}
    function powHeader(bytes calldata raw,bytes calldata aux,uint64 height) external pure returns(bytes memory){return DogecoinAuxPow420.validate(raw,aux,height);}
    function _submit(bytes memory raw,bytes memory aux) private returns(bytes32 hash){
        if(raw.length!=80) revert InvalidHeader();
        hash=BridgeCrypto420.sha256d(raw);
        if(headers[hash].work!=0) return hash;
        bytes32 parent=bytes32(BridgeWire420.readBE(raw,4,32));
        Header storage p=headers[parent];if(p.work==0) revert UnknownParent();
        uint32 time=uint32(BridgeWire420.readLE(raw,68,4));
        uint32 bits=uint32(BridgeWire420.readLE(raw,72,4));
        if(time<=medianTimePast(parent) || uint256(time)>block.timestamp+7200) revert InvalidTimestamp();
        if(bits!=expectedBits(parent)) revert InvalidTarget();
        uint256 target=decodeTarget(bits);
        bytes memory powParent=DogecoinAuxPow420.validate(raw,aux,p.height+1);
        (bytes32 digest,bool complete)=scrypt.result(BridgeCrypto420.sha256d(powParent));if(!complete)revert InvalidHeader();
        uint256 pow;for(uint256 i;i<32;++i)pow|=uint256(uint8(digest[i]))<<(8*i);if(pow>target)revert InvalidTarget();
        uint64 height=p.height+1;
        uint256 work=p.work+blockWork(target);
        headers[hash]=Header(parent,bytes32(BridgeWire420.readBE(raw,36,32)),work,height,time,bits,height%240==0?p.time:p.periodStart);
        emit HeaderAccepted(hash,parent,height,work);
        if(work>headers[bestTip].work){bytes32 old=bestTip;bestTip=hash;emit BestTipChanged(old,hash);}
    }
    /// @notice Caller supplies a bounded ancestry witness from the best tip to the target.
    /// Each hop is verified against stored authenticated parent links.
    function confirmations(bytes32 target,bytes32[] calldata ancestry) external view returns(uint32){
        Header storage h=headers[target];Header storage tip=headers[bestTip];
        if(h.work==0 || h.height>tip.height || ancestry.length!=tip.height-h.height) return 0;
        bytes32 cursor=bestTip;
        for(uint256 i;i<ancestry.length;++i){
            if(headers[cursor].parent!=ancestry[i]) return 0;
            cursor=ancestry[i];
        }
        if(cursor!=target) return 0;
        uint256 n=uint256(tip.height)-h.height+1;
        if(n>type(uint32).max) return type(uint32).max;
        return uint32(n);
    }
}
