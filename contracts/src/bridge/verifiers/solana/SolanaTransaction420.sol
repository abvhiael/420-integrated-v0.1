// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./SolanaEd25519420.sol";
/// @notice Canonical legacy/v0/v1 transaction decoding and required-signature verification.
/// Loaded addresses are execution witnesses: their authenticity must additionally
/// be covered by the finality certificate, not inferred from a caller/RPC list.
library SolanaTransaction420 {
 error InvalidTransaction();
 struct Instruction {uint8 programIndex;bytes accounts;bytes data;}
 struct Transaction {bytes32 id;bytes32 messageHash;bytes32[] keys;bool[] writable;uint8 required;Instruction[] instructions;}
 function cut(bytes memory raw,uint256 at,uint256 n) internal pure returns(bytes memory b){if(at>raw.length || n>raw.length-at)revert InvalidTransaction();b=new bytes(n);for(uint256 i;i<n;++i)b[i]=raw[at+i];}
 function word(bytes memory raw,uint256 at) internal pure returns(bytes32 v){if(at>raw.length || 32>raw.length-at)revert InvalidTransaction();assembly("memory-safe"){v:=mload(add(add(raw,32),at))}}
 function byteAt(bytes memory raw,uint256 at) private pure returns(uint8){if(at>=raw.length)revert InvalidTransaction();return uint8(raw[at]);}
 function compact(bytes memory raw,uint256 at) internal pure returns(uint256 value,uint256 next){
  for(uint256 i;i<3;++i){uint256 c=byteAt(raw,at+i);if(i==2 && c>3)revert InvalidTransaction();value|=(c&127)<<(7*i);if(c<128){if(i>0 && c==0)revert InvalidTransaction();return(value,at+i+1);}}
  revert InvalidTransaction();
 }
 function parse(bytes memory raw,bytes32[] memory loadedWritable,bytes32[] memory loadedReadonly,SolanaEd25519420 ed) internal view returns(Transaction memory t){
  if(raw.length>0 && raw[0]==0x81){if(loadedWritable.length!=0 || loadedReadonly.length!=0)revert InvalidTransaction();return parseV1(raw,ed);}
  if(raw.length<134 || raw.length>1232)revert InvalidTransaction();(uint256 ns,uint256 at)=compact(raw,0);if(ns==0 || ns>64 || 64*ns>=raw.length-at)revert InvalidTransaction();uint256 sigAt=at;at+=64*ns;uint256 messageAt=at;uint8 version=255;
  if(byteAt(raw,at)&128!=0){version=byteAt(raw,at)&127;if(version!=0)revert InvalidTransaction();++at;}
  t.required=byteAt(raw,at++);uint256 readonlySigned=byteAt(raw,at++);uint256 readonlyUnsigned=byteAt(raw,at++);if(t.required!=ns || readonlySigned>=ns)revert InvalidTransaction();uint256 n;(n,at)=compact(raw,at);if(n<ns || n>256 || readonlyUnsigned>n-ns)revert InvalidTransaction();uint256 total=n+loadedWritable.length+loadedReadonly.length;if(total>256)revert InvalidTransaction();
  t.keys=new bytes32[](total);t.writable=new bool[](total);
  for(uint256 i;i<n;++i){t.keys[i]=word(raw,at);at+=32;t.writable[i]=i<ns?i<ns-readonlySigned:i<n-readonlyUnsigned;}
  at+=32;if(at>raw.length)revert InvalidTransaction();uint256 count;(count,at)=compact(raw,at);if(count==0 || count>64)revert InvalidTransaction();t.instructions=new Instruction[](count);
  for(uint256 i;i<count;++i){uint8 pi=byteAt(raw,at++);if(pi>=total)revert InvalidTransaction();uint256 len;(len,at)=compact(raw,at);if(len>256)revert InvalidTransaction();bytes memory accounts=cut(raw,at,len);at+=len;for(uint256 j;j<len;++j)if(uint8(accounts[j])>=total)revert InvalidTransaction();(len,at)=compact(raw,at);bytes memory data=cut(raw,at,len);at+=len;t.instructions[i]=Instruction(pi,accounts,data);}
  uint256 expectedWritable;uint256 expectedReadonly;
  if(version==0){(count,at)=compact(raw,at);if(count>256)revert InvalidTransaction();for(uint256 i;i<count;++i){word(raw,at);at+=32;uint256 len;(len,at)=compact(raw,at);cut(raw,at,len);at+=len;expectedWritable+=len;(len,at)=compact(raw,at);cut(raw,at,len);at+=len;expectedReadonly+=len;}}
  if(at!=raw.length || expectedWritable!=loadedWritable.length || expectedReadonly!=loadedReadonly.length)revert InvalidTransaction();
  for(uint256 i;i<loadedWritable.length;++i){t.keys[n+i]=loadedWritable[i];t.writable[n+i]=true;}for(uint256 i;i<loadedReadonly.length;++i)t.keys[n+loadedWritable.length+i]=loadedReadonly[i];
  for(uint256 i;i<total;++i)for(uint256 j;j<i;++j)if(t.keys[i]==t.keys[j])revert InvalidTransaction();
  bytes memory message=cut(raw,messageAt,raw.length-messageAt);t.messageHash=sha256(message);t.id=sha256(cut(raw,sigAt,64));
  for(uint256 i;i<ns;++i)if(!ed.verify(t.keys[i],message,cut(raw,sigAt+i*64,64)))revert InvalidTransaction();
 }
 function parseV1(bytes memory raw,SolanaEd25519420 ed) private view returns(Transaction memory t){
  if(raw.length<138 || raw.length>4096)revert InvalidTransaction();uint256 ns=byteAt(raw,1);uint256 rs=byteAt(raw,2);uint256 ru=byteAt(raw,3);if(ns==0 || ns>12 || rs>=ns || 64*ns>=raw.length)revert InvalidTransaction();uint256 sigAt=raw.length-64*ns;t.required=uint8(ns);
  uint256 mask;for(uint256 i;i<4;++i)mask|=uint256(byteAt(raw,4+i))<<(8*i);if(mask>31 || (mask&3!=0 && mask&3!=3))revert InvalidTransaction();
  uint256 count=byteAt(raw,40);uint256 n=byteAt(raw,41);if(n<ns+ru || n>64 || count==0 || count>64)revert InvalidTransaction();t.keys=new bytes32[](n);t.writable=new bool[](n);uint256 at=42;
  for(uint256 i;i<n;++i){t.keys[i]=word(raw,at);at+=32;t.writable[i]=i<ns?i<ns-rs:i<n-ru;}
  for(uint256 bit;bit<5;++bit)if(mask&(uint256(1)<<bit)!=0){if(bit==4){uint256 heap;for(uint256 j;j<4;++j)heap|=uint256(byteAt(raw,at+j))<<(8*j);if(heap<32768 || heap>262144 || heap%1024!=0)revert InvalidTransaction();}at+=4;}
  uint256 headers=at;at+=count*4;t.instructions=new Instruction[](count);
  for(uint256 i;i<count;++i){uint256 head=headers+4*i;uint8 pi=byteAt(raw,head);uint256 na=byteAt(raw,head+1);uint256 nd=uint256(byteAt(raw,head+2))|(uint256(byteAt(raw,head+3))<<8);if(pi>=n)revert InvalidTransaction();bytes memory a=cut(raw,at,na);at+=na;for(uint256 j;j<na;++j)if(uint8(a[j])>=n)revert InvalidTransaction();bytes memory data=cut(raw,at,nd);at+=nd;t.instructions[i]=Instruction(pi,a,data);}
  if(at!=sigAt)revert InvalidTransaction();for(uint256 i;i<n;++i)for(uint256 j;j<i;++j)if(t.keys[i]==t.keys[j])revert InvalidTransaction();bytes memory message=cut(raw,0,sigAt);t.messageHash=sha256(message);t.id=sha256(cut(raw,sigAt,64));for(uint256 i;i<ns;++i)if(!ed.verify(t.keys[i],message,cut(raw,sigAt+64*i,64)))revert InvalidTransaction();
 }

}
