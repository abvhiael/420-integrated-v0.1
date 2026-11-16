// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./LitecoinBridgeAdapter420.t.sol";
contract LitecoinReplayQualification420Test {
    function testOutpointCannotReplayWithDifferentMessageAfterVerifierRotation() public {
        LitecoinRouterCaller420 r=new LitecoinRouterCaller420();LitecoinFinalityVerifierMock420 first=new LitecoinFinalityVerifierMock420();first.setRouter(address(r));
        LitecoinBridgeAdapter420 a=new LitecoinBridgeAdapter420(address(this),address(r),address(first));bytes32 asset=keccak256("420/BRIDGE/ASSET/LTC");a.setLtcBinding(asset,first.routeId());
        ILitecoinFinalityVerifier420.FinalizedTransfer memory t=ILitecoinFinalityVerifier420.FinalizedTransfer(a.LTC_MAINNET_GENESIS_HASH(),a.LTC_MAINNET_MESSAGE_START(),100,keccak256("block"),keccak256("tx"),keccak256("old message"),keccak256("same outpoint"),address(0xB0B),1000,12,true,true,false,true);
        first.set(t);r.inbound(a,hex"01");require(a.consumedSourceOutputs(t.sourceOutput));
        LitecoinFinalityVerifierMock420 second=new LitecoinFinalityVerifierMock420();second.setRouter(address(r));a.setVerifier(address(second));t.messageId=keccak256("new message");second.set(t);
        (bool ok,)=address(r).call(abi.encodeCall(r.inbound,(a,hex"02")));require(!ok && !a.consumedMessages(t.messageId) && a.consumedSourceOutputs(t.sourceOutput));
    }
    function testMWEBOutboundProgramAndUnauthorizedAdapterCallFailWithoutNonceMutation() public {
        LitecoinRouterCaller420 r=new LitecoinRouterCaller420();LitecoinFinalityVerifierMock420 v=new LitecoinFinalityVerifierMock420();v.setRouter(address(r));LitecoinBridgeAdapter420 a=new LitecoinBridgeAdapter420(address(this),address(r),address(v));bytes32 asset=keccak256("420/BRIDGE/ASSET/LTC");a.setLtcBinding(asset,v.routeId());
        (bool ok,)=address(r).call(abi.encodeCall(r.outbound,(a,v.routeId(),asset,address(this),abi.encodePacked(bytes32(uint256(1))),uint256(1000),hex"08")));require(!ok && a.outboundNonce()==0);
        (ok,)=address(r).call(abi.encodeCall(r.outbound,(a,v.routeId(),asset,address(this),abi.encodePacked(bytes32(uint256(1))),uint256(1000),hex"09")));require(!ok && a.outboundNonce()==0);
        (ok,)=address(a).call(abi.encodeCall(a.verifyInbound,(hex"00")));require(!ok);
        (ok,)=address(a).call(abi.encodeCall(a.initiateOutbound,(v.routeId(),asset,address(this),abi.encodePacked(address(1)),uint256(1000),hex"00")));require(!ok && a.outboundNonce()==0);
    }
}
