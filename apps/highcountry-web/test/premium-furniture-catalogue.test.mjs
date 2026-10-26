import test from 'node:test';
import assert from 'node:assert/strict';
import {premiumFurnitureCatalogue,getPremiumFurniture,canPlacePremiumFurniture} from '../src/premium-furniture-catalogue.js';
test('HC-ART-02-G defines twelve regional premium assets with proper paths and footprints',()=>{
 assert.equal(premiumFurnitureCatalogue.length,12);
 assert.equal(new Set(premiumFurnitureCatalogue.map(x=>x.id)).size,12);
 for(const region of ['emerald-coast','golden-prairie','red-mesa'])assert.equal(premiumFurnitureCatalogue.filter(x=>x.region===region).length,4);
 for(const item of premiumFurnitureCatalogue){
  assert.equal(item.assetUrl,'/assets/cultivation/props/premium-comfort/'+item.region+'/'+item.id+'.png');
  assert.ok(item.footprint.width>=1&&item.footprint.height>=1);
  assert.equal(item.footprint.tileSizePx,64);
  assert.equal(item.marketplace.price,null);
  assert.equal(item.marketplace.inventoryPolicy,'authenticated-server-owned');
  assert.equal(item.marketplace.fairnessEffect,'none');
  assert.equal(getPremiumFurniture(item.id),item);
 }
});
test('placement requires ownership and unoccupied floor, without home-region restriction',()=>{
 const id='hc-prop-premium-emerald-chesterfield';
 assert.equal(canPlacePremiumFurniture({id,owned:true}),true);
 assert.equal(canPlacePremiumFurniture({id,owned:false}),false);
 assert.equal(canPlacePremiumFurniture({id,owned:true,occupied:true}),false);
 assert.equal(canPlacePremiumFurniture({id:'unknown',owned:true}),false);
 assert.equal(getPremiumFurniture(id).placement.regionRestriction,null);
});
