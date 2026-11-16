// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../src/bridge/verifiers/LitecoinFinalityVerifier420.sol";
import "./EnvelopeV18.sol";
contract LitecoinEnvelopeV18Test is EnvelopeV18Test {
 function setUp() public {boundary=new EnvelopeActorV18();LitecoinFinalityVerifier420 v=new LitecoinFinalityVerifier420(new LitecoinHeaderChain420(), hex"76a914111111111111111111111111111111111111111188ac", bytes32(uint256(1)), 1, address(boundary));boundary.configure(address(v),v.verifyFinalizedTransfer.selector);maximumEnvelope=1_100_000;}
}
