import test from 'node:test';
import assert from 'node:assert/strict';
import {readSale,position,checkoutContext,transactionStatus} from '../core/consumer.mjs';
import {makeRpc,S,P,I,PROFILE,POLICY,TX,BLOCK,MERCHANT,USER,TOKEN,A,runtime,out} from './consumer.fixture.mjs';

test('sale ABI decodes authoritative project, payout, caps and status',async()=>{
  const sale=await readSale(makeRpc(),runtime,S);
  assert.equal(sale.paymentAsset,TOKEN.toLowerCase());assert.equal(sale.proceedsReceiver,MERCHANT.toLowerCase());
  assert.equal(sale.hardCap,'100');assert.equal(sale.raised,'12');assert.equal(sale.state,'ACTIVE');
});
test('participant position reads canonical capacity, identity credential and contribution history',async()=>{
  const p=await position(makeRpc(),runtime,S,USER);
  assert.equal(p.canonical,true);assert.equal(p.eligibility,'ELIGIBLE');
  assert.equal(p.remaining,'88');assert.equal(p.walletRemaining,'70');assert.equal(p.expectedClaim,'8');
  assert.deepEqual(p.history,[]);assert.equal(p.claimable,false);
  assert.equal(p.identity.profileAtSale,PROFILE);assert.equal(p.source.blockHash,BLOCK);
});
test('unregistered invoice and invalid settlement payout cannot enter canonical checkout',async()=>{
  const rpc=makeRpc();
  const base=await checkoutContext(rpc,runtime,S,USER,'42','9');
  assert.equal(base.next,'QUOTE_CONVERSION');assert.equal(base.invoiceId,I);assert.equal(base.amount,'42');
  rpc.set('registeredContributionIntent(bytes32)',out(0));
  await assert.rejects(()=>checkoutContext(rpc,runtime,S,USER,'42','9'),/unregistered payment intent/);
  rpc.set('registeredContributionIntent(bytes32)',out(1));
  rpc.set('merchantOf(bytes32)',out(USER));
  await assert.rejects(()=>checkoutContext(rpc,runtime,S,USER,'42','9'),/invoice merchant mismatches/);
});
test('checkout refuses unavailable capacity, missing eligibility, and bad invoice terms',async()=>{
  const rpc=makeRpc();
  rpc.set('sale(bytes32)',out(P,TOKEN,MERCHANT,20,100,80,10,100,200,210,POLICY,PROFILE,70,2,1));
  const exhausted=await checkoutContext(rpc,runtime,S,USER,'42','9');
  assert.equal(exhausted.canContribute,false);assert.equal(exhausted.next,'RECOVER_OR_EXPIRED');
  rpc.set('sale(bytes32)',out(P,TOKEN,MERCHANT,20,100,80,10,100,200,210,POLICY,PROFILE,12,2,1));
  rpc.set('hasValidCredential(bytes32,bytes32)',out(0));
  const revoked=await checkoutContext(rpc,runtime,S,USER,'42','9');
  assert.equal(revoked.canContribute,false);assert.equal(revoked.invoiceId,I);
  rpc.set('hasValidCredential(bytes32,bytes32)',out(1));
  rpc.set('getInvoice(bytes32)',out(PROFILE,MERCHANT,PROFILE,'0x343230',99,190,200,0,1,0,0,PROFILE,PROFILE,PROFILE,1));
  await assert.rejects(()=>checkoutContext(rpc,runtime,S,USER,'42','9'),/canonical invoice terms mismatch/);
});
test('reorg and revert are explicit transaction recovery states',async()=>{
  const rpc=makeRpc(),t={from:USER,to:A.allocations};
  rpc.setTransaction(t,null);
  assert.equal((await transactionStatus(rpc,runtime,TX,USER)).state,'PENDING');
  rpc.setTransaction(t,{status:'0x1',blockNumber:'0x10',blockHash:BLOCK,logs:[]});
  assert.equal((await transactionStatus(rpc,runtime,TX,USER)).state,'FINALIZED');
  rpc.reorg();
  assert.equal((await transactionStatus(rpc,runtime,TX,USER)).state,'REORGED');
  const bad=makeRpc();bad.setTransaction(t,{status:'0x0',blockNumber:'0x10',blockHash:BLOCK,logs:[]});
  assert.equal((await transactionStatus(bad,runtime,TX,USER)).state,'REVERTED');
});

test('expired or exhausted campaigns allow existing invoice recovery but not new checkout',async()=>{
  const rpc=makeRpc();
  rpc.set('sale(bytes32)',out(P,TOKEN,MERCHANT,20,100,80,10,100,200,210,POLICY,PROFILE,12,4,1));
  const state=await checkoutContext(rpc,runtime,S,USER,'42','9');
  assert.equal(state.canContribute,false);assert.equal(state.next,'RECOVER_OR_EXPIRED');
  assert.equal(state.invoiceId,I);
});

test('loss of sale-scoped contribution capability blocks new checkout while retaining paid-intent lookup',async()=>{
  const rpc=makeRpc();
  rpc.set('isAuthorized(address,bytes32,bytes32,uint256)',out(0));
  const result=await checkoutContext(rpc,runtime,S,USER,'42','9');
  assert.equal(result.capabilityAuthorized,false);
  assert.equal(result.canContribute,false);
  assert.equal(result.invoiceId,I);
  assert.equal(result.next,'RECOVER_OR_EXPIRED');
});

test('campaign mode and integration binding are mandatory for NEW checkout, not historical recovery',async()=>{
  const rpc=makeRpc();
  rpc.set('campaignMode(bytes32)',out(0));
  const missingMode=await checkoutContext(rpc,runtime,S,USER,'42','9');
  assert.equal(missingMode.canContribute,false);assert.equal(missingMode.invoiceId,I);
  rpc.set('campaignMode(bytes32)',out(1));
  rpc.set('crowdfundingIntegration()',out('0x0000000000000000000000000000000000009999'));
  const wrongIntegration=await checkoutContext(rpc,runtime,S,USER,'42','9');
  assert.equal(wrongIntegration.canContribute,false);
  rpc.set('crowdfundingIntegration()',out(A.crowd));
  assert.equal((await checkoutContext(rpc,runtime,S,USER,'42','9')).canContribute,true);
});

test('unallocated Pay refunds report delivered principal and never mark partially delivered refunds complete',async()=>{
  const rpc=makeRpc(),paymentId='0x'+'af'.repeat(32);
  rpc.set('checkoutPaymentForInvoice(bytes32)',out(paymentId));
  rpc.set('payments(bytes32)',out(I,USER,MERCHANT,TOKEN,42,TOKEN,42,P,9,PROFILE,0,42,6));
  rpc.set('usedPaymentId(bytes32)',out(0));
  rpc.set('refundProgress(bytes32,address,uint128)',out(42,20,20));
  const partial=await checkoutContext(rpc,runtime,S,USER,'42','9');
  assert.equal(partial.paymentId,paymentId);
  assert.equal(partial.next,'REFUND_RECOVERY');
  assert.equal(partial.unallocatedRefund.principalDelivered,'20');
  assert.equal(partial.unallocatedRefund.complete,false);
  rpc.set('refundProgress(bytes32,address,uint128)',out(42,42,42));
  const delivered=await checkoutContext(rpc,runtime,S,USER,'42','9');
  assert.equal(delivered.unallocatedRefund.complete,true);
  rpc.set('payments(bytes32)',out(I,USER,MERCHANT,TOKEN,42,USER,42,P,9,PROFILE,0,42,6));
  await assert.rejects(()=>checkoutContext(rpc,runtime,S,USER,'42','9'),/payment does not match the campaign intent/);
});

test('linked Arbitration status requires matching claimant, controller, domain, component and sale',async()=>{
  const rpc=makeRpc(),caseId='0x'+'bb'.repeat(32),domain='0x'+'dd'.repeat(32),component='0x'+'99'.repeat(32);
  rpc.set('disputeCase(bytes32,address)',out(caseId));
  rpc.set('caseOrigin(bytes32)',out(USER,MERCHANT,domain,component,S,1));
  rpc.set('publishedDisputeOutcome(bytes32)',out(0));
  const linked=await position(rpc,runtime,S,USER);
  assert.equal(linked.dispute.caseId,caseId);assert.equal(linked.dispute.state,'OPEN');
  rpc.set('caseOrigin(bytes32)',out(USER,MERCHANT,PROFILE,component,S,1));
  await assert.rejects(()=>position(rpc,runtime,S,USER),/arbitration origin mismatch/);
  rpc.set('caseOrigin(bytes32)',out(USER,MERCHANT,domain,PROFILE,S,1));
  await assert.rejects(()=>position(rpc,runtime,S,USER),/arbitration origin mismatch/);
});
test('Arbitration transaction receipt recovers only the sale-specific crowdfunding case-opening event',async()=>{
  const rpc=makeRpc(),caseId='0x'+'bb'.repeat(32),domain='0x'+'dd'.repeat(32);
  const cases='0x0000000000000000000000000000000000001010';
  const topic='0x'+'99'.repeat(32),claimant='0x'+USER.slice(2).padStart(64,'0');
  rpc.setTransaction({from:USER,to:cases},{status:'0x1',blockNumber:'0x10',blockHash:BLOCK,
    logs:[{address:cases,topics:[topic,caseId,domain,claimant]}]});
  const valid=await transactionStatus(rpc,runtime,TX,USER);
  assert.equal(valid.caseId,caseId);
  rpc.setTransaction({from:USER,to:cases},{status:'0x1',blockNumber:'0x10',blockHash:BLOCK,
    logs:[{address:cases,topics:[topic,caseId,PROFILE,claimant]}]});
  assert.equal((await transactionStatus(rpc,runtime,TX,USER)).caseId,null);
});
