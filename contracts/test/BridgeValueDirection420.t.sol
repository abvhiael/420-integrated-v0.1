// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BridgeValueConservation420.t.sol";
import "./EthereumCustodyRelease420.t.sol";
contract BridgeValueDirection420Test is ValueFixture420 {
 function setUp() public {setupValue(false);}
 function mask(uint8 bits) internal {BridgeVerifierRegistry420 q=BridgeQualificationFixture420.registry(f.env);bytes32 old=q.currentApproval(address(custody));BridgeVerifierRegistry420.Registration memory r=abi.decode(q.registration(old),(BridgeVerifierRegistry420.Registration));r.directions=bits;q.record(r,old,true);}
 function testQualificationDirectionInboundOnlyCannotBurn() public {
  inbound(100);mask(1);vvm.prank(address(0xB0B));token.approve(address(custody),40);vvm.prank(address(0xB0B));(bool ok,)=address(f.router).call(abi.encodeCall(f.router.initiateOutbound,(ADAPTER_ID,ROUTE_ID,ASSET_ID,hex"0102",40,bytes(""))));require(!ok&&token.totalSupply()==100&&custody.pendingAmount(ASSET_ID)==0);
  mask(3);withdraw(40);require(token.totalSupply()==60&&custody.pendingAmount(ASSET_ID)==40);
 }
 function testQualificationDirectionOutboundOnlyCannotMint() public {
  mask(2);f.adapter.setInbound(_inbound(100));(bool ok,)=address(f.router).call(abi.encodeCall(f.router.acceptInboundAndSettle,(ADAPTER_ID,ProofEnvelopeFixture420.mock(f.router,ADAPTER_ID,hex"09"))));require(!ok&&token.totalSupply()==0);
  mask(3);inbound(100);require(token.totalSupply()==100);
 }
 function testQualificationDirectionInboundOnlyCannotResolveWithdrawal() public {
  inbound(100);bytes32 id=withdraw(40);mask(1);(bool ok,)=address(f.router).call(abi.encodeCall(f.router.resolveFundedOutbound,(id,receipt(id,true))));require(!ok&&custody.pendingAmount(ASSET_ID)==40);
  mask(2);f.router.resolveFundedOutbound(id,receipt(id,true));require(custody.pendingAmount(ASSET_ID)==0&&token.totalSupply()==60);
 }
 function adapterId() external pure returns(bytes32){return ADAPTER_ID;}
 function initiateOutbound(bytes32,bytes32,address,bytes calldata,uint256,bytes calldata) external payable returns(bytes32){require(msg.sender==address(f.router));custody.setVerifier(new ValueOutcome420());return keccak256("custody mutation during approved dispatch");}
 function testQualificationDirectionDispatchCannotReplaceCustodyApproval() public {
  inbound(100);f.router.setAdapter(ADAPTER_ID,address(this));BridgeQualificationFixture420.approveRoute(f.env,f.routes,ROUTE_ID,address(this),address(this),0,abi.encodeWithSignature("adapterId()"),abi.encodeWithSignature("adapterId()"),true);
  vvm.prank(address(0xB0B));token.approve(address(custody),40);vvm.prank(address(0xB0B));(bool ok,)=address(f.router).call(abi.encodeCall(f.router.initiateOutbound,(ADAPTER_ID,ROUTE_ID,ASSET_ID,hex"0102",40,bytes(""))));
  require(!ok&&token.totalSupply()==100&&custody.pendingAmount(ASSET_ID)==0&&address(custody.verifier())==address(outcome),"custody mutation or burn survived dispatch");
 }
}
contract EthereumCustodyDirection420Test is EthereumCustodyRelease420Test {
 function sourceMask(uint8 bits) internal {BridgeVerifierRegistry420 q=BridgeQualificationFixture420.registry(f.env);bytes32 old=q.currentApproval(address(escrow_));BridgeVerifierRegistry420.Registration memory r=abi.decode(q.registration(old),(BridgeVerifierRegistry420.Registration));r.directions=bits;q.record(r,old,true);}
 function testQualificationDirectionSourceReleaseRequiresOutboundApproval() public {
  sourceMask(1);(bool ok,)=address(escrow_).call(abi.encodeCall(escrow_.setSettlementActive,(true)));require(!ok&&!escrow_.settlementActive());
  backing.set(escrow_.backingCommitment(request,true));(ok,)=address(escrow_).call(abi.encodeCall(escrow_.cancelWithdrawal,(request,abi.encode(bytes32(uint256(1))))));require(!ok&&escrow_.withdrawalStatus(request.messageId)==0);
  sourceMask(2);escrow_.setSettlementActive(true);backing.set(escrow_.backingCommitment(request,false));uint256 before_=request.recipient.balance;escrow_.settleEthereumWithdrawal(request,abi.encode(bytes32(uint256(1))));require(request.recipient.balance==before_+1 ether&&escrow_.withdrawalStatus(request.messageId)==1);
 }
}
