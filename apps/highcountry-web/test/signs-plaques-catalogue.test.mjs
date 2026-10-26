import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {signsPlaquesCatalogue,canPlaceSignPlaque} from '../src/signs-plaques-catalogue.js';
test('all twelve uploaded signs have canonical image paths and safe wall metadata',()=>{
 assert.equal(signsPlaquesCatalogue.length,12);
 assert.equal(new Set(signsPlaquesCatalogue.map(x=>x.id)).size,12);
 const root=fileURLToPath(new URL('../public',import.meta.url));
 for(const item of signsPlaquesCatalogue){
  assert.ok(existsSync(root+item.assetUrl),'missing PNG '+item.id);
  assert.equal(item.placement.layer,'wall_decor');
  assert.equal(item.placement.blocksMovement,false);
  assert.equal(item.placement.blocksFurniture,false);
  assert.equal(item.placement.requiresWallAnchor,true);
  assert.equal(item.marketplace.price,null);
  assert.equal(item.marketplace.inventoryPolicy,'authenticated-server-owned');
  assert.equal(item.footprint.tileSizePx,64);
 }
 assert.deepEqual(signsPlaquesCatalogue.at(-1).footprint,{width:1,height:2,tileSizePx:64});
});
test('wall ownership, anchoring and occupancy apply independently from floor furniture',()=>{
 const id='hc-wall-sign-seed-company';
 assert.equal(canPlaceSignPlaque({id,owned:true,hasWallAnchor:true}),true);
 assert.equal(canPlaceSignPlaque({id,owned:false,hasWallAnchor:true}),false);
 assert.equal(canPlaceSignPlaque({id,owned:true,hasWallAnchor:false}),false);
 assert.equal(canPlaceSignPlaque({id,owned:true,hasWallAnchor:true,wallOccupied:true}),false);
 assert.equal(canPlaceSignPlaque({id:'unknown',owned:true,hasWallAnchor:true}),false);
});
