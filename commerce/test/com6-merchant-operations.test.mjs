import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,checkout,buyer,seller,attacker,b32} from './fixtures.mjs';

test('COM-6 tenant owner can view canonical nonfinancial order projections, but buyer and spoofed merchant cannot',async t=>{
 const f=setup();t.after(()=>f.close());const {store,attempt,order}=await checkout(f);
 f.orders.set(attempt.orderId,order);
 const view=await f.service.merchantOperations(seller.address,store.store_id);
 assert.equal(view.totalCount,1);assert.equal(view.items.length,1);
 assert.equal(view.items[0].state,'MERCHANT_INVOICE_PENDING');
 assert.equal(view.items[0].paid,false);
 assert.equal(view.items[0].orderId,attempt.orderId);
 assert.equal(view.provenance.finalized,true);
 await assert.rejects(()=>f.service.merchantOperations(buyer.address,store.store_id),e=>e.code==='forbidden');
 await assert.rejects(()=>f.service.merchantOperations(attacker.address,store.store_id),e=>e.code==='forbidden');
});
test('COM-6 dashboard shows no synthetic settlement or refund on pending order',async t=>{
 const f=setup();t.after(()=>f.close());const {store,attempt,order}=await checkout(f);
 f.orders.set(attempt.orderId,order);
 const stats=await f.service.merchantAnalytics(seller.address,store.store_id);
 assert.equal(stats.totals.orders,1);assert.equal(stats.totals.paid,0);
 assert.deepEqual(stats.byAsset[order.paymentAsset.toLowerCase()],{paidBaseUnits:'0',refundedBaseUnits:'0'});
 assert.equal(stats.scope,'first_100_attempts_only');
 await assert.rejects(()=>f.service.merchantRemedy(seller.address,store.store_id,attempt.attemptId,'refund'),e=>e.code==='refund_not_authorized');
 await assert.rejects(()=>f.service.merchantRemedy(seller.address,store.store_id,attempt.attemptId,'dispute'),e=>e.code==='dispute_not_eligible');
});
test('COM-6 refund and dispute handoff never mutates Pay, Market, receipt, order or balances',async t=>{
 const f=setup();t.after(()=>f.close());const {store,attempt,order}=await checkout(f);
 f.orders.set(attempt.orderId,order);
 f.invoices.set(b32(900),{active:true,merchantId:b32(1),merchant:seller.address.toLowerCase(),amount:'100',currency:'0x343230',mode:'0',acceptance:'1',partialPayments:false,expiresAt:'0'});
 order.status='2';order.paymentRef=b32(901);
 f.payments.set(b32(901),{invoiceId:b32(900),payer:buyer.address.toLowerCase(),merchant:seller.address.toLowerCase(),settlementAsset:order.paymentAsset,settlementAmount:'100',receiptHash:b32(55),status:'5',refundedAmount:'0',tipAmount:'0'});
 const data=await f.service.merchantAnalytics(seller.address,store.store_id);
 assert.equal(data.totals.paid,1);assert.equal(data.byAsset[order.paymentAsset.toLowerCase()].paidBaseUnits,'100');
 const refund=await f.service.merchantRemedy(seller.address,store.store_id,attempt.attemptId,'refund',{amount:'100',reasonHash:b32(404)});
 assert.equal(refund.executed,false);assert.equal(refund.proposal.amount,'100');assert.equal(refund.proposal.remainingAfterProposal,'0');assert.equal(refund.refunded,false);assert.equal(refund.authority,'Pay.RefundManager420');
 const dispute=await f.service.merchantRemedy(seller.address,store.store_id,attempt.attemptId,'dispute');
 assert.equal(dispute.executed,false);assert.equal(dispute.disputed,false);
 assert.equal(order.status,'2');assert.equal(f.payments.get(b32(901)).status,'5');
 await assert.rejects(()=>f.service.merchantRemedy(buyer.address,store.store_id,attempt.attemptId,'refund'),e=>e.code==='forbidden');
});
test('COM-6 optional identity, names, notifications and external analytics fail closed, without pretending verified credential',async t=>{
 const f=setup();t.after(()=>f.close());const {store}=await checkout(f);
 const adapters=await f.service.merchantIntegrations(seller.address,store.store_id);
 assert.equal(adapters.notifications.status,'NOT_CONFIGURED');
 assert.equal(adapters.names.status,'NOT_VERIFIED');
 assert.equal(adapters.identity.status,'NOT_VERIFIED');
 assert.equal(adapters.analytics.status,'LOCAL_FINALIZED_PROJECTION');
 await assert.rejects(()=>f.service.merchantIntegrations(attacker.address,store.store_id),e=>e.code==='forbidden');
});
