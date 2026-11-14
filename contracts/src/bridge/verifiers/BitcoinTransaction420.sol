// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BridgeWire420.sol";
import "./BridgeCrypto420.sol";

/// @notice Parses canonical stripped Bitcoin transaction serialization (txid, not wtxid).
/// SegWit transactions must be supplied without marker, flag or witness. The authenticated
/// txid commits to all stripped inputs and outputs. No witness claim is made.
library BitcoinTransaction420 {
    uint256 constant MAX_MONEY=21_000_000*100_000_000;
    error InvalidTransaction();
    struct Output {uint64 value; bytes32 scriptHash;}
    struct Parsed {bytes32 txid; Output payment; Output commitment; bool coinbase;}
    function parse(bytes memory raw,uint32 paymentIndex,uint32 commitmentIndex) internal pure returns(Parsed memory p){
        if(raw.length<60 || raw.length>1_000_000 || paymentIndex==commitmentIndex) revert InvalidTransaction();
        uint256 at=4;
        uint64 count;
        (count,at)=BridgeWire420.compactSize(raw,at);
        if(count==0 || count>(raw.length-at)/41) revert InvalidTransaction();
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
            if(i==paymentIndex || i==commitmentIndex){
                bytes32 scriptHash;
                assembly ("memory-safe") {scriptHash := keccak256(add(add(raw,32),at),len)}
                if(i==paymentIndex) p.payment=Output(value,scriptHash);
                else p.commitment=Output(value,scriptHash);
            }
            at+=len;
        }
        if(at>raw.length || raw.length-at!=4) revert InvalidTransaction();
        p.txid=BridgeCrypto420.sha256d(raw);
    }
}
