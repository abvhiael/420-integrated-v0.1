// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bridge/verifiers/bnb/BnbBlsVerifier420.sol";
interface BnbBlsVm420 {function readFileBinary(string calldata) external view returns(bytes memory);}
contract BnbBlsSoftware420Test {
 BnbBlsVm420 constant vm=BnbBlsVm420(address(uint160(uint256(keccak256("hevm cheat code")))));
 function testRealCancunBLSWithoutNativeBlsPrecompiles() public {verifyVector("bls-vector.bin",true);}
 function testWrongMessageBlsPairingRejected() public {verifyVector("bls-wrong-message.bin",false);}
 function verifyVector(string memory name,bool expected) internal {
  (bytes[] memory pk,bytes32 msg_,bytes memory sig,BnbBlsVerifier420.Witness memory w)=abi.decode(vm.readFileBinary(string.concat("contracts/test/fixtures/bnb/",name)),(bytes[],bytes32,bytes,BnbBlsVerifier420.Witness));
  BnbBlsVerifier420 v=new BnbBlsVerifier420();bytes32 id=v.begin(pk,msg_,sig,w);uint256 steps;
  (bool done,,,)=v.status(id);while(!done){v.advance(id);++steps;require(steps<10000,"work bound");(done,,,)=v.status(id);}
  require(v.result(id)==expected,"BLS pairing result mismatch");
 }
 function testHashToCurveMatchesIndependentPyEcc() public {
  (,bytes32 msg_,,BnbBlsVerifier420.Witness memory w)=abi.decode(vm.readFileBinary("contracts/test/fixtures/bnb/bls-vector.bin"),(bytes[],bytes32,bytes,BnbBlsVerifier420.Witness));
  BnbBlsHash420 h=new BnbBlsHash420();M.P2 memory q=h.hashBeforeCofactor(msg_,w.hashY);M.F2 memory iz=M.i2(q.z);M.F2 memory x=M.m2(q.x,iz);M.F2 memory y=M.m2(q.y,iz);
  (M.F2 memory expectedX,M.F2 memory expectedY,,)=abi.decode(vm.readFileBinary("contracts/test/fixtures/bnb/bls-hash-oracle.bin"),(M.F2,M.F2,M.F2,M.F2));require(M.e2(x,expectedX)&&M.e2(y,expectedY));
 }
}
