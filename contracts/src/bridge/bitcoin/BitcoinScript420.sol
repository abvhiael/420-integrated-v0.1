// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
/// @notice Canonical locking scripts for the five established Bitcoin recipient profiles.
library BitcoinScript420 {
 uint256 internal constant MAX_MONEY=21_000_000*100_000_000;
 error UnsupportedScript();
 function lockingScript(bytes memory program,uint8 kind) internal pure returns(bytes memory){
  if(kind==0&&program.length==20)return abi.encodePacked(hex"76a914",program,hex"88ac");
  if(kind==1&&program.length==20)return abi.encodePacked(hex"a914",program,hex"87");
  if(kind==2&&program.length==20)return abi.encodePacked(hex"0014",program);
  if(kind==3&&program.length==32)return abi.encodePacked(hex"0020",program);
  if(kind==4&&program.length==32)return abi.encodePacked(hex"5120",program);
  revert UnsupportedScript();
 }
}
