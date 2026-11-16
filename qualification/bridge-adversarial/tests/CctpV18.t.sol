// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../helpers/CCTPNativeHarness420.sol";
import "./EnvelopeV18.sol";
contract CctpEnvelopeV18Test is CCTPNativeHarness420,EnvelopeV18Test {
 function setUp() public {boundary=new EnvelopeActorV18();setupNative(0,address(boundary));boundary.configure(address(adapter),adapter.verifyInbound.selector);maximumEnvelope=20_000;}
}
