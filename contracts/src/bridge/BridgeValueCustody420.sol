// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../system/GenesisResidentAccess420.sol";
import "../interfaces/IBridgeValueCustody420.sol";
import "../interfaces/genesis/ICanonicalAssetRegistry420.sol";
import "../libraries/GenesisInterfaceIds420.sol";
import "./BridgeIds420.sol";
import "./BridgeVerifierRegistry420.sol";
import "./BridgeTransferRegistry.sol";
import "./BridgeRouteRegistry.sol";
/// Qualified non-issuer mint/burn or prefunded lock/release custody. No arbitrary mint/refund role.
/// Source proof admission is exclusively the canonical router. Native issuer paths remain native.
interface IBridgeSourceReplayView420 {function sourceKeyForTransfer(bytes32) external view returns(bytes32);function consumedSourceMessages(bytes32) external view returns(bool);}
contract BridgeValueCustody420 is GenesisResidentAccess420,IBridgeValueCustody420 {
 enum Mode {NONE,MINT_BURN,LOCK_RELEASE,NATIVE_PROVIDER}
 struct Profile {address token;bytes32 runtimeHash;Mode mode;}
 struct Pending {bytes32 route;bytes32 asset;address sender;uint256 amount;uint256 balance;bytes32 approval;bool bound;}
 mapping(bytes32=>Profile) public profiles;
 mapping(bytes32=>uint256) public managedSupply;
 mapping(bytes32=>uint256) public pendingAmount;
 mapping(bytes32=>uint256) public escrow;
 mapping(bytes32=>Pending) public pending;
 mapping(bytes32=>bool) public delivered;
 mapping(bytes32=>bool) public usedProof;
 mapping(bytes32=>bytes32) public evidence;
 mapping(bytes32=>bool) public paidOutcome;
 IBridgeWithdrawalOutcome420 public verifier;
 address public immutable deploymentAddress;
 address public immutable qualificationAnchor;bytes32 public immutable qualificationRuntime;
 bytes32 public configurationHash;
 Pending private reservation;
 bool private entered;
 event ValueDelivered(bytes32 indexed transferId,address token,address recipient,uint256 amount,bytes32 evidenceHash);
 event WithdrawalResolved(bytes32 indexed transferId,bool paid,bytes32 proofId);
 constructor(address gov,address registry_,bytes32 config,IBridgeWithdrawalOutcome420 verifier_) GenesisResidentAccess420(gov,registry_,config){require(address(verifier_).code.length!=0,"outcome verifier");verifier=verifier_;deploymentAddress=address(this);qualificationAnchor=_resolveRequired(BridgeIds420.VERIFIER_REGISTRY);qualificationRuntime=qualificationAnchor.codehash;}
 function componentId() public pure override returns(bytes32){return BridgeIds420.VALUE_CUSTODY;}
 modifier onlyRouter(){_requireResidentActive();require(msg.sender==_resolveRequired(BridgeIds420.GATEWAY_ROUTER),"canonical router");require(!entered,"custody reentrancy");entered=true;_;entered=false;}
 function setVerifier(IBridgeWithdrawalOutcome420 next) external {_requireGenesisGovernance(BridgeIds420.ACTION_CONFIGURE);require(!entered&&address(next).code.length!=0,"outcome verifier");verifier=next;}
 /// Each execution binding is probed separately to respect the registry's fixed 50k-gas read limit.
 function configurationState() external view returns(bytes32){return keccak256(abi.encode(configurationHash,address(verifier),qualificationAnchor,qualificationRuntime));}
 function executionBinding(bytes32 id) external view returns(bytes32){address target=_resolveRequired(id);return keccak256(abi.encode(id,target,target.codehash));}
 function configure(bytes32 asset,address token,Mode mode) external {
  _requireResidentActive();_requireGenesisGovernance(BridgeIds420.ACTION_CONFIGURE);require((asset!=keccak256("420/BRIDGE/ASSET/USDC")&&asset!=keccak256("420/BRIDGE/ASSET/CADC"))||mode==Mode.NATIVE_PROVIDER,"native issuer only");
  require(managedSupply[asset]==0&&pendingAmount[asset]==0&&escrow[asset]==0&&reservation.amount==0,"live obligations");
  ICanonicalAssetRegistry420 a=ICanonicalAssetRegistry420(_resolveRequired(GenesisInterfaceIds420.CANONICAL_ASSET_REGISTRY));require(mode!=Mode.NONE&&token.code.length!=0&&a.asset(asset).token==token&&a.isUsable(asset)&&IBridgeValueToken420(token).decimals()==a.asset(asset).decimals,"canonical token");

  bytes32[12] memory nativeAssets=[keccak256("420/BRIDGE/ASSET/ETH"),keccak256("420/BRIDGE/ASSET/BNB"),keccak256("420/BRIDGE/ASSET/BTC"),keccak256("420/BRIDGE/ASSET/DOGE"),keccak256("420/BRIDGE/ASSET/LTC"),keccak256("420/BRIDGE/ASSET/XRP"),keccak256("420/BRIDGE/ASSET/TRX"),keccak256("420/BRIDGE/ASSET/POT"),keccak256("420/BRIDGE/ASSET/BOB"),keccak256("420/BRIDGE/ASSET/CURE"),keccak256("420/BRIDGE/ASSET/ARRR"),keccak256("420/BRIDGE/ASSET/SOL")];
  uint8[12] memory units=[uint8(18),18,8,8,8,6,6,8,8,6,8,9];for(uint256 i;i<12;++i)if(asset==nativeAssets[i])require(IBridgeValueToken420(token).decimals()==units[i],"native supply units");
  if(asset==keccak256("420/BRIDGE/ASSET/USDC")||asset==keccak256("420/BRIDGE/ASSET/CADC"))require(IBridgeValueToken420(token).decimals()==6,"issuer supply units");
  if(mode==Mode.MINT_BURN)require(IBridgeValueToken420(token).totalSupply()==0,"preexisting supply");
  profiles[asset]=Profile(token,token.codehash,mode);configurationHash=keccak256(abi.encode(configurationHash,asset,token,token.codehash,mode));
 }
 function qualified(uint8 direction) private view returns(bytes32){require(address(this)==deploymentAddress,"nondelegating custody");require(_resolveRequired(BridgeIds420.VERIFIER_REGISTRY)==qualificationAnchor&&qualificationAnchor.codehash==qualificationRuntime,"qualification registry changed");return BridgeVerifierRegistry420(qualificationAnchor).requireDirection(address(this),direction);}
 function profile(bytes32 asset) private view returns(Profile memory p){p=profiles[asset];require(p.mode!=Mode.NONE&&p.token.codehash==p.runtimeHash,"custody profile");require(ICanonicalAssetRegistry420(_resolveRequired(GenesisInterfaceIds420.CANONICAL_ASSET_REGISTRY)).asset(asset).token==p.token,"asset substitution");}
 function routeToken(bytes32 route,bytes32 asset,address token) private view {
  (bytes32 a,,,,bytes32 destination,,,,,,)=BridgeRouteRegistry(_resolveRequired(BridgeIds420.ROUTE_REGISTRY)).routes(route);
  require(a==asset&&destination==bytes32(uint256(uint160(token))),"custody route token");
 }
 function conservationHealthy(bytes32 asset) public view returns(bool){Profile memory p=profiles[asset];if(p.mode==Mode.NONE)return true;if(p.token.codehash!=p.runtimeHash||ICanonicalAssetRegistry420(_resolveRequired(GenesisInterfaceIds420.CANONICAL_ASSET_REGISTRY)).asset(asset).token!=p.token)return false;if(p.mode==Mode.MINT_BURN)return IBridgeValueToken420(p.token).totalSupply()==managedSupply[asset];if(p.mode==Mode.NATIVE_PROVIDER)return true;return IBridgeValueToken420(p.token).balanceOf(address(this))>=escrow[asset];}
 function fund(bytes32 asset,uint256 amount) external {_requireOperational(BridgeIds420.ACTION_INBOUND,ISystemSafety420.ActionClass.NORMAL_ONLY,Types420.Direction.INBOUND);bytes32 approval=qualified(1);require(!entered&&amount>0,"funding");entered=true;Profile memory p=profile(asset);require(p.mode==Mode.LOCK_RELEASE,"liquidity mode");IBridgeValueToken420 t=IBridgeValueToken420(p.token);uint256 before_=t.balanceOf(address(this));uint256 senderBefore=t.balanceOf(msg.sender);require(t.transferFrom(msg.sender,address(this),amount)&&t.balanceOf(address(this))==before_+amount&&t.balanceOf(msg.sender)+amount==senderBefore,"funding delta");escrow[asset]+=amount;_requireResidentActive();require(qualified(1)==approval&&conservationHealthy(asset),"funding configuration changed");entered=false;}
 function settleInbound(bytes32 id) external onlyRouter returns(bytes32 e){
  _requireOperational(BridgeIds420.ACTION_INBOUND,ISystemSafety420.ActionClass.NORMAL_ONLY,Types420.Direction.INBOUND);bytes32 approval=qualified(1);BridgeTransferRegistry tr=BridgeTransferRegistry(_resolveRequired(BridgeIds420.TRANSFER_REGISTRY));
  (bytes32 route,bytes32 asset,,address recipient,uint256 amount,,bytes32 message,BridgeTransferRegistry.Status status,,)=tr.transfers(id);
  require(tr.transferDirection(id)==BridgeTransferRegistry.Direction.INBOUND&&(status==BridgeTransferRegistry.Status.VERIFIED||status==BridgeTransferRegistry.Status.DESTINATION_PENDING)&&!delivered[id],"inbound custody state");
  Profile memory p=profile(asset);routeToken(route,asset,p.token);require(p.mode!=Mode.NATIVE_PROVIDER,"native delivery receipt required");require(conservationHealthy(asset),"supply drift");IBridgeValueToken420 t=IBridgeValueToken420(p.token);uint256 before_=t.balanceOf(recipient);delivered[id]=true;
  if(p.mode==Mode.MINT_BURN){managedSupply[asset]+=amount;t.bridgeMint(recipient,amount);}else{uint256 held=t.balanceOf(address(this));escrow[asset]-=amount;require(t.transfer(recipient,amount)&&t.balanceOf(address(this))+amount==held,"release");}
  require(t.balanceOf(recipient)==before_+amount&&conservationHealthy(asset),"delivery delta");require(qualified(1)==approval,"custody approval changed");
  e=keccak256(abi.encode("420/BRIDGE/LOCAL_DELIVERY/V1",id,message,p.token,recipient,amount,approval));evidence[id]=e;emit ValueDelivered(id,p.token,recipient,amount,e);
 }
 function reserve(bytes32 route,bytes32 asset,address sender,uint256 amount) external onlyRouter {
  _requireOperational(BridgeIds420.ACTION_OUTBOUND,ISystemSafety420.ActionClass.NORMAL_ONLY,Types420.Direction.OUTBOUND);bytes32 approval=qualified(2);require(reservation.amount==0&&amount>0&&conservationHealthy(asset),"reservation state");Profile memory p=profile(asset);routeToken(route,asset,p.token);IBridgeValueToken420 t=IBridgeValueToken420(p.token);uint256 before_=t.balanceOf(sender);
  if(p.mode==Mode.MINT_BURN){managedSupply[asset]-=amount;t.bridgeBurnFrom(sender,amount);}else if(p.mode==Mode.LOCK_RELEASE){uint256 held=t.balanceOf(address(this));require(t.transferFrom(sender,address(this),amount)&&t.balanceOf(address(this))==held+amount,"escrow delta");escrow[asset]+=amount;}
  require((p.mode==Mode.NATIVE_PROVIDER?t.balanceOf(sender)>=amount:t.balanceOf(sender)+amount==before_)&&conservationHealthy(asset)&&qualified(2)==approval,"backing delta");pendingAmount[asset]+=amount;reservation=Pending(route,asset,sender,amount,before_,approval,false);
 }
 function bindOutbound(bytes32 id) external onlyRouter {
  _requireOperational(BridgeIds420.ACTION_OUTBOUND,ISystemSafety420.ActionClass.NORMAL_ONLY,Types420.Direction.OUTBOUND);
  BridgeTransferRegistry tr=BridgeTransferRegistry(_resolveRequired(BridgeIds420.TRANSFER_REGISTRY));(bytes32 route,bytes32 asset,address sender,,uint256 amount,,,BridgeTransferRegistry.Status status,,)=tr.transfers(id);
  Pending memory p=reservation;require(tr.transferDirection(id)==BridgeTransferRegistry.Direction.OUTBOUND&&status==BridgeTransferRegistry.Status.SOURCE_PENDING&&p.amount==amount&&p.route==route&&p.asset==asset&&p.sender==sender&&pending[id].amount==0,"reservation binding");if(profile(asset).mode==Mode.NATIVE_PROVIDER){(,,,,,bytes32 provider,,,,,)=BridgeRouteRegistry(_resolveRequired(BridgeIds420.ROUTE_REGISTRY)).routes(route);require(provider==keccak256("420/BRIDGE/USDCCCTPAdapter")||provider==keccak256("420/BRIDGE/CADCLayerZeroAdapter"),"native provider route");require(IBridgeValueToken420(profile(asset).token).balanceOf(sender)+amount==p.balance,"native debit delta");}require(qualified(2)==p.approval,"custody approval changed during dispatch");p.bound=true;pending[id]=p;delete reservation;
 }
 function resolveOutbound(bytes32 id,bytes calldata proof) external onlyRouter returns(bool paid,bytes32 e){
  _requireOperational(BridgeIds420.ACTION_WITHDRAWAL_RECOVERY,ISystemSafety420.ActionClass.WITHDRAWAL_ONLY,Types420.Direction.NONE);
  bytes32 approval=qualified(2);Pending memory p=pending[id];require(p.bound&&p.amount>0&&evidence[id]==0,"pending withdrawal");
  require(proof.length>=32&&proof.length<=4_200_000,"outcome proof bounds");
  IBridgeWithdrawalOutcome420.Receipt memory r=verifier.verifyOutcome(proof);BridgeTransferRegistry tr=BridgeTransferRegistry(_resolveRequired(BridgeIds420.TRANSFER_REGISTRY));
  (bytes32 route,bytes32 asset,address sender,,uint256 amount,,bytes32 message,BridgeTransferRegistry.Status status,,)=tr.transfers(id);
  require(r.qualification==tr.transferQualification(id)&&r.transferId==id&&r.messageId==message&&r.route==route&&r.asset==asset&&r.sender==sender&&r.recipientHash==tr.externalRecipientHash(id)&&r.amount==amount&&r.sourceTxId!=0&&r.proofId!=0&&!usedProof[r.proofId],"withdrawal receipt");
  require(status!=BridgeTransferRegistry.Status.COMPLETED&&status!=BridgeTransferRegistry.Status.REFUNDED,"terminal withdrawal");
  if(!r.paid){require(status==BridgeTransferRegistry.Status.FAILED||status==BridgeTransferRegistry.Status.EXPIRED||status==BridgeTransferRegistry.Status.DISPUTED,"cancellation state");Profile memory c=profile(asset);require(c.mode!=Mode.NATIVE_PROVIDER,"issuer recovery required");IBridgeValueToken420 t=IBridgeValueToken420(c.token);uint256 before_=t.balanceOf(sender);
   if(c.mode==Mode.MINT_BURN){managedSupply[asset]+=amount;t.bridgeMint(sender,amount);}else{uint256 held=t.balanceOf(address(this));escrow[asset]-=amount;require(t.transfer(sender,amount)&&t.balanceOf(address(this))+amount==held,"refund");}require(t.balanceOf(sender)==before_+amount,"refund delta");}
  pendingAmount[asset]-=amount;usedProof[r.proofId]=true;paid=r.paid;paidOutcome[id]=paid;e=keccak256(abi.encode("420/BRIDGE/WITHDRAWAL_OUTCOME/V1",r,approval));evidence[id]=e;
  require(conservationHealthy(asset)&&qualified(2)==approval,"custody conservation");emit WithdrawalResolved(id,paid,r.proofId);
 }
 function sourceRefundIntent(bytes32 id) public view returns(bytes32){
  _requireResidentActive();qualified(1);
  BridgeTransferRegistry tr=BridgeTransferRegistry(_resolveRequired(BridgeIds420.TRANSFER_REGISTRY));(bytes32 route,bytes32 asset,address sender,address recipient,uint256 amount,bytes32 txid,bytes32 message,BridgeTransferRegistry.Status status,,)=tr.transfers(id);
  bytes32 sourceKey=IBridgeSourceReplayView420(_resolveRequired(BridgeIds420.GATEWAY_ROUTER)).sourceKeyForTransfer(id);require(sourceKey!=0&&IBridgeSourceReplayView420(_resolveRequired(BridgeIds420.GATEWAY_ROUTER)).consumedSourceMessages(sourceKey),"source replay reservation");
  require(tr.transferDirection(id)==BridgeTransferRegistry.Direction.INBOUND&&status==BridgeTransferRegistry.Status.DISPUTED&&!delivered[id]&&profile(asset).mode!=Mode.NATIVE_PROVIDER&&conservationHealthy(asset),"irrevocable unminted refund intent");
  return keccak256(abi.encode("420/BRIDGE/SOURCE_REFUND_INTENT/V1",block.chainid,address(this),id,route,asset,sender,recipient,amount,txid,message));
 }
 function resolveInboundRefund(bytes32 id,bytes calldata proof) external onlyRouter returns(bytes32 e){
  _requireOperational(BridgeIds420.ACTION_WITHDRAWAL_RECOVERY,ISystemSafety420.ActionClass.WITHDRAWAL_ONLY,Types420.Direction.NONE);
  bytes32 approval=qualified(1);bytes32 intent=sourceRefundIntent(id);require(evidence[id]==0&&proof.length>=32&&proof.length<=4_200_000,"source refund proof");
  IBridgeWithdrawalOutcome420.Receipt memory r=verifier.verifyOutcome(proof);BridgeTransferRegistry tr=BridgeTransferRegistry(_resolveRequired(BridgeIds420.TRANSFER_REGISTRY));(bytes32 route,bytes32 asset,address sender,,uint256 amount,,bytes32 message,,,)=tr.transfers(id);
  require(!r.paid&&r.qualification==tr.transferQualification(id)&&r.transferId==id&&r.messageId==message&&r.route==route&&r.asset==asset&&r.sender==sender&&r.amount==amount&&r.recipientHash==tr.externalRecipientHash(id)&&r.sourceTxId!=0&&r.proofId!=0&&!usedProof[r.proofId],"source refund receipt");
  usedProof[r.proofId]=true;e=keccak256(abi.encode("420/BRIDGE/SOURCE_REFUNDED/V1",intent,r,approval));evidence[id]=e;require(qualified(1)==approval,"source refund qualification changed");
 }
 function outcomeEvidence(bytes32 id) external view returns(bool,bytes32){return(paidOutcome[id],evidence[id]);}
}
