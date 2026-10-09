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
 assert.equal(stats.scope,'all_local_checkout_attempts_at_finalized_block');
 assert.equal(stats.partial,false);
 await assert.rejects(()=>f.service.merchantRemedy(seller.address,store.store_id,attempt.attemptId,'refund'),e=>e.code==='refund_not_authorized');
 await assert.rejects(()=>f.service.merchantRemedy(seller.address,store.store_id,attempt.attemptId,'dispute',{disputeHash:b32(406)}),e=>e.code==='dispute_not_eligible');
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
 assert.equal(refund.executed,false);assert.equal(refund.proposal.amount,'100');assert.equal(refund.proposal.remainingAfterProposal,'0');
 assert.equal(refund.proposal.requestState,'PENDING_GOVERNANCE');
 assert.equal(f.db.get('SELECT COUNT(*) AS n FROM refund_requests').n,1);
 const repeat=await f.service.merchantRemedy(seller.address,store.store_id,attempt.attemptId,'refund',{amount:'100',reasonHash:b32(404)});
 assert.equal(repeat.proposal.requestId,refund.proposal.requestId);
 assert.equal(f.db.get('SELECT COUNT(*) AS n FROM refund_requests').n,1);
 const before=await f.service.merchantRefunds(seller.address,store.store_id);
 assert.equal(before.items[0].fundsReturned,false);
 assert.equal(before.refundAuthority,'UNBOUND_REFUND_MANAGER');
 f.source.fundedRefund=async()=>({executed:true,record:{paymentId:b32(901),settlementAsset:order.paymentAsset,recipient:buyer.address.toLowerCase(),amount:'100',reasonHash:b32(404)}});
 await assert.rejects(()=>f.service.merchantRefunds(seller.address,store.store_id),e=>e.code==='refund_pay_correlation');
 f.payments.get(b32(901)).refundedAmount='100';
 const completed=await f.service.merchantRefunds(seller.address,store.store_id);
 assert.equal(completed.items[0].fundsReturned,true);
 assert.equal(completed.items[0].state,'FUNDS_RETURNED_MARKET_REPORT_PENDING');
 assert.equal(completed.items[0].marketReported,false);
 f.orders.get(attempt.orderId).status='7';
 f.source.marketRefundReported=async()=>true;
 const reconciled=await f.service.merchantRefunds(seller.address,store.store_id);
 assert.equal(reconciled.items[0].state,'FUNDED_REFUND_MARKET_RECONCILED');
 assert.equal(reconciled.items[0].marketReported,true);
 f.orders.get(attempt.orderId).status='2';
 f.source.marketRefundReported=null;
 assert.equal(completed.items[0].refundId,'0x'+refund.proposal.requestId);
 assert.equal(completed.provenance.finalized,true);
 f.source.fundedRefund=async()=>({executed:true,record:{paymentId:b32(901),settlementAsset:order.paymentAsset,recipient:attacker.address.toLowerCase(),amount:'100',reasonHash:b32(404)}});
 await assert.rejects(()=>f.service.merchantRefunds(seller.address,store.store_id),e=>e.code==='refund_proof_mismatch');
 f.source.fundedRefund=null;
 await assert.rejects(()=>f.service.merchantRefunds(attacker.address,store.store_id),e=>e.code==='forbidden');
 await assert.rejects(()=>f.service.merchantRemedy(seller.address,store.store_id,attempt.attemptId,'refund',{amount:'1',reasonHash:b32(405)}),e=>e.code==='refund_exceeds_available');
assert.equal(refund.refunded,false);assert.equal(refund.authority,'Pay.RefundManager420');
 const dispute=await f.service.merchantRemedy(seller.address,store.store_id,attempt.attemptId,'dispute',{disputeHash:b32(406)});
 assert.equal(dispute.executed,false);assert.equal(dispute.disputed,false);
 assert.equal(order.status,'2');assert.equal(f.payments.get(b32(901)).status,'5');
 await assert.rejects(()=>f.service.merchantRemedy(buyer.address,store.store_id,attempt.attemptId,'refund'),e=>e.code==='forbidden');
});
test('COM-6 optional identity, names, notifications and external analytics fail closed, without pretending verified credential',async t=>{
 const f=setup();t.after(()=>f.close());const {store}=await checkout(f);
 const adapters=await f.service.merchantIntegrations(seller.address,store.store_id);
 assert.equal(adapters.notifications.status,'LOCAL_OPT_IN_FEED_ONLY');
 assert.equal(adapters.notifications.externalDelivery,'NOT_CONFIGURED');
 assert.equal(adapters.notifications.sideEffects,false);
 assert.equal(adapters.names.status,'NOT_VERIFIED');
 assert.equal(adapters.identity.status,'NOT_VERIFIED');
 assert.equal(adapters.analytics.status,'LOCAL_FINALIZED_PROJECTION');
 await assert.rejects(()=>f.service.merchantIntegrations(attacker.address,store.store_id),e=>e.code==='forbidden');
});

test('COM-6E aggregates more than 100 attempts without silent preview truncation',async t=>{
 const f=setup();t.after(()=>f.close());const {store,attempt,order}=await checkout(f);
 f.orders.set(attempt.orderId,order);
 for(let i=1;i<105;i++){
   const attemptId=b32(20000+i).slice(2);
   const orderId=b32(30000+i);
   f.db.run('INSERT INTO checkout_attempts SELECT ?,cart_id,customer_scope,merchant_id,network_id,?,listing_id,listing_revision,quantity,seller,asset,total,payment_id,quote_id,?,request_hash,state,expires_at FROM checkout_attempts WHERE attempt_id=?',attemptId,orderId,'generated-'+i,attempt.attemptId);
   f.orders.set(orderId,{...order});
 }
 const stats=await f.service.merchantAnalytics(seller.address,store.store_id);
 assert.equal(stats.totals.orders,105);
 assert.equal(stats.partial,false);
 assert.equal(stats.scope,'all_local_checkout_attempts_at_finalized_block');
 assert.equal(stats.totals.paid,0);
 await assert.rejects(()=>f.service.merchantAnalytics(attacker.address,store.store_id),e=>e.code==='forbidden');
});

test('COM-6E fails closed if finalized RPC snapshot changes during aggregation',async t=>{
 const f=setup();t.after(()=>f.close());const {store,attempt,order}=await checkout(f);
 f.orders.set(attempt.orderId,order);
 const original=f.source.order;
 f.source.order=async key=>{const value=await original(key);f.source.blockHash=b32(700);return value;};
 await assert.rejects(()=>f.service.merchantAnalytics(seller.address,store.store_id),e=>e.code==='analytics_snapshot_changed');
});
