// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BnbConsensus420.t.sol";
/// @dev Gas isolation only: real signature correctness is covered by the genuine four-job test.
contract BnbAcceptedJobsGasOnly420 {
 function identifier(bytes[] memory k,bytes32 m,bytes memory s) external pure returns(bytes32){return keccak256(abi.encode(k,m,s));}
 function result(bytes32) external pure returns(bool){return true;}
}
contract BnbCallGas420Test is BnbConsensus420Test {
 error FinalizeGas(uint256 gasUsed);
 function testHistoricalFinalizationFitsSingleTransaction() public {
  BnbConsensusLightClient420 c=client(BnbBlsVerifier420(address(new BnbAcceptedJobsGasOnly420())));bytes[] memory a=new bytes[](1);a[0]=header(116663999);c.finalize(header(116664000),header(116664001),a,file("vote_116664000.rlp"),file("vote_116664001.rlp"));
  a=new bytes[](89);for(uint256 i;i<89;++i){a[i]=header(116664089-i);c.cacheHeader(a[i]);}bytes memory first=header(116664090);bytes memory child=header(116664091);bytes memory va=file("vote_116664090.rlp");bytes memory vb=file("vote_116664091.rlp");uint256 beforeGas=gasleft();c.finalize(first,child,a,va,vb);uint256 spent=beforeGas-gasleft();if(spent>=30000000)revert FinalizeGas(spent);require(c.finalizedNumber()==116664090);
 }
}
