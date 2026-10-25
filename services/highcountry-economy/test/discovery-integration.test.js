import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MemoryTransactionFixture,SettlementError} from '../src/buds-ledger.js';
import {DiscoveryIntegration} from '../src/discovery-integration.js';
const root=new URL('../../../deployments/highcountry/',import.meta.url);
const journeys=JSON.parse(await readFile(new URL('original-sixteen-discovery-journeys.v1.json',root),'utf8'));
const canonical=JSON.parse(await readFile(new URL('original-sixteen-archive.v1.json',root),'utf8'));
let now=1000;
function fixture(){
 const store=new MemoryTransactionFixture();
 const identity={registeredPrincipal:async t=>{if(t==='alice')return 'alice';if(t==='bob')return 'bob';throw new SettlementError('unregistered');},
 verifyToken:t=>({sub:t,epoch:0})};
 let trust=true;
 const service=new DiscoveryIntegration({store,identity,journeys,canonical,clock:()=>now,
  verifyEvidence:async({principal,missionId,objective,evidence,amount,version})=>{
   if(!trust||amount!==1||version!==journeys.schema||!objective||!missionId)return false;
   return {sourceEvent:evidence};
  }});
 return {service,store,trust:v=>trust=v};
}
test('16 founders and all 64 pairs map to gameplay and accessible objectives',async()=>{
 const {service}=fixture(),s=await service.snapshot('alice');
 assert.equal(s.founders.length,16);assert.equal(s.founders.flatMap(f=>f.fragments).length,64);
 for(const f of s.founders)for(const g of f.fragments){
  assert.equal(g.accessible.type,'archive.accessible_research');
  assert.ok(g.primary.objectiveId);assert.ok(g.accessible.objectiveId);
 }
 assert.equal(s.master,false);
});
test('signed objective once only, accessible equivalence, account isolation, fail-closed issuer',async()=>{
 const {service,store,trust}=fixture();
 const f=journeys.journeys[0],a=f.fragments[0],b=f.fragments[1];
 await assert.rejects(service.ingest('guest','a',a.trigger.objectiveId,'e1'),/unregistered/);
 trust(false);await assert.rejects(service.ingest('alice','a',a.trigger.objectiveId,'e1'),/independent/);
 trust(true);
 await service.ingest('alice','a',a.alternate.objectiveId,'e1');
 await assert.rejects(service.ingest('alice','b',a.trigger.objectiveId,'e2'),/already completed/);
 await assert.rejects(service.ingest('alice','c',b.trigger.objectiveId,'e1'),/replayed activity/);
 assert.equal((await service.snapshot('bob')).founders[0].fragments[0].earned,false);
 assert.equal((await service.snapshot('alice')).founders[0].fragments[0].earned,true);
 assert.equal(store.state.issued,0);assert.equal(store.state.assets.size,0);
});
test('every founder revelation and master issued exactly once without currency',async()=>{
 const {service,store}=fixture();
 let n=0;
 for(const founder of journeys.journeys)for(const fragment of founder.fragments){
  const response=await service.ingest('alice','op'+(++n),fragment.trigger.objectiveId,'evt'+n);
  assert.equal(response.status,'unlocked');
 }
 const s=await service.snapshot('alice');
 assert.equal(s.master,true);assert.equal(s.founders.filter(f=>f.revealed).length,16);
 assert.equal(new Set(s.entitlements).size,17);
 assert.equal(store.state.issued,0);assert.equal(store.state.burned,0);
});
test('revoked epoch prevents mutation and events stay unclaimed',async()=>{
 const {service,store}=fixture();
 store.state.runtimeEpochs=new Map([['alice',1]]);
 await assert.rejects(service.ingest('alice','op',journeys.journeys[0].fragments[0].trigger.objectiveId,'e1'),/revoked/);
 assert.equal(store.state.discoveryEvents.size,0);
});
