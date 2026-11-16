// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BridgeGenesisIntegration420.t.sol";
import "../src/bridge/BridgeRepresentation420.sol";
contract BridgeRepresentationEconomic420Test is BridgeGenesisFixture420 {
 function testRealRepresentationRequiresQualifiedProofAndActualBurn() public {
  Fixture memory f=_setup();ValueOutcome420 outcome=new ValueOutcome420();BridgeValueCustody420 custody=new BridgeValueCustody420(address(this),address(f.env.registry()),keccak256("real representation simulation"),outcome);f.env.registerResident(address(custody),custody.componentId());
  bytes32 asset=keccak256("420/BRIDGE/ASSET/ETH");BridgeRepresentation420 token=new BridgeRepresentation420(asset,18,custody);f.env.setSettlementAsset(address(token),asset,true);custody.configure(asset,address(token),BridgeValueCustody420.Mode.MINT_BURN);
  BridgeRouteRegistry.Route memory r;(r.assetId,r.sourceChainId,r.destinationChainId,r.sourceAsset,r.destinationAsset,r.adapterId,r.verifierConfigHash,r.version,r.status,r.inboundEnabled,r.outboundEnabled)=f.routes.routes(ROUTE_ID);r.assetId=asset;r.destinationAsset=bytes32(uint256(uint160(address(token))));r.status=BridgeRouteRegistry.Status.APPROVED_INACTIVE;f.routes.setRoute(ROUTE_ID,r);BridgeQualificationFixture420.approveRoute(f.env,f.routes,ROUTE_ID,address(f.adapter),address(f.adapter),0,abi.encodeWithSignature("adapterId()"),abi.encodeWithSignature("adapterId()"),true);f.risk.setAssetLimits(asset,_limits(1_000_000 ether));f.accounting.applyReconciliation(asset,0,0,uint64(block.timestamp),keccak256("zero real wrapper bootstrap"));ValueCustodyFixture420.approve(f.env,custody,address(token),address(outcome),abi.encodeWithSignature("root()"),EXTERNAL_CHAIN,LOCAL_CHAIN);
  IBridgeAdapter420.VerifiedTransfer memory v=_inbound(100);v.assetId=asset;f.adapter.setInbound(v);f.router.acceptInboundAndSettle(ADAPTER_ID,ProofEnvelopeFixture420.mock(f.router,ADAPTER_ID,hex"09"));require(token.totalSupply()==100&&token.balanceOf(address(0xB0B))==100&&!token.issuerNative());
  vm.prank(address(0xB0B));token.approve(address(custody),40);vm.prank(address(0xB0B));f.router.initiateOutbound(ADAPTER_ID,ROUTE_ID,asset,hex"0102",40,"");require(token.totalSupply()==60&&custody.pendingAmount(asset)==40);
  (bool ok,)=address(token).call(abi.encodeCall(token.bridgeMint,(address(this),1)));require(!ok,"administrator minted representation");
 }
 function testIssuerRepresentationsAndWrongNativeDecimalsCannotBeCreated() public {Fixture memory f=_setup();BridgeValueCustody420 custody=new BridgeValueCustody420(address(this),address(f.env.registry()),keccak256("wrapper constraints"),new ValueOutcome420());bool rejected;try new BridgeRepresentation420(keccak256("420/BRIDGE/ASSET/USDC"),6,custody){}catch{rejected=true;}require(rejected,"unofficial USDC created");rejected=false;try new BridgeRepresentation420(keccak256("420/BRIDGE/ASSET/CURE"),18,custody){}catch{rejected=true;}require(rejected,"CURE precision changed");}
}
