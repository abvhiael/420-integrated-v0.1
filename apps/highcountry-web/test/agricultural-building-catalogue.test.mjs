import test from 'node:test';
import assert from 'node:assert/strict';
import {agriculturalBuildingCatalogue as all,canPlaceAgriculturalBuilding} from '../src/agricultural-building-catalogue.js';
test('HC-ART-05-D 52 unique building identities and safe catalogue policies',()=>{
 assert.equal(all.length,52);assert.equal(new Set(all.map(x=>x.id)).size,52);
 for(const region of ['universal','emerald-coast','golden-prairie','red-mesa'])assert.equal(all.filter(x=>x.originRegion===region).length,region==='universal'?16:12);
 for(const x of all){assert.equal(x.footprint.tileSizePx,64);assert.equal(x.footprint.sourcePixelsPerTile,320);assert.equal(x.marketplace.currency,'BUDS');assert.equal(x.marketplace.price,null);assert.equal(x.marketplace.inventoryPolicy,'authenticated-server-owned');assert.equal(x.placement.placementWithoutCollisionMask,'deny');assert.equal(x.capability.noPassiveYield,true);assert.match(x.assetUrl,/^\/assets\/structures\/hc-art-05-d\//);}
});
test('HC-PLACE authorization and qualification gating is fail-closed',()=>{
 const id=all.find(x=>x.originRegion==='red-mesa').id;
 const ok={id,owned:true,parcelAuthorized:true,geometryQualified:true,region:'red-mesa',overlapsExisting:false};
 assert.equal(canPlaceAgriculturalBuilding(ok),true);
 for(const k of ['owned','parcelAuthorized','geometryQualified'])assert.equal(canPlaceAgriculturalBuilding({...ok,[k]:false}),false);
 assert.equal(canPlaceAgriculturalBuilding({...ok,region:'emerald-coast'}),false);
 assert.equal(canPlaceAgriculturalBuilding({...ok,overlapsExisting:true}),false);
 assert.equal(canPlaceAgriculturalBuilding({...ok,id:'missing'}),false);
});
