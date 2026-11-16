// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../src/bridge/verifiers/CurecoinFinalityVerifier420.sol";
import "./EnvelopeV18.sol";
contract CurecoinEnvelopeV18Test is EnvelopeV18Test {
 function setUp() public {boundary=new EnvelopeActorV18();AuthenticatedCheckpoint420 cp=new AuthenticatedCheckpoint420(address(this),keccak256("CURECOIN/MAINNET"),address(1),100,bytes32(uint256(1)),bytes32(uint256(1))); CurecoinFinalityVerifier420 v=new CurecoinFinalityVerifier420(address(this),address(cp),address(boundary),6);boundary.configure(address(v),v.verifyFinalizedTransfer.selector);maximumEnvelope=200000;}
}
