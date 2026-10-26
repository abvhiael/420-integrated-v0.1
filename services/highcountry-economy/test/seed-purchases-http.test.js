import test from 'node:test';import assert from 'node:assert/strict';import {once} from 'node:events';
import {purchaseFixture} from './seed-purchases.fixture.mjs';import {runtimeHttpServer} from '../src/runtime-service.js';
test('signed exact-body purchase routes reject fabricated prices, receipts, owners, foreign origins and foreign confirmation',async()=>{
 const f=await purchaseFixture();await f.fund();const server=runtimeHttpServer({identity:f.identity,seedPacks:f.packs,seedPurchases:f.purchases},{origin:'https://hc.example'});server.listen(0,'127.0.0.1');await once(server,'listening');
 const post=(path,body,token=f.alice,origin='https://hc.example')=>fetch('http://127.0.0.1:'+server.address().port+'/seeds/packs/'+path,{method:'POST',headers:{origin,'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
 try{const input={operation:'buy:http',region:'World',currency:'BUDS'};
  assert.equal((await post('shop',{},null)).status,403);assert.equal((await post('purchase-prepare',input,f.alice,'https://evil.example')).status,403);
  for(const extra of [{owner:'bob'},{price:1},{count:100},{payment:true},{receipt:{paid:true}},{entropy:'chosen'}])assert.equal((await post('purchase-prepare',{...input,...extra})).status,403);
  const response=await post('purchase-prepare',input);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');const p=(await response.json()).result;
  assert.equal((await post('purchase-confirm',{purchaseId:p.id},f.bob)).status,403);assert.equal((await post('purchase-confirm',{purchaseId:p.id,txHash:'fake'})).status,403);
  const done=(await (await post('purchase-confirm',{purchaseId:p.id})).json()).result;assert.equal(done.status,'paid');assert.equal(done.pack.owner,'alice');
  assert.equal((await post('purchase-confirm',{purchaseId:p.id})).status,200);assert.equal(f.store.state.burned,420);
  const history=(await (await post('shop',{})).json()).result;assert.equal(history.purchases.length,1);const foreign=(await (await post('shop',{},f.bob)).json()).result;assert.deepEqual(foreign.purchases,[]);
 }finally{server.close();await once(server,'close');}
});
