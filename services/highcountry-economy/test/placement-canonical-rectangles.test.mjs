import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalRectangleAssetIds,canonicalRectangleEvidence,resolveCanonicalGeometry,resolveCanonicalAssets,canonicalGeometrySnapshot,createCanonicalRectanglePlacementConfig} from '../src/placement-canonical-rectangles.js';
import {rotatedCells,definePlacedObject,CONTRACT_VERSION} from '../src/placement-contract.js';
test('04: all present approved rectangle catalogues are unique and strictly versioned',async()=>{
 assert.equal(canonicalRectangleAssetIds.length,36);
 assert.equal(new Set(canonicalRectangleAssetIds).size,36);
 assert.equal(canonicalRectangleEvidence.length,36);
 const ids=await resolveCanonicalAssets();assert.equal(ids.size,36);
 assert.equal(await resolveCanonicalGeometry('forged-client-asset'),null);
 assert.equal((await canonicalGeometrySnapshot()).size,36);
});
test('04: every approved rotated footprint conserves cells and dimensions',async()=>{
 for(const assetId of canonicalRectangleAssetIds){
  const g=await resolveCanonicalGeometry(assetId),{width,height}=g.occupancy;
  for(const a of [0,90,180,270]){
   const cells=rotatedCells(g,a);assert.equal(cells.length,width*height,assetId);
   assert.equal(new Set(cells.map(c=>c.x+':'+c.y)).size,width*height,assetId);
   assert.equal(Math.max(...cells.map(c=>c.x))+1,a%180===0?width:height,assetId);
   assert.equal(Math.max(...cells.map(c=>c.y))+1,a%180===0?height:width,assetId);
  }
  assert.throws(()=>rotatedCells(g,45),/orientation-denied/);
 }
});
test('04: geometry snapshots are defensive copies; forged clients cannot alter canonical masks',async()=>{
 const g=await resolveCanonicalGeometry(canonicalRectangleAssetIds[0]);
 g.occupancy.width=99;g.qualified=false;
 const again=await resolveCanonicalGeometry(canonicalRectangleAssetIds[0]);
 assert.notEqual(again.occupancy.width,99);assert.equal(again.qualified,true);
 assert.throws(()=>createCanonicalRectanglePlacementConfig(null),/missing-independent-world-authority/);
 const config=createCanonicalRectanglePlacementConfig({geometrySnapshot:async()=>new Map()});
 assert.equal(config.resolveGeometry,resolveCanonicalGeometry);
 assert.equal(config.resolveAssets,resolveCanonicalAssets);
});
test('04: geometry is accepted by original versioned placement record contract',async()=>{
 const assetId=canonicalRectangleAssetIds[0],g=await resolveCanonicalGeometry(assetId),ids=await resolveCanonicalAssets();
 const record={schemaVersion:CONTRACT_VERSION,instanceId:'example',assetId,ownerPrincipal:'alice',parcelId:'p',buildingId:null,roomId:null,regionId:'emerald-coast',surface:g.surface,layer:g.layer,gridX:0,gridY:0,orientation:90,renderAnchor:{x:0,y:0},geometryId:g.geometryId,geometryVersion:g.geometryVersion,parentInstanceId:null,slotId:null,revision:1,createdAt:1,updatedAt:1,history:[],state:'placed',validationVersion:1};
 assert.equal(definePlacedObject(record,{geometry:g,assetIds:ids}).instanceId,'example');
 assert.throws(()=>definePlacedObject({...record,geometryVersion:2},{geometry:g,assetIds:ids}),/geometry-incompatible/);
});

import {HighCountryPlacementTransactions} from '../src/placement-transactions.js';
import {custodyUnitId,CUSTODY_SCHEMA} from '../src/custody-records.js';
function integration(){
 const assetId='hc-prop-premium-emerald-writing-desk';
 const ref='receipt-qualified-rectangle';
 const units=new Map(Array.from({length:2},(_,i)=>{
  const unitId=custodyUnitId(ref,i);
  return [unitId,{schemaVersion:CUSTODY_SCHEMA,unitId,receiptId:ref,unitIndex:i,owner:'alice',assetId,state:'available',reservationId:null,revision:1}];
 }));
 let state={placementInstances:new Map(),placementOperations:new Map(),placementScenes:new Map(),
  placementAuthorityRevisions:new Map(),assets:new Map([[JSON.stringify(['alice',assetId]),{available:2,reserved:0}]]),
  custodyUnits:units,custodyReceipts:new Map([[ref,{schemaVersion:CUSTODY_SCHEMA,owner:'alice',assetId,quantity:2}]]),
  custodyReservations:new Map(),assetSources:new Map([[JSON.stringify(['alice',assetId]),ref]]),
  importedAssets:new Set([ref])};
 let tail=Promise.resolve();
 const store={transact(fn){const result=tail.then(()=>{
  const copy=structuredClone(state),out=fn(copy);
  if(out?.then)throw Error('async-transaction-forbidden');
  state=copy;return out;
 });tail=result.then(()=>{},()=>{});return result;}};
 let approved;
 const authority={
  registeredPrincipal:async session=>session,
  canPlaceOnParcel:async principal=>principal==='alice',
  validateWorld:async()=>({qualified:true,evidenceId:'world-signed-fixture',revision:1,geometryQualificationId:approved.qualificationRef}),
  qualifiedGeometrySnapshot:canonicalGeometrySnapshot,
  verifyAtCommit:({principal,authoritative,world,geometry})=>principal==='alice'&&authoritative.revision===1
   &&authoritative.evidenceId===world.evidenceId&&geometry.qualificationRef===approved.qualificationRef
 };
 const engine=new HighCountryPlacementTransactions({store,authority,resolveGeometry:resolveCanonicalGeometry,resolveAssets:resolveCanonicalAssets,clock:()=>100});
 const record=(instanceId,x,orientation=0)=>({
  schemaVersion:CONTRACT_VERSION,instanceId,assetId,ownerPrincipal:'alice',parcelId:'parcel-fixture',
  buildingId:null,roomId:null,regionId:'emerald-coast',surface:'floor',layer:'furniture',
  gridX:x,gridY:0,orientation,renderAnchor:{x:0,y:0},geometryId:'rectangle-'+assetId,
  geometryVersion:1,parentInstanceId:null,slotId:null,revision:1,createdAt:1,updatedAt:1,
  history:[],state:'placed',validationVersion:1
 });
 const place=(instanceId,operation,x,expectedSceneRevision,orientation=0)=>({
  action:'place',operation,instanceId,assetId,expectedRevision:0,expectedSceneRevision,
  record:record(instanceId,x,orientation)
 });
 return {engine,place,get:()=>state,async ready(){
  approved=await resolveCanonicalGeometry(assetId);
  state.placementAuthorityRevisions.set('parcel-fixture',{
   revision:1,evidenceId:'world-signed-fixture',geometryQualificationId:approved.qualificationRef
  });return approved;
 }};
}
test('04: canonical 2x1 desk placement, rotated overlap, custody and atomic rollback',async()=>{
 const q=integration(),g=await q.ready();
 assert.deepEqual(g.occupancy,{kind:'rectangle',width:2,height:1});
 const a=await q.engine.execute('alice',q.place('a','place-a',0,0));
 assert.equal(a.sceneRevision,1);
 assert.equal(q.get().assets.get(JSON.stringify(['alice',g.assetId])).reserved,1);
 const before=structuredClone(q.get());
 await assert.rejects(q.engine.execute('alice',q.place('b','overlap-b',1,1,90)),/occupied/);
 assert.deepEqual(q.get(),before);
 const b=await q.engine.execute('alice',q.place('b','place-b',4,1,90));
 assert.equal(b.sceneRevision,2);
 assert.notEqual(a.custody.unitId,b.custody.unitId);
 const competing=await Promise.allSettled([
  q.engine.execute('alice',{action:'move',operation:'move-a',instanceId:'a',assetId:g.assetId,expectedRevision:1,expectedSceneRevision:2,gridX:4,gridY:0}),
  q.engine.execute('alice',{action:'rotate',operation:'rotate-b',instanceId:'b',assetId:g.assetId,expectedRevision:1,expectedSceneRevision:2,orientation:180})
 ]);
 assert.equal(competing.filter(x=>x.status==='fulfilled').length,1);
 const removed=await q.engine.execute('alice',{action:'remove',operation:'remove-a',instanceId:'a',assetId:g.assetId,expectedRevision:1,expectedSceneRevision:3});
 assert.equal(removed.instance.state,'stored');
 assert.equal(q.get().assets.get(JSON.stringify(['alice',g.assetId])).reserved,1);
 assert.deepEqual(await q.engine.execute('alice',{action:'remove',operation:'remove-a',instanceId:'a',assetId:g.assetId,expectedRevision:1,expectedSceneRevision:3}),removed);
});
