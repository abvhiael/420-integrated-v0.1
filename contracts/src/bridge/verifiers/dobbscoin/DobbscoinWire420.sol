// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../BridgeWire420.sol";
import "../BridgeCrypto420.sol";

/// @notice Dobbscoin legacy transaction wire format; no Bitcoin SegWit interpretation.
library DobbscoinWire420 {
    error InvalidTransaction();
    uint256 constant MAX_MONEY=10_000_000_000*100_000_000;
    struct Output {uint64 amount;bytes script;}
    struct Transaction {bytes32 id;bool coinbase;bytes firstScript;Output[] outputs;uint256 commitments;}
    function cut(bytes memory data,uint256 at,uint256 n) internal pure returns(bytes memory out){
        if(at>data.length||n>data.length-at)revert InvalidTransaction();out=new bytes(n);
        for(uint256 i;i<n;++i)out[i]=data[at+i];
    }
    function hashAt(bytes memory data,uint256 at) internal pure returns(bytes32){return bytes32(BridgeWire420.readBE(data,at,32));}
    /// @dev AuxPoW parent transactions are serialized commitments, not ordinary BOB
    /// transactions. Native initAuxPow deliberately creates one with zero outputs;
    /// native CAuxPow::check does not apply CheckTransaction to this parent.
    function parse(bytes memory raw,bool parent) internal pure returns(Transaction memory t){
        if(raw.length<10||raw.length>1_000_000||(!parent&&BridgeWire420.readLE(raw,0,4)!=1))revert InvalidTransaction();
        uint256 at=4;uint64 n;(n,at)=BridgeWire420.compactSize(raw,at);
        if(n==0||n>(raw.length-at)/41)revert InvalidTransaction();
        for(uint256 i;i<n;++i){
            bool nullInput=hashAt(raw,at)==0&&BridgeWire420.readLE(raw,at+32,4)==type(uint32).max;
            if(!parent&&nullInput){if(n!=1)revert InvalidTransaction();t.coinbase=true;}
            at+=36;uint64 size;(size,at)=BridgeWire420.compactSize(raw,at);
            if(!parent&&nullInput&&(size<2||size>100))revert InvalidTransaction();
            if(i==0)t.firstScript=cut(raw,at,size);else if(size>raw.length-at)revert InvalidTransaction();
            at+=uint256(size);BridgeWire420.readLE(raw,at,4);at+=4;
        }
        (n,at)=BridgeWire420.compactSize(raw,at);
        if((!parent&&n==0)||n>(raw.length-at)/9)revert InvalidTransaction();
        t.outputs=new Output[](n);uint256 total;
        for(uint256 i;i<n;++i){
            uint64 amount=uint64(BridgeWire420.readLE(raw,at,8));at+=8;uint64 size;(size,at)=BridgeWire420.compactSize(raw,at);
            bytes memory script=cut(raw,at,size);at+=size;
            if(!parent){total+=amount;if(total>MAX_MONEY)revert InvalidTransaction();}
            if(script.length==34&&script[0]==0x6a&&script[1]==0x20)++t.commitments;
            t.outputs[i]=Output(amount,script);
        }
        BridgeWire420.readLE(raw,at,4);BridgeWire420.requireEnd(raw,at+4);t.id=BridgeCrypto420.sha256d(raw);
    }
}
