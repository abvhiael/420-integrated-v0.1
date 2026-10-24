import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MissionService,validateMissionCatalog} from '../src/missions.js';
import {MemoryTransactionFixture,SettlementError} from '../src/buds-ledger.js';
import {HIGHCOUNTRY_MISSIONS_V1} from '../src/mission-catalog-v1.js';
function fixture(){
 let now=1000,verified=true;
 const store=new MemoryTransactionFixture();
 store.state.issued=30;store.state.balances.set('alice',{available:30,reserved:0});
 const identity={registeredPrincipal:async t=>{if(t!=='alice')throw new SettlementError('unregistered');return 'alice';},
  verifyToken:()=>({sub:'alice',epoch:0})};
 const mission=new MissionService({store,identity,catalog:HIGHCOUNTRY_MISSIONS_V1,
  verifyEvidence:async({evidence})=>verified?{sourceEvent:evidence}:false,clock:()=>now});
 return {mission,store,setNow:n=>now=n,setVerified:v=>verified=v};
}
test('mission activates progresses completes claims once without BUDS issuance or wallet',async()=>{
 const x=fixture();
 await assert.rejects(x.mission.claim('alice','early','journal-first-steps'),/not activated/);
 const a=await x.mission.activate('alice','start','journal-first-steps');
 assert.equal(a.status,'active');
 await assert.rejects(x.mission.activate('alice','again','journal-first-steps'),/replay/);
 await assert.rejects(x.mission.activate('alice','prerequisite','field-notes'),/missing mission prerequisite/);
 await x.mission.progress('alice','one','journal-first-steps','proof:1',1);
 await assert.rejects(x.mission.progress('alice','replay','journal-first-steps','proof:1',1),/replayed/);
 const final=await x.mission.progress('alice','two','journal-first-steps','proof:2',1);
 assert.equal(final.status,'complete');
 const receipt=await x.mission.claim('alice','claim','journal-first-steps');
 assert.deepEqual(receipt.reward,{kind:'cosmetic-badge',badgeId:'first-journal-badge',units:0,objective:'verified-journal-entry',
  version:'HC-MISSIONS-V1'});
 await assert.rejects(x.mission.claim('alice','reclaim','journal-first-steps'),/not complete/);
 assert.equal(x.store.state.issued,30);assert.equal(x.store.state.burned,0);
 assert.equal(x.store.state.balances.get('alice').available,30);
 assert.equal(x.store.state.assets.size,0);
 assert.equal((await x.mission.snapshot('alice')).badges[0].badgeId,'first-journal-badge');
 await x.mission.activate('alice','next','field-notes');
});
test('mission cancellation irreversible and does not grant rewards',async()=>{
 const x=fixture();
 await x.mission.activate('alice','start','journal-first-steps');
 const cancel=await x.mission.cancel('alice','cancel','journal-first-steps');
 assert.equal(cancel.status,'cancelled');
 await assert.rejects(x.mission.progress('alice','p','journal-first-steps','p:1',1),/not active/);
 await assert.rejects(x.mission.cancel('alice','again','journal-first-steps'),/cannot be cancelled/);
 await assert.rejects(x.mission.activate('alice','restart','journal-first-steps'),/replay/);
 assert.equal(x.store.state.burned,0);
});
test('mission expiration prevents late progress or claims and persists',async()=>{
 const x=fixture();
 await x.mission.activate('alice','start','journal-first-steps');
 x.setNow(1000+86400000);
 await assert.rejects(x.mission.progress('alice','late','journal-first-steps','late:1',1),/not active/);
 assert.equal((await x.mission.snapshot('alice')).missions[0].status,'expired');
 const y=fixture();
 await y.mission.activate('alice','start','journal-first-steps');
 y.setNow(1000+86400000);
 assert.equal((await y.mission.expire('alice','expire','journal-first-steps')).status,'expired');
});
test('unverified forged oversized or duplicate mission evidence is rejected',async()=>{
 const x=fixture();await x.mission.activate('alice','start','journal-first-steps');
 x.setVerified(false);
 await assert.rejects(x.mission.progress('alice','op','journal-first-steps','forged',1),/independent/);
 x.setVerified(true);
 await assert.rejects(x.mission.progress('alice','op','journal-first-steps','p',2),/cap/);
 await x.mission.progress('alice','good','journal-first-steps','evt:shared',1);
 await assert.rejects(x.mission.progress('alice','different','journal-first-steps','evt:shared',1),/replayed/);
 x.store.state.skillResearchProofs.add('research:already-used');
 await assert.rejects(x.mission.progress('alice','research','journal-first-steps','research:already-used',1),/replayed/);
});
test('revoked authenticated session cannot mutate mission atomically',async()=>{
 const x=fixture();await x.mission.activate('alice','start','journal-first-steps');
 x.store.state.runtimeEpochs=new Map([['alice',1]]);
 await assert.rejects(x.mission.progress('alice','p','journal-first-steps','p:1',1),/revoked/);
 await assert.rejects(x.mission.cancel('alice','c','journal-first-steps'),/revoked/);
 assert.equal(x.store.state.missions.values().next().value.progress,0);
});
test('malformed mission tables cannot create cycles, excessive targets or economic rewards',()=>{
 assert.throws(()=>validateMissionCatalog({version:'v1',templates:[{
  ...HIGHCOUNTRY_MISSIONS_V1.templates[0],rewardUnits:-1}]}),/invalid/);
 assert.throws(()=>validateMissionCatalog({version:'v1',templates:[{
  ...HIGHCOUNTRY_MISSIONS_V1.templates[0],target:999999}]}),/invalid/);
 assert.throws(()=>validateMissionCatalog({version:'v1',templates:[{
  ...HIGHCOUNTRY_MISSIONS_V1.templates[0],prerequisite:'future'}]}),/invalid/);
});
