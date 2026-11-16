// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bridge/verifiers/pirate/PirateEquihash420.sol";
interface PirateVm {function mockCall(address,bytes calldata,bytes calldata) external;function readFile(string calldata) external view returns(string memory);function parseBytes(string calldata) external pure returns(bytes memory);}
contract PirateEquihash420Test {
 PirateVm constant vm=PirateVm(address(uint160(uint256(keccak256("hevm cheat code")))));
 function header() internal view returns(bytes memory){return vm.parseBytes(string.concat("0x",vm.readFile("contracts/test/fixtures/pirate/historical-header.hex")));}
 function verify(bytes memory h) external view returns(bytes32){return PirateEquihash420.verify(h);}
 function solution(bytes memory h) external view {PirateEquihash420.verifySolution(h);}
 function target(uint32 bits) external pure returns(uint256){return PirateEquihash420.target(bits);}
 function testInvalidTargetsRejected() public view {uint32[5] memory bad=[uint32(0),0x1d80ffff,0x23010000,0x22000100,0x207fffff];for(uint256 i;i<bad.length;++i){(bool ok,)=address(this).staticcall(abi.encodeCall(this.target,(bad[i])));require(!ok,"invalid target");}}
 function testExactNativeBlockWork() public view {require(PirateEquihash420.blockWork(header())==7967024531,"native chainwork");}
 function testHistoricalMainnetEquihash() public view {require(this.verify(header())==0x748e00dd0b14c5f51b1f3346f845acef23989db4278d5411bf08410f00000000,"id");}
 function testCorruptSolutionRejected() public view {bytes memory h=header();h[200]^=0x01;(bool ok,)=address(this).staticcall(abi.encodeCall(this.solution,(h)));require(!ok,"invalid solution");}
 function testCorruptInputRejected() public view {bytes memory h=header();h[10]^=0x01;(bool ok,)=address(this).staticcall(abi.encodeCall(this.solution,(h)));require(!ok,"wrong input");}
 function testMissingBlake2PrecompileRejected() public {vm.mockCall(address(9),bytes(""),bytes(""));(bool ok,bytes memory result)=address(this).staticcall(abi.encodeCall(this.verify,(header())));require(!ok&&bytes4(result)==PirateEquihash420.Blake2Unavailable.selector,"missing precompile");}
 function testNoncanonicalSolutionLengthRejected() public view {bytes memory h=header();h[140]=0xfe;(bool ok,)=address(this).staticcall(abi.encodeCall(this.solution,(h)));require(!ok,"compact size");}
 function testDuplicateIndicesRejected() public view {bytes memory h=header();for(uint256 i=143;i<h.length;++i)h[i]=0;(bool ok,)=address(this).staticcall(abi.encodeCall(this.solution,(h)));require(!ok,"duplicates");}
 function testMalformedLengthRejected() public view {(bool ok,)=address(this).staticcall(abi.encodeCall(this.verify,(new bytes(1486))));require(!ok,"length");}
}
