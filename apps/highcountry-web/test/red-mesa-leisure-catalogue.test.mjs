import test from 'node:test';
import assert from 'node:assert/strict';
import {redMesaLeisureCatalogue,canPlaceRedMesaLeisureBuilding,getRedMesaLeisureBuilding} from '../src/red-mesa-leisure-catalogue.js';

test('six canonical Red Mesa buildings have unique assets and locked dimensions',()=>{
 assert.equal(redMesaLeisureCatalogue.length,6);
 assert.equal(new Set(redMesaLeisureCatalogue.map(x=>x.id)).size,6);
 assert.equal(new Set(redMesaLeisureCatalogue.map(x=>x.assetUrl)).size,6);
 for(const x of redMesaLeisureCatalogue){
  assert.equal(x.region,'red-mesa');
  assert.equal(x.footprint.tileSizePx,64);
  assert.equal(x.artworkCanvas.width,x.footprint.width*320);
  assert.equal(x.artworkCanvas.height,x.footprint.height*320);
  assert.match(x.assetUrl,/^\/assets\/structures\/hc-art-05-e\/red-mesa\/hc-structure-[a-z-]+\.png$/);
  assert.equal(x.marketplace.currency,'BUDS');
  assert.equal(x.marketplace.price,null);
  assert.equal(x.marketplace.noClientPurchaseOrIssuance,true);
  assert.equal(x.placement.placementWithoutCollisionMask,'deny');
  assert.equal(x.bonuses.serverAuthorityRequired,true);
  assert.equal(x.bonuses.primary.amount,null);
  assert.equal(x.bonuses.secondary.amount,null);
  for(const key of ['directHarvestYield','geneticRarity','strainQuality','craftModifiers','directTokenRewards'])assert.equal(x.bonuses[key],false);
 }
 assert.deepEqual(redMesaLeisureCatalogue.map(x=>x.footprint.width),[6,6,5,6,6,5]);
 assert.deepEqual(redMesaLeisureCatalogue.map(x=>x.footprint.height),[5,5,4,5,5,4]);
});
test('placement fails closed for unqualified, unauthorized, unowned or blocked buildings',()=>{
 const id=redMesaLeisureCatalogue[0].id;
 const ok={id,region:'red-mesa',owned:true,serverAuthorized:true,hasGroundAnchor:true,flatTerrain:true,collisionMaskQualified:true,entranceQualified:true,overlapsExisting:false};
 assert.equal(canPlaceRedMesaLeisureBuilding(ok),true);
 for(const field of ['owned','serverAuthorized','hasGroundAnchor','flatTerrain','collisionMaskQualified','entranceQualified'])
  assert.equal(canPlaceRedMesaLeisureBuilding({...ok,[field]:false}),false,field);
 assert.equal(canPlaceRedMesaLeisureBuilding({...ok,region:'golden-prairie'}),false);
 assert.equal(canPlaceRedMesaLeisureBuilding({...ok,overlapsExisting:true}),false);
 assert.equal(canPlaceRedMesaLeisureBuilding({...ok,id:'invalid'}),false);
 assert.equal(getRedMesaLeisureBuilding(id)?.regionalId,'RM01');
});
