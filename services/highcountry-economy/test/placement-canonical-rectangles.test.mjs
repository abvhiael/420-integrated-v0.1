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
