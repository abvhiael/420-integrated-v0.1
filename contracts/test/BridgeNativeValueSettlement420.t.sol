// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BridgeFullLocalFixture420.sol";
import "./CADCGatewayIntegration420.t.sol";
contract BridgeNativeCCTPExposure420Test is BridgeFullLocalFixture420 {
 function testNativeValueCanonicalTokenSubstitutionRejectsBeforeVerified() public {env.setSettlementAsset(address(0xBAD),ASSET,true);(bool ok,)=address(gateway).call(abi.encodeCall(gateway.acceptInbound,(adapter.ADAPTER_ID(),transport(proof("base-standard")))));require(!ok,"native payout admitted as substituted canonical asset");assertClean();}

 function testNativeValueGrossIssuerMintIncludingFeesConsumesExposure() public {
  CCTPV2Message420.Message memory m=message("arbitrum-fast");require(m.fee>0,"must exercise fee");
  bytes32 source=keccak256("ARBITRUM/CONTROLLED");bytes32 destination=keccak256("420/BRIDGE/CHAIN/ETH");
  chains.setChain(source,BridgeChainRegistry420.Chain(42161,keccak256("ARBITRUM/MAINNET"),keccak256("ETH"),keccak256("CIRCLE/CCTP/V2"),BridgeChainRegistry420.ChainFamily.EVM,true));
  routes.setRoute(route(3),BridgeRouteRegistry.Route(ASSET,42161,1,m.burnToken,bytes32(uint256(uint160(address(token)))),adapter.ADAPTER_ID(),keccak256("CONTROLLED/CCTP/CONFIG"),1,BridgeRouteRegistry.Status.APPROVED_INACTIVE,true,true));
  risk.setRouteLimits(route(3),limits(1_000_000_000 ether));env.health().setRoute(route(3),true);
  BridgeVerifierRegistry420.Registration memory r=abi.decode(qualification.registration(qualification.currentApproval(address(adapter))),(BridgeVerifierRegistry420.Registration));r.sourceChainKey=source;r.destinationChainKey=destination;
  qualification.record(r,qualification.currentApproval(address(adapter)),true);
  BridgeRouteRegistry.Route memory next;(next.assetId,next.sourceChainId,next.destinationChainId,next.sourceAsset,next.destinationAsset,next.adapterId,next.verifierConfigHash,next.version,next.status,next.inboundEnabled,next.outboundEnabled)=routes.routes(route(3));next.status=BridgeRouteRegistry.Status.ACTIVE;routes.setRoute(route(3),next);
  IBridgeAdapter420.VerifiedTransfer memory v=IBridgeAdapter420.VerifiedTransfer(route(3),ASSET,address(uint160(uint256(m.messageSender))),m.mintRecipient,m.amount-m.fee,keccak256(file("arbitrum-fast.message.hex")),keccak256(abi.encode("420/CCTP/V2/NONCE",m.nonce)));
  bytes32 id=gateway.acceptInboundAndSettle(adapter.ADAPTER_ID(),ProofEnvelopeFixture420.wrap(gateway,adapter.ADAPTER_ID(),v,m.sender,proof("arbitrum-fast")));
  (uint256 routeExposure,uint256 assetExposure)=risk.outstanding(route(3),ASSET);require(routeExposure==m.amount&&assetExposure==m.amount,"fee-created supply omitted");
  require(token.balanceOf(m.mintRecipient)==m.amount-m.fee&&token.balanceOf(FEES)==m.fee);(,,,,,,,BridgeTransferRegistry.Status state,,)=transfers.transfers(id);require(state==BridgeTransferRegistry.Status.COMPLETED);
 }
}
contract BridgeNativeCADCSettlement420Test is CADCGatewayIntegration420Test {
 function testNativeValueCADCReceiptCompletesOnlyActualDelivery() public {
  bytes memory m=message(125);ready(1,m);bytes32 id=gateway.acceptInboundAndSettle(adapter.adapterId(),transport(1,m));
  (,,,,,,,BridgeTransferRegistry.Status state,,)=transfers.transfers(id);require(state==BridgeTransferRegistry.Status.COMPLETED&&oft.balanceOf(RECIPIENT)==125e12);
  (address token,address recipient,uint256 amount,bytes32 e)=adapter.settlementEvidence(guid(1));require(token==address(oft)&&recipient==RECIPIENT&&amount==125e12&&e!=0);
  (bool ok,)=address(gateway).call(abi.encodeCall(gateway.completeInboundSettlement,(id)));require(!ok&&oft.balanceOf(RECIPIENT)==125e12,"duplicate native release");
 }
}
