import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {recreationCatalogue,getRecreationAsset,canPlaceRecreationAsset} from '../src/recreation-catalogue.js';
const root=fileURLToPath(new URL('../public',import.meta.url));
test('12 recreation PNGs, canonical footprints and server-controlled marketplace metadata',()=>{
 assert.equal(recreationCatalogue.length,12);
 assert.equal(new Set(recreationCatalogue.map(a=>a.id)).size,12);
 for(const a of recreationCatalogue){
  const path=root+a.assetUrl;assert.ok(existsSync(path),'missing asset '+path);
  const buf=readFileSync(path);assert.equal(buf.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(a.assetUrl,'/assets/cultivation/props/outdoor-leisure/04-f-recreation-relaxation/'+a.id+'.png');
  assert.ok(a.footprint.width>=1&&a.footprint.width<=3);
  assert.ok(a.footprint.height>=1&&a.footprint.height<=3);
  assert.equal(a.footprint.tileSizePx,64);assert.equal(a.placement.layer,'outdoor_recreation');
  assert.equal(a.placement.requiresInteractionClearanceValidation,true);
  assert.equal(a.placement.placementWithoutValidation,'deny');
  assert.equal(a.placement.activityStatus,'not-enabled');assert.equal(a.placement.cultivationEffect,'none');
  assert.equal(a.marketplace.currency,'BUDS');assert.equal(a.marketplace.price,null);
  assert.equal(a.marketplace.inventoryPolicy,'authenticated-server-owned');assert.equal(getRecreationAsset(a.id),a);
 }
});
test('placement preflight fails closed on missing ownership, collision, terrain and interaction clearance',()=>{
 const good={id:recreationCatalogue[0].id,owned:true,hasOutdoorAnchor:true,terrainQualified:true,collisionQualified:true,interactionClearanceQualified:true,overlapsExisting:false};
 assert.equal(canPlaceRecreationAsset(good),true);
 for(const k of ['owned','hasOutdoorAnchor','terrainQualified','collisionQualified','interactionClearanceQualified'])assert.equal(canPlaceRecreationAsset({...good,[k]:false}),false,k);
 assert.equal(canPlaceRecreationAsset({...good,overlapsExisting:true}),false);
 assert.equal(canPlaceRecreationAsset({...good,id:'forged'}),false);
 assert.equal(canPlaceRecreationAsset(),false);
});
test('static browser bundle includes the new module',()=>{
 const script=readFileSync(fileURLToPath(new URL('../scripts/build.mjs',import.meta.url)),'utf8');
 assert.ok(script.includes("'recreation-catalogue.js'"));
});
