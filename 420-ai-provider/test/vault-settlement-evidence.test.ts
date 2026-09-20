import test from 'node:test';
import assert from 'node:assert/strict';
import { AbiCoder, keccak256 } from 'ethers';
import { VaultSettlementEvidence420 } from '../src/vault-settlement-evidence.js';
import type { VaultEscrowSnapshot420, VaultObligationSnapshot420, CanonicalVaultOperation420 } from '../src/vault-reconciliation.js';

const id=(n: string)=>`0x${n.repeat(64)}` as `0x${string}`;
const jobId=id('1'),providerId=id('2'),vaultRef=id('3'),fundingRef=id('4'),fundingObligationId=id('5'),settlementRef=id('6'),operationId=id('7');
const payer='0x1111111111111111111111111111111111111111';
const beneficiary='0x2222222222222222222222222222222222222222';
const asset='0x0000000000000000000000000000000000000000';
const refundObligationId=keccak256(AbiCoder.defaultAbiCoder().encode(['string','bytes32','bytes32','bytes32'],
 ['420AI_REFUND_OBLIGATION_V1',fundingRef,jobId,settlementRef])) as `0x${string}`;
const expectation={jobId,providerId,vaultRef,fundingRef,fundingObligationId,payer,beneficiary,amount420:42n,asset};
function fixture() {
 const escrow:VaultEscrowSnapshot420={jobId,providerId,vaultRef,fundingRef,payer,beneficiary,amount420:42n,settlementRef,state:'CLOSED'};
 const original:VaultObligationSnapshot420={obligationId:fundingObligationId,vaultRef,sourceRef:fundingRef,asset,beneficiary,amount420:42n,state:'CLAIMED'};
 const refund:VaultObligationSnapshot420={obligationId:refundObligationId,vaultRef,sourceRef:fundingRef,asset,beneficiary:payer,amount420:42n,state:'CLAIMED'};
 const payout:CanonicalVaultOperation420={operationId,vaultRef,obligationId:fundingObligationId,asset,recipient:beneficiary,amount420:42n,txHash:id('8'),canonical:true,withdrawalAndClaimProven:true};
 const gate=new VaultSettlementEvidence420({async escrow(){return escrow;},async obligation(key){return key===refundObligationId?refund:original;},async payout(){return payout;}});
 return {escrow,original,refund,payout,gate};
}
test('closed escrow and claimable provider obligation cannot prove provider payment',async()=>{
 const f=fixture(); f.original.state='CLAIMABLE';
 await assert.rejects(f.gate.verifyProviderPaid(expectation,settlementRef,operationId),/not claimed/);
 f.original.state='CLAIMED'; f.payout.canonical=false;
 await assert.rejects(f.gate.verifyProviderPaid(expectation,settlementRef,operationId),/unproven/);
 f.payout.canonical=true; f.payout.withdrawalAndClaimProven=false;
 await assert.rejects(f.gate.verifyProviderPaid(expectation,settlementRef,operationId),/unproven/);
 f.payout.withdrawalAndClaimProven=true;
 assert.equal((await f.gate.verifyProviderPaid(expectation,settlementRef,operationId)).txHash,id('8'));
});
test('full refund demands cancelled provider obligation and distinct payer-claimed obligation',async()=>{
 const f=fixture(); f.payout.obligationId=refundObligationId; f.payout.recipient=payer;
 await assert.rejects(f.gate.verifyPayerRefund(expectation,settlementRef,operationId,refundObligationId),/not cancelled/);
 f.original.state='CANCELLED'; f.refund.state='RESERVED';
 await assert.rejects(f.gate.verifyPayerRefund(expectation,settlementRef,operationId,refundObligationId),/unproven/);
 f.refund.state='CLAIMED'; f.refund.beneficiary=beneficiary;
 await assert.rejects(f.gate.verifyPayerRefund(expectation,settlementRef,operationId,refundObligationId),/unproven/);
 f.refund.beneficiary=payer;
 await assert.rejects(f.gate.verifyPayerRefund(expectation,settlementRef,operationId,id('9')),/identity mismatch/);
 assert.equal((await f.gate.verifyPayerRefund(expectation,settlementRef,operationId,refundObligationId)).txHash,id('8'));
});
test('rejects mismatched recipient, amount, funding reference, settlement reference and unverified receipt',async()=>{
 const f=fixture(); f.original.state='CANCELLED'; f.payout.obligationId=refundObligationId; f.payout.recipient=beneficiary;
 await assert.rejects(f.gate.verifyPayerRefund(expectation,settlementRef,operationId,refundObligationId),/unproven/);
 f.payout.recipient=payer; f.payout.amount420=41n;
 await assert.rejects(f.gate.verifyPayerRefund(expectation,settlementRef,operationId,refundObligationId),/unproven/);
 f.payout.amount420=42n; f.payout.withdrawalAndClaimProven=false;
 await assert.rejects(f.gate.verifyPayerRefund(expectation,settlementRef,operationId,refundObligationId),/unproven/);
 f.payout.withdrawalAndClaimProven=true; f.original.sourceRef=id('a');
 await assert.rejects(f.gate.verifyPayerRefund(expectation,settlementRef,operationId,refundObligationId),/original funding obligation/);
 f.original.sourceRef=fundingRef; f.escrow.settlementRef=id('b');
 await assert.rejects(f.gate.verifyPayerRefund(expectation,settlementRef,operationId,refundObligationId),/escrow closure/);
});
