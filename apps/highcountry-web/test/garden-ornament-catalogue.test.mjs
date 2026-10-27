import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {gardenOrnamentCatalogue,getGardenOrnament,canPlaceGardenOrnament} from '../src/garden-ornament-catalogue.js';
const root=fileURLToPath(new URL('../public',import.meta.url));
test('canonical assets, tile footprints, cosmetic and server-owned marketplace metadata',()=>{
 assert.equal(gardenOrnamentCatalogue.length,12);
 assert.equal(new Set(gardenOrnamentCatalogue.map(x=>x.id)).size,12);
 for(const asset of gardenOrnamentCatalogue){
  assert.equal(asset.assetUrl,'/assets/cultivation/props/outdoor-leisure/04-d-garden-ornaments/'+asset.id+'.png');
  const path=root+asset.assetUrl;assert.ok(existsSync(path),'missing '+path);
  const buf=readFileSync(path);assert.equal(buf.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.ok(asset.footprint.width>=1&&asset.footprint.width<=2);
  assert.ok(asset.footprint.height>=1&&asset.footprint.height<=2);
  assert.equal(asset.footprint.tileSizePx,64);
  assert.equal(asset.placement.layer,'outdoor_decor');assert.equal(asset.placement.placementWithoutValidation,'deny');
  assert.equal(asset.placement.requiresCollisionValidation,true);
  assert.equal(asset.placement.gameplayEffect,'none');assert.equal(asset.placement.regionRestriction,null);
  assert.equal(asset.marketplace.currency,'BUDS');assert.equal(asset.marketplace.price,null);
  assert.equal(asset.marketplace.inventoryPolicy,'authenticated-server-owned');assert.equal(getGardenOrnament(asset.id),asset);
 }
});
test('placement guard denies unqualified ownership, terrain, anchors, collisions and overlap',()=>{
 const good={id:gardenOrnamentCatalogue[0].id,owned:true,hasOutdoorAnchor:true,flatTerrain:true,collisionQualified:true,overlapsExisting:false};
 assert.equal(canPlaceGardenOrnament(good),true);
 for(const k of ['owned','hasOutdoorAnchor','flatTerrain','collisionQualified'])assert.equal(canPlaceGardenOrnament({...good,[k]:false}),false,k);
 assert.equal(canPlaceGardenOrnament({...good,overlapsExisting:true}),false);
 assert.equal(canPlaceGardenOrnament({...good,id:'unregistered'}),false);
 assert.equal(canPlaceGardenOrnament(),false);
});
test('browser build includes new catalogue module',()=>{
 const script=readFileSync(fileURLToPath(new URL('../scripts/build.mjs',import.meta.url)),'utf8');
 assert.ok(script.includes("'garden-ornament-catalogue.js'"));
});
