// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../interfaces/IBitcoinWithdrawal420.sol";
import "../verifiers/BitcoinFinalityVerifier420.sol";
import "./BitcoinSigningTransaction420.sol";
/// @notice Confirmed payout evidence against the existing greatest-work Bitcoin header chain.
/// Does not authorize signing, establish global-tip freshness or prove custody ownership.
contract BitcoinWithdrawalProof420 {
 IBitcoinWithdrawal420 public immutable adapter;
 BitcoinFinalityVerifier420 public immutable deposits;
 BitcoinHeaderChain420 public immutable chain;
 struct Proof {bytes32 blockHash;bytes transaction;uint256 index;bytes32[] siblings;bytes32[] ancestry;}
 struct Receipt {bytes32 requestId;bytes32 txid;bytes32 skeletonHash;bytes32 inputsHash;bytes32 blockHash;bytes32 tip;uint64 height;uint32 confirmations;}
 error InvalidWithdrawalProof();
 constructor(IBitcoinWithdrawal420 adapter_,BitcoinFinalityVerifier420 deposits_){require(address(adapter_).code.length!=0&&address(deposits_).code.length!=0,"withdrawal dependencies");adapter=adapter_;deposits=deposits_;chain=deposits_.chain();}
 function verify(bytes32 requestId,bytes calldata encoded) external view returns(Receipt memory r){
  if(encoded.length>1_100_000)revert InvalidWithdrawalProof();Proof memory p=abi.decode(encoded,(Proof));if(keccak256(encoded)!=keccak256(abi.encode(p)))revert InvalidWithdrawalProof();
  IBitcoinWithdrawal420.Request memory request=adapter.outboundMessage(requestId);if(request.sourceChainId!=block.chainid||request.sourceAdapter!=address(adapter)||request.messageId!=requestId)revert InvalidWithdrawalProof();
  BitcoinHeaderChain420.Header memory h=chain.getHeader(p.blockHash);uint32 conf=chain.confirmations(p.blockHash,p.ancestry);if(conf<6)revert InvalidWithdrawalProof();
  BitcoinSigningTransaction420.Parsed memory tx_=BitcoinSigningTransaction420.parse(p.transaction);
  if(!tx_.signedData)revert InvalidWithdrawalProof();
  BitcoinSigningTransaction420.validateOutputs(tx_,request.amountSatoshis,keccak256(adapter.outboundScript(requestId)),deposits.gatewayScriptHash(),requestId);
  if(!deposits.verifyInclusion(tx_.txid,h.merkleRoot,p.index,p.siblings))revert InvalidWithdrawalProof();
  r=Receipt(requestId,tx_.txid,tx_.skeletonHash,tx_.inputsHash,p.blockHash,chain.bestTip(),h.height,conf);
 }
}
