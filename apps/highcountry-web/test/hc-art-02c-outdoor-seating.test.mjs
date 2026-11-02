import test from 'node:test';import assert from 'node:assert/strict';
import {OUTDOOR_SEATING_DESIGNS,OUTDOOR_SEATING_ROOT,OUTDOOR_SEATING_VERSION,outdoorSeatingDesign,outdoorSeatingPlacement} from '../src/outdoor-seating-catalog.js';
test('HC-ART-02-C all 12 universal asset records map to verified canonical PNG URLs',()=>{
 assert.equal(OUTDOOR_SEATING_VERSION,'hc-art-02c/assets-v1');
 assert.equal(OUTDOOR_SEATING_DESIGNS.length,12);
 assert.equal(new Set(OUTDOOR_SEATING_DESIGNS.map(x=>x.id)).size,12);
 for(const item of OUTDOOR_SEATING_DESIGNS){
  assert.equal(item.sprite.src,OUTDOOR_SEATING_ROOT+item.id+'.png');
  assert.equal(item.assetStatus,'uploaded-main');assert.equal(item.marketStatus,'not-registered');
  assert.equal(item.environment,'outdoor');assert.equal(item.regions.length,3);
 }
});
test('HC-ART-02-C logical footprint, anchor, clearance and collision contracts',()=>{
 const expected={'adirondack-chair':[1,1],'patio-lounge-chair':[1,1],'chaise-lounge':[2,1],
 'patio-loveseat':[2,1],'outdoor-sofa':[3,1],'sectional-sofa':[3,2],
 'patio-dining-chair':[1,1],'patio-dining-table':[2,2],'picnic-table':[3,1],
 'fire-pit-chairs':[2,2],'porch-swing':[2,2],'hammock-stand':[3,2]};
 for(const [slug,[columns,rows]] of Object.entries(expected)){
  const id='hc-prop-furniture-'+slug,entry=outdoorSeatingDesign(id),place=outdoorSeatingPlacement(id);
  assert.deepEqual(place.footprintTiles,{columns,rows});assert.equal(place.src,entry.sprite.src);
  assert.equal(place.anchorX,.5);assert.equal(place.anchorY,1);assert.equal(place.tilePx,64);
  assert.equal(place.collision,'tile-occupancy');assert.equal(place.depth,'ground-contact-y');
 }
 for(const slug of ['fire-pit-chairs','porch-swing','hammock-stand']){
  assert.equal(outdoorSeatingPlacement('hc-prop-furniture-'+slug).clearance,'additional-clearance-review');
 }
 assert.throws(()=>outdoorSeatingDesign('../not-valid'),/unknown-outdoor-seating-design/);
});
