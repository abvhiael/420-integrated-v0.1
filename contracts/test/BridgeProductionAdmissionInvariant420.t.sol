// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BridgeGenesisIntegration420.t.sol";
import "../src/bridge/CADCBridgeIntegration.sol";
contract V20AdmissionHandler is BridgeGenesisFixture420 {
    Fixture private f;bool public expected;uint256 public sequence;uint256 public acceptedCount;
    bool private initialized;
    function initialize() external {require(!initialized);initialized=true;f=_setup();expected=true;}
    function revoke() external {BridgeVerifierRegistry420 q=BridgeQualificationFixture420.registry(f.env);bytes32 id=q.currentApproval(address(f.adapter));if(id!=0)q.revoke(id,keccak256("invariant revocation"));expected=false;}
    function disable() external {f.routes.setDirection(ROUTE_ID,false,false);expected=false;}
    function suspend() external {BridgeRouteRegistry.Route memory r; (r.assetId,r.sourceChainId,r.destinationChainId,r.sourceAsset,r.destinationAsset,r.adapterId,r.verifierConfigHash,r.version,r.status,r.inboundEnabled,r.outboundEnabled)=f.routes.routes(ROUTE_ID);r.status=BridgeRouteRegistry.Status.SUSPENDED;f.routes.setRoute(ROUTE_ID,r);expected=false;}
    function qualify() external {BridgeRouteRegistry.Route memory r; (r.assetId,r.sourceChainId,r.destinationChainId,r.sourceAsset,r.destinationAsset,r.adapterId,r.verifierConfigHash,r.version,r.status,r.inboundEnabled,r.outboundEnabled)=f.routes.routes(ROUTE_ID);r.status=BridgeRouteRegistry.Status.APPROVED_INACTIVE;r.inboundEnabled=true;r.outboundEnabled=true;f.routes.setRoute(ROUTE_ID,r);BridgeQualificationFixture420.approveRoute(f.env,f.routes,ROUTE_ID,address(f.adapter),address(f.adapter),0,abi.encodeWithSignature("adapterId()"),abi.encodeWithSignature("adapterId()"),true);expected=true;}
    function attempt() external {IBridgeAdapter420.VerifiedTransfer memory v=_inbound(1);v.sourceMessageId=keccak256(abi.encode(++sequence));v.sourceTxId=v.sourceMessageId;f.adapter.setInbound(v);(bool ok,)=address(f.router).call(abi.encodeCall(f.router.acceptInbound,(ADAPTER_ID,hex"20")));require(ok==expected,"admission disagrees with independent action model");if(ok)++acceptedCount;}
    function check() external view {(,,,,,,uint256 tvl)=f.risk.routeUsage(ROUTE_ID);require(tvl==acceptedCount,"rejected admission changed accounting");(bool ok,)=address(f.routes).staticcall(abi.encodeCall(f.routes.requireAdmission,(ROUTE_ID,ASSET_ID,true)));require(ok==expected,"stale approval executes");}
}
contract BridgeProductionAdmissionInvariant420Test {
    V20AdmissionHandler private handler;struct FuzzSelector {address addr;bytes4[] selectors;}
    function setUp() public {handler=new V20AdmissionHandler();handler.initialize();}
    function targetContracts() public view returns(address[] memory a){a=new address[](1);a[0]=address(handler);}
    function targetSelectors() public view returns(FuzzSelector[] memory a){bytes4[] memory selectors=new bytes4[](5);selectors[0]=handler.revoke.selector;selectors[1]=handler.disable.selector;selectors[2]=handler.suspend.selector;selectors[3]=handler.qualify.selector;selectors[4]=handler.attempt.selector;a=new FuzzSelector[](1);a[0]=FuzzSelector(address(handler),selectors);}
    function invariantOnlyLiveQualifiedRoutesAdmitAndRejectedProofsDoNotConsumeRisk() public view {handler.check();}
}
