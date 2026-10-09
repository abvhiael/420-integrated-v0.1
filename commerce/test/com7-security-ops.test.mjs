import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,checkout,seller,buyer,attacker,b32} from './fixtures.mjs';

// COM-7: a burst of identical browser retries cannot mint separate local
// checkout plans. Only the canonical Market transaction reserves inventory.
test('COM-7 checkout retry burst is idempotent and cannot reserve SQL stock',async t=>{
 const f=setup();t.after(()=>f.close());
 const {store,attempt,cart}=await checkout(f);
 const before=f.db.get('SELECT COUNT(*) AS n FROM checkout_attempts').n;
 const pending=Array.from({length:20},()=>f.service.prepare(buyer.address,{cartId:cart.cart_id,cartVersion:1,idempotencyKey:'abcdefghijklmnop'}));
 const outcomes=await Promise.all(pending);
 assert.equal(f.db.get('SELECT COUNT(*) AS n FROM checkout_attempts').n,before);
 assert.ok(outcomes.every(x=>x.attempts.length===1&&x.attempts[0].orderId===attempt.orderId));
 assert.ok(outcomes.every(x=>x.paid===false&&x.attempts[0].reserved===false));
 assert.ok(store.store_id);
});

test('COM-7 rotated controller loses read and refund privileges without cached authorization',async t=>{
 const f=setup();t.after(()=>f.close());
 const {store,attempt,order}=await checkout(f);
 f.orders.set(attempt.orderId,order);
 assert.equal((await f.service.merchantAnalytics(seller.address,store.store_id)).totals.orders,1);
 f.setController(attacker.address);
 await assert.rejects(()=>f.service.merchantAnalytics(seller.address,store.store_id),e=>e.code==='forbidden');
 await assert.rejects(()=>f.service.merchantRemedy(seller.address,store.store_id,attempt.attemptId,'refund'),e=>e.code==='forbidden');
 await assert.rejects(()=>f.service.merchantNotifications(seller.address,store.store_id),e=>e.code==='forbidden');
});

test('COM-7 canonical RPC outage halts sensitive operations without marking payment as completed',async t=>{
 const f=setup();t.after(()=>f.close());
 const {store,attempt,order}=await checkout(f);f.orders.set(attempt.orderId,order);
 f.setOutage(true);
 await assert.rejects(()=>f.service.status(buyer.address,attempt.attemptId));
 await assert.rejects(()=>f.service.merchantAnalytics(seller.address,store.store_id));
 await assert.rejects(()=>f.service.prepare(buyer.address,{cartId:f.db.get('SELECT cart_id FROM cart_sessions LIMIT 1').cart_id,cartVersion:1,idempotencyKey:'0123456789abcdef'}));
 assert.equal(f.db.get('SELECT COUNT(*) AS n FROM checkout_attempts').n,1);
 assert.equal(f.db.get('SELECT COUNT(*) AS n FROM refund_requests').n,0);
});
