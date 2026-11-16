// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../system/SystemAccess.sol";
import "../../interfaces/IBitcoinWithdrawal420.sol";
import "../../interfaces/genesis/IProtocolRegistry420.sol";
import "../BridgeVerifierRegistry420.sol";
import "../BridgeRouteRegistry.sol";
import "../GatewayRouter420.sol";
import "../adapters/BitcoinBridgeAdapter420.sol";
import "./BitcoinWithdrawalProof420.sol";
/// @notice Public custody signing-authorization/reconciliation boundary; stores no private keys.
/// Default inactive. Existing governance qualification and route admission remain mandatory.
/// The approved backing verifier authenticates source backing AND actual custody UTXO metadata.
contract BitcoinCustody420 is SystemAccess,IBitcoinCustody420 {
 address public immutable registry;
 BitcoinBridgeAdapter420 public immutable adapter;
 BitcoinWithdrawalProof420 public immutable withdrawalProof;
 BridgeRouteRegistry public immutable routeRegistry;
 IBitcoinCustodyBacking420 public verifier;
 bytes32 public immutable descriptorHash;
 uint64 public immutable maxFeeSatoshis;
 bool public active;
 enum Status {NONE,AUTHORIZED,CONFIRMED,REORGED}
 struct Authorization {bytes32 current;bytes32 fundingHash;bytes32 inputsHash;uint256 generation;Status status;bytes32 txid;bytes32 blockHash;bytes32 tip;uint64 height;bytes32 approvalId;}
 mapping(bytes32=>Authorization) public authorizations;
 mapping(bytes32=>mapping(bytes32=>bool)) public authorizedSkeletons;
 mapping(bytes32=>bytes32) public reservedInputs;
 event SigningAuthorized(bytes32 indexed requestId,bytes32 indexed commitment,bytes32 skeletonHash,uint256 generation,uint256 feeSatoshis);
 event PayoutObserved(bytes32 indexed requestId,bytes32 indexed txid,bytes32 indexed blockHash,bytes32 tip);
 event PayoutReorganized(bytes32 indexed requestId,bytes32 oldBlock,bytes32 canonicalBlock);
 constructor(address governance,address registry_,BitcoinBridgeAdapter420 adapter_,BitcoinWithdrawalProof420 proof_,IBitcoinCustodyBacking420 backing_,bytes32 descriptor,uint64 feeCap) SystemAccess(governance){
  require(registry_.code.length!=0&&address(adapter_).code.length!=0&&address(proof_).code.length!=0&&address(backing_).code.length!=0&&descriptor!=0&&feeCap>0&&feeCap<=BitcoinScript420.MAX_MONEY,"custody configuration");
  require(address(proof_.adapter())==address(adapter_),"withdrawal adapter");registry=registry_;routeRegistry=BridgeRouteRegistry(_resolve(BridgeIds420.ROUTE_REGISTRY));adapter=adapter_;withdrawalProof=proof_;verifier=backing_;descriptorHash=descriptor;maxFeeSatoshis=feeCap;
 }
 function _resolve(bytes32 id) private view returns(address target){Types420.ContractRef memory ref=IProtocolRegistry420(registry).component(id);target=ref.implementation;require(target.code.length!=0&&target.codehash==ref.runtimeCodeHash&&ref.lifecycle==Types420.Lifecycle.ACTIVE,"custody dependency");}
 function configurationState() external view returns(bytes32){
  BridgeRouteRegistry routes=routeRegistry;(address q,bytes32 hash,address consumer,bytes32 approval,bytes32 routeHash)=routes.verifierBindings(adapter.btcRouteId());
  return keccak256(abi.encode(address(adapter),address(adapter.verifier()),address(withdrawalProof),address(verifier),descriptorHash,maxFeeSatoshis,address(routes),q,hash,consumer,approval,routeHash));
 }
 function setVerifier(IBitcoinCustodyBacking420 next) external onlyGovernance {require(address(next).code.length!=0,"backing verifier");verifier=next;active=false;}
 function setActive(bool enabled) external onlyGovernance {if(enabled)_qualified();active=enabled;}
 function _qualified() private view returns(bytes32 id){
  BridgeVerifierRegistry420 q=BridgeVerifierRegistry420(_resolve(BridgeIds420.VERIFIER_REGISTRY));id=q.requireDirection(address(this),2);q.requireCurrent(address(adapter));
  require(address(adapter)==IBridgeQualifiedRouter420(_resolve(BridgeIds420.GATEWAY_ROUTER)).adapters(adapter.ADAPTER_ID()),"custody adapter");
  require(_resolve(BridgeIds420.ROUTE_REGISTRY)==address(routeRegistry),"custody route registry");
  GatewayRouter420(_resolve(BridgeIds420.GATEWAY_ROUTER)).requireOutboundSigningAdmission(adapter.ADAPTER_ID(),adapter.btcRouteId(),adapter.btcAssetId());
  BitcoinFinalityVerifier420 nativeVerifier=BitcoinFinalityVerifier420(address(adapter.verifier()));require(address(nativeVerifier.chain())==address(withdrawalProof.chain())&&nativeVerifier.gatewayScriptHash()==withdrawalProof.deposits().gatewayScriptHash(),"custody source identity");
 }
 function _live() private view returns(bytes32 id){require(active,"custody inactive");return _qualified();}
 function authorizeSigning(bytes32 requestId,bytes calldata raw,FundingInput[] calldata funding,bytes calldata backingEvidence,bytes32 expectedPrevious) external returns(bytes32 commitment){
  bytes32 approval=_live();IBitcoinWithdrawal420.Request memory r=adapter.outboundMessage(requestId);require(r.sourceChainId==block.chainid&&r.sourceRouter==_resolve(BridgeIds420.GATEWAY_ROUTER)&&r.sourceAdapter==address(adapter)&&r.routeId==adapter.btcRouteId()&&r.assetId==adapter.btcAssetId(),"withdrawal request domain");
  Authorization storage a=authorizations[requestId];require(a.current==expectedPrevious&&a.status!=Status.CONFIRMED,"withdrawal state");
  BitcoinSigningTransaction420.Parsed memory p=BitcoinSigningTransaction420.parse(raw);require(!p.signedData&&funding.length==p.outpoints.length,"unsigned signing transaction");
  uint256 outputTotal=BitcoinSigningTransaction420.validateOutputs(p,r.amountSatoshis,keccak256(adapter.outboundScript(requestId)),withdrawalProof.deposits().gatewayScriptHash(),requestId);
  uint256 inputTotal;bytes32 fundingHash;
  for(uint256 i;i<funding.length;++i){FundingInput calldata f=funding[i];require(keccak256(abi.encode(f.txid,f.outputIndex))==p.outpoints[i]&&f.amountSatoshis>0&&f.scriptHash==withdrawalProof.deposits().gatewayScriptHash(),"custody input");inputTotal+=f.amountSatoshis;require(inputTotal<=BitcoinScript420.MAX_MONEY,"input money range");fundingHash=keccak256(abi.encode(fundingHash,f));}
  require(inputTotal>=outputTotal&&inputTotal-outputTotal<=maxFeeSatoshis,"custody fee");
  if(a.current!=0)require(a.fundingHash==fundingHash&&a.inputsHash==p.inputsHash,"replacement must conflict");
  commitment=keccak256(abi.encode("420/BTC/SIGNING/V1",block.chainid,address(this),descriptorHash,approval,requestId,p.skeletonHash,fundingHash,a.generation+1));
  require(verifier.verifyBacking(requestId,commitment,backingEvidence),"unbacked withdrawal");
  for(uint256 i;i<p.outpoints.length;++i){bytes32 owner=reservedInputs[p.outpoints[i]];require(owner==0||owner==requestId,"custody input reserved");reservedInputs[p.outpoints[i]]=requestId;}
  a.current=commitment;a.fundingHash=fundingHash;a.inputsHash=p.inputsHash;++a.generation;a.status=Status.AUTHORIZED;a.approvalId=approval;authorizedSkeletons[requestId][p.skeletonHash]=true;
  require(_live()==approval,"custody qualification changed");emit SigningAuthorized(requestId,commitment,p.skeletonHash,a.generation,inputTotal-outputTotal);
 }
 /// @notice HSMs must check current authorization and independently validate their descriptor, UTXOs,
 /// complete PSBT, amounts, fees and SIGHASH policy before signing. This call never signs a transaction.
 function signingAuthorization(bytes32 requestId,bytes32 commitment) external view returns(bool){bytes32 approval=_live();Authorization storage a=authorizations[requestId];return a.approvalId==approval&&a.status==Status.AUTHORIZED&&a.current==commitment&&commitment!=0;}
 /// @notice Append actual confirmed payments even during emergency suspension; no mint/release authority.
 function observeSettlement(bytes32 requestId,bytes calldata proof) external {
  BitcoinWithdrawalProof420.Receipt memory r=withdrawalProof.verify(requestId,proof);Authorization storage a=authorizations[requestId];require(authorizedSkeletons[requestId][r.skeletonHash]&&a.inputsHash==r.inputsHash,"unsigned custody payout");
  if(a.status==Status.CONFIRMED)require(a.txid==r.txid,"conflicting payout");
  a.status=Status.CONFIRMED;a.txid=r.txid;a.blockHash=r.blockHash;a.tip=r.tip;a.height=r.height;emit PayoutObserved(requestId,r.txid,r.blockHash,r.tip);
 }
 /// @notice A canonical block at the same height proves the observed payment block was orphaned.
 function invalidateForReorg(bytes32 requestId,bytes32 canonicalBlock,bytes32[] calldata ancestry) external {
  Authorization storage a=authorizations[requestId];require(a.status==Status.CONFIRMED&&canonicalBlock!=a.blockHash,"reorg state");BitcoinHeaderChain420 c=withdrawalProof.chain();require(c.getHeader(canonicalBlock).height==a.height&&c.confirmations(canonicalBlock,ancestry)>0,"canonical conflict proof");a.status=Status.REORGED;emit PayoutReorganized(requestId,a.blockHash,canonicalBlock);
 }
 /// @notice Conservative current-tip receipt. Refresh the proof after any best-tip change.
 function confirmedWithdrawal(bytes32 requestId) external view returns(bytes32 txid,bytes32 blockHash,bytes memory recipientScript,uint64 amountSatoshis,bytes32 evidenceHash){
  bytes32 approval=_live();Authorization storage a=authorizations[requestId];require(a.approvalId==approval,"stale custody approval");require(a.status==Status.CONFIRMED&&a.tip==withdrawalProof.chain().bestTip(),"stale custody receipt");IBitcoinWithdrawal420.Request memory r=adapter.outboundMessage(requestId);
  txid=a.txid;blockHash=a.blockHash;recipientScript=adapter.outboundScript(requestId);amountSatoshis=r.amountSatoshis;evidenceHash=keccak256(abi.encode("420/BTC/PAID/V1",requestId,a.txid,a.blockHash,a.tip,keccak256(recipientScript),a.approvalId));
 }
 /// @notice Authenticated payment fact, including after signing revocation. Never signing authority.
 /// The outcome verifier must itself be currently qualified against this immutable proof/chain graph.
 function observedPayment(bytes32 requestId) external view returns(bytes32 txid,bytes32 blockHash,bytes memory recipientScript,uint64 amountSatoshis,bytes32 evidenceHash){
  Authorization storage a=authorizations[requestId];require(a.status==Status.CONFIRMED&&a.tip==withdrawalProof.chain().bestTip(),"stale payment observation");
  IBitcoinWithdrawal420.Request memory r=adapter.outboundMessage(requestId);txid=a.txid;blockHash=a.blockHash;recipientScript=adapter.outboundScript(requestId);amountSatoshis=r.amountSatoshis;
  evidenceHash=keccak256(abi.encode("420/BTC/OBSERVED_PAYMENT/V1",requestId,txid,blockHash,a.tip,keccak256(recipientScript),a.approvalId));
 }

}
