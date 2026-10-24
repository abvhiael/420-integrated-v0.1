import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runtimeHttpServer} from '../src/runtime-service.js';
import {HighCountryMarket} from '../src/market.js';
import {BudsLedger,MemoryTransactionFixture} from '../src/buds-ledger.js';

test('ordinary HTTP trades require authenticated session, atomic BUDS, and explicit ordinary mode',async t=>{
 const store=new MemoryTransactionFixture();
 const accounts=new Map([['seller-token','seller'],['buyer-token','buyer']]);
 const registeredPrincipal=async token=>{
  if(!accounts.has(token))throw Error('unauthorized');
  return accounts.get(token);
 };
 const authority={
  canonicalSettlementRequired:false,registeredPrincipal,
  requireAssetIssuer:async token=>{if(token!=='issuer-token')throw Error('unauthorized issuer');},
  verifyAssetReceipt:async r=>r.receiptId==='receipt-one'
 };
 const market=new HighCountryMarket(store,authority,()=>100);
 const ledger=new BudsLedger(store,{authorize:()=>true,sourceLimit:()=>100,authorizeSink:()=>false});
 await market.importAsset('issuer-token','import',{receiptId:'receipt-one',owner:'seller',asset:'lot',quantity:3});
 await ledger.earn('earn','buyer','mission','proof',80);
 const server=runtimeHttpServer({identity:{registeredPrincipal},market,settlement:{}},{origin:'https://ordinary.example'});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>server.close());
 const base='http://127.0.0.1:'+server.address().port;
 const post=async(path,token,data={})=>{
  const res=await fetch(base+path,{method:'POST',headers:{origin:'https://ordinary.example',
   authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(data)});
  return {status:res.status,body:await res.json()};
 };
 assert.equal((await post('/market/list','intruder',{operation:'fraud',listing:'one',asset:'lot',quantity:2,price:30,expiresAt:200})).status,503);
 assert.equal((await post('/market/list','seller-token',{operation:'list',listing:'one',asset:'lot',quantity:2,price:30,expiresAt:200})).status,200);
 assert.equal((await post('/market/buy','intruder',{operation:'steal',listing:'one'})).status,503);
 assert.equal((await post('/market/prepare','buyer-token',{operation:'wrong-mode',listing:'one',transferOperation:'unverified'})).status,403);
 assert.equal((await post('/market/buy','buyer-token',{operation:'buy',listing:'one'})).status,200);
 assert.equal((await post('/market/buy','buyer-token',{operation:'buy-replay',listing:'one'})).status,403);
 assert.equal(store.state.balances.get('buyer').available,50);
 assert.equal(store.state.balances.get('seller').available,30);
 assert.equal(store.state.assets.get(JSON.stringify(['buyer','lot'])).available,2);
 assert.equal(store.state.issued,80);
 authority.canonicalSettlementRequired=true;
 assert.equal((await post('/market/buy','buyer-token',{operation:'denied',listing:'one'})).status,403);
 assert.equal((await post('/market/cancel','seller-token',{operation:'denied-cancel',listing:'one'})).status,403);
 assert.equal((await post('/market/expire','buyer-token',{operation:'denied-expiry',listing:'one'})).status,403);
});

test('ordinary HTTP cancellation and expiry return exact reserved goods without paid credits',async t=>{
 const store=new MemoryTransactionFixture();
 const authority={
  canonicalSettlementRequired:false,
  registeredPrincipal:async token=>{
   if(token==='seller-token')return 'seller';
   if(token==='buyer-token')return 'buyer';
   throw new Error('unauthorized');
  },
  requireAssetIssuer:async()=>{},verifyAssetReceipt:async()=>true
 };
 let now=100;
 const market=new HighCountryMarket(store,authority,()=>now);
 await market.importAsset('issuer','import',{receiptId:'receipt',owner:'seller',asset:'lot',quantity:5});
 const server=runtimeHttpServer({identity:{registeredPrincipal:authority.registeredPrincipal},market,settlement:{}},{origin:'https://ordinary.example'});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>server.close());
 const base='http://127.0.0.1:'+server.address().port;
 const post=async(token,path,data)=>{
  const r=await fetch(base+path,{method:'POST',headers:{authorization:'Bearer '+token,origin:'https://ordinary.example','content-type':'application/json'},body:JSON.stringify(data)});
  return r.status;
 };
 assert.equal(await post('seller-token','/market/list',{operation:'list1',listing:'one',asset:'lot',quantity:2,price:10,expiresAt:200}),200);
 assert.equal(await post('buyer-token','/market/cancel',{operation:'wrong',listing:'one'}),403);
 assert.equal(await post('seller-token','/market/cancel',{operation:'cancel',listing:'one'}),200);
 assert.equal(await post('seller-token','/market/list',{operation:'list2',listing:'two',asset:'lot',quantity:5,price:10,expiresAt:150}),200);
 now=150;
 assert.equal(await post('buyer-token','/market/buy',{operation:'late',listing:'two'}),403);
 assert.equal(await post('buyer-token','/market/expire',{operation:'expire',listing:'two'}),200);
 assert.deepEqual(store.state.assets.get(JSON.stringify(['seller','lot'])),{available:5,reserved:0});
 assert.equal(store.state.issued,0);
});
