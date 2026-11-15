// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bridge/verifiers/solana/SolanaTransaction420.sol";
interface SolanaCorpusVm420 {function readFileBinary(string calldata) external view returns(bytes memory);}
contract SolanaHistoricalCorpus420Test {
 struct Vector {bytes transaction;bytes32[] writable;bytes32[] readonly_;bytes32 id;bytes32 messageHash;}
 function testRemainingGenuineHistoricalBlockCorpusWithoutRepeatingQualifiedVectors() public {SolanaCorpusVm420 vm=SolanaCorpusVm420(address(uint160(uint256(keccak256("hevm cheat code")))));Vector[] memory rows=abi.decode(vm.readFileBinary("contracts/test/fixtures/solana/historical-remaining-block.bin"),(Vector[]));require(rows.length==1047,"unexpected corpus");SolanaEd25519420 ed=new SolanaEd25519420();for(uint256 i;i<rows.length;++i){SolanaTransaction420.Transaction memory t=SolanaTransaction420.parse(rows[i].transaction,rows[i].writable,rows[i].readonly_,ed);require(t.id==rows[i].id && t.messageHash==rows[i].messageHash);}}
}
