import test from 'node:test';
import assert from 'node:assert/strict';
import {SUPPORT_CATALOG,SUPPORT_CATALOG_VERSION,SUPPORT_TILE_SIZE,supportAsset,supportPlacement} from '../src/support-catalog.js';
test('HC-ART-01-A canonical universal and regional catalog',()=>{
 assert.equal(SUPPORT_CATALOG_VERSION,'hc-art-01a/v1');assert.equal(SUPPORT_TILE_SIZE,64);
 assert.equal(SUPPORT_CATALOG.length,11);
 assert.equal(SUPPORT_CATALOG.filter(x=>x.region==='universal').length,8);
 assert.equal(new Set(SUPPORT_CATALOG.map(x=>x.id)).size,11);
 for(const a of SUPPORT_CATALOG){
  for(const [layer,path] of Object.entries(a.paths)){
   assert.match(path,/^\/assets\/cultivation\/props\/trellises-supports\/(universal|emerald-coast|golden-prairie|red-mesa)\/hc-prop-support-[a-z-]+\.png$/);
   assert.equal(path.split('/').at(-1),a.files[layer]);
  }
  assert.ok(['ground','plant','container'].includes(a.anchor));
 }
});
test('split layered cages and teepee use exact canonical PNG paths',()=>{
 for(const id of ['teepee-bamboo','cage-tomato-small','cage-tomato-tall','cage-cone']){
  const x=supportAsset('hc-prop-support-'+id);
  assert.equal(x.layering,'split');assert.equal(Object.keys(x.paths).length,3);
  assert.match(x.paths.front,/-front\.png$/);assert.match(x.paths.back,/-back\.png$/);
 }
});
test('parent attachments do not occupy extra tiles; ground teepee occupies 1x1',()=>{
 const attached=supportPlacement('hc-prop-support-cage-tomato-small',{parentId:'verified-pot'});
 assert.deepEqual(attached.footprintTiles,{columns:0,rows:0});assert.equal(attached.parentId,'verified-pot');
 assert.throws(()=>supportPlacement('hc-prop-support-cage-tomato-small'),/support-attachment-required/);
 const floor=supportPlacement('hc-prop-support-teepee-bamboo');
 assert.deepEqual(floor.footprintTiles,{columns:1,rows:1});assert.deepEqual(floor.spriteAnchor,{x:.5,y:1});
 assert.throws(()=>supportAsset('unknown'),/unknown-support-asset/);
});
