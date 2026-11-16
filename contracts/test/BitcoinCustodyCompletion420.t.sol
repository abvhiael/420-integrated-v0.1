// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BridgeGenesisIntegration420.t.sol";
import "../src/bridge/bitcoin/BitcoinCustody420.sol";
interface CustodyVm420 {function store(address,bytes32,bytes32) external;function prank(address) external;}
/// @dev Controlled backing authority only; never production burn/UTXO proof evidence.
contract ControlledBitcoinBacking420 is IBitcoinCustodyBacking420 {
 bytes32 public trustedRoot=keccak256("controlled backing root");bool public accept=true;
 function setAccept(bool yes) external {accept=yes;}
 function verifyBacking(bytes32,bytes32,bytes calldata) external view returns(bool){return accept;}
}
abstract contract BitcoinCustodyFixture420 is BridgeGenesisFixture420 {
 CustodyVm420 constant cvm=CustodyVm420(address(uint160(uint256(keccak256("hevm cheat code")))));
 Fixture f;BitcoinHeaderChain420 headerChain;BitcoinFinalityVerifier420 deposits;BitcoinBridgeAdapter420 btc;BitcoinWithdrawalProof420 payoutProof;BitcoinCustody420 custody;ControlledBitcoinBacking420 backing;BridgeVerifierRegistry420 q;bytes32 requestId;
 bytes32 prev;bytes32 fundingTip;uint64 constant PAY=1000;
 function custodyScript() internal pure returns(bytes memory){return abi.encodePacked(hex"0020",bytes32(uint256(0xC0FFEE)));}
 function recipientProgram() internal pure returns(bytes memory){return abi.encodePacked(bytes20(uint160(0xB0B)));}
 function setupCustody(bool activate) internal {
  f=_setup();headerChain=new BitcoinHeaderChain420();deposits=new BitcoinFinalityVerifier420(headerChain,custodyScript(),ROUTE_ID,1,address(f.router));btc=new BitcoinBridgeAdapter420(address(this),address(f.router),address(deposits));btc.setBtcBinding(ASSET_ID,ROUTE_ID);
  f.chains.setChain(EXTERNAL_CHAIN,_chain(btc.BTC_ROUTE_CHAIN_ID(),btc.BTC_MAINNET_GENESIS_HASH(),true));
  f.router.setAdapter(btc.ADAPTER_ID(),address(btc));f.routes.setRoute(ROUTE_ID,BridgeRouteRegistry.Route(ASSET_ID,btc.BTC_ROUTE_CHAIN_ID(),uint64(block.chainid),ASSET_ID,bytes32(uint256(uint160(TOKEN))),btc.ADAPTER_ID(),keccak256("controlled BTC configuration"),2,BridgeRouteRegistry.Status.APPROVED_INACTIVE,true,true));
  BridgeQualificationFixture420.approveRoute(f.env,f.routes,ROUTE_ID,address(btc),address(deposits),bytes4(keccak256("verifier()")),abi.encodeWithSignature("gatewayScriptHash()"),abi.encodeWithSignature("depositDomain()"),true);
  q=BridgeQualificationFixture420.registry(f.env);payoutProof=new BitcoinWithdrawalProof420(IBitcoinWithdrawal420(address(btc)),deposits);backing=new ControlledBitcoinBacking420();custody=new BitcoinCustody420(address(this),address(f.env.registry()),btc,payoutProof,backing,keccak256("controlled descriptor; no private keys"),500);
  creditDeposit();qualifyCustody();if(activate)custody.setActive(true);
  requestId=f.router.initiateOutbound(btc.ADAPTER_ID(),ROUTE_ID,ASSET_ID,recipientProgram(),PAY,hex"02");
 }
 function qualifyCustody() internal {
  BridgeVerifierRegistry420.Registration memory r;r.consumer=q.identity(address(custody),BridgeVerifierRegistry420.ProxyKind.DIRECT);r.verifier=q.identity(address(backing),BridgeVerifierRegistry420.ProxyKind.DIRECT);r.verifierGetter=bytes4(keccak256("verifier()"));r.sourceChainKey=LOCAL_CHAIN;r.destinationChainKey=EXTERNAL_CHAIN;r.proofSystem=keccak256("CONTROLLED CUSTODY / NOT PRODUCTION");r.configurationHash=keccak256("controlled custody");r.evidenceHash=keccak256("controlled custody tests");r.directions=2;r.dependencies=new BridgeVerifierRegistry420.Identity[](4);r.dependencies[0]=q.identity(address(btc),BridgeVerifierRegistry420.ProxyKind.DIRECT);r.dependencies[1]=q.identity(address(payoutProof),BridgeVerifierRegistry420.ProxyKind.DIRECT);r.dependencies[2]=q.identity(address(headerChain),BridgeVerifierRegistry420.ProxyKind.DIRECT);r.dependencies[3]=q.identity(address(f.routes),BridgeVerifierRegistry420.ProxyKind.DIRECT);
  r.probes=new BridgeVerifierRegistry420.Probe[](2);bytes memory root=abi.encodeWithSignature("trustedRoot()");bytes memory config=abi.encodeWithSignature("configurationState()");r.probes[0]=BridgeVerifierRegistry420.Probe(1,true,root,BridgeQualificationFixture420.resultHash(address(backing),root));r.probes[1]=BridgeVerifierRegistry420.Probe(0,false,config,BridgeQualificationFixture420.resultHash(address(custody),config));q.record(r,q.currentApproval(address(custody)),true);
 }
 function creditDeposit() internal {
  bytes memory marker=deposits.commitmentScript(0,address(this),10_000);bytes memory script_=custodyScript();bytes memory raw=bytes.concat(hex"0200000001",abi.encodePacked(bytes32(uint256(0x987654))),hex"0000000000fdffffff02",BridgeWire420.encodeLE(10_000,8),BridgeWire420.encodeCompactSize(uint64(script_.length)),script_,hex"000000000000000022",marker,hex"00000000");prev=BridgeCrypto420.sha256d(raw);
  bytes32 parent=headerChain.GENESIS();for(uint256 i=1;i<=6;++i){bytes32 next=keccak256(abi.encode("funded fixture",i));put(next,parent,i==1?prev:bytes32(uint256(1)),uint64(i));parent=next;}fundingTip=parent;cvm.store(address(headerChain),bytes32(uint256(1)),parent);bytes32[] memory ancestry=new bytes32[](5);for(uint256 i;i<5;++i)ancestry[i]=keccak256(abi.encode("funded fixture",uint256(5)-i));
  bytes memory inner=abi.encode(BitcoinFinalityVerifier420.Proof(keccak256(abi.encode("funded fixture",uint256(1))),raw,0,1,address(this),0,new bytes32[](0),ancestry));IBitcoinFinalityVerifier420.FinalizedTransfer memory t=deposits.verifyFinalizedTransfer(inner);IBridgeAdapter420.VerifiedTransfer memory transfer_=IBridgeAdapter420.VerifiedTransfer(ROUTE_ID,ASSET_ID,address(uint160(uint256(keccak256(abi.encodePacked(t.sourceOutput))))),address(this),t.amountSatoshis,t.transactionHash,t.messageId);
  f.router.acceptInbound(btc.ADAPTER_ID(),ProofEnvelopeFixture420.wrap(f.router,btc.ADAPTER_ID(),transfer_,keccak256(custodyScript()),inner));
 }
 function funding() internal view returns(IBitcoinCustody420.FundingInput[] memory list){list=new IBitcoinCustody420.FundingInput[](1);list[0]=IBitcoinCustody420.FundingInput(prev,0,10_000,keccak256(custodyScript()));}
 function transaction(uint64 fee,bool signed_) internal view returns(bytes memory){
  bytes memory prefix=signed_?abi.encodePacked(hex"020000000001"):abi.encodePacked(hex"02000000");
  bytes memory input=abi.encodePacked(hex"01",prev,hex"0000000000fdffffff");
  bytes memory recipient=btc.outboundScript(requestId);bytes memory marker=abi.encodePacked(hex"6a20",requestId);bytes memory change=custodyScript();
  bytes memory outputs=bytes.concat(hex"03",BridgeWire420.encodeLE(PAY,8),BridgeWire420.encodeCompactSize(uint64(recipient.length)),recipient,hex"000000000000000022",marker,BridgeWire420.encodeLE(10_000-PAY-fee,8),BridgeWire420.encodeCompactSize(uint64(change.length)),change);
  return bytes.concat(prefix,input,outputs,signed_?abi.encodePacked(hex"010151"):bytes(""),hex"00000000");
 }
 function authorize(uint64 fee,bytes32 previous) internal returns(bytes32){return custody.authorizeSigning(requestId,transaction(fee,false),funding(),hex"01",previous);}
 function put(bytes32 hash,bytes32 parent,bytes32 merkle,uint64 height) internal {bytes32 slot=keccak256(abi.encode(hash,uint256(0)));cvm.store(address(headerChain),slot,parent);cvm.store(address(headerChain),bytes32(uint256(slot)+1),merkle);cvm.store(address(headerChain),bytes32(uint256(slot)+2),bytes32(headerChain.getHeader(headerChain.GENESIS()).work+height));cvm.store(address(headerChain),bytes32(uint256(slot)+3),bytes32(uint256(height)));}
 function sourceProof(uint64 fee,bytes32 branch,uint32 confirmations) internal returns(bytes memory encoded,bytes32 blockHash,bytes32 tip){
  bytes memory raw=transaction(fee,true);BitcoinSigningTransaction420.Parsed memory p=BitcoinSigningTransaction420.parse(raw);blockHash=keccak256(abi.encode(branch,uint256(7)));put(blockHash,fundingTip,p.txid,7);bytes32 parent=blockHash;bytes32[] memory ancestry=new bytes32[](confirmations-1);
  for(uint256 i=8;i<=6+confirmations;++i){bytes32 next=keccak256(abi.encode(branch,i));put(next,parent,bytes32(uint256(1)),uint64(i));parent=next;}
  tip=parent;cvm.store(address(headerChain),bytes32(uint256(1)),tip);for(uint256 i;i<ancestry.length;++i)ancestry[i]=keccak256(abi.encode(branch,uint256(confirmations)+5-i));
  encoded=abi.encode(BitcoinWithdrawalProof420.Proof(blockHash,raw,0,new bytes32[](0),ancestry));
 }
}
contract BitcoinCustodyCompletion420Test is BitcoinCustodyFixture420 {
 function setUp() public {setupCustody(true);}
 function testBackedPlanProducesOnlyPublicSigningAuthorization() public {bytes32 id=authorize(100,0);require(custody.signingAuthorization(requestId,id));require(!custody.signingAuthorization(requestId,keccak256("other")));}
 function testDefaultInactiveEvenWithQualification() public {custody.setActive(false);(bool ok,)=address(custody).call(abi.encodeCall(custody.authorizeSigning,(requestId,transaction(100,false),funding(),hex"01",bytes32(0))));require(!ok);}
 function testBackingFailureCannotCreateAuthorization() public {backing.setAccept(false);(bool ok,)=address(custody).call(abi.encodeCall(custody.authorizeSigning,(requestId,transaction(100,false),funding(),hex"01",bytes32(0))));require(!ok);(bytes32 current,,,,,,,,,)=custody.authorizations(requestId);require(current==0);}
 function testExcessFeeAndWrongInputReject() public {(bool ok,)=address(custody).call(abi.encodeCall(custody.authorizeSigning,(requestId,transaction(501,false),funding(),hex"01",bytes32(0))));require(!ok);IBitcoinCustody420.FundingInput[] memory list=funding();list[0].amountSatoshis=9_999;list[0].txid=keccak256("forged prevout");(ok,)=address(custody).call(abi.encodeCall(custody.authorizeSigning,(requestId,transaction(100,false),list,hex"01",bytes32(0))));require(!ok);}
 function testReplacementUsesCASAndSameFunding() public {bytes32 first=authorize(100,0);bytes32 second=authorize(200,first);require(first!=second&&!custody.signingAuthorization(requestId,first)&&custody.signingAuthorization(requestId,second));(bool ok,)=address(custody).call(abi.encodeCall(custody.authorizeSigning,(requestId,transaction(300,false),funding(),hex"01",first)));require(!ok);}
 function testRevocationImmediatelyRemovesSigningAuthority() public {bytes32 id=authorize(100,0);q.revoke(q.currentApproval(address(custody)),keccak256("compromised backing"));(bool ok,)=address(custody).staticcall(abi.encodeCall(custody.signingAuthorization,(requestId,id)));require(!ok);custody.setActive(false);}
 function testNativeRouteSuspensionBlocksSigning() public {f.routes.setDirection(ROUTE_ID,false,false);(bool ok,)=address(custody).call(abi.encodeCall(custody.authorizeSigning,(requestId,transaction(100,false),funding(),hex"01",bytes32(0))));require(!ok);}
 function testUnauthorizedCustodyControlsReject() public {cvm.prank(address(0xBAD));(bool ok,)=address(custody).call(abi.encodeCall(custody.setActive,(false)));require(!ok);}
 function testSixConfirmedPaymentAndRefresh() public {authorize(100,0);(bytes memory proof,,bytes32 tip)=sourceProof(100,keccak256("A"),6);custody.observeSettlement(requestId,proof);(bytes32 txid,,,uint64 amount,bytes32 evidence)=custody.confirmedWithdrawal(requestId);require(txid!=0&&amount==PAY&&evidence!=0);bytes32 next=keccak256("later tip");put(next,tip,0,13);cvm.store(address(headerChain),bytes32(uint256(1)),next);(bool ok,)=address(custody).staticcall(abi.encodeCall(custody.confirmedWithdrawal,(requestId)));require(!ok);}
 function testFiveConfirmationsAndForgedPayoutReject() public {authorize(100,0);(bytes memory proof,,)=sourceProof(100,keccak256("A"),5);(bool ok,)=address(custody).call(abi.encodeCall(custody.observeSettlement,(requestId,proof)));require(!ok);(proof,,)=sourceProof(200,keccak256("B"),6);(ok,)=address(custody).call(abi.encodeCall(custody.observeSettlement,(requestId,proof)));require(!ok);}
 function testPreviouslySignedReplacementCanConfirm() public {bytes32 first=authorize(100,0);authorize(200,first);(bytes memory proof,,)=sourceProof(100,keccak256("old signed plan wins"),6);custody.observeSettlement(requestId,proof);(,,,uint64 amount,)=custody.confirmedWithdrawal(requestId);require(amount==PAY);}
 function testReorganizedPaymentCannotRemainLiveEvidence() public {authorize(100,0);(bytes memory proof,,)=sourceProof(100,keccak256("A"),6);custody.observeSettlement(requestId,proof);(,bytes32 conflict,)=sourceProof(100,keccak256("B"),6);bytes32[] memory ancestry=new bytes32[](5);for(uint256 i;i<5;++i)ancestry[i]=keccak256(abi.encode(keccak256("B"),uint256(11)-i));custody.invalidateForReorg(requestId,conflict,ancestry);(bool ok,)=address(custody).staticcall(abi.encodeCall(custody.confirmedWithdrawal,(requestId)));require(!ok);custody.observeSettlement(requestId,abi.encode(BitcoinWithdrawalProof420.Proof(conflict,transaction(100,true),0,new bytes32[](0),ancestry)));}
 function testSignedDataCannotBeAuthorizedAsUnsignedPSBT() public {(bool ok,)=address(custody).call(abi.encodeCall(custody.authorizeSigning,(requestId,transaction(100,true),funding(),hex"01",bytes32(0))));require(!ok);}
 function testFuzzFeeCap(uint64 fee) public {fee=uint64(uint256(fee)%1000);(bool ok,)=address(custody).call(abi.encodeCall(custody.authorizeSigning,(requestId,transaction(fee,false),funding(),hex"01",bytes32(0))));require(ok==(fee<=500));}
}
