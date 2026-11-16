// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../EthereumRLP420.sol";
/// @notice Canonical BSC execution headers and mainnet-domain Parlia seal recovery.
/// BLS finality certificates authenticate execution validity; this is not full EVM execution.
library BnbHeader420 {
 struct Header {bytes32 hash;bytes32 parent;bytes32 stateRoot;bytes32 transactionsRoot;bytes32 receiptsRoot;address miner;uint64 number;uint64 timestamp;uint64 milli;uint64 gasLimit;bytes extra;bytes32 sealHash;}
 error InvalidHeader();
 function enc(bytes memory payload) internal pure returns(bytes memory){if(payload.length==1 && uint8(payload[0])<128)return payload;return prefix(payload,128);}
 function scalar(uint256 value) internal pure returns(bytes memory out){if(value==0)return hex"";uint256 n;uint256 v=value;while(v!=0){++n;v>>=8;}out=new bytes(n);for(uint256 i;i<n;++i)out[n-i-1]=bytes1(uint8(value>>(8*i)));}
 function prefix(bytes memory payload,uint256 offset) private pure returns(bytes memory){if(payload.length<56)return abi.encodePacked(bytes1(uint8(offset+payload.length)),payload);bytes memory len=scalar(payload.length);return abi.encodePacked(bytes1(uint8(offset+55+len.length)),len,payload);}
 function list(bytes[] memory fields) internal pure returns(bytes memory){bytes memory payload;for(uint256 i;i<fields.length;++i)payload=abi.encodePacked(payload,fields[i]);return prefix(payload,192);}
 function parse(bytes memory raw) internal pure returns(Header memory h){
  EthereumRLP420.validate(raw);EthereumRLP420.Item[] memory f=EthereumRLP420.children(raw,EthereumRLP420.item(raw,0));uint256 n=f.length;
  if(n!=15 && n!=16 && n!=17 && n!=20 && n!=21)revert InvalidHeader();for(uint256 i;i<n;++i)if(f[i].list)revert InvalidHeader();
  h.hash=keccak256(raw);h.parent=EthereumRLP420.word(raw,f[0]);h.miner=EthereumRLP420.account(raw,f[2]);h.stateRoot=EthereumRLP420.word(raw,f[3]);h.transactionsRoot=EthereumRLP420.word(raw,f[4]);h.receiptsRoot=EthereumRLP420.word(raw,f[5]);
  uint256 number=EthereumRLP420.integer(raw,f[8]);uint256 time=EthereumRLP420.integer(raw,f[11]);uint256 gasLimit=EthereumRLP420.integer(raw,f[9]);uint256 used=EthereumRLP420.integer(raw,f[10]);uint256 difficulty=EthereumRLP420.integer(raw,f[7]);
  if(number==0 || number>type(uint64).max || time>type(uint64).max/1000 || gasLimit>uint256(uint64(type(int64).max)) || used>gasLimit || f[6].length!=256 || (difficulty!=1 && difficulty!=2))revert InvalidHeader();
  if(EthereumRLP420.word(raw,f[1])!=0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347 || f[14].length!=8 || keccak256(EthereumRLP420.data(raw,f[14]))!=keccak256(new bytes(8)))revert InvalidHeader();
  h.number=uint64(number);h.timestamp=uint64(time);h.gasLimit=uint64(gasLimit);h.extra=EthereumRLP420.data(raw,f[12]);if(h.extra.length<97 || h.extra.length>102400)revert InvalidHeader();
  bytes32 mix=EthereumRLP420.word(raw,f[13]);if(time>=1745903100){if(uint256(mix)>999)revert InvalidHeader();h.milli=uint64(time*1000+uint256(mix));}else{if(mix!=0)revert InvalidHeader();h.milli=uint64(time*1000);}
  if(n>=16 && EthereumRLP420.integer(raw,f[15])!=0)revert InvalidHeader();
  if(n>=17 && EthereumRLP420.word(raw,f[16])!=0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421)revert InvalidHeader();
  if(n>=20){EthereumRLP420.integer(raw,f[17]);EthereumRLP420.integer(raw,f[18]);if(EthereumRLP420.word(raw,f[19])!=0)revert InvalidHeader();}
  if(n==21)EthereumRLP420.word(raw,f[20]);
  uint256 count=n>=20?n+1:16;bytes[] memory sealParts=new bytes[](count);sealParts[0]=hex"38";
  for(uint256 i;i<15;++i)sealParts[i+1]=i==12?enc(EthereumRLP420.slice(h.extra,0,h.extra.length-65)):EthereumRLP420.encoded(raw,f[i]);
  if(n>=20)for(uint256 i=15;i<n;++i)sealParts[i+1]=EthereumRLP420.encoded(raw,f[i]);h.sealHash=keccak256(list(sealParts));
 }
 function signer(Header memory h) internal pure returns(address who){uint256 at=h.extra.length-65;bytes32 r;bytes32 s;bytes memory e=h.extra;assembly("memory-safe"){r:=mload(add(add(e,32),at)) s:=mload(add(add(e,64),at))}uint8 v=uint8(e[at+64]);if(v>=27)v-=27;if(v>1)revert InvalidHeader();who=ecrecover(h.sealHash,v+27,r,s);if(who==address(0)||who!=h.miner)revert InvalidHeader();}
}
