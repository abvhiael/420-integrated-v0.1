import test from 'node:test';
import {request} from 'node:http';
import assert from 'node:assert/strict';
import { createCommerceSdk420 } from '../../packages/420-sdk/dist/index.js';
import { commerceServer } from '../src/http.mjs';
import { RequestAuth } from '../src/security.mjs';
import sharp from 'sharp';
import { setup,checkout,published,seller,buyer,attacker,b32 } from './fixtures.mjs';
async function running(t,{rateLimit=120}={}){
  const f=setup(),origin='https://commerce.example.invalid',auth=new RequestAuth(f.db,{origin,chainId:'420',now:f.now}),server=commerceServer(f.service,auth,{origin,now:f.now,rateLimit});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const baseUrl='http://127.0.0.1:'+server.address().port;
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));f.close();});
  const sdk=wallet=>createCommerceSdk420({baseUrl,origin,chainId:'420',now:f.now,...wallet?{wallet}:{}});
  return {...f,origin,baseUrl,sdk};
}
test('SDK against real HTTP/SQLite: anonymous browsing and signed merchant catalogue mutations',async t=>{
  const f=await running(t),sdk=f.sdk(seller);const store=await sdk.createStore(b32(1),'sdk-store');
  await sdk.branding(store.store_id,{version:1,theme:'dark',description:'SDK description'});await sdk.updateStore(store.store_id,{version:1,status:'published',slug:'sdk-store'});
  const anonymous=f.sdk();assert.equal((await anonymous.storefronts()).items[0].slug,'sdk-store');assert.equal((await anonymous.storefront('sdk-store')).public_description,'SDK description');
  const product=await sdk.saveProduct(store.store_id,{sku:'DRAFT',description:'draft description',media:[],publishState:'draft'});assert.ok(product.metadata_hash);assert.equal((await anonymous.search()).items.length,0);
  assert.ok((await sdk.merchantStore(store.store_id)).products.length);
  await assert.rejects(()=>f.sdk(attacker).branding(store.store_id,{version:2,theme:'dark',description:'IDOR'}),e=>e.code==='forbidden'&&e.status===403);
  await assert.rejects(()=>anonymous.createStore(b32(1),'anonymous-store'),e=>e.code==='wallet_required');
});
test('SDK checkout resume and encrypted delivery round-trip through actual routes',async t=>{
  const f=await running(t),state=await checkout(f),sdk=f.sdk(buyer);assert.equal((await sdk.checkoutStatus(state.attempt.attemptId)).paid,false);f.orders.set(state.attempt.orderId,state.order);
  await sdk.saveDelivery(state.attempt.attemptId,{address:'Private address',contact:'Private contact'});assert.equal((await sdk.delivery(state.attempt.attemptId)).address,'Private address');await assert.rejects(()=>f.sdk(attacker).delivery(state.attempt.attemptId),e=>e.status===403);
  assert.equal((await f.sdk().product(state.product.product_id)).items[0].product_id,state.product.product_id);
});
test('HTTP denies unsigned/cross-origin writes, malformed JSON, duplicate/unknown query, oversize and unknown paths',async t=>{
  const f=await running(t);
  for(const [path,init,status] of [['/v1/merchant/storefronts',{method:'POST',headers:{Origin:f.origin,'Content-Type':'application/json'},body:'{}'},400],['/v1/storefronts?limit=2&limit=3',{},400],['/v1/search?sql=DROP',{},400],['/v1/health',{headers:{Origin:'https://evil.invalid'}},403],['/v1/auth/challenge',{method:'POST',headers:{'Content-Type':'application/json'},body:'not json'},400],['/v1/auth/challenge',{method:'POST',headers:{'Content-Type':'application/json'},body:'x'.repeat(65537)},413],['/v1/not-found',{},403],['/v1/storefronts',{method:'DELETE'},405]]){const response=await fetch(f.baseUrl+path,init);assert.equal(response.status,status,path);assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.equal(response.headers.get('cache-control'),'no-store');assert.equal((await response.text()).includes('Private'),false);}
});
test('HTTP rate limit enforced and resets without trusting forwarded headers',async t=>{
  const f=await running(t,{rateLimit:2});assert.equal((await fetch(f.baseUrl+'/v1/health')).status,200);assert.equal((await fetch(f.baseUrl+'/v1/health')).status,200);assert.equal((await fetch(f.baseUrl+'/v1/health',{headers:{'X-Forwarded-For':'10.0.0.9'}})).status,429);f.advance(60001);assert.equal((await fetch(f.baseUrl+'/v1/health')).status,200);
});
test('SDK detects wrong-chain challenges and never signs or sends a write',async t=>{
  const f=await running(t);let signed=false;const sdk=createCommerceSdk420({baseUrl:f.baseUrl,origin:f.origin,chainId:'421',now:f.now,wallet:{address:seller.address,signMessage:async()=>{signed=true;return '0x';}}});await assert.rejects(()=>sdk.createStore(b32(1),'test-store'),e=>e.code==='challenge_mismatch');assert.equal(signed,false);
});
test('public media cannot enumerate draft or unattached merchant objects',async t=>{
  const f=await running(t),{store}=await published(f);assert.throws(()=>f.service.publicMedia('a'.repeat(64)),e=>e.status===404);assert.equal((await fetch(f.baseUrl+'/v1/media/'+'a'.repeat(64))).status,404);assert.ok(store.store_id);
});
test('draft media preview is protected and narrow branding delegates can read their section versions',async t=>{
  const f=await running(t),sdk=f.sdk(seller),store=await sdk.createStore(b32(1),'private-media');
  const png=await sharp({create:{width:2,height:2,channels:3,background:'#000'}}).png().toBuffer(),media=await sdk.upload(store.store_id,png,'image/png');assert.equal((await sdk.merchantMedia(store.store_id,media.objectId)).contentType,'image/png');assert.equal((await fetch(f.baseUrl+'/v1/media/'+media.objectId)).status,404);
  await sdk.delegate(store.store_id,{wallet:attacker.address,scopes:['branding'],expiresAt:f.now()+10000});const editor=f.sdk(attacker);assert.equal((await editor.merchantSection(store.store_id,'branding')).version,1);await assert.rejects(()=>editor.merchantMedia(store.store_id,media.objectId),e=>e.status===403);await assert.rejects(()=>editor.merchantSection(store.store_id,'products'),e=>e.status===403);
});
test('browser signed GET with forbidden Origin omitted requires exact same-origin Fetch and Host, retains signature and tenant checks',async t=>{
  const f=await running(t),sdk=f.sdk(seller),store=await sdk.createStore(b32(1),'browser-get');
  const fetcher=async(url,init)=>{if(init?.method==='GET'){const headers=new Headers(init.headers);headers.delete('Origin');headers.set('Sec-Fetch-Site','same-origin');return fetch(url,{...init,headers});}return fetch(url,init);};
  const browser=createCommerceSdk420({baseUrl:f.baseUrl,origin:f.origin,chainId:'420',now:f.now,wallet:seller,fetcher});
  // Different proxy Host cannot claim same origin. The production reverse proxy must preserve configured Host.
  await assert.rejects(()=>browser.merchantBuilder(store.store_id),e=>e.code==='origin_mismatch');
  const good=async(url,init)=>{if(init?.method==='GET'){const headers=new Headers(init.headers);headers.delete('Origin');headers.set('Sec-Fetch-Site','same-origin');headers.set('Host',new URL(f.origin).host);return new Promise((resolve,reject)=>{const req=request(url,{method:'GET',headers:Object.fromEntries(headers)},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:res.statusCode})));});req.on('error',reject);req.end();});}return fetch(url,init);};
  assert.ok((await createCommerceSdk420({baseUrl:f.baseUrl,origin:f.origin,chainId:'420',now:f.now,wallet:seller,fetcher:good}).merchantBuilder(store.store_id)).permissions.includes('publish'));
  const cross=async(url,init)=>{if(init?.method==='GET'){const headers=new Headers(init.headers);headers.delete('Origin');headers.set('Sec-Fetch-Site','cross-site');headers.set('Host',new URL(f.origin).host);return fetch(url,{...init,headers});}return fetch(url,init);};
  await assert.rejects(()=>createCommerceSdk420({baseUrl:f.baseUrl,origin:f.origin,chainId:'420',now:f.now,wallet:seller,fetcher:cross}).merchantBuilder(store.store_id),e=>e.code==='origin_mismatch');
});

test('COM-6B signed SDK/HTTP dispute route never bypasses seller or Market authority',async t=>{
 const f=await running(t),state=await checkout(f),sdk=f.sdk(seller);
 state.order.status='2';f.orders.set(state.attempt.orderId,state.order);
 const prepared=await sdk.merchantRemedy(state.store.store_id,state.attempt.attemptId,'dispute',{disputeHash:b32(702)});
 assert.equal(prepared.proposal.intent.method,'disputeOrder');
 assert.equal(prepared.proposal.arbitrationCaseOpened,false);
 const pending=await sdk.merchantDisputes(state.store.store_id);
 assert.equal(pending.items[0].marketDisputed,false);
 await assert.rejects(()=>f.sdk(attacker).merchantDisputes(state.store.store_id),e=>e.code==='forbidden');
 await assert.rejects(()=>f.sdk(buyer).merchantRemedy(state.store.store_id,state.attempt.attemptId,'dispute',{disputeHash:b32(702)}),e=>e.code==='forbidden');
 state.order.status='6';state.order.disputeHash=b32(702);
 const final=await sdk.merchantDisputes(state.store.store_id);
 assert.equal(final.items[0].state,'MARKET_DISPUTE_FINALIZED');
 await assert.rejects(()=>sdk.arbitrationPrepare(state.store.store_id,state.attempt.attemptId,{remedyHash:b32(703)}),e=>e.code==='arbitration_unavailable');
});

test('COM-6C signed SDK/HTTP notifications require merchant controller, opt-in and carry no execution authority',async t=>{
 const f=await running(t),{store}=await checkout(f),owner=f.sdk(seller);
 assert.equal((await owner.merchantNotificationPreferences(store.store_id)).enabled,false);
 const consent=await owner.setMerchantNotificationPreferences(store.store_id,true);
 assert.equal(consent.enabled,true);assert.equal(consent.externalDelivery,'NOT_CONFIGURED');
 assert.deepEqual((await owner.merchantNotifications(store.store_id)).items,[]);
 await assert.rejects(()=>f.sdk(attacker).merchantNotifications(store.store_id),e=>e.code==='forbidden');
 await assert.rejects(()=>f.sdk(attacker).setMerchantNotificationPreferences(store.store_id,false),e=>e.code==='forbidden');
 await assert.rejects(()=>f.sdk(buyer).merchantNotificationPreferences(store.store_id),e=>e.code==='forbidden');
 const stopped=await owner.setMerchantNotificationPreferences(store.store_id,false);
 assert.equal(stopped.enabled,false);assert.equal((await owner.merchantNotifications(store.store_id)).authoritative,false);
});

test('COM-7 security headers and strict numeric pagination reject ambiguous inputs',async t=>{
 const f=await running(t),anonymous=f.sdk();
 const healthy=await fetch(f.baseUrl+'/v1/health');
 assert.equal(healthy.headers.get('x-frame-options'),'DENY');
 assert.match(healthy.headers.get('permissions-policy'),/geolocation=\(\)/);
 assert.equal(healthy.headers.get('strict-transport-security'),'max-age=31536000');
 for(const value of ['','+1','01','1e2','-1','NaN','Infinity','1.5']){
  const res=await fetch(f.baseUrl+'/v1/storefronts?limit='+value);
  assert.equal(res.status,400,'rejected limit '+value);
 }
 assert.ok((await anonymous.storefronts()).items);
});
