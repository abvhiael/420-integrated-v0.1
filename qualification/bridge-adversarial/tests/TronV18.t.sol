// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../src/bridge/verifiers/TronFinalityVerifier420.sol";
import "./EnvelopeV18.sol";
contract TronEnvelopeV18Test is EnvelopeV18Test {
 function setUp() public {boundary=new EnvelopeActorV18(); TronFinalityVerifier420 v=new TronFinalityVerifier420(address(this),address(boundary));boundary.configure(address(v),v.verifyFinalizedTransfer.selector);maximumEnvelope=70000;}
}
