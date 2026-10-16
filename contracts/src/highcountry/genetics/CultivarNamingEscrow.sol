// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
/// @notice Native $420 cultivar naming escrow, deploy ONLY on the approved native-$420 network.
/// @dev Exact authorized service controls quote verification off-chain; publisher attests price
///      after fixed-window oracle checks. Native payments are held by this contract.
contract CultivarNamingEscrow {
 error Forbidden(); error Invalid(); error Unavailable(); error TransferFailure();
 address public immutable owner;
 address public immutable competitionVault;
 address public quotePublisher;
 address public adjudicator;
 bool public paused=true;
 uint256 private guard;
 struct Quote {uint256 cost;uint64 expiresAt;uint64 priceWindowEnd;uint64 version;}
 struct Payment {address payer;uint256 amount;address reviewer;bool finalized;bool refundable;}
 mapping(bytes32=>Quote) public quotes;
 mapping(bytes32=>Payment) public payments;
 mapping(address=>uint256) public claimable;
 event QuotePublished(bytes32 indexed requestId,uint256 cost,uint64 windowEnd,uint64 version);
 event Deposited(bytes32 indexed requestId,address indexed payer,uint256 amount);
 event Resolved(bytes32 indexed requestId,address indexed reviewer,uint256 reviewerAmount,uint256 vaultAmount);
 event Refunded(bytes32 indexed requestId,address indexed payer,uint256 amount);
 constructor(address vault,address publisher,address arbiter){
  if(vault==address(0)||publisher==address(0)||arbiter==address(0))revert Invalid();
  owner=msg.sender;competitionVault=vault;quotePublisher=publisher;adjudicator=arbiter;
 }
 modifier onlyOwner(){if(msg.sender!=owner)revert Forbidden();_;}
 modifier lock(){if(guard!=0)revert Forbidden();guard=1;_;guard=0;}
 function setPaused(bool v) external onlyOwner{paused=v;}
 function updateRoles(address publisher,address arbiter) external onlyOwner{
  if(publisher==address(0)||arbiter==address(0))revert Invalid();
  quotePublisher=publisher;adjudicator=arbiter;
 }
 function publishQuote(bytes32 id,uint256 amount,uint64 expiry,uint64 windowEnd,uint64 version) external {
  if(msg.sender!=quotePublisher)revert Forbidden();
  if(paused||id==0||amount==0||expiry<=block.timestamp||version==0||windowEnd>block.timestamp||quotes[id].cost!=0)revert Invalid();
  quotes[id]=Quote(amount,expiry,windowEnd,version);emit QuotePublished(id,amount,windowEnd,version);
 }
 function deposit(bytes32 id) external payable lock {
  Quote memory q=quotes[id];
  if(paused||q.cost==0||block.timestamp>q.expiresAt||msg.value!=q.cost||payments[id].payer!=address(0))revert Invalid();
  payments[id]=Payment(msg.sender,msg.value,address(0),false,false);
  emit Deposited(id,msg.sender,msg.value);
 }
 /// @dev The adjudicator must prove unique final review, no self-review and permission off-chain.
 function resolve(bytes32 id,address reviewer) external {
  if(msg.sender!=adjudicator)revert Forbidden();
  Payment storage p=payments[id];if(p.payer==address(0)||p.finalized||reviewer==address(0)||reviewer==p.payer)revert Invalid();
  p.finalized=true;p.reviewer=reviewer;
  uint256 reward=p.amount/2;claimable[reviewer]+=reward;
  claimable[competitionVault]+=p.amount-reward;
  emit Resolved(id,reviewer,reward,p.amount-reward);
 }
 function authorizeRefund(bytes32 id) external {
  if(msg.sender!=adjudicator)revert Forbidden();
  Payment storage p=payments[id];if(p.payer==address(0)||p.finalized)revert Invalid();
  p.refundable=true;p.finalized=true;claimable[p.payer]+=p.amount;
  emit Refunded(id,p.payer,p.amount);
 }
 function withdraw() external lock {
  uint256 value=claimable[msg.sender];if(value==0)revert Unavailable();
  claimable[msg.sender]=0;(bool ok,)=payable(msg.sender).call{value:value}("");if(!ok)revert TransferFailure();
 }
}
