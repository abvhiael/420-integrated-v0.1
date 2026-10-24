import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runtimeHttpServer} from '../src/runtime-service.js';
import {MemoryTransactionFixture,SettlementError} from '../src/buds-ledger.js';
import {MissionService} from '../src/missions.js';
import {HIGHCOUNTRY_MISSIONS_V1} from '../src/mission-catalog-v1.js';
test('registered HTTP mission lifecycle rejects owner override and cannot mint BUDS',async t=>{
 const store=new MemoryTransactionFixture(),identity={
  registeredPrincipal:async token=>{if(token!=='alice-token')throw new SettlementError('unregistered');return 'alice';}
 };
 const missionService=new MissionService({store,identity,catalog:HIGHCOUNTRY_MISSIONS_V1,
  verifyEvidence:async({evidence})=>({sourceEvent:evidence}),clock:()=>100});
 const server=runtimeHttpServer({identity,missionService},{origin:'https://hc.example'});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));t.after(()=>server.close());
 const post=async(path,data,token='alice-token')=>{
  const response=await fetch('http://127.0.0.1:'+server.address().port+path,
   {method:'POST',headers:{origin:'https://hc.example',authorization:'Bearer '+token,
    'content-type':'application/json'},body:JSON.stringify(data)});
  return {status:response.status,body:await response.json()};
 };
 assert.equal((await post('/missions/snapshot',{},'stranger')).status,403);
 assert.equal((await post('/missions/activate',{operation:'start',missionId:'journal-first-steps',owner:'victim'})).status,403);
 assert.equal((await post('/missions/activate',{operation:'start',missionId:'journal-first-steps'})).status,200);
 assert.equal((await post('/missions/progress',{operation:'one',missionId:'journal-first-steps',amount:1,evidence:'verified:1'})).status,200);
 assert.equal((await post('/missions/progress',{operation:'two',missionId:'journal-first-steps',amount:1,evidence:'verified:2'})).status,200);
 const claim=await post('/missions/claim',{operation:'claim',missionId:'journal-first-steps'});
 assert.equal(claim.status,200);assert.equal(claim.body.result.reward.kind,'cosmetic-badge');
 assert.equal((await post('/missions/claim',{operation:'claim-again',missionId:'journal-first-steps'})).status,403);
 assert.equal(store.state.issued,0);assert.equal(store.state.burned,0);assert.equal(store.state.assets.size,0);
});
