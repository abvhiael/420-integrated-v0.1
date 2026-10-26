import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {runtimeHttpServer} from '../src/runtime-service.js';
import {fixture} from './seed-catalogue.fixture.mjs';

test('public browse, authenticated collection and harvest HTTP routes enforce fields and origin',async()=>{
 const f=await fixture(),server=runtimeHttpServer({identity:f.identity,seedCatalogue:f.catalogue,seedCollection:f.service},{origin:'https://hc.example'});
 server.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
 const post=(path,body={},token,origin)=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{}),...(origin?{origin}:{})},body:JSON.stringify(body)});
 try{
  const pub=await post('/seeds/catalogue',{filters:{tier:'rare'}});assert.equal(pub.status,200);assert.equal((await pub.json()).result.entries.length,26);
  assert.equal((await post('/seeds/collection')).status,403);
  assert.equal((await post('/seeds/collection',{principal:'bob'},f.alice)).status,403);
  assert.equal((await post('/seeds/harvest-card',{plantId:'7',owner:'alice'},f.alice)).status,403);
  assert.equal((await post('/seeds/harvest-card',{plantId:'7'},f.bob)).status,403);
  assert.equal((await post('/seeds/harvest-card',{plantId:'7'},f.alice,'https://evil.example')).status,403);
  const claim=await post('/seeds/harvest-card',{plantId:'7'},f.alice);assert.equal(claim.status,200);assert.equal((await claim.json()).result.cultivarId,'HC-C-blue-dream');
  const result=await post('/seeds/collection',{},f.alice);assert.equal(result.status,200);assert.equal((await result.json()).result.cards.length,1);assert.equal(result.headers.get('cache-control'),'no-store');
 }finally{server.close();await once(server,'close');}
});
