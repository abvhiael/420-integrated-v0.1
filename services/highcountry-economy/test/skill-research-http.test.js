import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runtimeHttpServer} from '../src/runtime-service.js';
import {MemoryTransactionFixture} from '../src/buds-ledger.js';
import {SkillResearchService} from '../src/skill-research.js';
import {HIGHCOUNTRY_SKILL_RESEARCH_V1} from '../src/skill-catalog-v1.js';
test('authenticated progression HTTP accepts verified proof, spends exact BUDS and denies spoofed level',async t=>{
 const store=new MemoryTransactionFixture();
 store.state.balances.set('alice',{available:20,reserved:0});store.state.issued=20;
 const identity={registeredPrincipal:async token=>{
  if(token==='alice')return 'alice';throw Error('unauthorized player');
 }};
 const skillResearch=new SkillResearchService({store,identity,catalog:HIGHCOUNTRY_SKILL_RESEARCH_V1,
  verifyEvidence:async({evidence})=>evidence==='approved-one'?{sourceEvent:'quest:one'}:
   evidence==='approved-two'?{sourceEvent:'quest:two'}:false,
  getPlayerLevel:async()=>1});
 const server=runtimeHttpServer({identity,skillResearch},{origin:'https://highcountry.example'});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 t.after(()=>server.close());
 const post=async(path,data,token='alice')=>{
  const resp=await fetch('http://127.0.0.1:'+server.address().port+path,{
   method:'POST',headers:{origin:'https://highcountry.example',
    authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(data)});
  return {status:resp.status,body:await resp.json()};
 };
 assert.equal((await post('/progression/snapshot',{},'intruder')).status,503);
 assert.equal((await post('/progression/unlock',{operation:'early',trackId:'archive-index-I'})).status,403);
 assert.equal((await post('/progression/evidence',{operation:'step1',trackId:'archive-index-I',
  evidence:'approved-one',points:1})).status,200);
 assert.equal((await post('/progression/evidence',{operation:'step2',trackId:'archive-index-I',
  evidence:'approved-two',points:1})).status,200);
 assert.equal((await post('/progression/evidence',{operation:'step3',trackId:'workbench-notes-I',
  evidence:'approved-one',points:1})).status,403);
 assert.equal((await post('/progression/unlock',{operation:'unlock',trackId:'archive-index-I',
  playerLevel:1000,owner:'victim'})).status,200);
 const snap=(await post('/progression/snapshot',{})).body.result;
 assert.equal(snap.records[0].unlocked,true);
 assert.equal(snap.availableBuds,10);
 assert.equal(store.state.burned,10);
 assert.equal(store.state.issued,20);
 assert.equal(store.state.assets.size,0);
 assert.equal((await post('/progression/unlock',{operation:'unlock2',trackId:'archive-index-I'})).status,403);
});
