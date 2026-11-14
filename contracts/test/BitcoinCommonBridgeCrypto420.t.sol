// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "forge-std/Test.sol";
import "../src/bridge/verifiers/BridgeCrypto420.sol";
import "../src/bridge/verifiers/BridgeWire420.sol";
import "../src/bridge/verifiers/AuthenticatedCheckpoint420.sol";
import "../src/bridge/verifiers/BitcoinHeaderPow420.sol";
import "../src/bridge/verifiers/BitcoinMerkleBranch420.sol";

contract CommonBridgeCrypto420Test is Test {
    function testHistoricalGenesis() public pure {
        bytes memory header=hex"0100000000000000000000000000000000000000000000000000000000000000000000003ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4a29ab5f49ffff001d1dac2b7c";
        bytes32 digest=0x6fe28c0ab6f1b372c1a6a246ae63f74f931e8365e15a089c68d6190000000000;
        assertEq(BridgeCrypto420.sha256d(header),digest);
        assertEq(BitcoinHeaderPow420.verify(header),digest);
        bytes32 root=0x3ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4a;
        require(BitcoinMerkleBranch420.verify(root,root,0,1,new bytes32[](0)));
    }
    function testHashVectors() public pure {
        assertEq(BridgeCrypto420.sha256d(bytes("")),0x5df6e0e2761359d30a8275058e299fcc0381534545f55cf43e41983f5d4c9456);
        assertEq(bytes32(BridgeCrypto420.hash160(bytes("hello"))),bytes32(bytes20(hex"b6a9c8c230722b7c748331a8b450f05566dc7d0f")));
    }
    function testFuzzIntegerRoundTrip(uint256 value,uint8 rawWidth) public pure {
        uint256 width=uint256(rawWidth)%32+1;
        if(width<32) value=value & ((uint256(1)<<(8*width))-1);
        assertEq(BridgeWire420.readLE(BridgeWire420.encodeLE(value,width),0,width),value);
        assertEq(BridgeWire420.readBE(BridgeWire420.encodeBE(value,width),0,width),value);
    }
    function testFuzzCompactSize(uint64 value) public pure {
        bytes memory encoded=BridgeWire420.encodeCompactSize(value);
        (uint64 decoded,uint256 next)=BridgeWire420.compactSize(encoded,0);
        assertEq(uint256(decoded),uint256(value));
        BridgeWire420.requireEnd(encoded,next);
    }
    function testCompactBoundaries() public pure {
        assertEq(BridgeWire420.encodeCompactSize(252),hex"fc");
        assertEq(BridgeWire420.encodeCompactSize(253),hex"fdfd00");
        assertEq(BridgeWire420.encodeCompactSize(65536),hex"fe00000100");
        assertEq(BridgeWire420.encodeCompactSize(4294967296),hex"ff0000000001000000");
    }
    function readCompact(bytes calldata data) external pure returns(uint64,uint256) {
        return BridgeWire420.compactSize(data,0);
    }
    function testMalformedCompact() public {
        vm.expectRevert(BridgeWire420.NonCanonical.selector);
        this.readCompact(hex"fdfc00");
        vm.expectRevert(BridgeWire420.Truncated.selector);
        this.readCompact(hex"ff0102");
    }
    function testCheckpoint() public {
        uint256 key=1234;
        AuthenticatedCheckpoint420 c=new AuthenticatedCheckpoint420(address(this),keccak256("network"),vm.addr(key),0,bytes32(uint256(1)),bytes32(uint256(2)));
        bytes32 hash=bytes32(uint256(3)); bytes32 root=bytes32(uint256(4));
        (uint8 v,bytes32 r,bytes32 s)=vm.sign(key,c.digest(1,hash,root));
        bytes memory sig=abi.encodePacked(r,s,v);
        c.advance(1,hash,root,sig);
        AuthenticatedCheckpoint420.Checkpoint memory cp=c.current();
        assertEq(uint256(cp.height),1);
        assertEq(cp.blockHash,hash);
        vm.expectRevert(AuthenticatedCheckpoint420.StaleCheckpoint.selector);
        c.advance(1,hash,root,sig);
        c.rotate(vm.addr(5678));
        vm.expectRevert(AuthenticatedCheckpoint420.StaleCheckpoint.selector);
        c.current();
        vm.expectRevert(BridgeCrypto420.InvalidSignature.selector);
        c.advance(2,bytes32(uint256(5)),root,sig);
        (v,r,s)=vm.sign(5678,c.digest(2,bytes32(uint256(5)),root));
        c.advance(2,bytes32(uint256(5)),root,abi.encodePacked(r,s,v));
        cp=c.current();
        assertEq(uint256(cp.height),2);
    }
    function testOrderedMerkle() public pure {
        bytes32 a=bytes32(uint256(1));bytes32 b=bytes32(uint256(2));
        bytes32[] memory branch=new bytes32[](1);branch[0]=b;
        bytes32 root=sha256(abi.encodePacked(a,b));
        require(BridgeCrypto420.verifySha256Branch(a,root,0,1,branch));
        require(!BridgeCrypto420.verifySha256Branch(a,root,1,1,branch));
    }
}
