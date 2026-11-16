// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../src/bridge/verifiers/PirateChainFinalityVerifier420.sol";
import "./EnvelopeV18.sol";
contract PirateEnvelopeV18Test is EnvelopeV18Test {
 function setUp() public {boundary=new EnvelopeActorV18();AuthenticatedCheckpoint420 cp=new AuthenticatedCheckpoint420(address(this),keccak256("PIRATE/MAINNET"),address(1),100,bytes32(uint256(1)),bytes32(uint256(1))); PirateChainFinalityVerifier420 v=new PirateChainFinalityVerifier420(address(this),address(cp),address(boundary));boundary.configure(address(v),v.verifyFinalizedTransfer.selector);maximumEnvelope=4100000;}
}
