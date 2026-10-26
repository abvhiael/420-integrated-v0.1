import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {posterCatalogue,canPlacePoster} from '../src/poster-catalogue.js';
test('twelve canonical posters are wall-only and never collide with floor furniture',()=>{
 assert.equal(posterCatalogue.length,12);
 assert.equal(new Set(posterCatalogue.map(p=>p.id)).size,12);
 for(const p of posterCatalogue){
  assert.equal(p.placement.layer,'wall_decor');assert.equal(p.placement.requiresWallAnchor,true);
  assert.equal(p.placement.blocksMovement,false);assert.equal(p.placement.blocksFurniture,false);
  assert.equal(p.placement.allowsPlacementBehindFurniture,true);
  assert.equal(p.marketplace.price,null);
  assert.equal(p.assetUrl,'/assets/cultivation/props/interior-decorations/posters/'+p.id+'.png');
 }
});
test('wall occupancy/ownership govern poster placement independent of floor occupancy',()=>{
 const id='hc-wall-poster-underground-show';
 assert.equal(canPlacePoster({id,owned:true,hasWallAnchor:true,floorOccupied:true}),true);
 assert.equal(canPlacePoster({id,owned:true,hasWallAnchor:true,wallOccupied:true}),false);
 assert.equal(canPlacePoster({id,owned:false,hasWallAnchor:true}),false);
 assert.equal(canPlacePoster({id,owned:true,hasWallAnchor:false}),false);
 assert.equal(canPlacePoster({id:'bogus',owned:true,hasWallAnchor:true}),false);
});

test('each poster resolves to an uploaded public PNG in the checkout',()=>{
 const root=fileURLToPath(new URL('../public',import.meta.url));
 for(const p of posterCatalogue){
  assert.ok(existsSync(root+p.assetUrl),p.id+' must have a real uploaded PNG');
  assert.equal(p.marketplace.inventoryPolicy,'authenticated-server-owned');
  assert.equal(p.placement.wallSlotExclusive,true);
 }
});
