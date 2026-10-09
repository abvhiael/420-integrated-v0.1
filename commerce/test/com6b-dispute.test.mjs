import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,checkout,seller,buyer,attacker,b32} from './fixtures.mjs';

test('COM-6B seller dispute intent is durable, idempotent, canonical and not a fabricated Arbitration case',async t=>{
 const f=setup();t.after(()=>f.close());
 const {store,attempt,order}=await checkout(f);order.status='2';f.orders.set(attempt.orderId,order);
 const request={disputeHash:b32(702)};
 const first=await f.service.merchantRemedy(seller.address,store.store_id,attempt.attemptId,'dispute',request);
 assert.equal(first.executed,false);assert.equal(first.disputed,false);
 assert.equal(first.proposal.intent.method,'disputeOrder');
 assert.deepEqual(first.proposal.intent.args,[attempt.orderId,b32(702)]);
 assert.equal(first.proposal.arbitrationCaseOpened,false);
 const again=await f.service.merchantRemedy(seller.address,store.store_id,attempt.attemptId,'dispute',request);
 assert.equal(again.proposal.requestId,first.proposal.requestId);
 assert.equal(f.db.get('SELECT COUNT(*) AS n FROM dispute_requests').n,1);
 const pending=await f.service.merchantDisputes(seller.address,store.store_id);
 assert.equal(pending.items[0].marketDisputed,false);
 assert.equal(pending.items[0].arbitrationCaseOpened,false);
 order.status='6';order.disputeHash=b32(702);
 const confirmed=await f.service.merchantDisputes(seller.address,store.store_id);
 assert.equal(confirmed.items[0].marketDisputed,true);
 assert.equal(confirmed.items[0].state,'MARKET_DISPUTE_FINALIZED');
 assert.equal(confirmed.items[0].remedyExecuted,false);
 await assert.rejects(()=>f.service.merchantRemedy(seller.address,store.store_id,attempt.attemptId,'dispute',request),e=>e.code==='dispute_not_eligible');
});
test('COM-6B rejects cross-store, buyer, other wallet, forged evidence and conflicting requests',async t=>{
 const f=setup();t.after(()=>f.close());const {store,attempt,order}=await checkout(f);order.status='3';f.orders.set(attempt.orderId,order);
 await assert.rejects(()=>f.service.merchantRemedy(buyer.address,store.store_id,attempt.attemptId,'dispute',{disputeHash:b32(8)}),e=>e.code==='forbidden');
 await assert.rejects(()=>f.service.merchantRemedy(attacker.address,store.store_id,attempt.attemptId,'dispute',{disputeHash:b32(8)}),e=>e.code==='forbidden');
 for(const invalid of [{},{disputeHash:b32(0)},{disputeHash:b32(8),admin:true}])await assert.rejects(()=>f.service.merchantRemedy(seller.address,store.store_id,attempt.attemptId,'dispute',invalid));
 await f.service.merchantRemedy(seller.address,store.store_id,attempt.attemptId,'dispute',{disputeHash:b32(8)});
 await assert.rejects(()=>f.service.merchantRemedy(seller.address,store.store_id,attempt.attemptId,'dispute',{disputeHash:b32(9)}),e=>e.code==='dispute_conflict');
 order.status='6';order.disputeHash=b32(9);
 await assert.rejects(()=>f.service.merchantDisputes(seller.address,store.store_id),e=>e.code==='dispute_commitment_mismatch');
 await assert.rejects(()=>f.service.merchantDisputes(attacker.address,store.store_id),e=>e.code==='forbidden');
});
test('COM-6B refuses expired market eligibility and noncanonical seller',async t=>{
 const f=setup();t.after(()=>f.close());const {store,attempt,order}=await checkout(f);f.orders.set(attempt.orderId,order);
 for(const state of ['1','4','5','6','7']){order.status=state;await assert.rejects(()=>f.service.merchantRemedy(seller.address,store.store_id,attempt.attemptId,'dispute',{disputeHash:b32(5)}),e=>e.code==='dispute_not_eligible');}
 order.status='2';order.seller=attacker.address.toLowerCase();
 await assert.rejects(()=>f.service.merchantRemedy(seller.address,store.store_id,attempt.attemptId,'dispute',{disputeHash:b32(5)}),e=>e.code==='dispute_party_mismatch');
});
