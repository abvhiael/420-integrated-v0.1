import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {waterWildlifeCatalogue,canPlaceWaterWildlifeFeature} from '../src/water-wildlife-catalogue.js';
const root=fileURLToPath(new URL('../public',import.meta.url));
test('all 12 water and wildlife PNGs exist and are PNG files with approved footprints',()=>{
 assert.equal(waterWildlifeCatalogue.length,12);
 assert.equal(new Set(waterWildlifeCatalogue.map(a=>a.id)).size,12);
 for(const asset of waterWildlifeCatalogue){
  const path=root+asset.assetUrl;
  assert.ok(existsSync(path),'missing PNG '+path);
  assert.equal(readFileSync(path).subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.ok(asset.footprint.width>=1&&asset.footprint.width<=3);
  assert.ok(asset.footprint.height>=1&&asset.footprint.height<=3);
  assert.equal(asset.footprint.tileSizePx,64);
  assert.equal(asset.placement.layer,'outdoor_feature');
  assert.equal(asset.placement.placementWithoutValidation,'deny');
  assert.equal(asset.placement.resourceEffect,'none');
  assert.equal(asset.placement.cultivationEffect,'none');
  assert.equal(asset.marketplace.currency,'BUDS');
  assert.equal(asset.marketplace.price,null);
  assert.equal(asset.marketplace.inventoryPolicy,'authenticated-server-owned');
 }
});
test('client placement preflight rejects missing ownership, anchor, collision and water-edge clearance',()=>{
 const pond={id:'hc-outdoor-water-lily-dragonfly-pond',owned:true,hasOutdoorAnchor:true,flatTerrain:true,collisionQualified:true,waterEdgeQualified:true,overlapsExisting:false};
 assert.equal(canPlaceWaterWildlifeFeature(pond),true);
 for(const key of ['owned','hasOutdoorAnchor','flatTerrain','collisionQualified','waterEdgeQualified'])assert.equal(canPlaceWaterWildlifeFeature({...pond,[key]:false}),false,key);
 assert.equal(canPlaceWaterWildlifeFeature({...pond,overlapsExisting:true}),false);
 assert.equal(canPlaceWaterWildlifeFeature({...pond,id:'fake'}),false);
 assert.equal(canPlaceWaterWildlifeFeature(),false);
});
test('browser build declares the catalogue module',()=>{
 const script=readFileSync(fileURLToPath(new URL('../scripts/build.mjs',import.meta.url)),'utf8');
 assert.ok(script.includes("'water-wildlife-catalogue.js'"));
});
