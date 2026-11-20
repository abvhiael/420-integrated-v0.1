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
  await assert.rejects(()=>checkoutContext(rpc,runtime,S,USER,'90','9'),/exceeds canonical capacity/);
  rpc.set('hasValidCredential(bytes32,bytes32)',out(0));
  await assert.rejects(()=>checkoutContext(rpc,runtime,S,USER,'42','9'),/identity eligibility/);
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
