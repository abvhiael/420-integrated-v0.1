// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BitcoinCustodyCompletion420.t.sol";
import "../src/bridge/bitcoin/BitcoinCustodyOutcome420.sol";
contract BitcoinEconomicOutcome420Test is BitcoinCustodyFixture420 {
 function testBitcoinOutcomeAuthenticatesPaidRequestAcrossSigningRevocation() public {
  setupCustody(true);authorize(100,0);(bytes memory proof,,)=sourceProof(100,keccak256("economic receipt"),6);custody.observeSettlement(requestId,proof);
  BitcoinCustodyOutcome420 outcome=new BitcoinCustodyOutcome420(custody,f.transfers);
  bytes32 id=f.transfers.deriveOutboundTransferId(ROUTE_ID,ASSET_ID,address(this),keccak256(recipientProgram()),PAY,requestId);
  IBridgeWithdrawalOutcome420.Receipt memory r=outcome.verifyOutcome(abi.encode(id));require(r.transferId==id&&r.messageId==requestId&&r.amount==PAY&&r.paid&&r.proofId!=0);
  q.revoke(q.currentApproval(address(custody)),keccak256("signing authority revoked"));(bool ok,)=address(custody).staticcall(abi.encodeCall(custody.confirmedWithdrawal,(requestId)));require(!ok,"revoked signing approval live");
  r=outcome.verifyOutcome(abi.encode(id));require(r.paid&&r.amount==PAY,"historical real payment erased by revocation");
  f.router.resolveFundedOutbound(id,abi.encode(id));(,,,,,,,BridgeTransferRegistry.Status state,,)=f.transfers.transfers(id);require(state==BridgeTransferRegistry.Status.COMPLETED,"paid BTC obligation remained pending");(uint256 debt,)=f.risk.outstanding(ROUTE_ID,ASSET_ID);require(debt==10_000-PAY,"paid BTC exposure not reconciled");
 }
 function testBitcoinOutcomeRejectsUnknownTransferAndStaleCanonicalTip() public {
  setupCustody(true);authorize(100,0);(bytes memory proof,,bytes32 tip)=sourceProof(100,keccak256("economic stale"),6);custody.observeSettlement(requestId,proof);BitcoinCustodyOutcome420 outcome=new BitcoinCustodyOutcome420(custody,f.transfers);
  bytes32 id=f.transfers.deriveOutboundTransferId(ROUTE_ID,ASSET_ID,address(this),keccak256(recipientProgram()),PAY,requestId);bytes32 next=keccak256("next tip");put(next,tip,0,13);cvm.store(address(headerChain),bytes32(uint256(1)),next);
  (bool ok,)=address(outcome).staticcall(abi.encodeCall(outcome.verifyOutcome,(abi.encode(id))));require(!ok,"stale tip outcome");(ok,)=address(outcome).staticcall(abi.encodeCall(outcome.verifyOutcome,(abi.encode(bytes32(uint256(1))))));require(!ok,"unknown withdrawal");
 }
}
