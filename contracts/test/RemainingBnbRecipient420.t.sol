// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BnbBridgeAdapter420.t.sol";
/// Controlled verifier boundary; no BSC finality or custody claim.
contract RemainingBnbRecipient420Test {
 function testBnbZeroRecipientRejectedBeforeNonceConsumption() public {
  BnbRouterCaller420 router=new BnbRouterCaller420();BnbFinalityVerifierMock420 verifier=new BnbFinalityVerifierMock420();
  BnbBridgeAdapter420 adapter=new BnbBridgeAdapter420(address(this),address(router),address(verifier));
  bytes32 asset=keccak256("420/BRIDGE/ASSET/BNB");bytes32 route=keccak256("420/BRIDGE/ROUTE/BNB/MAINNET");
  adapter.setAssetMapping(adapter.BNB_NATIVE_SOURCE_ASSET(),asset,true);adapter.setRouteBinding(asset,route);
  (bool ok,bytes memory reason)=address(router).call(abi.encodeCall(router.outbound,(adapter,route,asset,address(this),new bytes(20),1 ether,bytes(""))));
  require(!ok&&bytes4(reason)==BnbBridgeAdapter420.InvalidOutbound.selector&&adapter.outboundNonce()==0,"zero BNB recipient accepted");
 }
}
