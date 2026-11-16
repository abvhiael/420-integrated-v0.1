// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../verifiers/BridgeWire420.sol";
import "../verifiers/BridgeCrypto420.sol";
import "./BitcoinScript420.sol";
/// @notice Bounded custody signing policy parser, not a replacement Bitcoin consensus verifier.
/// Normalizes scriptSigs/witness out of the unsigned skeleton while retaining actual txid.
library BitcoinSigningTransaction420 {
 struct Parsed {bytes32 txid;bytes32 skeletonHash;bytes32 inputsHash;bytes32[] outpoints;uint64[] amounts;bytes32[] scripts;bool signedData;}
 error InvalidSigningTransaction();
 function cut(bytes memory raw,uint256 at,uint256 len) private pure returns(bytes memory out){if(at>raw.length||len>raw.length-at)revert InvalidSigningTransaction();out=new bytes(len);for(uint256 i;i<len;++i)out[i]=raw[at+i];}
 function parse(bytes memory raw) internal pure returns(Parsed memory p){
  if(raw.length<60||raw.length>1_000_000)revert InvalidSigningTransaction();
  bytes memory version=cut(raw,0,4);uint256 at=4;bool witness=raw[at]==0;
  if(witness){if(raw[5]!=0x01)revert InvalidSigningTransaction();at=6;p.signedData=true;}
  uint256 inputStart=at;uint64 count;(count,at)=BridgeWire420.compactSize(raw,at);
  // Explicit qualified-wallet resource policy; these are not Bitcoin consensus limits.
  if(count==0||count>128||count>(raw.length-at)/41)revert InvalidSigningTransaction();
  p.outpoints=new bytes32[](count);bytes memory unsignedInputs=BridgeWire420.encodeCompactSize(count);uint64 inputCount=count;
  for(uint256 i;i<count;++i){
   bytes memory prev=cut(raw,at,36);bytes32 txid=bytes32(BridgeWire420.readBE(raw,at,32));uint32 index=uint32(BridgeWire420.readLE(raw,at+32,4));
   if(txid==0&&index==type(uint32).max)revert InvalidSigningTransaction();
   bytes32 point=keccak256(abi.encode(txid,index));for(uint256 j;j<i;++j)if(p.outpoints[j]==point)revert InvalidSigningTransaction();p.outpoints[i]=point;
   p.inputsHash=keccak256(abi.encode(p.inputsHash,point));at+=36;
   uint64 len;(len,at)=BridgeWire420.compactSize(raw,at);if(len>raw.length-at)revert InvalidSigningTransaction();if(len!=0)p.signedData=true;at+=len;
   bytes memory sequence=cut(raw,at,4);at+=4;unsignedInputs=bytes.concat(unsignedInputs,prev,hex"00",sequence);
  }
  uint256 outputStart=at;(count,at)=BridgeWire420.compactSize(raw,at);if(count<2||count>3)revert InvalidSigningTransaction();
  p.amounts=new uint64[](count);p.scripts=new bytes32[](count);uint256 total;
  for(uint256 i;i<count;++i){uint64 value=uint64(BridgeWire420.readLE(raw,at,8));at+=8;uint64 len;(len,at)=BridgeWire420.compactSize(raw,at);bytes memory script=cut(raw,at,len);at+=len;total+=value;if(total>BitcoinScript420.MAX_MONEY)revert InvalidSigningTransaction();p.amounts[i]=value;p.scripts[i]=keccak256(script);}
  uint256 outputEnd=at;
  if(witness){bool hasWitness;for(uint256 i;i<inputCount;++i){uint64 items;(items,at)=BridgeWire420.compactSize(raw,at);if(items>raw.length-at)revert InvalidSigningTransaction();if(items!=0)hasWitness=true;for(uint256 j;j<items;++j){uint64 len;(len,at)=BridgeWire420.compactSize(raw,at);cut(raw,at,len);at+=len;}}if(!hasWitness)revert InvalidSigningTransaction();}
  if(at>raw.length||raw.length-at!=4)revert InvalidSigningTransaction();bytes memory lockTime=cut(raw,at,4);
  bytes memory unsignedRaw=bytes.concat(version,unsignedInputs,cut(raw,outputStart,outputEnd-outputStart),lockTime);p.skeletonHash=BridgeCrypto420.sha256d(unsignedRaw);
  p.txid=witness?BridgeCrypto420.sha256d(bytes.concat(version,cut(raw,inputStart,outputEnd-inputStart),lockTime)):BridgeCrypto420.sha256d(raw);
 }
 function validateOutputs(Parsed memory p,uint64 amount,bytes32 recipientHash,bytes32 changeHash,bytes32 requestId) internal pure returns(uint256 total){
  uint256 payments;uint256 commitments;uint256 changes;bytes32 marker=keccak256(abi.encodePacked(hex"6a20",requestId));
  for(uint256 i;i<p.amounts.length;++i){uint64 value=p.amounts[i];bytes32 script=p.scripts[i];total+=value;
   if(script==recipientHash&&value==amount)++payments;
   else if(script==marker&&value==0)++commitments;
   else if(script==changeHash&&value>0)++changes;
   else revert InvalidSigningTransaction();
  }
  if(payments!=1||commitments!=1||changes>1)revert InvalidSigningTransaction();
 }
}
