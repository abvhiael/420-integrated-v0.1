import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {mountedDecorCatalogue,canPlaceMountedDecor} from '../src/mounted-decor-catalogue.js';
test('twelve real uploaded canonical mounted decorations, correct wall footprints and no price grants',()=>{
 const root=fileURLToPath(new URL('../public',import.meta.url));
 assert.equal(mountedDecorCatalogue.length,12);
 assert.equal(new Set(mountedDecorCatalogue.map(x=>x.id)).size,12);
 for(const item of mountedDecorCatalogue){
  assert.ok(existsSync(root+item.assetUrl),'missing PNG '+item.id);
  assert.equal(item.placement.layer,'wall_decor');
  assert.equal(item.placement.requiresWallAnchor,true);
  assert.equal(item.placement.wallSlotExclusive,true);
  assert.equal(item.placement.blocksMovement,false);
  assert.equal(item.placement.blocksFurniture,false);
  assert.equal(item.marketplace.price,null);
  assert.equal(item.marketplace.inventoryPolicy,'authenticated-server-owned');
  assert.equal(item.marketplace.fairnessEffect,'none');
  assert.equal(item.footprint.tileSizePx,64);
 }
 assert.equal(mountedDecorCatalogue.find(x=>x.id==='hc-wall-decor-homestead-key-rack').footprint.width,2);
 assert.equal(mountedDecorCatalogue.find(x=>x.id==='hc-wall-decor-heritage-candle-sconce').footprint.height,2);
});
test('mounted decor must be owned and wall-anchored with unoccupied wall slot',()=>{
 const id='hc-wall-decor-heritage-oak-clock';
 assert.equal(canPlaceMountedDecor({id,owned:true,hasWallAnchor:true}),true);
 assert.equal(canPlaceMountedDecor({id,owned:false,hasWallAnchor:true}),false);
 assert.equal(canPlaceMountedDecor({id,owned:true,hasWallAnchor:false}),false);
 assert.equal(canPlaceMountedDecor({id,owned:true,hasWallAnchor:true,wallOccupied:true}),false);
 assert.equal(canPlaceMountedDecor({id:'fake',owned:true,hasWallAnchor:true}),false);
});
