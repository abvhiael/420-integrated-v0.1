import test from 'node:test';import assert from 'node:assert/strict';import {once} from 'node:events';
import {openingFixture} from './seed-openings.fixture.mjs';import {runtimeHttpServer} from '../src/runtime-service.js';
test('HTTP commits owned packs only, rejects caller entropy/tiers/owners and exposes issuer queue only to source operators',async()=>{
 const f=await openingFixture(),[p]=await f.allocate(),server=runtimeHttpServer({identity:f.identity,seedPacks:f.packs,seedOpenings:f.openings,seedOpeningWorker:f.worker},{origin:'https://hc.example'});
 server.listen(0,'127.0.0.1');await once(server,'listening');const post=(path,body,token=f.alice,origin='https://hc.example')=>fetch('http://127.0.0.1:'+server.address().port+'/seeds/packs/'+path,{method:'POST',headers:{origin,'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
 try{
  assert.equal((await post('open',{packId:p.id},null)).status,403);assert.equal((await post('open',{packId:p.id},f.bob)).status,403);
  for(const extra of [{entropy:'chosen'},{tier:'exclusive'},{owner:'bob'},{region:'Red Mesa'},{requestId:'changed'},{reroll:true}])assert.equal((await post('open',{packId:p.id,...extra})).status,403);
  assert.equal((await post('open',{packId:p.id},f.alice,'https://evil.example')).status,403);
  const a=await post('open',{packId:p.id});assert.equal(a.status,200);assert.equal((await a.json()).result.outcome,null);assert.equal(a.headers.get('cache-control'),'no-store');
  assert.equal((await post('opening-pending',{after:'',limit:100},f.bob)).status,403);assert.equal((await post('opening-pending',{after:'',limit:100})).status,200);
  assert.equal((await post('opening-dispatch',{packId:p.id},f.bob)).status,403);assert.equal((await post('opening-dispatch',{packId:p.id})).status,200);
  const status=await (await post('opening',{packId:p.id})).json();assert.equal(status.result.status,'awaiting-randomness');assert.equal(status.result.outcome,null);
 }finally{server.close();await once(server,'close');}
});
