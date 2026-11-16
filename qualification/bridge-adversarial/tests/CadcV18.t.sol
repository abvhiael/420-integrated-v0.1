// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../CADCLayerZero420.t.sol";
import "./EnvelopeV18.sol";

contract CadcEnvelopeV18Test is CADCLayerZero420Test, EnvelopeV18Test {
    function _router() internal view override returns (address) { return address(boundary); }
    function setUp() public override {
        boundary = new EnvelopeActorV18();
        CADCLayerZero420Test.setUp();
        boundary.configure(address(adapter), CADCLayerZeroAdapter.verifyInbound.selector);
        maximumEnvelope = 192;
    }
    function testV18CanonicalEnvelopeDelivers() public {
        bytes memory m = message(1); ready(1, m);
        boundary.attack(abi.encode(uint32(30101), uint64(1), m));
        require(boundary.unauthorizedAcceptances() == 1, "native valid-context control failed");
        require(oft.balanceOf(RECIPIENT) == 1e12, "native mint mismatch");
    }
    function rejectEnvelope(bytes memory encoded) private {
        bytes memory m = message(1); ready(1, m);
        boundary.attack(encoded);
        require(boundary.unauthorizedAcceptances() == 0, "noncanonical envelope authorized native delivery");
        require(oft.balanceOf(RECIPIENT) == 0, "rejected envelope minted");
        require(!adapter.consumed(guid(1)), "rejected envelope consumed replay key");
    }
    function testV18TrailingEnvelopeCannotDeliver() public {
        rejectEnvelope(bytes.concat(abi.encode(uint32(30101), uint64(1), message(1)), hex"00"));
    }
    function testV18DirtyPaddingCannotDeliver() public {
        bytes memory encoded = abi.encode(uint32(30101), uint64(1), message(1));
        encoded[encoded.length - 1] = 0x01;
        rejectEnvelope(encoded);
    }
    function testV18RelocatedDynamicTailCannotDeliver() public {
        bytes memory encoded = abi.encode(uint32(30101), uint64(1), uint256(128), uint256(0), uint256(40));
        bytes memory tail = abi.encodePacked(message(1), new bytes(24));
        rejectEnvelope(bytes.concat(encoded, tail));
    }
}
