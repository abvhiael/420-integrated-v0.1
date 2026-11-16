// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../src/bridge/BridgeProofEnvelope420.sol";
import "../../src/bridge/GatewayRouter420.sol";
import "../../src/bridge/BridgeRouteRegistry.sol";
import "../../src/interfaces/genesis/IProtocolRegistry420.sol";
/// @dev Public transport claims for controlled tests; never source evidence or a signing service.
library ProofEnvelopeFixture420 {
 function wrap(GatewayRouter420 router,bytes32 adapter,IBridgeAdapter420.VerifiedTransfer memory v,bytes32 gateway,bytes memory raw) internal view returns(bytes memory){
  BridgeProofEnvelope420.Envelope memory e;
  e.version=1;e.routeId=v.routeId;e.adapterId=adapter;e.assetId=v.assetId;
  e.sourceGateway=gateway;e.destinationChainIdEvm=block.chainid;e.destinationRouter=address(router);
  e.recipient=v.recipient;e.amount=v.amount;e.sourceTxId=v.sourceTxId;e.sourceMessageId=v.sourceMessageId;
  e.observedAt=uint64(block.timestamp);e.expiresAt=uint64(block.timestamp+3600);e.innerProof=raw;
  BridgeRouteRegistry routes=BridgeRouteRegistry(IProtocolRegistry420(router.registry()).component(BridgeIds420.ROUTE_REGISTRY).implementation);
  (bool ok,bytes memory routeData)=address(routes).staticcall(abi.encodeCall(routes.routes,(v.routeId)));if(!ok || routeData.length<352)return raw;
  (,e.sourceChainId,e.destinationChainId,e.sourceAsset,,,e.verifierConfigHash,,,,)=abi.decode(routeData,(bytes32,uint64,uint64,bytes32,bytes32,bytes32,bytes32,uint32,uint8,bool,bool));
  (ok,routeData)=address(routes).staticcall(abi.encodeCall(routes.chainBindings,(v.routeId)));if(!ok||routeData.length<128)return raw;
  (,e.sourceNetworkId,,e.destinationNetworkId)=abi.decode(routeData,(bytes32,bytes32,bytes32,bytes32));
  return abi.encode(e);
 }
 function mock(GatewayRouter420 router,bytes32 adapter,bytes memory raw) internal view returns(bytes memory){
  (bool ok,bytes memory data)=router.adapters(adapter).staticcall(abi.encodeWithSignature("nextTransfer()"));if(!ok||data.length<224)return raw;IBridgeAdapter420.VerifiedTransfer memory v=abi.decode(data,(IBridgeAdapter420.VerifiedTransfer));return wrap(router,adapter,v,keccak256("fixture/gateway"),raw);
 }
}
