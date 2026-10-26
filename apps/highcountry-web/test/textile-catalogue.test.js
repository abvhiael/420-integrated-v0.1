import test from 'node:test';
import assert from 'node:assert/strict';
import {textileCatalogue,getTextileAsset,canPlaceTextile} from '../src/textile-catalogue.js';
test('HC-ART-02-E canonical ten assets have unique public paths and tile footprints',()=>{
 assert.equal(textileCatalogue.length,10);
 assert.equal(new Set(textileCatalogue.map(x=>x.id)).size,10);
 for(const asset of textileCatalogue){
  assert.equal(asset.assetUrl,'/assets/furnishings/02-e-rugs-textiles/'+asset.id+'.png');
  assert.ok(asset.footprint.width>=1&&asset.footprint.height>=1);
  assert.equal(asset.marketplace.suggestedPrice,null);
  assert.equal(asset.marketplace.listingPolicy,'authenticated-inventory-only');
  assert.equal(getTextileAsset(asset.id),asset);
 }
});
test('rugs are nonblocking floor overlays, with furniture allowed above',()=>{
 const rugs=textileCatalogue.filter(x=>x.placement.layer==='floor_overlay');
 assert.equal(rugs.length,4);
 for(const rug of rugs){
  assert.equal(rug.placement.blocksFurniture,false);
  assert.equal(rug.placement.blocksMovement,false);
  assert.equal(rug.placement.renderBelowFurniture,true);
  assert.equal(rug.placement.stackableWithFurniture,true);
  assert.equal(canPlaceTextile({id:rug.id,existing:[{layer:'furniture'}]}),true);
  assert.equal(canPlaceTextile({id:rug.id,existing:[{layer:'floor_overlay'}]}),false);
 }
});
test('wall furnishings and furniture accessories demand matching anchor',()=>{
 assert.equal(canPlaceTextile({id:'textile_botanical_tapestry',anchor:'furniture'}),false);
 assert.equal(canPlaceTextile({id:'textile_botanical_tapestry',anchor:'wall'}),true);
 assert.equal(canPlaceTextile({id:'textile_chunky_knit_throw',anchor:'wall'}),false);
 assert.equal(canPlaceTextile({id:'textile_chunky_knit_throw',anchor:'furniture'}),true);
 assert.equal(canPlaceTextile({id:'not-found'}),false);
});
