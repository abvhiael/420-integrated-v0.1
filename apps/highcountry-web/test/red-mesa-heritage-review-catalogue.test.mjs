import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {redMesaHeritageReviewCatalogue as all,canPlayerPlaceRedMesaHeritage} from '../src/red-mesa-heritage-review-catalogue.js';
test('all twelve uploaded Red Mesa review assets have canonical paths and dimensions',()=>{
 assert.equal(all.length,12);assert.equal(new Set(all.map(x=>x.id)).size,12);
 for(const x of all){
  assert.ok(existsSync(new URL('../public'+x.assetUrl,import.meta.url)),x.assetUrl);
  assert.equal(x.footprint.tileSizePx,64);
  assert.equal(x.artworkCanvas.width,x.footprint.width*320);
  assert.equal(x.artworkCanvas.height,x.footprint.height*320);
  assert.equal(x.assetStatus,'review-only-roster-mismatch');
  assert.equal(x.canonicalIdentityApproved,false);
  assert.equal(x.ownership.owner,'420Corp');
  assert.equal(x.placement.maximumWorldInstances,1);
  assert.equal(x.placement.assignedMap,null);
  assert.equal(x.placement.playerPlacementAllowed,false);
  assert.equal(x.marketplace.purchasable,false);
  assert.equal(x.marketplace.tradable,false);
  assert.equal(x.marketplace.visibleInPlayerMarketplace,false);
  assert.equal(x.modifiers.status,'not-applicable');
  assert.deepEqual(x.modifiers.playerBonuses,[]);
  assert.equal(canPlayerPlaceRedMesaHeritage({id:x.id,owned:true,founder:true}),false);
 }
});
