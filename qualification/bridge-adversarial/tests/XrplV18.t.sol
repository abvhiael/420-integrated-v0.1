// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../src/bridge/verifiers/XrplFinalityVerifier420.sol";
import "./EnvelopeV18.sol";
contract XrplEnvelopeV18Test is EnvelopeV18Test {
 function setUp() public {boundary=new EnvelopeActorV18(); XrplFinalityVerifier420 v=new XrplFinalityVerifier420(address(this),address(boundary));boundary.configure(address(v),v.verifyFinalizedTransfer.selector);maximumEnvelope=120000;}
}
