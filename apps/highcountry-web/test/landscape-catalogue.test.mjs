import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {landscapeCatalogue,getLandscapeAsset,canPlaceLandscapeAsset} from '../src/landscape-catalogue.js';
const root=fileURLToPath(new URL('../public',import.meta.url));
test('twelve canonical landscape files and versioned tile footprints',()=>{
 assert.equal(landscapeCatalogue.length,12);
 assert.equal(new Set(landscapeCatalogue.map(a=>a.id)).size,12);
 const types=new Set;
 for(const asset of landscapeCatalogue){
  const path=root+asset.assetUrl;assert.ok(existsSync(path),'missing asset '+path);
  assert.equal(readFileSync(path).subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.ok(asset.footprint.width>=1&&asset.footprint.width<=3);
  assert.ok(asset.footprint.height>=1&&asset.footprint.height<=2);
  assert.equal(asset.footprint.tileSizePx,64);types.add(asset.placementSubtype);
  assert.equal(asset.placement.placementWithoutValidation,'deny');assert.equal(asset.placement.connectivityStatus,'unqualified');
  assert.equal(asset.placement.parcelAccessEffect,'none');assert.equal(asset.placement.roadNetworkEffect,'none');
  assert.equal(asset.placement.cultivationEffect,'none');assert.equal(asset.marketplace.currency,'BUDS');
  assert.equal(asset.marketplace.price,null);assert.equal(asset.marketplace.inventoryPolicy,'authenticated-server-owned');
  assert.equal(getLandscapeAsset(asset.id),asset);
 }
 assert.deepEqual([...types].sort(),['ground_ornament','landscape_border','outdoor_path']);
});
test('unqualified outdoor anchors, terrain, collision or ownership fail closed',()=>{
 const valid={id:landscapeCatalogue[0].id,owned:true,hasOutdoorAnchor:true,terrainQualified:true,collisionQualified:true,overlapsExisting:false};
 assert.equal(canPlaceLandscapeAsset(valid),true);
 for(const key of ['owned','hasOutdoorAnchor','terrainQualified','collisionQualified'])assert.equal(canPlaceLandscapeAsset({...valid,[key]:false}),false,key);
 assert.equal(canPlaceLandscapeAsset({...valid,overlapsExisting:true}),false);
 assert.equal(canPlaceLandscapeAsset({...valid,id:'unknown'}),false);
 assert.equal(canPlaceLandscapeAsset(),false);
});
test('browser source list includes landscape catalogue',()=>{
 const script=readFileSync(fileURLToPath(new URL('../scripts/build.mjs',import.meta.url)),'utf8');
 assert.ok(script.includes("'landscape-catalogue.js'"));
});
