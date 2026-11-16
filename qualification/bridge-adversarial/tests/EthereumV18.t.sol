// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../helpers/EthereumProofFixture420.sol";
import "../../src/bridge/verifiers/EthereumFinalityVerifier420.sol";
import "./EnvelopeV18.sol";
contract EthereumEnvelopeV18Test is EthereumProofFixture420,EnvelopeV18Test {
 function setUp() public {boundary=new EnvelopeActorV18();EthereumConsensusLightClient420 c=client("");EthereumGatewayMessageVerifier420 m=new EthereumGatewayMessageVerifier420(address(this),address(boundary));EthereumFinalityVerifier420 v=new EthereumFinalityVerifier420(address(this),address(c),address(m));boundary.configure(address(v),v.verifyFinalizedTransfer.selector);maximumEnvelope=1_200_000;}
}
