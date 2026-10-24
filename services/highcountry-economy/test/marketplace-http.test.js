import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MemoryTransactionFixture,BudsLedger} from '../src/buds-ledger.js';
import {HighCountryMarket} from '../src/market.js';
import {HighCountryMarketplaceView} from '../src/marketplace-view.js';
import {runtimeHttpServer} from '../src/runtime-service.js';
test('authenticated HTTP browsing, atomic purchase, history and dispute do not require a wallet',async t=>{
 const store=new MemoryTransactionFixture();
 const identity={registeredPrincipal:async token=>{
  if(token==='alice-token')return 'alice';
  if(token==='bob-token')return 'bob';
  throw Error('unregistered');
 }};
 const authority={...identity,canonicalSettlementRequired:false,
  requireAssetIssuer:async token=>{if(token!=='trusted-inventory')throw Error('untrusted');},
  verifyAssetReceipt:async()=>true};
 const market=new HighCountryMarket(store,authority,()=>100);
 const view=new HighCountryMarketplaceView({store,identity,market,clock:()=>100});
 const ledger=new BudsLedger(store,{authorize:()=>true,sourceLimit:()=>1000,authorizeSink:()=>true});
 await market.importAsset('trusted-inventory','import',{receiptId:'verified-source',owner:'alice',asset:'lot',quantity:2});
 await ledger.earn('fund','bob','approved','proof',50);
 const server=runtimeHttpServer({market,marketView:view,identity},{origin:'https://highcountry.example'});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));t.after(()=>server.close());
 const url='http://127.0.0.1:'+server.address().port;
 const post=async(path,token,data={})=>{
  const response=await fetch(url+path,{method:'POST',
   headers:{origin:'https://highcountry.example','content-type':'application/json',
    ...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(data)});
  return {code:response.status,body:await response.json()};
 };
 assert.equal((await post('/market/snapshot',null)).code,403);
 assert.equal((await post('/market/snapshot','intruder')).code,503);
 assert.equal((await post('/market/list','alice-token',{operation:'list',listing:'one',asset:'lot',quantity:1,price:20,expiresAt:200})).code,200);
 const buyer=await post('/market/snapshot','bob-token');
 assert.equal(buyer.code,200);assert.equal(buyer.body.result.browse[0].seller,'alice');
 assert.equal(buyer.body.result.buds.available,50);
 assert.equal((await post('/market/buy','bob-token',{operation:'buy',listing:'one'})).code,200);
 const after=await post('/market/snapshot','bob-token');
 assert.equal(after.body.result.buds.available,30);
 assert.equal(after.body.result.inventory[0].available,1);
 assert.equal(after.body.result.history[0].status,'sold');
 assert.equal((await post('/market/dispute','bob-token',{operation:'notice',listing:'one',reason:'incorrect-item'})).code,200);
 assert.equal((await post('/market/dispute','bob-token',{operation:'notice2',listing:'one',reason:'payment'})).code,403);
 assert.equal((await post('/market/cancel','alice-token',{operation:'cancel',listing:'one'})).code,403);
 assert.equal((await post('/market/buy','bob-token',{operation:'buyagain',listing:'one'})).code,403);
 const final=await post('/market/snapshot','bob-token');
 assert.equal(final.body.result.disputes[0].status,'open');
 assert.equal(final.body.result.buds.available,30);
 assert.equal(store.state.balances.get('alice').available,20);
 assert.equal(store.state.issued,50);
 assert.equal(store.state.burned,0);
});
