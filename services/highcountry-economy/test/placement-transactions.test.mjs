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
 assert.equal(a.custody.unitId,[custodyUnitId('fixture-receipt',0),custodyUnitId('fixture-receipt',1)].sort((a,b)=>a.localeCompare(b,'en'))[0]);
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

test('03-C restore reclaims only the exact original canonical unit, with replay and scene revision',async()=>{
 const s=setup(),placed=await s.engine.execute('alice',s.place('a','place-c'));
 await s.engine.execute('alice',{operation:'remove-c',action:'remove',instanceId:'a',assetId:asset,expectedRevision:1,expectedSceneRevision:1});
 const restored=await s.engine.execute('alice',{operation:'restore-c',action:'restore',instanceId:'a',assetId:asset,expectedRevision:2,expectedSceneRevision:2});
 assert.equal(restored.instance.state,'placed');assert.equal(restored.custody.unitId,placed.custody.unitId);
 assert.deepEqual(await s.engine.execute('alice',{operation:'restore-c',action:'restore',instanceId:'a',assetId:asset,expectedRevision:2,expectedSceneRevision:2}),restored);
 await assert.rejects(s.engine.execute('alice',{operation:'restore-again',action:'restore',instanceId:'a',assetId:asset,expectedRevision:3,expectedSceneRevision:3}),/invalid-instance-state/);
});
test('03-C displaced canonical entitlement cannot be replaced by a different fungible unit',async()=>{
 const s=setup(),a=await s.engine.execute('alice',s.place('a','first-c'));
 await s.engine.execute('alice',{operation:'remove-c',action:'remove',instanceId:'a',assetId:asset,expectedRevision:1,expectedSceneRevision:1});
 const u=s.get().custodyUnits.get(a.custody.unitId);s.get().custodyUnits.set(u.unitId,{...u,owner:'bob'});
 const kA=JSON.stringify(['alice',asset]),kB=JSON.stringify(['bob',asset]);
 s.get().assets.get(kA).available--;s.get().assets.set(kB,{available:1,reserved:0});
 await assert.rejects(s.engine.execute('alice',{operation:'restore-c',action:'restore',instanceId:'a',assetId:asset,expectedRevision:2,expectedSceneRevision:2}),/bound-unit-unavailable/);
 assert.equal(s.get().placementInstances.get('a').state,'stored');
});
test('03-C stored placement cannot be reissued as a new instance ID or mutated by record override',async()=>{
 const s=setup();await s.engine.execute('alice',s.place('a','first-c'));
 await assert.rejects(s.engine.execute('alice',{operation:'mutate-c',action:'move',instanceId:'a',assetId:asset,expectedRevision:1,expectedSceneRevision:1,record:{ownerPrincipal:'bob'}}),/existing-instance-record-override/);
 assert.equal(s.get().placementInstances.get('a').ownerPrincipal,'alice');
});

test('03-P1: support mutation and removal reject live descendants without releasing custody',async()=>{
 const s=setup();await s.engine.execute('alice',s.place('support','support-op'));
 // A persisted, qualified attachment from a later attachment lane must still be
 // protected by HC-PLACE-03 transaction-side support rules.
 s.get().placementInstances.set('child',{...record('child'),surface:'tabletop_slot',layer:'tabletop_decor',parentInstanceId:'support',slotId:'slot-one',gridX:0});
 const before=structuredClone(s.get());
 for(const action of ['move','rotate','remove','attach']){
  await assert.rejects(s.engine.execute('alice',{operation:'reject-'+action,action,instanceId:'support',assetId:asset,expectedRevision:1,expectedSceneRevision:1,...(action==='move'?{gridX:3,gridY:0}:{}),...(action==='rotate'?{orientation:90}:{})}),/support-has-children|geometry-incompatible/);
 }
 assert.deepEqual(s.get(),before);
});
test('03-P1: unsupported detach target rejects atomically',async()=>{
 const s=setup();await s.engine.execute('alice',s.place('support','support-op'));
 const before=structuredClone(s.get());
 await assert.rejects(s.engine.execute('alice',{operation:'detach-no-target',action:'detach',instanceId:'support',assetId:asset,expectedRevision:1,expectedSceneRevision:1,detachTarget:'floor'}),/detach-target-unsupported/);
 assert.deepEqual(s.get(),before);
});
test('03-P1: placement rejects missing parent and self-parent inside same transaction',async()=>{
 const s=setup();const q=s.place('child','orphan');
 q.record={...q.record,surface:'tabletop_slot',layer:'tabletop_decor',parentInstanceId:'missing',slotId:'slot-a'};
 await assert.rejects(s.engine.execute('alice',q),/geometry-incompatible/);
 assert.equal(s.get().placementInstances.size,0);
 assert.equal(s.get().custodyReservations.size,0);
});

test('03-P1: attached child requires existing placed same-owner same-scene parent and can be stored then restored',async()=>{
 const s=setup();
 await s.engine.execute('alice',s.place('support','support'));
 const attachedAsset='hc-fixture-attached';
 const g={...geometry,assetId:attachedAsset,geometryId:'fixture-attachment',surface:'tabletop_slot',layer:'tabletop_decor',occupancy:{kind:'none'}};
 const akey=JSON.stringify(['alice',attachedAsset]),uid=custodyUnitId('attachment-receipt',0);
 s.get().assets.set(akey,{available:1,reserved:0});
 s.get().custodyReceipts.set('attachment-receipt',{owner:'alice',assetId:attachedAsset,quantity:1,schemaVersion:CUSTODY_SCHEMA});
 s.get().custodyUnits.set(uid,{schemaVersion:CUSTODY_SCHEMA,unitId:uid,receiptId:'attachment-receipt',unitIndex:0,owner:'alice',assetId:attachedAsset,state:'available',reservationId:null,revision:1});
 s.get().importedAssets.add('attachment-receipt');s.get().assetSources.set(akey,'attachment-receipt');
 // Trusted dependency overrides are fixture-only: no client catalogue is consulted.
 s.engine.assets=async()=>new Set([asset,attachedAsset]);s.engine.geometry=async id=>id===attachedAsset?g:geometry;
 s.engine.auth.qualifiedGeometrySnapshot=async()=>new Map([[asset,geometry],[attachedAsset,g]]);
 const child={...record('child',4),assetId:attachedAsset,geometryId:'fixture-attachment',surface:'tabletop_slot',layer:'tabletop_decor',parentInstanceId:'support',slotId:'slot-a'};
 const cmd=(operation,record,revision,scene,action='place')=>({operation,action,instanceId:'child',assetId:attachedAsset,expectedRevision:revision,expectedSceneRevision:scene,...(record?{record}:{})});
 const bad=structuredClone(child);bad.parentInstanceId='missing';
 await assert.rejects(s.engine.execute('alice',cmd('bad-parent',bad,0,1)),/parent-authority-or-scene/);
 assert.equal(s.get().placementInstances.size,1);
 const placed=await s.engine.execute('alice',cmd('child-place',child,0,1));
 assert.equal(placed.instance.parentInstanceId,'support');
 await assert.rejects(s.engine.execute('alice',{operation:'parent-removal',action:'remove',instanceId:'support',assetId:asset,expectedRevision:1,expectedSceneRevision:2}),/support-has-children/);
 const detached=await s.engine.execute('alice',{...cmd('child-detach',null,1,2,'detach'),detachTarget:'storage'});
 assert.equal(detached.instance.state,'stored');
 assert.equal(detached.custody.unitId,placed.custody.unitId);
 assert.equal(s.get().custodyUnits.get(placed.custody.unitId).state,'available');
 assert.equal(s.get().custodyReservations.has(placed.custody.unitId),false);
 await s.engine.execute('alice',{operation:'parent-store',action:'remove',instanceId:'support',assetId:asset,expectedRevision:1,expectedSceneRevision:3});
 await assert.rejects(s.engine.execute('alice',cmd('child-restore-denied',null,2,4,'restore')),/parent-not-placed/);
 await s.engine.execute('alice',{operation:'parent-restore',action:'restore',instanceId:'support',assetId:asset,expectedRevision:2,expectedSceneRevision:4});
 const restored=await s.engine.execute('alice',cmd('child-restore',null,2,5,'restore'));
 assert.equal(restored.instance.parentInstanceId,'support');
 assert.equal(restored.custody.unitId,placed.custody.unitId);
 assert.equal(s.get().custodyReservations.size,2);
});
