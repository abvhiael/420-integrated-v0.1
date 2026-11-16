// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BridgeWire420.sol";
import "./BridgeCrypto420.sol";

/// @notice Parses legacy or SegWit serialization and hashes stripped bytes for the txid.
/// Witness syntax is checked; SPV inclusion does not authenticate witness data or scripts.
library LitecoinTransaction420 {
    uint256 constant MAX_MONEY=84_000_000*100_000_000;
    error InvalidTransaction();
    struct Output {uint64 value; bytes32 scriptHash;}
    struct Parsed {bytes32 txid; Output payment; Output commitment; bool coinbase; uint256 strippedSize; uint256 commitmentOutputs; int32 version; uint32 lockTime;}
    function parse(bytes memory raw,uint32 paymentIndex,uint32 commitmentIndex) internal pure returns(Parsed memory p){
        if(raw.length<60 || raw.length>1_000_000 || paymentIndex==commitmentIndex) revert InvalidTransaction();
        p.version=int32(uint32(BridgeWire420.readLE(raw,0,4)));
        uint256 at=4;
        bool witness=raw[at]==0;
        if(witness){
            if(raw[5]!=0x01) revert InvalidTransaction();
            at=6;
        }
        uint256 inputStart=at;
        uint64 count;
        (count,at)=BridgeWire420.compactSize(raw,at);
        if(count==0 || count>(raw.length-at)/41) revert InvalidTransaction();
        uint64 inputCount=count;
        for(uint256 i;i<count;++i){
            if(at>raw.length || raw.length-at<36) revert InvalidTransaction();
            bool nullInput=BridgeWire420.readBE(raw,at,32)==0 && BridgeWire420.readLE(raw,at+32,4)==type(uint32).max;
            if(nullInput){if(count!=1) revert InvalidTransaction();p.coinbase=true;}
            at+=36;
            uint64 len;
            (len,at)=BridgeWire420.compactSize(raw,at);
            if(len>raw.length-at || raw.length-at-len<4) revert InvalidTransaction();
            if(nullInput && (len<2 || len>100)) revert InvalidTransaction();
            at+=uint256(len)+4;
        }
        (count,at)=BridgeWire420.compactSize(raw,at);
        if(count==0 || count>(raw.length-at)/9 || paymentIndex>=count || commitmentIndex>=count) revert InvalidTransaction();
        uint256 total;
        for(uint256 i;i<count;++i){
            uint64 value=uint64(BridgeWire420.readLE(raw,at,8));at+=8;
            total+=value;if(total>MAX_MONEY) revert InvalidTransaction();
            uint64 len;
            (len,at)=BridgeWire420.compactSize(raw,at);
            if(len>raw.length-at) revert InvalidTransaction();
            // Reject MWEB peg-in/HogAddr programs even if extension flags were stripped from the txid preimage.
            if(len>=2 && (raw[at]==0x58 || raw[at]==0x59) && raw[at+1]==0x20)revert InvalidTransaction();
            if(len==34 && raw[at]==0x6a && raw[at+1]==0x20) ++p.commitmentOutputs;
            if(i==paymentIndex || i==commitmentIndex){
                bytes32 scriptHash;
                assembly ("memory-safe") {scriptHash := keccak256(add(add(raw,32),at),len)}
                if(i==paymentIndex) p.payment=Output(value,scriptHash);
                else p.commitment=Output(value,scriptHash);
            }
            at+=len;
        }
        uint256 outputEnd=at;
        if(witness){
            bool hasWitness;
            for(uint256 i;i<inputCount;++i){
                uint64 items;
                (items,at)=BridgeWire420.compactSize(raw,at);
                if(items>raw.length-at) revert InvalidTransaction();
                if(items!=0) hasWitness=true;
                for(uint256 j;j<items;++j){
                    uint64 len;
                    (len,at)=BridgeWire420.compactSize(raw,at);
                    if(len>raw.length-at) revert InvalidTransaction();
                    at+=len;
                }
            }
            if(!hasWitness) revert InvalidTransaction();
        }
        if(at>raw.length || raw.length-at!=4) revert InvalidTransaction();
        p.lockTime=uint32(BridgeWire420.readLE(raw,at,4));
        p.strippedSize=4+(outputEnd-inputStart)+4;
        if(witness){
            bytes memory stripped=new bytes(p.strippedSize);
            for(uint256 i;i<4;++i){stripped[i]=raw[i];stripped[p.strippedSize-4+i]=raw[at+i];}
            for(uint256 i=inputStart;i<outputEnd;++i) stripped[4+i-inputStart]=raw[i];
            p.txid=BridgeCrypto420.sha256d(stripped);
        } else p.txid=BridgeCrypto420.sha256d(raw);
    }
}
