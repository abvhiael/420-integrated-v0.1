// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BridgeValueConservation420.t.sol";
/// Deliberately unqualified replacement: Registry registration is not economic authorization.
contract UnqualifiedValueCustody420 is GenesisResidentAccess420 {
 constructor(address gov,address registry_) GenesisResidentAccess420(gov,registry_,keccak256("unqualified replacement")){}
 function componentId() public pure override returns(bytes32){return BridgeIds420.VALUE_CUSTODY;}
 function conservationHealthy(bytes32) external pure returns(bool){return true;}
 function reserve(bytes32,bytes32,address,uint256) external {}
 function bindOutbound(bytes32) external {}
}
contract BridgeValueAuthority420Test is ValueFixture420 {
 function setUp() public {setupValue(false);}
 function testCustodyRevocationRollsBackMintReplayAndExposure() public {
  BridgeVerifierRegistry420 q=BridgeQualificationFixture420.registry(f.env);q.revoke(q.currentApproval(address(custody)),keccak256("revoked economic authority"));
  f.adapter.setInbound(_inbound(100));(bool ok,)=address(f.router).call(abi.encodeCall(f.router.acceptInboundAndSettle,(ADAPTER_ID,ProofEnvelopeFixture420.mock(f.router,ADAPTER_ID,hex"09"))));
  (uint256 debt,)=f.risk.outstanding(ROUTE_ID,ASSET_ID);require(!ok&&token.totalSupply()==0&&debt==0,"revocation leaked value/accounting");
 }
 function testOutcomeRotationRequiresFreshQualificationAndPreservesReplay() public {
  inbound(100);bytes32 id=withdraw(40);BridgeVerifierRegistry420 q=BridgeQualificationFixture420.registry(f.env);bytes32 old=q.currentApproval(address(custody));
  ValueOutcome420 next=new ValueOutcome420();custody.setVerifier(next);(bool ok,)=address(f.router).call(abi.encodeCall(f.router.resolveFundedOutbound,(id,receipt(id,true))));require(!ok&&custody.pendingAmount(ASSET_ID)==40,"unqualified replacement inherited approval");
  BridgeVerifierRegistry420.Registration memory r=abi.decode(q.registration(old),(BridgeVerifierRegistry420.Registration));r.verifier=q.identity(address(next),BridgeVerifierRegistry420.ProxyKind.DIRECT);r.probes[0].expectedResultHash=BridgeQualificationFixture420.resultHash(address(next),r.probes[0].data);r.probes[1].expectedResultHash=BridgeQualificationFixture420.resultHash(address(custody),r.probes[1].data);q.record(r,old,true);
  f.router.resolveFundedOutbound(id,receipt(id,true));(ok,)=address(f.router).call(abi.encodeCall(f.router.resolveFundedOutbound,(id,receipt(id,true))));require(!ok&&token.totalSupply()==60&&custody.pendingAmount(ASSET_ID)==0,"rotation reset consumed authority");
 }
 function testExecutionGraphSubstitutionDoesNotInheritCustodyApproval() public {
  BridgeRiskManager substituted=new BridgeRiskManager(address(this),address(f.env.registry()),keccak256("replacement risk"));f.env.registerResident(address(substituted),substituted.componentId());
  (bool ok,)=address(custody).call(abi.encodeCall(custody.fund,(ASSET_ID,uint256(1))));require(!ok,"graph substitution inherited authority");
  BridgeVerifierRegistry420 q=BridgeQualificationFixture420.registry(f.env);(ok,)=address(q).staticcall(abi.encodeCall(q.requireCurrent,(address(custody))));require(!ok,"changed risk graph still qualified");
 }
 function testUnauthorizedCustodyConfigurationAndOutcomeSubstitutionReject() public {
  ValueOutcome420 next=new ValueOutcome420();vvm.prank(address(0xBAD));(bool ok,)=address(custody).call(abi.encodeCall(custody.setVerifier,(next)));require(!ok);
  vvm.prank(address(0xBAD));(ok,)=address(custody).call(abi.encodeCall(custody.configure,(ASSET_ID,address(token),BridgeValueCustody420.Mode.LOCK_RELEASE)));require(!ok);
 }
 function testOutcomeTupleAndOriginalQualificationCannotBeSubstituted() public {
  inbound(100);bytes32 id=withdraw(40);
  for(uint256 i;i<8;++i){bytes memory data=receipt(id,true);uint256 word=i==7?10:i;assembly {let pos:=add(add(data,32),mul(word,32)) mstore(pos,xor(mload(pos),1))}
   (bool ok,)=address(f.router).call(abi.encodeCall(f.router.resolveFundedOutbound,(id,data)));require(!ok,"substituted outcome binding");}
  require(token.totalSupply()==60&&custody.pendingAmount(ASSET_ID)==40,"invalid proof changed value");
 }
 function testMalformedAndExcessiveOutcomeProofsCannotConsumeAuthority() public {
  inbound(100);bytes32 id=withdraw(40);(bool ok,)=address(f.router).call(abi.encodeCall(f.router.resolveFundedOutbound,(id,new bytes(32))));require(!ok);
  (ok,)=address(f.router).call(abi.encodeCall(f.router.resolveFundedOutbound,(id,new bytes(4_200_001))));require(!ok&&custody.pendingAmount(ASSET_ID)==40);
  f.router.resolveFundedOutbound(id,receipt(id,true));require(custody.pendingAmount(ASSET_ID)==0);
 }
 function testUnqualifiedCustodySubstitutionCannotDispatchUnfundedWithdrawal() public {
  inbound(100);UnqualifiedValueCustody420 fake=new UnqualifiedValueCustody420(address(this),address(f.env.registry()));f.env.registerResident(address(fake),fake.componentId());
  vvm.prank(address(0xB0B));(bool ok,)=address(f.router).call(abi.encodeCall(f.router.initiateOutbound,(ADAPTER_ID,ROUTE_ID,ASSET_ID,hex"0102",40,bytes(""))));
  require(!ok&&token.totalSupply()==100&&token.balanceOf(address(0xB0B))==100,"unqualified custody dispatched unbacked claim");
 }
}
