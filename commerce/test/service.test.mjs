import test from 'node:test';
import assert from 'node:assert/strict';
import { Database } from '../src/database.mjs';
import { setup,published,checkout,seller,buyer,attacker,b32,NOW } from './fixtures.mjs';
const rejects=(fn,code)=>assert.rejects(fn,error=>error.code===code);
test('transactional schema migrates once, survives restart and rolls back all rows on failure',t=>{
  const f=setup();t.after(()=>f.close());
  assert.throws(()=>f.db.transaction(()=>{f.db.run('INSERT INTO audit_log VALUES(1,\'test\',NULL,\'test\',\'x\',0)');throw new Error('crash');}));
  assert.equal(f.db.all('SELECT * FROM audit_log').length,0);
  const reopened=new Database(f.file);assert.equal(reopened.get('SELECT MAX(version) AS v FROM migrations').v,6);reopened.close();
});
test('merchant binding and unique slugs fail closed; fresh controller and active state checked on writes',async t=>{
  const f=setup();t.after(()=>f.close());
  await rejects(()=>f.service.createStore(attacker.address,{merchantId:b32(1),slug:'test-store'}),'forbidden');
  const store=await f.service.createStore(seller.address,{merchantId:b32(1),slug:'test-store'});
  await assert.rejects(()=>f.service.createStore(seller.address,{merchantId:b32(1),slug:'other-store'}));
  f.setController(attacker.address);await rejects(()=>f.service.branding(seller.address,store.store_id,{version:1,theme:'default',description:'text'}),'forbidden');
  f.setActive(false);await rejects(()=>f.service.updateStore(attacker.address,store.store_id,{version:1,slug:'test-store',status:'published'}),'inactive_merchant');
});
test('tenant IDOR and unknown financial fields cannot cross scope or redirect payout',async t=>{
  const f=setup();t.after(()=>f.close());const {store}=await published(f);
  await rejects(()=>f.service.product(attacker.address,store.store_id,{sku:'X',description:'text',media:[],publishState:'draft'}),'forbidden');
  await rejects(()=>f.service.updateStore(seller.address,store.store_id,{version:2,slug:'test-store',status:'published',payout:attacker.address}),'unknown_field');
  await rejects(()=>f.service.branding(seller.address,store.store_id,{version:1,theme:'default',description:'<script>alert(1)</script>'}),'invalid_text');
  assert.equal(f.db.all('SELECT * FROM products').length,1);
});
test('delegates have narrow, expiring and controller-bound rights; cannot publish or read PII',async t=>{
  const f=setup();t.after(()=>f.close());const {store}=await published(f);
  await rejects(()=>f.service.delegate(seller.address,store.store_id,{wallet:attacker.address,scopes:['payment'],expiresAt:NOW+10000}),'invalid_scope');
  await f.service.delegate(seller.address,store.store_id,{wallet:attacker.address,scopes:['branding'],expiresAt:NOW+10000});
  await f.service.branding(attacker.address,store.store_id,{version:1,theme:'dark',description:'delegate'});
  await rejects(()=>f.service.updateStore(attacker.address,store.store_id,{version:2,slug:'test-store',status:'draft'}),'forbidden');
  await rejects(()=>f.service.access(attacker.address,store.store_id,'delivery'),'forbidden');
  f.advance(10001);await rejects(()=>f.service.branding(attacker.address,store.store_id,{version:2,theme:'dark',description:'expired'}),'forbidden');
  f.setController(buyer.address);await rejects(()=>f.service.access(attacker.address,store.store_id,'branding'),'forbidden');
});
test('optimistic version race permits one update and rejects stale writers without lost data',async t=>{
  const f=setup();t.after(()=>f.close());const {store}=await published(f);
  const results=await Promise.allSettled(['first','second'].map(description=>f.service.branding(seller.address,store.store_id,{version:1,theme:'default',description})));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'version_conflict');assert.equal(f.db.get('SELECT version FROM store_branding').version,2);
});
test('draft/published catalogue, committed metadata and fresh listing revision are distinct',async t=>{
  const f=setup();t.after(()=>f.close());const {store,product,listing}=await published(f);
  assert.equal(f.service.search().items[0].listing,null);assert.equal(f.service.search().items[0].availability,'canonical_reservation_required');
  const input={id:product.product_id,version:2,sku:'PRODUCT',description:'tampered',media:[],publishState:'published',listingId:b32(2),revision:1};
  await rejects(()=>f.service.product(seller.address,store.store_id,input),'listing_binding');
  listing.revision='2';input.description='A product';await rejects(()=>f.service.product(seller.address,store.store_id,input),'listing_binding');
  assert.equal(f.service.search({query:"' OR 1=1 --"}).items.length,0);
  assert.throws(()=>f.service.search({limit:101}),e=>e.code==='invalid_integer');
  await f.service.updateStore(seller.address,store.store_id,{version:2,slug:'test-store',status:'draft'});assert.equal(f.service.search().items.length,0);assert.equal(f.service.publicStores().items.length,0);
});
test('categories enforce tenant ancestry, global taxonomy separation and bounded tree',async t=>{
  const f=setup();t.after(()=>f.close());const {store}=await published(f);
  const parent=await f.service.category(seller.address,store.store_id,{slug:'parent-menu',order:0,visibility:'public'});
  const child=await f.service.category(seller.address,store.store_id,{slug:'child-menu',order:1,visibility:'public',parent:parent.category_id});
  await rejects(()=>f.service.category(seller.address,store.store_id,{id:parent.category_id,version:1,slug:'parent-menu',order:0,visibility:'public',parent:child.category_id}),'category_parent');
  await rejects(()=>f.service.category(seller.address,store.store_id,{slug:'global-menu',order:0,visibility:'public',globalTaxonomy:parent.category_id}),'global_taxonomy');
  assert.equal(f.service.publicStore('test-store').categories.length,0);
  await f.service.updateStore(seller.address,store.store_id,{version:2,slug:'test-store',status:'published'});
  assert.equal(f.service.publicStore('test-store').categories.length,2);
});
test('approved global taxonomy remains separate from merchant menus and cannot delete a referenced taxonomy',async t=>{
  const f=setup();t.after(()=>f.close());const {store}=await published(f),taxonomy='a'.repeat(64);f.service.reconcileTaxonomy([{id:taxonomy,slug:'global-goods',order:0}]);assert.equal(f.service.globalCategories().items.length,1);
  await f.service.category(seller.address,store.store_id,{slug:'store-goods',order:0,visibility:'public',globalTaxonomy:taxonomy});assert.throws(()=>f.service.reconcileTaxonomy([]),e=>e.code==='taxonomy_in_use');assert.equal(f.service.globalCategories().items.length,1);
});
test('fresh inventory API reports Market counts without creating a Commerce reservation',async t=>{
  const f=setup();t.after(()=>f.close());const {product,listing}=await published(f);listing.available='7';listing.inventory={originalOffered:'10',reserved:'2',sold:'1',released:'0',initialized:true};
  const inventory=await f.service.availability(product.product_id);assert.equal(inventory.available,'7');assert.equal(inventory.inventory.reserved,'2');assert.equal(inventory.reservationRequired,true);assert.equal(f.db.get('SELECT COUNT(*) AS n FROM checkout_attempts').n,0);
});
test('variants map distinct canonical listings, never share or invent finite stock',async t=>{
  const f=setup();t.after(()=>f.close());const {store,product,listing}=await published(f);
  await rejects(()=>f.service.variant(seller.address,store.store_id,product.product_id,{options:{size:'large'},sku:'L',listingId:b32(2)}),'variant_stock_alias');
  f.listings.set(b32(4),{...listing});
  const variant=await f.service.variant(seller.address,store.store_id,product.product_id,{options:{size:'large'},sku:'L',listingId:b32(4)});assert.equal(variant.canonical_listing_id,b32(4));
  await assert.rejects(()=>f.service.variant(seller.address,store.store_id,product.product_id,{options:{size:'small'},sku:'S',listingId:b32(4)}));
});
test('cart and checkout are noncustodial, revision pinned, durable and idempotent',async t=>{
  const f=setup();t.after(()=>f.close());const {cart,plan}=await checkout(f);
  assert.equal(cart.reserved,false);assert.equal(plan.paid,false);assert.equal(plan.attempts[0].paymentAllowed,false);assert.equal(plan.attempts[0].intent.method,'createOrder');
  const repeated=await f.service.prepare(buyer.address,{cartId:cart.cart_id,cartVersion:1,idempotencyKey:'abcdefghijklmnop'});assert.deepEqual(repeated,plan);
  assert.equal(f.db.get('SELECT COUNT(*) AS n FROM checkout_attempts').n,1);
  await rejects(()=>f.service.prepare(attacker.address,{cartId:cart.cart_id,cartVersion:1,idempotencyKey:'abcdefghijklmnop'}),'cart_unavailable');
  f.advance(120001);await rejects(()=>f.service.prepare(buyer.address,{cartId:cart.cart_id,cartVersion:1,idempotencyKey:'abcdefghijklmnop'}),'idempotency_conflict');
});
test('concurrent identical prepares return one attempt; underscore idempotency keys have literal scope',async t=>{
  const f=setup();t.after(()=>f.close());const {store}=await published(f),cart=f.service.cart(buyer.address,{storeId:store.store_id,lines:[{listingId:b32(2),revision:1,quantity:'1'}]}),input={cartId:cart.cart_id,cartVersion:1,idempotencyKey:'abcdefghijklmnop_'};
  const plans=await Promise.all([f.service.prepare(buyer.address,input),f.service.prepare(buyer.address,input)]);assert.deepEqual(plans[0],plans[1]);const different=await f.service.prepare(buyer.address,{...input,idempotencyKey:'abcdefghijklmnopX'});assert.notEqual(different.attempts[0].orderId,plans[0].attempts[0].orderId);assert.equal(f.db.get('SELECT COUNT(*) AS n FROM checkout_attempts').n,2);
});
for(const [name,change] of Object.entries({revision:{revision:'2'},stock:{available:'0'},policy:{policyActive:false},adapter:{adapterActive:false},reporter:{reporterActive:false},expiry:{expiresAt:'1'},seller:{seller:attacker.address.toLowerCase()},auction:{saleMechanism:b32(123)}}))test(`checkout rejects canonical ${name} mismatch before any payment or order claim`,async t=>{
  const f=setup();t.after(()=>f.close());const {store,listing}=await published(f);Object.assign(listing,change);
  const cart=f.service.cart(buyer.address,{storeId:store.store_id,lines:[{listingId:b32(2),revision:1,quantity:'1'}]});
  await rejects(()=>f.service.prepare(buyer.address,{cartId:cart.cart_id,cartVersion:1,idempotencyKey:'abcdefghijklmnop'}),'listing_unavailable');assert.equal(f.db.get('SELECT COUNT(*) AS n FROM checkout_attempts').n,0);
});
test('multi-line cart prepares distinct canonical Market orders without a synthetic aggregate',async t=>{
  const f=setup();t.after(()=>f.close());const {store,listing}=await published(f);
  const draft=await f.service.product(seller.address,store.store_id,{sku:'SECOND',description:'Second',media:[],publishState:'draft'});f.listings.set(b32(4),{...listing,metadataHash:draft.metadata_hash});await f.service.product(seller.address,store.store_id,{id:draft.product_id,version:1,sku:'SECOND',description:'Second',media:[],publishState:'published',listingId:b32(4),revision:1});
  const cart=f.service.cart(buyer.address,{storeId:store.store_id,lines:[{listingId:b32(2),revision:1,quantity:'1'},{listingId:b32(4),revision:1,quantity:'2'}]});
  const plan=await f.service.prepare(buyer.address,{cartId:cart.cart_id,cartVersion:1,idempotencyKey:'abcdefghijklmnop'});assert.equal(plan.attempts.length,2);assert.notEqual(plan.attempts[0].orderId,plan.attempts[1].orderId);assert.equal(plan.attempts[1].intent.args[5],'200');
});
test('reservation failure, included payment, forged receipt and unrelated order never produce paid',async t=>{
  const f=setup();t.after(()=>f.close());const {attempt,order}=await checkout(f);
  assert.equal((await f.service.status(buyer.address,attempt.attemptId)).paid,false);
  f.orders.set(attempt.orderId,order);const pending=await f.service.status(buyer.address,attempt.attemptId);assert.equal(pending.state,'MERCHANT_INVOICE_PENDING');assert.equal(pending.paid,false);
  order.buyer=attacker.address.toLowerCase();await rejects(()=>f.service.status(buyer.address,attempt.attemptId),'order_correlation');order.buyer=buyer.address.toLowerCase();
  await rejects(()=>f.service.status(attacker.address,attempt.attemptId),'forbidden');
  f.invoices.set(b32(900),{active:true,merchantId:b32(1),merchant:seller.address.toLowerCase(),amount:'100',currency:'0x343230',mode:'0',acceptance:'1',partialPayments:false,expiresAt:'0'});
  assert.equal((await f.service.status(buyer.address,attempt.attemptId)).state,'PAYMENT_SIGNATURE_REQUIRED');
  order.status='2';order.paymentRef=b32(901);const payment={invoiceId:b32(900),payer:buyer.address.toLowerCase(),merchant:seller.address.toLowerCase(),settlementAsset:order.paymentAsset,settlementAmount:'100',receiptHash:b32(55),status:'2',refundedAmount:'0',tipAmount:'0'};f.payments.set(b32(901),payment);
  await rejects(()=>f.service.status(buyer.address,attempt.attemptId),'payment_finality');payment.status='5';assert.equal((await f.service.status(buyer.address,attempt.attemptId)).paid,true);
  payment.status='7';payment.refundedAmount='25';assert.equal((await f.service.status(buyer.address,attempt.attemptId)).state,'PAID');
  order.status='7';await rejects(()=>f.service.status(buyer.address,attempt.attemptId),'payment_finality');payment.status='6';payment.refundedAmount='100';assert.equal((await f.service.status(buyer.address,attempt.attemptId)).paid,false);
});
test('private delivery encrypted, purpose-scoped, audited and physically purged on retention',async t=>{
  const f=setup();t.after(()=>f.close());const {attempt,order}=await checkout(f);
  await rejects(()=>f.service.putDelivery(buyer.address,attempt.attemptId,{address:'PRIVATE STREET',contact:'PRIVATE PHONE'}),'unreserved_delivery');f.orders.set(attempt.orderId,order);
  await f.service.putDelivery(buyer.address,attempt.attemptId,{address:'PRIVATE STREET',contact:'PRIVATE PHONE'});
  const bytes=Buffer.from(f.db.get('SELECT encrypted_payload FROM customer_delivery').encrypted_payload);assert.equal(bytes.includes(Buffer.from('PRIVATE')),false);assert.equal(JSON.stringify(f.service.search()).includes('PRIVATE'),false);assert.equal(JSON.stringify(f.db.all('SELECT * FROM audit_log')).includes('PRIVATE'),false);
  await rejects(()=>f.service.readDelivery(attacker.address,attempt.attemptId),'forbidden');assert.equal((await f.service.readDelivery(seller.address,attempt.attemptId)).address,'PRIVATE STREET');
  f.setController(attacker.address);await rejects(()=>f.service.readDelivery(seller.address,attempt.attemptId),'forbidden');f.advance(30*86400000+1);assert.equal(f.service.purge(),1);assert.equal(f.db.get('SELECT COUNT(*) AS n FROM customer_delivery').n,0);
});
test('unknown ancestry halt blocks all merchant and checkout sensitive writes',async t=>{
  const f=setup();t.after(()=>f.close());const {store}=await published(f);f.db.run('UPDATE projection_checkpoints SET halted=1');
  await rejects(()=>f.service.branding(seller.address,store.store_id,{version:1,theme:'default',description:'no'}),'projection_halted');
  f.db.run('UPDATE projection_checkpoints SET halted=0');f.setOutage(true);await assert.rejects(()=>f.service.branding(seller.address,store.store_id,{version:1,theme:'default',description:'no'}));assert.equal(f.db.get('SELECT version FROM store_branding').version,1);
});
