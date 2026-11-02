import test from 'node:test';import assert from 'node:assert/strict';
import {GREENHOUSE_LOUNGE_DESIGNS,GREENHOUSE_LOUNGE_ROOT,GREENHOUSE_LOUNGE_VERSION,greenhouseLoungeDesign,greenhouseLoungePlacement} from '../src/greenhouse-lounge-catalog.js';
test('HC-ART-02-B all 10 uploaded universal assets have canonical paths',()=>{
 assert.equal(GREENHOUSE_LOUNGE_VERSION,'hc-art-02b/assets-v1');
 assert.equal(GREENHOUSE_LOUNGE_DESIGNS.length,10);
 assert.equal(new Set(GREENHOUSE_LOUNGE_DESIGNS.map(x=>x.id)).size,10);
 for(const asset of GREENHOUSE_LOUNGE_DESIGNS){
  assert.equal(asset.sprite.src,GREENHOUSE_LOUNGE_ROOT+asset.id+'.png');
  assert.equal(asset.assetStatus,'uploaded-main');assert.equal(asset.marketStatus,'not-registered');
  assert.deepEqual(asset.regions,['emerald-coast','golden-prairie','red-mesa']);
  assert.equal(asset.environment,'greenhouse');
 }
});
test('HC-ART-02-B footprints and parent-independent floor placement remain 64px',()=>{
 const cases={'papasan-chair':[2,2],'wicker-egg-chair':[2,2],'double-hanging-egg-chair':[3,2],
 'wicker-loveseat':[2,1],'rattan-armchair':[1,1],'folding-teak-chair':[1,1],
 'cedar-garden-bench':[2,1],'greenhouse-reading-chair':[1,1],'hammock-chair-stand':[2,2],
 'wicker-footstool':[1,1]};
 for(const [slug,[columns,rows]] of Object.entries(cases)){
  const id='hc-prop-furniture-'+slug,item=greenhouseLoungeDesign(id),place=greenhouseLoungePlacement(id);
  assert.deepEqual(place.footprintTiles,{columns,rows});assert.equal(item.placement.tilePx,64);
  assert.equal(place.anchorX,.5);assert.equal(place.anchorY,1);
  assert.equal(place.collision,'tile-occupancy');assert.equal(place.src,item.sprite.src);
 }
 assert.equal(greenhouseLoungePlacement('hc-prop-furniture-hammock-chair-stand').clearance,'swing-clearance-check');
 assert.throws(()=>greenhouseLoungePlacement('../evil'),/unknown-greenhouse-lounge-design/);
});
