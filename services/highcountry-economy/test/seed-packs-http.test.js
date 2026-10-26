import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {runtimeHttpServer} from '../src/runtime-service.js';
import {fixture} from './seed-catalogue.fixture.mjs';
import {SeedPacks} from '../src/seed-packs.js';
test('pack HTTP enforces authenticated ownership, exact inputs, allowed origins and explicit deployment opt-in',async()=>{
 const f=await fixture(),packs=new SeedPacks({...f,reader:f.chain.reader});
 const server=runtimeHttpServer({identity:f.identity,seedPacks:packs},{origin:'https://hc.example'});server.listen(0,'127.0.0.1');await once(server,'listening');
 const post=(path,body={},token=f.alice,origin='https://hc.example')=>fetch('http://127.0.0.1:'+server.address().port+'/seeds/packs/'+path,{method:'POST',headers:{origin,'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
 try{
  assert.equal((await post('policy',{},null)).status,200);assert.equal((await post('starter',{region:'Red Mesa'},null)).status,403);
  for(const body of [{region:'Red Mesa',owner:'bob'},{region:'Red Mesa',count:4},{region:'World'},{region:'Red Mesa',quantity:100}])assert.equal((await post('starter',body)).status,403);
  assert.equal((await post('starter',{region:'Red Mesa'},f.alice,'https://evil.example')).status,403);
  const first=await (await post('starter',{region:'Red Mesa'})).json();assert.equal(first.result.length,2);
  const snapshot=await post('inventory');assert.equal(snapshot.headers.get('cache-control'),'no-store');assert.equal((await snapshot.json()).result.packs.length,2);
  assert.equal((await (await post('inventory',{},f.bob)).json()).result.packs.length,0);
  assert.equal((await post('prepare',{packId:first.result[0].id},f.bob)).status,403);
  assert.equal((await post('allocate',{receiptId:'forged',owner:'alice',region:'World',count:1})).status,403);
  assert.equal((await post('dispatch',{packId:first.result[0].id})).status,403);
 }finally{server.close();await once(server,'close');}
});
