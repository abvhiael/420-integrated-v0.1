import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {MemoryTransactionFixture,SettlementError} from '../src/buds-ledger.js';
import {MissionService,validateMissionCatalog} from '../src/missions.js';
import {createSignedMissionEvidence} from '../src/signed-mission-evidence.js';
const catalog={version:'test-v1',missions:[
 {id:'first',objective:'field',target:2,maxPerEvidence:1,durationMs:1000,prerequisites:[],reward:{type:'journal-badge',amount:1}},
 {id:'second',objective:'lab',target:1,maxPerEvidence:1,durationMs:1000,prerequisites:['first'],reward:{type:'archive-note',amount:1}}
]};
function setup(){
 let now=10000,enabled=true;
 const store=new MemoryTransactionFixture();
 const identity={registeredPrincipal:async token=>{if(token!=='alice')throw new SettlementError('unregistered');return 'alice';},
  verifyToken:()=>({sub:'alice',epoch:0})};
 const service=new MissionService({store,identity,catalog,clock:()=>now,
 verifyEvidence:async ({evidence})=>enabled?{sourceEvent:evidence}:false});
 return {store,service,time:n=>now=n,verified:v=>enabled=v};
}
test('authenticated activation, bounded progress, terminal completion and one-time noncanonical reward',async()=>{
 const x=setup(),s=x.service;
 await assert.rejects(s.activate('alice','a','second'),/prerequisite/);
 await s.activate('alice','b','first');
 await assert.rejects(s.activate('alice','again','first'),/already activated/);
 x.verified(false);
 await assert.rejects(s.progress('alice','p0','first','proof',1),/authenticated mission evidence/);
 x.verified(true);
 await s.progress('alice','p1','first','proof',1);
 await assert.rejects(s.progress('alice','p2','first','proof',1),/replayed mission evidence/);
 assert.equal((await s.progress('alice','p3','first','proof2',1)).state,'complete');
 await assert.rejects(s.progress('alice','p4','first','proof3',1),/not active/);
 await s.claim('alice','claim','first');
 await assert.rejects(s.claim('alice','claim2','first'),/unavailable/);
 await s.activate('alice','next','second');
 assert.equal(x.store.state.missionRewards.get('alice')[0].type,'journal-badge');
 assert.equal(x.store.state.issued,0);assert.equal(x.store.state.assets.size,0);
});
test('cancel, expire, cross-account and replay refuse unauthorized outcomes',async()=>{
 const x=setup(),s=x.service;
 await assert.rejects(s.snapshot('guest'),/unregistered/);
 await s.activate('alice','a','first');
 await s.cancel('alice','b','first');
 await assert.rejects(s.claim('alice','c','first'),/unavailable/);
 await assert.rejects(s.progress('alice','d','first','proof',1),/not active/);
 const y=setup();await y.service.activate('alice','e','first');
 y.time(11000);
 assert.equal((await y.service.snapshot('alice')).missions[0].state,'expired');
 await assert.rejects(y.service.progress('alice','f','first','proof',1),/not active/);
 await y.service.expire('alice','g','first');
 await assert.rejects(y.service.expire('alice','h','first'),/not expirable/);
});
test('invalid catalog and revoked session fail closed',async()=>{
 const x=setup();
 assert.throws(()=>validateMissionCatalog({version:'v',missions:[{...catalog.missions[0],reward:{type:'canonical-asset',amount:1}}]}),/invalid mission/);
 x.store.state.runtimeEpochs=new Map([['alice',1]]);
 await assert.rejects(x.service.activate('alice','o','first'),/revoked/);
 assert.equal(x.store.state.missions.size,0);
});
test('signed evidence is domain bound and rejects forged or mismatched proofs',async()=>{
 const {privateKey,publicKey}=generateKeyPairSync('ed25519');
 const gameId='0x'+'a'.repeat(64);
 const verify=createSignedMissionEvidence({publicKey,issuer:'issuer',gameId,chainId:420,clock:()=>10000});
 const claim={domain:'HC.MISSION.EVIDENCE.V1',issuer:'issuer',principal:'alice',gameId,chainId:420,
  missionId:'first',version:'test-v1',objective:'field',amount:1,sourceEvent:'evt1',expiresAt:12000};
 const evidence=c=>{const bytes=Buffer.from(JSON.stringify(c));return Buffer.from(JSON.stringify({
  payload:bytes.toString('base64url'),signature:sign(null,bytes,privateKey).toString('base64url')})).toString('base64url');};
 const request={principal:'alice',missionId:'first',version:'test-v1',objective:'field',amount:1};
 assert.equal((await verify({...request,evidence:evidence(claim)})).sourceEvent,'evt1');
 assert.equal(await verify({...request,evidence:evidence({...claim,domain:'HC.PROGRESSION.EVIDENCE.V1'})}),false);
 assert.equal(await verify({...request,evidence:evidence({...claim,principal:'bob'})}),false);
 assert.equal(await verify({...request,evidence:evidence({...claim,expiresAt:9000})}),false);
});
