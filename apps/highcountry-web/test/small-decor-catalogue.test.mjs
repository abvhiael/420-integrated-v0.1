import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {smallDecorCatalogue,canPlaceSmallDecor} from '../src/small-decor-catalogue.js';
test('all twelve small decorations are uploaded, 1x1 and server-authoritative',()=>{
 assert.equal(smallDecorCatalogue.length,12);
 assert.equal(new Set(smallDecorCatalogue.map(x=>x.id)).size,12);
 const root=fileURLToPath(new URL('../public',import.meta.url));
 for(const item of smallDecorCatalogue){
  assert.ok(existsSync(root+item.assetUrl),'missing image '+item.id);
  assert.deepEqual(item.footprint,{width:1,height:1,tileSizePx:64});
  assert.equal(item.placement.layer,'tabletop_decor');
  assert.equal(item.placement.requiresSurfaceAnchor,true);
  assert.equal(item.placement.surfaceSlotExclusive,true);
  assert.equal(item.placement.blocksMovement,false);
  assert.equal(item.placement.blocksFurniture,false);
  assert.equal(item.marketplace.price,null);
  assert.equal(item.marketplace.inventoryPolicy,'authenticated-server-owned');
  assert.equal(item.marketplace.fairnessEffect,'none');
 }
});
test('attachment placement requires verified ownership and a vacant compatible surface slot',()=>{
 const id='hc-decor-wildflower-ceramic-vase';
 assert.equal(canPlaceSmallDecor({id,owned:true,hasSurfaceAnchor:true}),true);
 assert.equal(canPlaceSmallDecor({id,owned:false,hasSurfaceAnchor:true}),false);
 assert.equal(canPlaceSmallDecor({id,owned:true,hasSurfaceAnchor:false}),false);
 assert.equal(canPlaceSmallDecor({id,owned:true,hasSurfaceAnchor:true,surfaceOccupied:true}),false);
 assert.equal(canPlaceSmallDecor({id:'unknown',owned:true,hasSurfaceAnchor:true}),false);
});
