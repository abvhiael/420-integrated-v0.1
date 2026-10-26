import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {outdoorStructureCatalogue,canPlaceOutdoorStructure} from '../src/outdoor-structure-catalogue.js';
test('all twelve structural assets resolve with canonical 64px footprints',()=>{
 const root=fileURLToPath(new URL('../public',import.meta.url));
 assert.equal(outdoorStructureCatalogue.length,12);
 assert.equal(new Set(outdoorStructureCatalogue.map(x=>x.id)).size,12);
 for(const x of outdoorStructureCatalogue){
  assert.ok(existsSync(root+x.assetUrl),'missing PNG '+x.id);
  assert.ok(x.footprint.width>=2&&x.footprint.width<=4);
  assert.ok(x.footprint.height>=2&&x.footprint.height<=4);
  assert.equal(x.footprint.tileSizePx,64);
  assert.equal(x.placement.layer,'outdoor_structure');
  assert.equal(x.placement.collisionMaskStatus,'pending-qualified-geometry');
  assert.equal(x.placement.placementWithoutCollisionMask,'deny');
  assert.equal(x.placement.regionRestriction,null);
  assert.equal(x.marketplace.price,null);
  assert.equal(x.marketplace.inventoryPolicy,'authenticated-server-owned');
 }
});
test('placement fails closed on missing ownership, terrain, anchor, collision proof or free space',()=>{
 const id='hc-outdoor-structure-cedar-pergola';
 const ok={id,owned:true,hasOutdoorAnchor:true,flatTerrain:true,collisionMaskQualified:true,overlapsExisting:false};
 assert.equal(canPlaceOutdoorStructure(ok),true);
 for(const key of ['owned','hasOutdoorAnchor','flatTerrain','collisionMaskQualified'])assert.equal(canPlaceOutdoorStructure({...ok,[key]:false}),false);
 assert.equal(canPlaceOutdoorStructure({...ok,overlapsExisting:true}),false);
 assert.equal(canPlaceOutdoorStructure({...ok,id:'not-an-asset'}),false);
});
