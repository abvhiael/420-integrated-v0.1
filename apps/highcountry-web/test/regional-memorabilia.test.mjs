import test from 'node:test';
import assert from 'node:assert/strict';
import {regionalMemorabiliaCatalogue as assets,canPlaceRegionalMemorabilia as canPlace} from '../src/regional-memorabilia-catalogue.js';
test('HC-ART-03-F cosmetic registry integrity',()=>{
 assert.equal(assets.length,12);
 assert.equal(new Set(assets.map(x=>x.id)).size,12);
 for(const region of ['emerald-coast','golden-prairie','red-mesa'])assert.equal(assets.filter(x=>x.region===region).length,4);
 for(const x of assets){
  assert.equal(x.assetUrl.endsWith(x.id+'.png'),true);
  assert.equal(x.footprint.tileSizePx,64);
  assert.equal(x.marketplace.currency,'BUDS');
  assert.equal(x.marketplace.price,null);
  assert.equal(x.marketplace.inventoryPolicy,'authenticated-server-owned');
  assert.equal(canPlace({id:x.id,surface:x.placement.surface}),false);
  assert.equal(canPlace({id:x.id,owned:true,occupied:true,surface:x.placement.surface}),false);
  assert.equal(canPlace({id:x.id,owned:true,surface:x.placement.surface}),true);
 }
});
