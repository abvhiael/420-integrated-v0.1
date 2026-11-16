// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./SolanaV18.t.sol";
contract SolanaIntegerV18Test is SolanaEnvelopeV18Test {
 function testV18IndependentInstructionIntegerVectors() public view {
  uint64[7] memory values=[uint64(0),uint64(1),uint64(4294967295),uint64(4294967296),uint64(9007199254740992),uint64(9223372036854775808),uint64(18446744073709551615)];
  bytes32[7] memory expected=[bytes32(0x93e9b25ab7b02c233de622cdb7b26aad0b4ec3728db346bad238f35afe9a1092),bytes32(0xe65b74fc5581d5d5a4b5812c4c2fb7678ade46fff26f40d30df71c786d339aa6),bytes32(0x26eaa11b078f74bcd0b454d8cce3e7f3a531eaf3c25fad866d696ae8730518ab),bytes32(0x16cf4201ec186b4a757dfbc20c3d8062e972e47ad5a41a908077371d75570a06),bytes32(0xf1cbdc19b5a426b5c92d77d99fd58deca8fd3cda12e32f3a128dff4e90bc4038),bytes32(0x039e1094925a60b60dda409e4386b547a190b7e86ec79a2d3546c3cd8dade86e),bytes32(0xcd9f843d2c5652360d9209f357a82de7f05925fbff286672ba69289674164991)];
  SolanaFinalityVerifier420 v=SolanaFinalityVerifier420(boundary.target());
  for(uint256 i;i<values.length;++i){SolanaFinalityVerifier420.Execution memory e;e.amount=values[i];e.nonce=values[i];bytes memory result=v.instructionData(e);require(result.length==160&&sha256(result)==expected[i],"independent uint64 instruction encoding");}
 }
 function testFuzzV18DirtyAmountCannotTruncate(uint192 high,uint64 low) public view {
  SolanaFinalityVerifier420 v=SolanaFinalityVerifier420(boundary.target());SolanaFinalityVerifier420.Execution memory e;e.amount=low;
  bytes memory payload=abi.encodeCall(v.instructionData,(e));
  (bool valid,)=address(v).staticcall(payload);require(valid,"canonical control");
  uint256 dirty=(uint256(high==0?1:high)<<64)|uint256(low);
  // Four-byte selector, one tuple offset, then Execution field 8.
  assembly {mstore(add(payload,324),dirty)}
  (bool accepted,)=address(v).staticcall(payload);require(!accepted,"high uint64 bits truncated");
 }
}
