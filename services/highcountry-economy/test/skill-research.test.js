import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MemoryTransactionFixture,SettlementError} from '../src/buds-ledger.js';
import {SkillResearchService,validateProgressionCatalog} from '../src/skill-research.js';
const catalogue={version:'hc-next-5-1-v1',tracks:[
 {id:'archive-index',kind:'skill',effect:'archive-filters',effectValue:1,cap:1,
 cost:10,requiredPoints:2,maxPointsPerProof:1,minLevel:1,prerequisites:[],eligibility:'verified-gameplay'},
 {id:'workshop-notes',kind:'research',effect:'recipe-notes',effectValue:2,cap:2,
 cost:20,requiredPoints:2,maxPointsPerProof:1,minLevel:2,prerequisites:['archive-index'],eligibility:'verified-gameplay'}]};
function setup(){
 const store=new MemoryTransactionFixture();
 store.state.balances.set('alice',{available:100,reserved:0});
 store.state.issued=100;
 let level=1,verified=true;
 const identity={registeredPrincipal:async t=>{if(t==='alice-token')return 'alice';if(t==='bob-token')return 'bob';throw new SettlementError('unregistered');}};
 const engine=new SkillResearchService({store,identity,catalog:catalogue,
  verifyEvidence:async({evidence})=>verified?{sourceEvent:evidence}:false,getPlayerLevel:async()=>level,clock:()=>12345});
 return {store,engine,setLevel:v=>{level=v;},setVerified:v=>{verified=v;}};
}
test('progression is version-pinned, proof-unique and independently admitted',async()=>{
 const x=setup();
 const initial=await x.engine.snapshot('alice-token');
 assert.equal(initial.records.length,2);assert.equal(initial.records[0].unlocked,false);
 x.setVerified(false);
 await assert.rejects(x.engine.progress('alice-token','attempt','archive-index','proof1',1),/independent progression evidence/);
 x.setVerified(true);
 await x.engine.progress('alice-token','step1','archive-index','proof1',1);
 await assert.rejects(x.engine.progress('alice-token','step2','archive-index','proof1',1),/replayed progression evidence/);
 await assert.rejects(x.engine.progress('alice-token','step3','archive-index','proof3',2),/track proof cap/);
 await x.engine.progress('alice-token','step4','archive-index','proof2',1);
 assert.equal((await x.engine.snapshot('alice-token')).records[0].points,2);
 await assert.rejects(x.engine.progress('alice-token','step5','archive-index','proof5',1),/progression capped/);
});
test('purchase burns exact available BUDS, preserves conservation, rejects replay and prerequisites',async()=>{
 const x=setup();
 for(const [op,track,proof] of [['a','archive-index','a'],['b','archive-index','b'],
  ['c','workshop-notes','c'],['d','workshop-notes','d']]){
  await x.engine.progress('alice-token',op,track,proof,1);
 }
 await assert.rejects(x.engine.unlock('alice-token','pay1','workshop-notes'),/progression not eligible|missing prerequisite/);
 const first=await x.engine.unlock('alice-token','pay2','archive-index');
 assert.equal(first.spent,10);
 assert.equal(first.effect,'archive-filters');
 assert.equal(x.store.state.balances.get('alice').available,90);
 assert.equal(x.store.state.burned,10);
 await assert.rejects(x.engine.unlock('alice-token','pay2','archive-index'),/replayed operation/);
 await assert.rejects(x.engine.unlock('alice-token','pay3','archive-index'),/progression not eligible/);
 x.setLevel(2);
 await x.engine.unlock('alice-token','pay4','workshop-notes');
 assert.equal(x.store.state.burned,30);
 assert.equal(x.store.state.balances.get('alice').available,70);
 assert.equal(x.store.state.issued,100);
 assert.equal(x.store.state.assets.size,0);
});
test('insufficient funds, missing evidence and unregistered principals fail closed',async()=>{
 const x=setup();
 await assert.rejects(x.engine.snapshot('guest'),/unregistered/);
 await assert.rejects(x.engine.progress('bob-token','x','archive-index','proof',0),/invalid progression request/);
 await x.engine.progress('bob-token','b1','archive-index','proofb',1);
 await x.engine.progress('bob-token','b2','archive-index','proofc',1);
 await assert.rejects(x.engine.unlock('bob-token','purchase','archive-index'),/insufficient BUDS/);
 assert.equal(x.store.state.burned,0);
});
test('catalogue forbids canonical asset minting, fairness effects, unsafe numbers and forward prerequisite',()=>{
 for(const effect of ['yield','harvest','potency','genetics','competitive','score','capacity','asset','canonical','wallet','buds','mint','drop-rate']){
  assert.throws(()=>validateProgressionCatalog({version:'v1',tracks:[{...catalogue.tracks[0],effect}]}),/invalid or unapproved/);
 }
 assert.throws(()=>validateProgressionCatalog({version:'v1',tracks:[{...catalogue.tracks[0],cost:0}]}),/invalid or unapproved/);
 assert.throws(()=>validateProgressionCatalog({version:'v1',tracks:[{...catalogue.tracks[0],prerequisites:['later']}]}),/invalid or unapproved/);
 assert.throws(()=>validateProgressionCatalog({version:'v1',tracks:[catalogue.tracks[0],catalogue.tracks[0]]}),/invalid or unapproved/);
 assert.equal(validateProgressionCatalog(catalogue).tracks.length,2);
});
test('player cannot buy on forged level or unverified session',async()=>{
 const x=setup();
 await x.engine.progress('alice-token','a','archive-index','a',1);
 await x.engine.progress('alice-token','b','archive-index','b',1);
 x.setLevel(-1);
 await assert.rejects(x.engine.unlock('alice-token','pay','archive-index'),/invalid verified player level/);
 await assert.rejects(x.engine.unlock('guest','pay','archive-index'),/unregistered/);
});

test('revoked session epoch is checked again inside progression atomic write',async()=>{
 const x=setup();
 x.engine.identity.verifyToken=()=>({sub:'alice',epoch:0});
 x.store.state.runtimeEpochs=new Map([['alice',1]]);
 await assert.rejects(x.engine.snapshot('alice-token'),/progression account authority revoked/);
 await assert.rejects(x.engine.progress('alice-token','stale','archive-index','stale-proof',1),
  /progression account authority revoked/);
 assert.equal(x.store.state.skillResearch.size,0);
 x.engine.identity.verifyToken=()=>({sub:'alice',epoch:1});
 await x.engine.progress('alice-token','current','archive-index','valid-proof',1);
 assert.equal(x.store.state.skillResearch.size,1);
});

test('catalogue revision preserves historical purchased record but never silently activates prior version effects',async()=>{
 const x=setup();
 await x.engine.progress('alice-token','a','archive-index','pa',1);
 await x.engine.progress('alice-token','b','archive-index','pb',1);
 await x.engine.unlock('alice-token','buy','archive-index');
 const newer={version:'hc-next-5-1-v2',tracks:[{...catalogue.tracks[0],cost:11}]};
 const next=new SkillResearchService({store:x.store,identity:x.engine.identity,catalog:newer,
  verifyEvidence:x.engine.verifyEvidence,getPlayerLevel:x.engine.getPlayerLevel});
 const snapshot=await next.snapshot('alice-token');
 assert.equal(snapshot.records[0].unlocked,false);
 assert.equal(snapshot.effects['archive-filters'],undefined);
 assert.equal(snapshot.history[0].version,'hc-next-5-1-v1');
 assert.equal(snapshot.history[0].unlocked,true);
 assert.equal(x.store.state.burned,10);
});
