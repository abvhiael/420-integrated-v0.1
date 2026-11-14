// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bridge/verifiers/LitecoinFinalityVerifier420.sol";
interface LitecoinRestrictionVm420 {function readFileBinary(string calldata) external view returns(bytes memory);function warp(uint256) external;function expectRevert(bytes4) external;}
contract LitecoinRestrictions420Test {
    LitecoinRestrictionVm420 constant vm=LitecoinRestrictionVm420(address(uint160(uint256(keccak256("hevm cheat code")))));
    function parse(bytes calldata raw) external pure returns(LitecoinTransaction420.Parsed memory){return LitecoinTransaction420.parse(raw,0,1);}
    function txWithScript(bytes memory script) private pure returns(bytes memory){return abi.encodePacked(hex"0100000001",bytes32(uint256(1)),hex"0000000000ffffffff02e803000000000000",bytes1(uint8(script.length)),script,hex"0000000000000000226a20",bytes32(uint256(2)),hex"00000000");}
    function testActualMWEBHogExAndStrippedHogAddrAndPeginProgramsRejected() public {
        bytes memory hogex=vm.readFileBinary("contracts/test/fixtures/litecoin/hogex.bin");require(hogex[4]==0 && hogex[5]==0x08);
        vm.expectRevert(LitecoinTransaction420.InvalidTransaction.selector);this.parse(hogex);
        // Two otherwise admissible transparent outputs cannot conceal MWEB programs.
        bytes memory raw=txWithScript(abi.encodePacked(hex"5820",bytes32(uint256(1))));
        vm.expectRevert(LitecoinTransaction420.InvalidTransaction.selector);this.parse(raw);
        raw=txWithScript(abi.encodePacked(hex"5920",bytes32(uint256(1))));vm.expectRevert(LitecoinTransaction420.InvalidTransaction.selector);this.parse(raw);
        // An MWEB flag combined with witness framing is also unsupported.
        hogex[5]=0x09;vm.expectRevert(LitecoinTransaction420.InvalidTransaction.selector);this.parse(hogex);
        LitecoinTransaction420.Parsed memory ordinary=this.parse(txWithScript(hex"00141111111111111111111111111111111111111111"));require(ordinary.payment.value==1000);
    }
    function testUnfinishedWorkWrongHeaderAndInvalidScryptCannotAuthorizeHeaders() public {
        vm.warp(1_800_000_000);LitecoinHeaderChain420 c=new LitecoinHeaderChain420();bytes memory data=vm.readFileBinary("contracts/test/fixtures/litecoin/headers.bin");bytes memory raw=new bytes(80);for(uint256 i;i<80;++i)raw[i]=data[80+i];
        vm.expectRevert(LitecoinHeaderChain420.InvalidHeader.selector);c.submit(raw);
        raw[79]^=0x01;bytes32 id=c.scrypt().begin(raw);c.scrypt().advance(id,32);
        vm.expectRevert(LitecoinHeaderChain420.InvalidHeader.selector);c.submit(raw);
        // Different chunk sizes cross the fill/ROMix boundary and still produce exact Scrypt.
        while(c.scrypt().cursor(id)<2048)c.scrypt().advance(id,17);
        (bytes32 actual,bool complete)=c.scrypt().result(id);bytes memory expected=vm.readFileBinary("contracts/test/fixtures/litecoin/bad-pow.bin");require(complete && actual==bytes32(BridgeWire420.readBE(expected,0,32)));
        vm.expectRevert(LitecoinHeaderChain420.InvalidTarget.selector);c.submit(raw);
        raw[79]^=0x01;vm.expectRevert(LitecoinHeaderChain420.InvalidHeader.selector);c.submit(raw);
        require(c.bestTip()==c.GENESIS());
    }
    function testFuzzUnknownOrOutOfRangeProgressNeverCreatesCompletedWork(bytes32 id,uint16 steps) public {
        LitecoinScrypt420 s=new LitecoinScrypt420();(bool ok,)=address(s).call(abi.encodeCall(s.advance,(id,steps)));require(!ok);(,bool complete)=s.result(id);require(!complete);
    }
}
