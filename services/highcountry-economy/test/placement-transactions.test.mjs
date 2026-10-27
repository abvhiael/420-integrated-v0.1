import {custodyUnitId,CUSTODY_SCHEMA} from '../src/custody-records.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {HighCountryPlacementTransactions} from '../src/placement-transactions.js';
import {CONTRACT_VERSION} from '../src/placement-contract.js';
const asset='hc-prop-premium-emerald-writing-desk';
const geometry={schemaVersion:CONTRACT_VERSION,assetId:asset,geometryId:'fixture-mask',geometryVersion:1,surface:'floor',layer:'furniture',visualPx:{width:128,height:64},renderAnchorPx:{x:0,y:0},occupancy:{kind:'rectangle',width:2,height:1},allowedOrientations:[0,90,180,270],qualified:true,qualificationRef:'test-fixture-only'};
const record=(instanceId='a',gridX=0)=>({schemaVersion:CONTRACT_VERSION,instanceId,assetId:asset,ownerPrincipal:'alice',parcelId:'parcel-a',buildingId:null,roomId:null,regionId:'emerald-coast',surface:'floor',layer:'furniture',gridX,gridY:0,orientation:0,renderAnchor:{x:0,y:0},geometryId:'fixture-mask',geometryVersion:1,parentInstanceId:null,slotId:null,revision:1,createdAt:1,updatedAt:1,history:[],state:'placed',validationVersion:1});
const balance=()=>({available:2,reserved:0});
function setup(){
 let state={assets:new Map([[JSON.stringify(['alice',asset]),balance()]]),placementInstances:new Map(),placementOperations:new Map(),placementScenes:new Map(),placementAuthorityRevisions:new Map([['parcel-a',{revision:1,evidenceId:'fixture-world',geometryQualificationId:'test-fixture-only'}]])};
 const units=new Map(Array.from({length:2},(_,i)=>{const id=custodyUnitId('fixture-receipt',i);return [id,{schemaVersion:CUSTODY_SCHEMA,unitId:id,receiptId:'fixture-receipt',unitIndex:i,owner:'alice',assetId:asset,state:'available',reservationId:null,revision:1}]}));
 state.custodyUnits=units;state.custodyReceipts=new Map([['fixture-receipt',{owner:'alice',assetId:asset,quantity:2,schemaVersion:CUSTODY_SCHEMA}]]);state.custodyReservations=new Map();state.importedAssets=new Set(['fixture-receipt']);state.assetSources=new Map([[JSON.stringify(['alice',asset]),'fixture-receipt']]);
 let tail=Promise.resolve();
 const store={transact(fn){const running=tail.then(()=>{const copy=structuredClone(state);const out=fn(copy);if(out?.then)throw Error('callback-not-sync');state=copy;return out;});tail=running.then(()=>{},()=>{});return running;}};
 const authority={registeredPrincipal:async s=>s,canPlaceOnParcel:async who=>who==='alice',validateWorld:async()=>({qualified:true,evidenceId:'fixture-world',revision:1,geometryQualificationId:'test-fixture-only'}),qualifiedGeometrySnapshot:async()=>new Map([[asset,geometry]]),verifyAtCommit:({principal,command,world,geometry:mask,authoritative})=>principal==='alice'&&command.record?.parcelId!=='wrong-parcel'&&authoritative.revision===1&&authoritative.evidenceId===world.evidenceId&&authoritative.geometryQualificationId===mask.qualificationRef};
 const engine=new HighCountryPlacementTransactions({store,authority,resolveGeometry:async()=>geometry,resolveAssets:async()=>new Set([asset]),clock:()=>10});
 const place=(instanceId,op,scene=0,x=0)=>({operation:op,action:'place',instanceId,assetId:asset,expectedRevision:0,expectedSceneRevision:scene,record:record(instanceId,x)});
 return {engine,place,get:()=>state};
}
test('atomic place reserves existing market inventory',async()=>{const s=setup();const x=await s.engine.execute('alice',s.place('a','op1'));assert.equal(x.sceneRevision,1);assert.deepEqual([...s.get().assets.values()],[{available:1,reserved:1}]);});
test('exact replay is idempotent, different payload with same operation rejected',async()=>{const s=setup();const q=s.place('a','op1');const a=await s.engine.execute('alice',q);assert.deepEqual(await s.engine.execute('alice',q),a);await assert.rejects(s.engine.execute('alice',{...q,expectedSceneRevision:3}),/replay-payload-conflict/);assert.equal(s.get().placementOperations.size,1);});
test('competing placement requests cannot claim occupied floor and rollback inventory',async()=>{const s=setup();const out=await Promise.allSettled([s.engine.execute('alice',s.place('a','op1')),s.engine.execute('alice',s.place('b','op2'))]);assert.equal(out.filter(x=>x.status==='fulfilled').length,1);assert.deepEqual([...s.get().assets.values()],[{available:1,reserved:1}]);});
test('remove restores inventory atomically, stale revision rejected',async()=>{const s=setup();await s.engine.execute('alice',s.place('a','op1'));await assert.rejects(s.engine.execute('alice',{operation:'remove-bad',action:'remove',instanceId:'a',assetId:asset,expectedRevision:0,expectedSceneRevision:1}),/stale-instance/);const result=await s.engine.execute('alice',{operation:'remove-a',action:'remove',instanceId:'a',assetId:asset,expectedRevision:1,expectedSceneRevision:1});assert.equal(result.instance.state,'stored');assert.deepEqual([...s.get().assets.values()],[{available:2,reserved:0}]);});
test('unauthorized principal rejected, snapshot excludes other owners',async()=>{const s=setup();await assert.rejects(s.engine.execute('mallory',s.place('a','bad')),/parcel-authority-denied/);await s.engine.execute('alice',s.place('a','op1'));assert.deepEqual((await s.engine.snapshot('mallory')).instances,[]);});
test('invalid missing qualified geometry fails without inventory mutation',async()=>{const s=setup();const q=s.place('a','op1');q.record.geometryVersion=100;await assert.rejects(s.engine.execute('alice',q),/geometry-incompatible/);assert.deepEqual([...s.get().assets.values()],[{available:2,reserved:0}]);});

test('03-A: changed world evidence fails under transaction lock without inventory mutation',async()=>{const s=setup();s.get().placementAuthorityRevisions.set('parcel-a',{revision:2,evidenceId:'revoked-world',geometryQualificationId:'test-fixture-only'});await assert.rejects(s.engine.execute('alice',s.place('a','new-op')),/authority-changed-or-denied/);assert.deepEqual([...s.get().assets.values()],[{available:2,reserved:0}]);});
test('03-A: revoked geometry qualification fails closed',async()=>{const s=setup();s.get().placementAuthorityRevisions.set('parcel-a',{revision:1,evidenceId:'fixture-world',geometryQualificationId:'revoked'});await assert.rejects(s.engine.execute('alice',s.place('a','new-op')),/authority-changed-or-denied/);assert.equal(s.get().placementInstances.size,0);});
test('03-A: unprovisioned world authority denied',async()=>{const s=setup();s.get().placementAuthorityRevisions.clear();await assert.rejects(s.engine.execute('alice',s.place('a','new-op')),/authority-not-provisioned/);});

test('03-B.2 exact custody unit is reserved and released across placement lifecycle',async()=>{
 const s=setup();const a=await s.engine.execute('alice',s.place('a','custody-a'));
 assert.equal(a.custody.unitId,custodyUnitId('fixture-receipt',0));
 const unit=s.get().custodyUnits.get(a.custody.unitId);
 assert.equal(unit.state,'placed');assert.equal(unit.reservationId,'place:a');assert.equal(unit.revision,2);
 const removed=await s.engine.execute('alice',{operation:'custody-remove',action:'remove',instanceId:'a',assetId:asset,expectedRevision:1,expectedSceneRevision:1});
 assert.equal(removed.custody.unitId,a.custody.unitId);
 assert.equal(s.get().custodyUnits.get(a.custody.unitId).state,'available');
 assert.equal(s.get().custodyReservations.size,0);
});
test('03-B.2 no double allocation across separate non-overlapping positions',async()=>{
 const s=setup();const a=await s.engine.execute('alice',s.place('a','first'));
 const second=await s.engine.execute('alice',s.place('b','second',1,5));
 assert.notEqual(a.custody.unitId,second.custody.unitId);
 await assert.rejects(s.engine.execute('alice',s.place('c','third',2,10)),/verified-unit-unavailable/);
 assert.equal(s.get().placementInstances.size,2);assert.equal(s.get().custodyReservations.size,2);
});
test('03-B.2 wrong-reservation release fails and rolls back world state',async()=>{
 const s=setup();const a=await s.engine.execute('alice',s.place('a','reservation'));
 const unitId=a.custody.unitId;s.get().custodyReservations.get(unitId).instanceId='attacker';
 await assert.rejects(s.engine.execute('alice',{operation:'bad-release',action:'remove',instanceId:'a',assetId:asset,expectedRevision:1,expectedSceneRevision:1}),/placement-reservation-corrupt/);
 assert.equal(s.get().placementInstances.get('a').state,'placed');
});
test('03-B.2 prevents phantom placement from unsourced aggregate inventory',async()=>{
 const s=setup();s.get().custodyUnits.clear();s.get().custodyReceipts.clear();s.get().importedAssets.clear();
 await assert.rejects(s.engine.execute('alice',s.place('a','phantom')),/verified-unit-unavailable/);
 assert.equal(s.get().assets.values().next().value.available,2);
});
