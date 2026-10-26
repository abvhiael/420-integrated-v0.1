import test from 'node:test';import assert from 'node:assert/strict';
import {furnitureCondition,evaluateWorkspace,furnitureResaleEligibility,CONDITION_STATES,ARRANGEMENTS} from '../src/furniture-rules.js';
import {SEATING_DESIGNS,seatingPlacement,seatingDesign,SEATING_ART_ROOT} from '../src/seating-design-catalog.js';
test('12 HC-ART-02-A candidate designs have approved 64px logical footprints',()=>{
 assert.equal(SEATING_DESIGNS.length,12);assert.equal(new Set(SEATING_DESIGNS.map(x=>x.id)).size,12);
 for(const item of SEATING_DESIGNS){assert.ok(item.footprintTiles.columns>0&&item.footprintTiles.rows>0);assert.equal(item.marketStatus,'not-registered');assert.equal(item.assetStatus,'uploaded-main');assert.equal(item.placement.tilePx,64);assert.equal(item.placement.anchorY,1);assert.equal(item.placement.collision,'tile-occupancy');assert.equal(item.sprite.src,SEATING_ART_ROOT+item.id+'.png');}
 assert.deepEqual(SEATING_DESIGNS.find(x=>x.id.endsWith('salvaged-sectional-sofa')).footprintTiles,{columns:3,rows:2});
});
test('wear, repair and provenance are distinct and bounded',()=>{
 assert.deepEqual(CONDITION_STATES,['secondhand','used','good','restored','heirloom']);
 assert.equal(furnitureCondition({wear:70}),'secondhand');assert.equal(furnitureCondition({wear:40}),'used');
 assert.equal(furnitureCondition({wear:10,restored:true}),'restored');assert.equal(furnitureCondition({wear:5,heirloom:true}),'heirloom');
 assert.throws(()=>furnitureCondition({wear:101}),/invalid-furniture-wear/);
});
test('complete arrangements contribute bounded bonuses and reserved props do not count',()=>{
 const items=[{tag:'couch',tags:['seating'],comfort:8,placed:true},{tag:'table',tags:['table'],comfort:2,placed:true},{tag:'light',tags:['lighting'],comfort:1,placed:true},{tag:'rug',tags:['rug'],comfort:1,placed:true}];
 const a=evaluateWorkspace({environment:'indoor',items});assert.ok(a.arrangements.includes('break-corner'));assert.ok(a.arrangements.includes('grower-lounge'));assert.ok(a.modifiers.comfort<=20);
 const reserved=evaluateWorkspace({environment:'indoor',items:items.map(x=>({...x,reserved:true}))});assert.deepEqual(reserved.arrangements,[]);assert.equal(reserved.modifiers.comfort,0);
 assert.equal(Object.keys(ARRANGEMENTS).length,6);
});
test('resale requires off-floor unlocked verified instance and server execution',()=>{
 assert.deepEqual(furnitureResaleEligibility({instanceId:'item1',ownerId:'owner1',placed:true}).reason,'unplace-before-listing');
 assert.equal(furnitureResaleEligibility({instanceId:'item1',ownerId:'owner1',placed:false}).eligible,true);
 assert.equal(furnitureResaleEligibility({instanceId:'item1',ownerId:'owner1',reserved:true}).eligible,false);
 assert.equal(furnitureResaleEligibility({instanceId:'item1',ownerId:'owner1',bound:true}).eligible,false);
 assert.equal(furnitureResaleEligibility({instanceId:'item1',ownerId:'owner1'}).requiresServerSettlement,true);
});

test('all seating assets have stable render src and bounded logical placement geometry',()=>{
 for(const item of SEATING_DESIGNS){
  const place=seatingPlacement(item.id);assert.equal(place.src,item.sprite.src);
  assert.equal(place.anchorX,.5);assert.equal(place.anchorY,1);assert.equal(place.tilePx,64);
  assert.deepEqual(place.footprintTiles,item.footprintTiles);
  assert.equal(seatingDesign(item.id),item);
 }
 assert.throws(()=>seatingDesign('../bad'),/unknown-seating-design/);
 assert.throws(()=>seatingPlacement('../bad'),/unknown-seating-design/);
});
