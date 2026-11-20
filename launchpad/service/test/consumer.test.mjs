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
