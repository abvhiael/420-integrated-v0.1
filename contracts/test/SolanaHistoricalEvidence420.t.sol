// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bridge/verifiers/solana/SolanaTransaction420.sol";
interface SolanaHistoryVm420 {function readFileBinary(string calldata) external view returns(bytes memory);}
contract SolanaHistoricalEvidence420Test {
 SolanaHistoryVm420 constant vm=SolanaHistoryVm420(address(uint160(uint256(keccak256("hevm cheat code")))));
 function read(string memory name) internal view returns(bytes memory,bytes32[] memory,bytes32[] memory,bytes32,bytes32){return abi.decode(vm.readFileBinary(string.concat("contracts/test/fixtures/solana/historical-",name,".bin")),(bytes,bytes32[],bytes32[],bytes32,bytes32));}
 function testGenuineLegacyV0V1NativeRayAndEurcSignatureEvidence() public {SolanaEd25519420 ed=new SolanaEd25519420();string[6] memory names=[string("legacy"),"v0","v1","native","ray","eurc"];for(uint256 i;i<names.length;++i){(bytes memory raw,bytes32[] memory w,bytes32[] memory r,bytes32 id,bytes32 message)=read(names[i]);SolanaTransaction420.Transaction memory t=SolanaTransaction420.parse(raw,w,r,ed);require(t.id==id && t.messageHash==message && t.required>0);}}
 function testHistoricalSignatureAndShortVecSubstitutionFail() public {SolanaEd25519420 ed=new SolanaEd25519420();(bytes memory raw,bytes32[] memory w,bytes32[] memory r,,)=read("legacy");bytes memory bad=new bytes(raw.length+1);bad[0]=0x81;bad[1]=0x00;for(uint256 i=1;i<raw.length;++i)bad[i+1]=raw[i];bool rejected;try this.decode(bad,w,r,ed){}catch{rejected=true;}require(rejected);raw[10]^=0x01;rejected=false;try this.decode(raw,w,r,ed){}catch{rejected=true;}require(rejected);}
 function decode(bytes memory raw,bytes32[] memory w,bytes32[] memory r,SolanaEd25519420 ed) external view {SolanaTransaction420.parse(raw,w,r,ed);}
}
