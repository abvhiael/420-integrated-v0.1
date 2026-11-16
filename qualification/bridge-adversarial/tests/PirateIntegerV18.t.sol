// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../PirateChainFinalityVerifier420.t.sol";
contract PirateIntegerV18Test is PirateChainFinalityVerifier420Test {
 function testV18NotePositionCannotTruncate() public {
  PirateChainFinalityVerifier420.Proof memory p=ready();p.record.notePosition=uint64(type(uint32).max)+1;install(p,p.record.height+2);
  (bool ok,bytes memory reason)=address(verifier).staticcall(abi.encodeCall(verifier.verifyFinalizedTransfer,(abi.encode(p))));
  require(!ok&&bytes4(reason)==PirateChainFinalityVerifier420.InvalidProof.selector,"note position truncation");
 }
 function testV18NativeSupplyAmountBounds() public {
  uint64[3] memory values=[uint64(20_000_000_000_000_001),uint64(1<<63),type(uint64).max];
  for(uint256 i;i<values.length;++i){PirateChainFinalityVerifier420.Proof memory p=ready();p.record.amount=values[i];p=bind(p);install(p,p.record.height+2);
   (bool ok,bytes memory reason)=address(verifier).staticcall(abi.encodeCall(verifier.verifyFinalizedTransfer,(abi.encode(p))));require(!ok&&bytes4(reason)==PirateChainFinalityVerifier420.InvalidProof.selector,"native supply overflow");}
 }
}
