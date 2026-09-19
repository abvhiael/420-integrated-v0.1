import test from 'node:test';
import assert from 'node:assert/strict';
import { VaultReconciliation420, type VaultEscrowSnapshot420, type VaultObligationSnapshot420, type CanonicalVaultOperation420 } from '../src/vault-reconciliation.js';

const id = (n: string) => `0x${n.repeat(64)}` as `0x${string}`;
const jobId=id('1'), providerId=id('2'), vaultRef=id('3'), fundingRef=id('4'), obligationId=id('5'), settlementRef=id('6'), operationId=id('7');
const payer='0x1111111111111111111111111111111111111111', beneficiary='0x2222222222222222222222222222222222222222';
const asset='0x3333333333333333333333333333333333333333';
const expectation={jobId,providerId,vaultRef,fundingRef,fundingObligationId:obligationId,payer,beneficiary,amount420:42n,asset};
function fixture() {
 const escrow: VaultEscrowSnapshot420={jobId,providerId,vaultRef,fundingRef,payer,beneficiary,amount420:42n,settlementRef:id('0'),state:'FUNDED'};
 const obligation: VaultObligationSnapshot420={obligationId,vaultRef,sourceRef:fundingRef,asset,beneficiary,amount420:42n,state:'RESERVED'};
 const payout: CanonicalVaultOperation420={operationId,vaultRef,obligationId,asset,recipient:beneficiary,amount420:42n,txHash:id('8'),canonical:true,withdrawalAndClaimProven:true};
 return {escrow,obligation,payout, gate:new VaultReconciliation420({async escrow(){return escrow;},async obligation(){return obligation;},async payout(){return payout;}})};
}
test('accepts matching escrow and reserved Vault obligation, not escrow assertion alone', async()=>{
 const f=fixture(); assert.equal((await f.gate.verifyFunding(expectation)).state,'FUNDED');
 f.obligation.sourceRef=id('9'); await assert.rejects(f.gate.verifyFunding(expectation),/Vault obligation/);
});
test('rejects wrong payer, provider, asset, unfunded or missing reservation', async()=>{
 const f=fixture(); f.escrow.payer=beneficiary; await assert.rejects(f.gate.verifyFunding(expectation),/escrow funding/);
 f.escrow.payer=payer; f.escrow.providerId=id('a'); await assert.rejects(f.gate.verifyFunding(expectation),/escrow funding/);
 f.escrow.providerId=providerId; f.obligation.asset=payer; await assert.rejects(f.gate.verifyFunding(expectation),/Vault obligation/);
 f.obligation.asset=asset; f.obligation.state='NONE'; await assert.rejects(f.gate.verifyFunding(expectation),/Vault obligation/);
});
test('CLOSED escrow is not a payment; requires canonical claimed Vault operation', async()=>{
 const f=fixture(); f.escrow.state='CLOSED'; f.escrow.settlementRef=settlementRef; f.obligation.state='CLAIMABLE';
 await assert.rejects(f.gate.verifyPaid(expectation,settlementRef,operationId,'release'),/not been claimed/);
 f.obligation.state='CLAIMED'; f.payout.canonical=false;
 await assert.rejects(f.gate.verifyPaid(expectation,settlementRef,operationId,'release'),/unproven/);
 f.payout.canonical=true; f.payout.withdrawalAndClaimProven=false;
 await assert.rejects(f.gate.verifyPaid(expectation,settlementRef,operationId,'release'),/unproven/);
 f.payout.withdrawalAndClaimProven=true;
 assert.equal((await f.gate.verifyPaid(expectation,settlementRef,operationId,'release')).txHash,id('8'));
});
test('rejects false settlement reference, missing receipt, recipient substitution and mismatched amount', async()=>{
 const f=fixture(); f.escrow.state='CLOSED'; f.escrow.settlementRef=settlementRef; f.obligation.state='CLAIMED';
 await assert.rejects(f.gate.verifyPaid(expectation,id('a'),operationId,'release'),/has not closed/);
 f.payout.recipient=payer; await assert.rejects(f.gate.verifyPaid(expectation,settlementRef,operationId,'release'),/unproven/);
 f.payout.recipient=beneficiary; f.payout.amount420=41n; await assert.rejects(f.gate.verifyPaid(expectation,settlementRef,operationId,'release'),/unproven/);
 await assert.rejects(f.gate.verifyPaid(expectation,settlementRef,operationId,'refund'),/unproven/);
});
