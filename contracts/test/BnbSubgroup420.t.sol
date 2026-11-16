// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bridge/verifiers/bnb/BnbBlsVerifier420.sol";
interface BnbSubgroupVm420 {function readFileBinary(string calldata) external view returns(bytes memory);}
contract BnbSubgroup420Test {
 function testOnCurveNonPrimeOrderKeyCannotProduceAcceptedJob() public {
  BnbSubgroupVm420 vm=BnbSubgroupVm420(address(uint160(uint256(keccak256("hevm cheat code")))));
  (bytes[] memory pk,bytes32 message,bytes memory sig,BnbBlsVerifier420.Witness memory w)=abi.decode(vm.readFileBinary("contracts/test/fixtures/bnb/bls-vector.bin"),(bytes[],bytes32,bytes,BnbBlsVerifier420.Witness));
  // (0,2) lies on y^2=x^3+4 but has order 3, outside the prime-order subgroup.
  pk[0]=new bytes(48);pk[0][0]=0x80;w.publicY[0]=M.c(2);
  BnbBlsVerifier420 v=new BnbBlsVerifier420();bytes32 id=v.begin(pk,message,sig,w);bool rejected;
  for(uint256 i;i<1300;++i){try v.advance(id){}catch{(,,uint8 phase,)=v.status(id);require(phase==2);rejected=true;break;}}
  require(rejected && !v.result(id) && !v.validatedKeys(keccak256(pk[0])));
 }
}
