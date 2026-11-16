// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../BnbConsensus420.t.sol";
import "../../src/bridge/verifiers/BnbFinalityVerifier420.sol";
import "../../src/bridge/verifiers/BnbGatewayMessageVerifier420.sol";
import "./EnvelopeV18.sol";
contract BnbEnvelopeV18Test is BnbConsensus420Test,EnvelopeV18Test {
 function setUp() public {boundary=new EnvelopeActorV18();BnbConsensusLightClient420 c=client(new BnbBlsVerifier420());BnbGatewayMessageVerifier420 m=new BnbGatewayMessageVerifier420(address(this),address(boundary));BnbFinalityVerifier420 v=new BnbFinalityVerifier420(address(this),address(c),address(m));boundary.configure(address(v),v.verifyFinalizedTransfer.selector);maximumEnvelope=1_200_000;}
}
