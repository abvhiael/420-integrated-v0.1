import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {fireGatheringCatalogue,canPlaceFireGatheringFeature,getFireGatheringFeature} from '../src/fire-gathering-catalogue.js';
const root=fileURLToPath(new URL('../public',import.meta.url));
test('twelve verified canonical fire gathering PNGs with versioned footprints and safe marketplace metadata',()=>{
 assert.equal(fireGatheringCatalogue.length,12);
 assert.equal(new Set(fireGatheringCatalogue.map(x=>x.id)).size,12);
 for(const a of fireGatheringCatalogue){
  const filename=a.id+'.png';assert.equal(a.assetUrl,'/assets/cultivation/props/outdoor-leisure/04-b-fire-gathering/'+filename);
  const path=root+a.assetUrl;assert.ok(existsSync(path),'missing '+path);
  const buf=readFileSync(path);assert.equal(buf.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.ok(a.footprint.width>=2&&a.footprint.width<=3);
  assert.ok(a.footprint.height>=2&&a.footprint.height<=3);
  assert.equal(a.footprint.tileSizePx,64);assert.equal(a.placement.layer,'outdoor_feature');
  assert.equal(a.placement.placementWithoutValidation,'deny');assert.equal(a.placement.requiresFireClearanceValidation,true);
  assert.equal(a.placement.regionRestriction,null);assert.equal(a.marketplace.price,null);
  assert.equal(a.marketplace.currency,'BUDS');assert.equal(a.marketplace.inventoryPolicy,'authenticated-server-owned');
  assert.equal(a.marketplace.fairnessEffect,'none');assert.equal(getFireGatheringFeature(a.id),a);
 }
});
test('placement preflight fails closed on ownership, anchor, terrain, collision, heat clearance and overlap',()=>{
 const good={id:fireGatheringCatalogue[0].id,owned:true,hasOutdoorAnchor:true,flatTerrain:true,collisionQualified:true,fireClearanceQualified:true,overlapsExisting:false};
 assert.equal(canPlaceFireGatheringFeature(good),true);
 for(const key of ['owned','hasOutdoorAnchor','flatTerrain','collisionQualified','fireClearanceQualified'])assert.equal(canPlaceFireGatheringFeature({...good,[key]:false}),false,key);
 assert.equal(canPlaceFireGatheringFeature({...good,overlapsExisting:true}),false);
 assert.equal(canPlaceFireGatheringFeature({...good,id:'forged'}),false);
 assert.equal(canPlaceFireGatheringFeature(),false);
});
test('distribution build includes the imported catalogue',()=>{
 const script=readFileSync(fileURLToPath(new URL('../scripts/build.mjs',import.meta.url)),'utf8');
 assert.ok(script.includes("'fire-gathering-catalogue.js'"));
});
