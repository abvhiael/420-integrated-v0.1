// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BridgeGenesisIntegration420.t.sol";
import "../src/bridge/EthereumDepositGateway420.sol";
interface SourceVm420 {function chainId(uint256) external;function deal(address,uint256) external;}
contract ControlledEthereumBacking420 is IEthereumWithdrawalBacking420 {
 bytes32 public root=keccak256("CONTROLLED FINALIZED 420 BACKING / NOT PRODUCTION");bytes32 public expected;
 function set(bytes32 e) external {expected=e;}
 function verifyBacking(IEthereumOutboundMessage420.OutboundMessage calldata,bytes calldata,bool) external view returns(bytes32){return expected;}
 function verifyDepositRefund(bytes32,bytes calldata) external view returns(bytes32){return expected;}
}
contract EthereumCustodyRelease420Test is BridgeGenesisFixture420 {
 SourceVm420 constant svm=SourceVm420(address(uint160(uint256(keccak256("hevm cheat code")))));
 EthereumDepositGateway420 escrow_;ControlledEthereumBacking420 backing;Fixture f;IEthereumOutboundMessage420.OutboundMessage request;
 bytes32 depositId;
 bytes32 constant SOURCE=keccak256("ETH/CUSTODY/420");bytes32 constant ETH=keccak256("420/BRIDGE/ASSET/ETH");bytes32 constant ROUTE=keccak256("controlled ETH custody route");
 function setUp() public {
  svm.chainId(420);f=_setup();svm.chainId(1);escrow_=new EthereumDepositGateway420(address(this));backing=new ControlledEthereumBacking420();
  escrow_.setWithdrawalRoute(keccak256("420/BRIDGE/ETHEREUM/NATIVE/ETH"),ETH,ROUTE);
  BridgeVerifierRegistry420 q=BridgeQualificationFixture420.registry(f.env);escrow_.configureSettlement(q,backing,420,address(0x42042),address(0xA420));
  BridgeVerifierRegistry420.Registration memory r;r.consumer=q.identity(address(escrow_),BridgeVerifierRegistry420.ProxyKind.DIRECT);r.verifier=q.identity(address(backing),BridgeVerifierRegistry420.ProxyKind.DIRECT);r.verifierGetter=bytes4(keccak256("verifier()"));r.sourceChainKey=LOCAL_CHAIN;r.destinationChainKey=EXTERNAL_CHAIN;r.proofSystem=keccak256("CONTROLLED FINALIZED 420 STORAGE PROOF");r.configurationHash=keccak256("controlled source custody");r.evidenceHash=keccak256("CONTROLLED SOURCE EXECUTION / NO LIVE ROOT");r.directions=2;r.dependencies=new BridgeVerifierRegistry420.Identity[](0);r.probes=new BridgeVerifierRegistry420.Probe[](2);bytes memory root=abi.encodeWithSignature("root()");bytes memory config=abi.encodeWithSignature("configurationState()");r.probes[0]=BridgeVerifierRegistry420.Probe(1,true,root,BridgeQualificationFixture420.resultHash(address(backing),root));r.probes[1]=BridgeVerifierRegistry420.Probe(0,false,config,BridgeQualificationFixture420.resultHash(address(escrow_),config));q.record(r,0,true);
  request=IEthereumOutboundMessage420.OutboundMessage(420,address(0x42042),address(0xA420),keccak256("withdrawal"),ROUTE,ETH,address(this),address(0xB0B),1 ether,1 ether,keccak256("420/BRIDGE/ETHEREUM/NATIVE/ETH"),1,"");
  svm.deal(address(this),2 ether);depositId=escrow_.deposit{value:1 ether}(address(0),1 ether,420,address(0x42042),ROUTE,address(0xB0B));
 }
 function testSourceCustodyDefaultInactive() public {backing.set(escrow_.backingCommitment(request,false));(bool ok,)=address(escrow_).call(abi.encodeCall(escrow_.settleEthereumWithdrawal,(request,abi.encode(bytes32(uint256(1))))));require(!ok&&address(escrow_).balance==1 ether);}
 function testSourceCustodyActualReleaseAndPersistentReplay() public {escrow_.setSettlementActive(true);backing.set(escrow_.backingCommitment(request,false));uint256 before_=request.recipient.balance;escrow_.settleEthereumWithdrawal(request,abi.encode(bytes32(uint256(1))));require(request.recipient.balance==before_+1 ether&&address(escrow_).balance==0&&escrow_.withdrawalStatus(request.messageId)==1);(bool ok,)=address(escrow_).call(abi.encodeCall(escrow_.settleEthereumWithdrawal,(request,abi.encode(bytes32(uint256(1))))));require(!ok,"duplicate source release");}
 function testSourceCancellationPermanentlyBlocksStalePendingProof() public {backing.set(escrow_.backingCommitment(request,true));escrow_.cancelWithdrawal(request,abi.encode(bytes32(uint256(1))));escrow_.setSettlementActive(true);backing.set(escrow_.backingCommitment(request,false));(bool ok,)=address(escrow_).call(abi.encodeCall(escrow_.settleEthereumWithdrawal,(request,abi.encode(bytes32(uint256(1))))));require(!ok&&address(escrow_).balance==1 ether&&escrow_.withdrawalStatus(request.messageId)==2);}
 function testSourceChangedAmountAndUnbackedProofRejected() public {escrow_.setSettlementActive(true);backing.set(escrow_.backingCommitment(request,false));request.ethereumAmount=2 ether;(bool ok,)=address(escrow_).call(abi.encodeCall(escrow_.settleEthereumWithdrawal,(request,abi.encode(bytes32(uint256(1))))));require(!ok&&address(escrow_).balance==1 ether&&escrow_.withdrawalStatus(request.messageId)==0);}
 function testSourcePaidCannotBeCancelledForDoubleRefund() public {escrow_.setSettlementActive(true);backing.set(escrow_.backingCommitment(request,false));escrow_.settleEthereumWithdrawal(request,abi.encode(bytes32(uint256(1))));backing.set(escrow_.backingCommitment(request,true));(bool ok,)=address(escrow_).call(abi.encodeCall(escrow_.cancelWithdrawal,(request,abi.encode(bytes32(uint256(1))))));require(!ok&&escrow_.withdrawalStatus(request.messageId)==1);}
 function testSourceUnmintedRefundRequiresFinalizedIntentAndReturnsOriginalOwner() public {backing.set(escrow_.depositRefundCommitment(depositId));uint256 before_=address(this).balance;escrow_.refundUnmintedDeposit(depositId,abi.encode(bytes32(uint256(1))));require(address(this).balance==before_+1 ether&&address(escrow_).balance==0);(bool ok,)=address(escrow_).call(abi.encodeCall(escrow_.refundUnmintedDeposit,(depositId,abi.encode(bytes32(uint256(1))))));require(!ok,"duplicate source refund");}
 receive() external payable {}
}
