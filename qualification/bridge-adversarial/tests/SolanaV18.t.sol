// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../src/bridge/verifiers/SolanaFinalityVerifier420.sol";
import "./EnvelopeV18.sol";
contract SolanaEnvelopeV18Test is EnvelopeV18Test {
 function setUp() public {boundary=new EnvelopeActorV18();SolanaValidatorQuorum420 q=new SolanaValidatorQuorum420(address(this));SolanaFinalityVerifier420 v=new SolanaFinalityVerifier420(address(this),address(q),address(boundary));boundary.configure(address(v),v.verifyFinalizedTransfer.selector);maximumEnvelope=50_000;}
}
